import { useEffect, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import LandingPage from './pages/LandingPage'
import CreateRoom from './pages/CreateRoom'
import WatchRoom from './pages/WatchRoom'
import AuthPage from './pages/AuthPage'
import HomePage from './pages/HomePage'
import { auth } from './lib/firebase'

type Screen = 'landing' | 'auth' | 'home' | 'create' | 'watch'
export default function App() {
  const [screen, setScreen] = useState<Screen>('landing'); const [darkMode, setDarkMode] = useState(false); const [userId, setUserId] = useState<string | null>(null); const [roomId, setRoomId] = useState(''); const [movieUrl, setMovieUrl] = useState('')
  useEffect(() => onAuthStateChanged(auth, user => setUserId(user?.uid ?? null)), [])
  const theme = { darkMode, onToggleDark: () => setDarkMode(value => !value) }
  const requireAuth = (next: 'create' | 'home') => userId ? setScreen(next) : setScreen('auth')
  return <div className={darkMode ? 'dark' : ''}>
    {screen === 'landing' && <LandingPage {...theme} onGetStarted={() => requireAuth('create')} onLogin={() => setScreen('auth')} />}
    {screen === 'auth' && <AuthPage {...theme} onSuccess={() => setScreen('home')} onBack={() => setScreen('landing')} />}
    {screen === 'home' && userId && <HomePage {...theme} userId={userId} onCreate={() => setScreen('create')} onJoin={() => setScreen('create')} onLogout={() => { void signOut(auth); setScreen('landing') }} />}
    {screen === 'create' && userId && <CreateRoom {...theme} userId={userId} onCreateRoom={(id, url) => { setRoomId(id); setMovieUrl(url); setScreen('watch') }} onJoinRoom={(id, url) => { setRoomId(id); setMovieUrl(url); setScreen('watch') }} onBack={() => setScreen('home')} />}
    {screen === 'watch' && userId && <WatchRoom {...theme} roomId={roomId} movieUrl={movieUrl} userId={userId} onLeave={() => setScreen('home')} />}
  </div>
}
