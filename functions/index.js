const { initializeApp } = require("firebase-admin/app")
const { getDatabase } = require("firebase-admin/database")
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