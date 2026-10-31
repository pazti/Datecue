const { initializeApp } = require("firebase-admin/app")
const { getAuth } = require("firebase-admin/auth")
const { getDatabase } = require("firebase-admin/database")
const { getMessaging } = require("firebase-admin/messaging")
const { onValueCreated } = require("firebase-functions/v2/database")
const { onCall, HttpsError } = require("firebase-functions/v2/https")
const { onSchedule } = require("firebase-functions/v2/scheduler")

initializeApp()

const INACTIVE_ROOM_MS = 48 * 60 * 60 * 1000

exports.cleanupInactiveRooms = onSchedule(
  { schedule: "every 24 hours", timeZone: "Etc/UTC" },
  async () => {
    const database = getDatabase()
    const directory = await database.ref("roomDirectory").get()
    const roomIds = Object.keys(directory.val() ?? {})
    const cutoff = Date.now() - INACTIVE_ROOM_MS

    for (const roomId of roomIds) {
      const roomDirectoryRef = database.ref(`roomDirectory/${roomId}`)
      const result = await roomDirectoryRef.transaction(
        (room) => {
          if (!room) return
          if (room.cleanupPending) return room
          const lastActivity = Number(room.updatedAt ?? room.createdAt ?? 0)
          if (!lastActivity || lastActivity > cutoff) return
          return { ...room, cleanupPending: true }
        },
        undefined,
        false,
      )

      if (result.committed && result.snapshot.val()?.cleanupPending) {
        await database.ref().update({
          [`rooms/${roomId}`]: null,
          [`roomDirectory/${roomId}`]: null,
        })
      }
    }
  },
)

exports.deleteAccountData = onCall(async (request) => {
  const uid = request.auth?.uid
  if (!uid) {
    throw new HttpsError(
      "unauthenticated",
      "Sign in before deleting your account.",
    )
  }

  const adminAuth = getAuth()
  const database = getDatabase()
  try {
    await adminAuth.getUser(uid)
  } catch (error) {
    if (error.code === "auth/user-not-found") {
      throw new HttpsError("not-found", "The account no longer exists.")
    }
    throw error
  }

  const directory = await database.ref("roomDirectory").get()
  const rooms = Object.entries(directory.val() ?? {})
  const updates = { [`users/${uid}`]: null }
  const roomCleanupChecks = []

  for (const [roomId, room] of rooms) {
    if (room.hostId === uid) {
      updates[`rooms/${roomId}`] = null
      updates[`roomDirectory/${roomId}`] = null
      continue
    }
    updates[`rooms/${roomId}/presence/${uid}`] = null
    updates[`rooms/${roomId}/typing/${uid}`] = null
    roomCleanupChecks.push(
      database
        .ref(`rooms/${roomId}/guestSeat`)
        .get()
        .then((seat) => {
          if (seat.val() === uid) updates[`rooms/${roomId}/guestSeat`] = null
        }),
    )
    roomCleanupChecks.push(
      database
        .ref(`rooms/${roomId}/queue`)
        .get()
        .then((queue) => {
          for (const [queueId, item] of Object.entries(queue.val() ?? {})) {
            if (item.addedBy === uid)
              updates[`rooms/${roomId}/queue/${queueId}`] = null
          }
        }),
    )
  }

  await Promise.all(roomCleanupChecks)
  await database.ref().update(updates)
  await adminAuth.deleteUser(uid)
  return { success: true }
})

exports.sendBrowserNotification = onValueCreated(
  "/users/{uid}/notifications/{notificationId}",
  async (event) => {
    const { uid } = event.params
    const notification = event.data.val()
    const database = getDatabase()
    const tokenSnapshot = await database
      .ref(`users/${uid}/notificationTokens`)
      .get()
    const tokens = Object.entries(tokenSnapshot.val() ?? {}).filter(
      ([, item]) => typeof item?.token === "string" && item.token.length > 0,
    )
    if (!tokens.length) return

    const staleTokenUpdates = []
    for (let offset = 0; offset < tokens.length; offset += 500) {
      const batch = tokens.slice(offset, offset + 500)
      const response = await getMessaging().sendEachForMulticast({
        tokens: batch.map(([, item]) => item.token),
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: {
          url: notification.roomId ? `#/room/${notification.roomId}` : "#/home",
        },
      })
      response.responses.forEach((result, index) => {
        if (
          result.error?.code === "messaging/invalid-registration-token" ||
          result.error?.code === "messaging/registration-token-not-registered"
        ) {
          staleTokenUpdates.push(
            database
              .ref(`users/${uid}/notificationTokens/${batch[index][0]}`)
              .remove(),
          )
        }
      })
    }
    await Promise.all(staleTokenUpdates)
  },
)
