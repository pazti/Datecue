import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAuth, signInAnonymously } from 'firebase/auth'
import { getDatabase } from 'firebase/database'

const firebaseConfig = {
  // Firebase web API keys are public identifiers. The fallbacks keep the Figma Make
  // preview working when its build does not inject the local Vite env file.
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyBCZL8iwtXVZtqxD-XSm_T94f934tx7TjA',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'datecue-e90a5.firebaseapp.com',
  databaseURL:
    import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://datecue-e90a5-default-rtdb.firebaseio.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'datecue-e90a5',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'datecue-e90a5.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '203915148369',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:203915148369:web:8e9e4c18d67510a6ec8c70',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-MZCHWXTXHT',
}

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)
export const firebaseApp = app
export const auth = getAuth(app)
export const realtimeDatabase = getDatabase(app)

export async function ensureAnonymousSession() {
  if (auth.currentUser) return auth.currentUser
  const result = await signInAnonymously(auth)
  return result.user
}

export default app
