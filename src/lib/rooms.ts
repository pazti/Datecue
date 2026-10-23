import {
  ref,
  set,
  get,
  update,
  remove,
  runTransaction,
} from "firebase/database"
import { realtimeDatabase } from "./firebase"

export interface RoomStats {
  totalWatchTime: number
  messagesCount: number
  reactionsCount: number
}

export async function createRoom(
  roomId: string,
  hostId: string,
  movieUrl: string,
) {
  const now = Date.now()
  return update(ref(realtimeDatabase), {
    [`rooms/${roomId}`]: {
      hostId,
      movieUrl,
      createdAt: now,
      updatedAt: now,
      members: { [hostId]: true },
      public: { hostId, movieUrl, createdAt: now },
    },
    [`roomDirectory/${roomId}`]: {
      hostId,
      movieUrl,
      createdAt: now,
    },
  })
}

export async function joinRoom(roomId: string, userId: string) {
  return set(ref(realtimeDatabase, `rooms/${roomId}/members/${userId}`), true)
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
) {
  const cumulativeSeconds = Math.max(0, Math.floor(watchSeconds))
  if (!Number.isFinite(cumulativeSeconds) || cumulativeSeconds <= 0) return
  const userRef = ref(realtimeDatabase, `users/${userId}`)
  return runTransaction(userRef, (current) => {
    const user = current ?? {}
    const history = user.history ?? {}
    const previous = history[roomId] ?? {}
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
        [roomId]: {
          movieUrl,
          watchedSeconds: (previous.watchedSeconds ?? 0) + addedSeconds,
          updatedAt: Date.now(),
          sessions: { ...sessions, [sessionId]: cumulativeSeconds },
        },
      },
    }
  })
}
