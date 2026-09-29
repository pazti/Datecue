import { ref, set, get, update, remove } from "firebase/database"
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
  return set(ref(realtimeDatabase, `rooms/${roomId}`), {
    hostId,
    movieUrl,
    createdAt: now,
    updatedAt: now,
    members: { [hostId]: true },
  })
}

export async function joinRoom(roomId: string, userId: string) {
  return set(ref(realtimeDatabase, `rooms/${roomId}/members/${userId}`), true)
}

export async function leaveRoom(roomId: string, userId: string) {
  return remove(ref(realtimeDatabase, `rooms/${roomId}/members/${userId}`))
}

export async function getRoomData(roomId: string) {
  const snap = await get(ref(realtimeDatabase, `rooms/${roomId}`))
  return snap.val()
}

export async function updateUserStats(userId: string, watchSeconds: number) {
  const statsRef = ref(realtimeDatabase, `users/${userId}/stats`)
  const snap = await get(statsRef)
  const current = snap.val() ?? { watchSeconds: 0 }
  return set(statsRef, {
    watchSeconds: Math.max(0, current.watchSeconds + watchSeconds),
    lastUpdated: Date.now(),
  })
}

export async function addToWatchHistory(
  userId: string,
  roomId: string,
  movieUrl: string,
  watchSeconds: number,
) {
  return set(ref(realtimeDatabase, `users/${userId}/history/${roomId}`), {
    movieUrl,
    watchSeconds,
    updatedAt: Date.now(),
  })
}
