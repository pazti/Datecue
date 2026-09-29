import { getApp, getApps, initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getDatabase } from "firebase/database"

export const firebaseConfig = {
  apiKey:
    import.meta.env.VITE_FIREBASE_API_KEY ||
    "AIzaSyBCZL8iwtXVZtqxD-XSm_T94f934tx7TjA",
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
    "datecue-e90a5.firebaseapp.com",
  databaseURL:
    import.meta.env.VITE_FIREBASE_DATABASE_URL ||
    "https://datecue-e90a5-default-rtdb.firebaseio.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "datecue-e90a5",
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    "datecue-e90a5.firebasestorage.app",
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "203915148369",
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ||
    "1:203915148369:web:8e9e4c18d67510a6ec8c70",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-MZCHWXTXHT",
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const realtimeDatabase = getDatabase(app)
export default app

export function youtubeIdFromUrl(value: string) {
  return (
    value.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/,
    )?.[1] ?? null
  )
}

export function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`
}
