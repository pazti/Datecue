import { useEffect, useState } from 'react'
import LandingPage from './pages/LandingPage'
import CreateRoom from './pages/CreateRoom'
import WatchRoom from './pages/WatchRoom'
import AuthPage from './pages/AuthPage'
import { auth, ensureAnonymousSession } from './lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'

type Screen = 'landing' | 'auth' | 'create' | 'watch'

export default function App() {
  const [screen, setScreen] = useState<Screen>('landing')
  const [darkMode, setDarkMode] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [roomId, setRoomId] = useState('XK4P2R')
  const [movieUrl, setMovieUrl] = useState('https://www.youtube.com/watch?v=9bZkp7q19f0')

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => setUserId(user?.uid ?? null))
    ensureAnonymousSession().catch(() => undefined)
    return unsubscribe
  }, [])

  const openRoom = (id = 'XK4P2R', url = movieUrl) => { setRoomId(id); setMovieUrl(url); setScreen('watch') }

  return (
    <div className={darkMode ? 'dark' : ''}>
      {screen === 'landing' && <LandingPage onGetStarted={() => setScreen('create')} onLogin={() => setScreen('auth')} darkMode={darkMode} onToggleDark={() => setDarkMode(value => !value)} />}
      {screen === 'auth' && <AuthPage onSuccess={() => setScreen('create')} onBack={() => setScreen('landing')} darkMode={darkMode} onToggleDark={() => setDarkMode(value => !value)} />}
      {screen === 'create' && <CreateRoom onCreateRoom={(id, url) => openRoom(id, url)} onJoinRoom={id => openRoom(id)} onBack={() => setScreen('landing')} darkMode={darkMode} onToggleDark={() => setDarkMode(value => !value)} userId={userId} />}
      {screen === 'watch' && <WatchRoom onLeave={() => setScreen('landing')} darkMode={darkMode} onToggleDark={() => setDarkMode(value => !value)} roomId={roomId} movieUrl={movieUrl} userId={userId} />}
    </div>
  )
}
