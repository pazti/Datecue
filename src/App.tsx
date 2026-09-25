import { useEffect, useState } from 'react'
import LandingPage from './pages/LandingPage'
import CreateRoom from './pages/CreateRoom'
import WatchRoom from './pages/WatchRoom'
import { ensureAnonymousSession } from './lib/firebase'

type Screen = 'landing' | 'create' | 'watch'

export default function App() {
  const [screen, setScreen] = useState<Screen>('landing')
  const [darkMode, setDarkMode] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [roomId, setRoomId] = useState('XK4P2R')

  useEffect(() => {
    ensureAnonymousSession().then(user => setUserId(user.uid)).catch(() => setUserId(null))
  }, [])

  const openRoom = (id = 'XK4P2R') => { setRoomId(id); setScreen('watch') }

  return (
    <div className={darkMode ? 'dark' : ''}>
      {screen === 'landing' && <LandingPage onGetStarted={() => setScreen('create')} darkMode={darkMode} onToggleDark={() => setDarkMode(value => !value)} />}
      {screen === 'create' && <CreateRoom onCreateRoom={openRoom} onJoinRoom={openRoom} onBack={() => setScreen('landing')} darkMode={darkMode} onToggleDark={() => setDarkMode(value => !value)} userId={userId} />}
      {screen === 'watch' && <WatchRoom onLeave={() => setScreen('landing')} darkMode={darkMode} onToggleDark={() => setDarkMode(value => !value)} roomId={roomId} userId={userId} />}
    </div>
  )
}
