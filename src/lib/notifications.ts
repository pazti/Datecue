import { ref, set, remove, onValue } from "firebase/database"
import { realtimeDatabase } from "./firebase"

export interface Notification {
  id: string
  title: string
  body: string
  createdAt: number
  read?: boolean
  type?: "invite" | "system" | "message"
  roomId?: string
}

export async function createNotification(
  userId: string,
  notification: Omit<Notification, "id" | "createdAt">,
) {
  const notifRef = ref(realtimeDatabase, `users/${userId}/notifications`)
  const timestamp = Date.now()
  return set(
    ref(realtimeDatabase, `users/${userId}/notifications/${timestamp}`),
    {
      ...notification,
      createdAt: timestamp,
    },
  )
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
