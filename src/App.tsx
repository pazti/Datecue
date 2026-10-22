import { useEffect, useRef, useState } from "react"
import { onAuthStateChanged, signOut } from "firebase/auth"
import LandingPage from "./pages/LandingPage"
import CreateRoom from "./pages/CreateRoom"
import WatchRoom from "./pages/WatchRoom"
import AuthPage from "./pages/AuthPage"
import HomePage from "./pages/HomePage"
import AppErrorBoundary from "./components/AppErrorBoundary"
import { LiquidBackdrop } from "./components/LiquidHero"
import { auth } from "./lib/firebase"

type Screen = "landing" | "auth" | "home" | "create" | "watch"
type Route = { screen: Screen; roomCode?: string }

function readRoute(): Route {
  const route = window.location.hash.replace(/^#\/?/, "")
  const roomMatch = route.match(/^room\/([a-z0-9]{6})$/i)
  if (roomMatch) return { screen: "create", roomCode: roomMatch[1].toUpperCase() }
  if (route === "auth") return { screen: "auth" }
  if (route === "home") return { screen: "home" }
  if (route === "create") return { screen: "create" }
  return { screen: "landing" }
}

function routeHash(screen: Screen, roomCode?: string) {
  if (screen === "landing") return "#/"
  if (screen === "watch" && roomCode) return `#/room/${roomCode}`
  return `#/${screen}`
}

export default function App() {
  const [initialRoute] = useState(readRoute)
  const [screen, setScreen] = useState<Screen>(
    initialRoute.roomCode ? "auth" : initialRoute.screen,
  )
  const [darkMode, setDarkMode] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [roomId, setRoomId] = useState("")
  const [movieUrl, setMovieUrl] = useState("")
  const [pendingRoomCode, setPendingRoomCode] = useState(
    initialRoute.roomCode ?? "",
  )
  const [pendingMovieUrl, setPendingMovieUrl] = useState("")
  const authInitialized = useRef(false)

  useEffect(
    () =>
      onAuthStateChanged(auth, (user) => {
        setUserId(user?.uid ?? null)
        setAuthReady(true)
        if (!authInitialized.current) {
          authInitialized.current = true
          const route = initialRoute
          if (route.roomCode) setScreen(user ? "create" : "auth")
          else if (!user && ["home", "create", "watch"].includes(route.screen))
            setScreen("auth")
          else if (user && route.screen === "auth") setScreen("home")
        } else if (!user && ["home", "create", "watch"].includes(screen)) {
          setScreen("auth")
        }
      }),
    [initialRoute, screen],
  )

  const navigate = (next: Screen, code = roomId) => {
    window.history.pushState(
      {},
      "",
      `${window.location.pathname}${window.location.search}${routeHash(next, code)}`,
    )
    setScreen(next)
  }

  useEffect(() => {
    const syncRoute = () => {
      const route = readRoute()
      setPendingRoomCode(route.roomCode ?? "")
      if (route.roomCode) setScreen(userId ? "create" : "auth")
      else if (!userId && ["home", "create", "watch"].includes(route.screen))
        setScreen("auth")
      else setScreen(route.screen)
    }
    window.addEventListener("popstate", syncRoute)
    return () => window.removeEventListener("popstate", syncRoute)
  }, [userId])

  if (!authReady)
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f2ea] text-sm font-semibold text-[#17252b]">
        Loading Datecue…
      </div>
    )

  const theme = {
    darkMode,
    onToggleDark: () => setDarkMode((value) => !value),
  }
  const startCreating = (url = "") => {
    setPendingMovieUrl(url.trim())
    setPendingRoomCode("")
    navigate(userId ? "create" : "auth")
  }

  return (
    <AppErrorBoundary>
      <div className={darkMode ? "dark" : ""}>
        <LiquidBackdrop />
        <div className="app-content">
          {screen === "landing" && (
            <LandingPage
              {...theme}
              onGetStarted={startCreating}
              onLogin={() => navigate("auth")}
            />
          )}
          {screen === "auth" && (
            <AuthPage
              {...theme}
              onSuccess={() =>
                navigate(pendingRoomCode || pendingMovieUrl ? "create" : "home")
              }
              onBack={() => navigate("landing")}
            />
          )}
          {screen === "home" && userId && (
            <HomePage
              {...theme}
              userId={userId}
              onCreate={() => {
                setPendingMovieUrl("")
                setPendingRoomCode("")
                navigate("create")
              }}
              onJoin={() => {
                setPendingMovieUrl("")
                setPendingRoomCode("")
                navigate("create")
              }}
              onOpenRoom={(id, url) => {
                setRoomId(id)
                setMovieUrl(url)
                navigate("watch", id)
              }}
              onLogout={async () => {
                await signOut(auth)
                navigate("landing")
              }}
            />
          )}
          {screen === "create" && userId && (
            <CreateRoom
              {...theme}
              userId={userId}
              initialRoomCode={pendingRoomCode}
              initialMovieUrl={pendingMovieUrl}
              onCreateRoom={(id, url) => {
                setPendingRoomCode("")
                setPendingMovieUrl("")
                setRoomId(id)
                setMovieUrl(url)
                navigate("watch", id)
              }}
              onJoinRoom={(id, url) => {
                setPendingRoomCode("")
                setPendingMovieUrl("")
                setRoomId(id)
                setMovieUrl(url)
                navigate("watch", id)
              }}
              onBack={() => navigate("home")}
            />
          )}
          {screen === "watch" && userId && (
            <WatchRoom
              {...theme}
              roomId={roomId}
              movieUrl={movieUrl}
              userId={userId}
              onLeave={() => navigate("home")}
            />
          )}
        </div>
      </div>
    </AppErrorBoundary>
  )
}
