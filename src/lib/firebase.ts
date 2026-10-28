import { getApp, getApps, initializeApp } from "firebase/app"
import {
  initializeAppCheck,
  ReCaptchaV3Provider,
  type AppCheck,
} from "firebase/app-check"
import { getAuth } from "firebase/auth"
import { getDatabase } from "firebase/database"
import { getAnalytics, isSupported, logEvent, type Analytics } from "firebase/analytics"
import { youtubeVideoIdFromUrl } from "./youtube"

const firebaseEnvironment = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}
const firebaseEnvironmentIsComplete = Object.values(firebaseEnvironment).every(
  (value) => typeof value === "string" && value.trim().length > 0,
)

if (import.meta.env.PROD && !firebaseEnvironmentIsComplete) {
  const missingKeys = Object.entries(firebaseEnvironment)
    .filter(([, value]) => !value?.trim())
    .map(([key]) => `VITE_FIREBASE_${key.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}`)
  throw new Error(
    `Production Firebase configuration is incomplete. Add: ${missingKeys.join(", ")}`,
  )
}

export const firebaseConfig = {
  apiKey:
    firebaseEnvironment.apiKey ||
    (import.meta.env.DEV ? "AIzaSyBCZL8iwtXVZtqxD-XSm_T94f934tx7TjA" : ""),
  authDomain: firebaseEnvironment.authDomain || "datecue-e90a5.firebaseapp.com",
  databaseURL:
    firebaseEnvironment.databaseURL ||
    "https://datecue-e90a5-default-rtdb.firebaseio.com",
  projectId: firebaseEnvironment.projectId || "datecue-e90a5",
  storageBucket:
    firebaseEnvironment.storageBucket || "datecue-e90a5.firebasestorage.app",
  messagingSenderId: firebaseEnvironment.messagingSenderId || "203915148369",
  appId:
    firebaseEnvironment.appId ||
    "1:203915148369:web:8e9e4c18d67510a6ec8c70",
  measurementId: firebaseEnvironment.measurementId || "G-MZCHWXTXHT",
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig)
const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY?.trim()
export let appCheck: AppCheck | null = null
if (appCheckSiteKey) {
  appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  })
} else if (import.meta.env.PROD) {
  console.warn(
    "Firebase App Check is not active. Configure VITE_FIREBASE_APPCHECK_SITE_KEY and register its provider in Firebase before launch.",
  )
}

export const auth = getAuth(app)
export const realtimeDatabase = getDatabase(app)
export default app

let analyticsInstance: Promise<Analytics | null> | null = null

export async function trackAnalyticsEvent(
  eventName: string,
  params: Record<string, string | number | boolean> = {},
) {
  analyticsInstance ??= isSupported()
    .then((supported) => supported ? getAnalytics(app) : null)
    .catch(() => null)
  const analytics = await analyticsInstance
  if (analytics) logEvent(analytics, eventName, params)
}

export function youtubeIdFromUrl(value: string) {
  return youtubeVideoIdFromUrl(value)
}

export function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`
}
