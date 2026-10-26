import {
  ref,
  set,
  get,
  update,
  remove,
  runTransaction,
} from "firebase/database"
import { realtimeDatabase } from "./firebase"
import { youtubeVideoIdFromUrl } from "./youtube"

export interface RoomStats {
  totalWatchTime: number
  messagesCount: number
  reactionsCount: number
}

export async function createRoom(
  roomId: string,
  hostId: string,
  movieUrl: string,
  title = "YouTube video",
) {
  const now = Date.now()
  const metadata = { hostId, movieUrl, title, createdAt: now, updatedAt: now }
  return update(ref(realtimeDatabase), {
    [`rooms/${roomId}`]: {
      ...metadata,
      members: { [hostId]: true },
      public: metadata,
    },
    [`roomDirectory/${roomId}`]: metadata,
  })
}

export async function joinRoom(roomId: string, userId: string) {
  const directory = await get(ref(realtimeDatabase, `roomDirectory/${roomId}`))
  const room = directory.val()
  const updatedAt = Number(room?.updatedAt ?? room?.createdAt ?? 0)
  if (!directory.exists() || !room?.movieUrl || room.cleanupPending || Date.now() - updatedAt > 48 * 60 * 60 * 1000) {
    throw new Error("ROOM_EXPIRED")
  }
  await set(ref(realtimeDatabase, `rooms/${roomId}/members/${userId}`), true)
  const membership = await get(ref(realtimeDatabase, `rooms/${roomId}/members/${userId}`))
  if (membership.val() !== true) throw new Error("MEMBERSHIP_NOT_CONFIRMED")
  return room
}

export async function saveUserProfile(userId: string, displayName: string) {
  return update(ref(realtimeDatabase, `users/${userId}/profile`), {
    displayName: displayName.trim().slice(0, 40),
    updatedAt: Date.now(),
  })
}

export async function recordLegalAcceptance(userId: string, version: string) {
  return set(ref(realtimeDatabase, `users/${userId}/legalAcceptance`), {
    termsVersion: version,
    privacyVersion: version,
    acceptedAt: Date.now(),
  })
}

export async function getUserProfile(userId: string) {
  const snap = await get(ref(realtimeDatabase, `users/${userId}/profile`))
  return snap.val() as { displayName?: string } | null
}

export async function leaveRoom(roomId: string, userId: string) {
  return Promise.all([
    remove(ref(realtimeDatabase, `rooms/${roomId}/members/${userId}`)),
    remove(ref(realtimeDatabase, `rooms/${roomId}/presence/${userId}`)),
  ])
}

export async function getRoomData(roomId: string) {
  const snap = await get(ref(realtimeDatabase, `rooms/${roomId}`))
  return snap.val()
}

export async function updateUserStats(userId: string, watchSeconds: number) {
  const statsRef = ref(realtimeDatabase, `users/${userId}/stats`)
  return runTransaction(statsRef, (current) => ({
    ...(current ?? {}),
    watchSeconds: Math.max(0, (current?.watchSeconds ?? 0) + watchSeconds),
    lastUpdated: Date.now(),
  }))
}

export async function addToWatchHistory(
  userId: string,
  roomId: string,
  movieUrl: string,
  watchSeconds: number,
) {
  const historyRef = ref(realtimeDatabase, `users/${userId}/history/${roomId}`)
  return runTransaction(historyRef, (current) => ({
    movieUrl,
    watchedSeconds: (current?.watchedSeconds ?? 0) + watchSeconds,
    updatedAt: Date.now(),
  }))
}

export async function recordWatchSession(
  userId: string,
  roomId: string,
  movieUrl: string,
  watchSeconds: number,
  sessionId: string,
  title = "YouTube video",
) {
  const cumulativeSeconds = Math.max(0, Math.floor(watchSeconds))
  if (!Number.isFinite(cumulativeSeconds) || cumulativeSeconds <= 0) return
  const userRef = ref(realtimeDatabase, `users/${userId}`)
  const videoId = youtubeVideoIdFromUrl(movieUrl) || "video"
  const historyKey = `${roomId}_${videoId}`
  return runTransaction(userRef, (current) => {
    const user = current ?? {}
    const history = user.history ?? {}
    const previous = history[historyKey] ?? {}
    const sessions = previous.sessions ?? {}
    const previousSeconds = sessions[sessionId] ?? 0
    const addedSeconds = Math.max(0, cumulativeSeconds - previousSeconds)
    if (!addedSeconds) return user

    return {
      ...user,
      stats: {
        ...(user.stats ?? {}),
        watchSeconds: (user.stats?.watchSeconds ?? 0) + addedSeconds,
        lastUpdated: Date.now(),
      },
      history: {
        ...history,
        [historyKey]: {
          roomId,
          movieUrl,
          title,
          thumbnailUrl: (() => {
            const videoId = youtubeVideoIdFromUrl(movieUrl)
            return videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null
          })(),
          watchedSeconds: (previous.watchedSeconds ?? 0) + addedSeconds,
          updatedAt: Date.now(),
          sessions: { ...sessions, [sessionId]: cumulativeSeconds },
        },
      },
    }
  })
}
