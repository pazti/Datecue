import {
  ref,
  set,
  remove,
  onValue,
  push,
  serverTimestamp,
} from "firebase/database"
import { realtimeDatabase } from "./firebase"

export interface Notification {
  id: string
  title: string
  body: string
  createdAt: number
  read?: boolean
  type?: "invite" | "system" | "message" | "schedule"
  roomId?: string
}

export async function createNotification(
  userId: string,
  notification: Omit<Notification, "id" | "createdAt">,
  notificationId?: string,
) {
  const notificationRef = notificationId
    ? ref(realtimeDatabase, `users/${userId}/notifications/${notificationId}`)
    : push(ref(realtimeDatabase, `users/${userId}/notifications`))
  return set(notificationRef, {
    ...notification,
    createdAt: serverTimestamp(),
  })
}

export async function markNotificationAsRead(
  userId: string,
  notificationId: string,
) {
  return set(
    ref(
      realtimeDatabase,
      `users/${userId}/notifications/${notificationId}/read`,
    ),
    true,
  )
}

export async function clearNotification(
  userId: string,
  notificationId: string,
) {
  return remove(
    ref(realtimeDatabase, `users/${userId}/notifications/${notificationId}`),
  )
}

export function subscribeToNotifications(
  userId: string,
  callback: (notifications: Notification[]) => void,
) {
  return onValue(
    ref(realtimeDatabase, `users/${userId}/notifications`),
    (snap) => {
      const data = snap.val() ?? {}
      const notifications = Object.entries(data).map(([id, value]) => ({
        id,
        ...value as Omit<Notification, "id">,
      }))
      callback(notifications.sort((a, b) => b.createdAt - a.createdAt))
    },
  )
}
