import { get, push, ref, remove, set } from "firebase/database"
import {
  deleteToken,
  getMessaging,
  getToken,
  isSupported,
  onMessage,
} from "firebase/messaging"
import app, { auth, firebaseConfig, realtimeDatabase } from "./firebase"

const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY?.trim()

export async function enableBrowserNotifications(userId: string) {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    throw new Error("PUSH_UNSUPPORTED")
  }
  if (!(await isSupported())) throw new Error("PUSH_UNSUPPORTED")
  if (!vapidKey) throw new Error("PUSH_VAPID_KEY_MISSING")
  if (auth.currentUser?.uid !== userId) throw new Error("PUSH_NOT_SIGNED_IN")

  const permission = await Notification.requestPermission()
  if (permission !== "granted") throw new Error("PUSH_PERMISSION_DENIED")

  const workerUrl = new URL(
    `${import.meta.env.BASE_URL}firebase-messaging-sw.js`,
    window.location.origin,
  )
  workerUrl.search = new URLSearchParams({
    apiKey: firebaseConfig.apiKey,
    projectId: firebaseConfig.projectId,
    messagingSenderId: firebaseConfig.messagingSenderId,
    appId: firebaseConfig.appId,
  }).toString()
  const registration = await navigator.serviceWorker.register(workerUrl, {
    scope: import.meta.env.BASE_URL,
  })
  const messaging = getMessaging(app)
  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: registration,
  })
  if (!token) throw new Error("PUSH_TOKEN_UNAVAILABLE")

  const tokensRef = ref(realtimeDatabase, `users/${userId}/notificationTokens`)
  const existing: Record<string, { token?: string }> =
    (await get(tokensRef)).val() ?? {}
  const existingEntry = Object.entries(existing).find(
    ([, item]) => item?.token === token,
  )
  if (!existingEntry) {
    await set(push(tokensRef), { token, createdAt: Date.now() })
  }
  window.localStorage.setItem(`datecue-push-token-${userId}`, token)
}

export async function disableBrowserNotifications(userId: string) {
  const isMessagingSupported = await isSupported()
  const messaging = isMessagingSupported ? getMessaging(app) : null
  let token = window.localStorage.getItem(`datecue-push-token-${userId}`)
  if (messaging && vapidKey) {
    const registration = await navigator.serviceWorker.getRegistration(
      new URL(import.meta.env.BASE_URL, window.location.origin).href,
    )
    if (registration) {
      token =
        (await getToken(messaging, {
          vapidKey,
          serviceWorkerRegistration: registration,
        })) || token
    }
  }
  if (token) {
    const tokensRef = ref(
      realtimeDatabase,
      `users/${userId}/notificationTokens`,
    )
    const tokens: Record<string, { token?: string }> =
      (await get(tokensRef)).val() ?? {}
    const matchingIds = Object.entries(tokens)
      .filter(([, item]) => item?.token === token)
      .map(([id]) => id)
    await Promise.all(
      matchingIds.map((id) =>
        remove(
          ref(realtimeDatabase, `users/${userId}/notificationTokens/${id}`),
        ),
      ),
    )
  }
  window.localStorage.removeItem(`datecue-push-token-${userId}`)
  if (messaging) await deleteToken(messaging)
}

export async function listenForBrowserNotifications(
  callback: (title: string, body: string) => void,
) {
  if (!(await isSupported())) return () => {}
  return onMessage(getMessaging(app), (payload) => {
    callback(
      payload.notification?.title || "Datecue",
      payload.notification?.body || "You have a new update.",
    )
  })
}
