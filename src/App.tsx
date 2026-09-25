import { useState } from 'react'
import LandingPage from './pages/LandingPage'
import CreateRoom from './pages/CreateRoom'
import WatchRoom from './pages/WatchRoom'

type Screen = 'landing' | 'create' | 'watch'

export default function App() {
  const [screen, setScreen] = useState<Screen>('landing')
  const [darkMode, setDarkMode] = useState(false)

  const toggleDark = () => setDarkMode(d => !d)

  return (
    <div className={darkMode ? 'dark' : ''}>
      {screen === 'landing' && (
        <LandingPage
          onGetStarted={() => setScreen('create')}
          darkMode={darkMode}
          onToggleDark={toggleDark}
        />
      )}
      {screen === 'create' && (
        <CreateRoom
          onCreateRoom={() => setScreen('watch')}
          onJoinRoom={() => setScreen('watch')}
          onBack={() => setScreen('landing')}
          darkMode={darkMode}
          onToggleDark={toggleDark}
        />
      )}
      {screen === 'watch' && (
        <WatchRoom
          onLeave={() => setScreen('landing')}
          darkMode={darkMode}
          onToggleDark={toggleDark}
        />
      )}
    </div>
  )
}
