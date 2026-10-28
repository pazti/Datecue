import { useEffect, useRef, useState } from "react"
import { onAuthStateChanged, signOut } from "firebase/auth"
import LandingPage from "./pages/LandingPage"
import CreateRoom from "./pages/CreateRoom"
import WatchRoom from "./pages/WatchRoom"
import AuthPage from "./pages/AuthPage"
import HomePage from "./pages/HomePage"
import LegalPage from "./pages/LegalPage"
import type { LegalDocument } from "./pages/LegalPage"
import AppErrorBoundary from "./components/AppErrorBoundary"
import { LiquidBackdrop } from "./components/LiquidHero"
import { auth } from "./lib/firebase"

type Screen = "landing" | "auth" | "home" | "create" | "watch" | LegalDocument
interface Route {
  screen: Screen
  roomCode?: string
}

function readRoute(): Route {
  const path = window.location.pathname.replace(/\/+$/, "")
  if (path.endsWith("/privacy")) return { screen: "privacy" }
  if (path.endsWith("/terms")) return { screen: "terms" }
  const route = window.location.hash.replace(/^#\/?/, "")
  const roomMatch = route.match(/^room\/([a-z0-9]{6})$/i)
  if (roomMatch)
    return { screen: "create", roomCode: roomMatch[1].toUpperCase() }
  if (route === "auth") return { screen: "auth" }
  if (route === "home") return { screen: "home" }
  if (route === "create") return { screen: "create" }
  if (route === "privacy" || route === "terms") return { screen: route }
  return { screen: "landing" }
}

function routeHash(screen: Screen, roomCode?: string) {
  if (screen === "landing") return "#/"
  if ((screen === "watch" || screen === "create") && roomCode)
    return `#/room/${roomCode}`
  if (screen === "privacy" || screen === "terms") return `/${screen}`
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
  const [nextAfterAuth, setNextAfterAuth] = useState<"create" | null>(null)
  const [legalReturnScreen, setLegalReturnScreen] = useState<Screen>("landing")
  const authInitialized = useRef(false)
  const screenRef = useRef(screen)

  useEffect(() => {
    screenRef.current = screen
  }, [screen])

  useEffect(() => {
    const metadata: Record<Screen, { title: string; description: string }> = {
      landing: {
        title: "Datecue | Watch YouTube Together in Sync",
        description: "Start a private, two-person YouTube watch party with synced playback, scene-timestamped chat, and live reactions.",
      },
      auth: {
        title: "Sign In or Create an Account | Datecue",
        description: "Create a Datecue account or sign in to start a private watch room and keep your watch history.",
      },
      home: {
        title: "Your Watch History | Datecue",
        description: "Return to your Datecue rooms, review watch history, and start another shared YouTube watch party.",
      },
      create: {
        title: "Create or Join a Watch Room | Datecue",
        description: "Choose a YouTube video to watch together or join a private Datecue room with its six-character code.",
      },
      watch: {
        title: "Watch Together in Sync | Datecue",
        description: "Watch a YouTube video together with synchronized playback, private chat, and reactions.",
      },
      privacy: {
        title: "Privacy Policy | Datecue",
        description: "Learn what Datecue collects, how room and account data is used, and the choices available to you.",
      },
      terms: {
        title: "Terms of Service | Datecue",
        description: "Read the terms for using Datecue private watch rooms, chat, reactions, and third-party YouTube embeds.",
      },
    }
    const current = metadata[screen]
    document.title = current.title
    const setMeta = (selector: string, attribute: string, value: string) => {
      let element = document.head.querySelector<HTMLMetaElement>(selector)
      if (!element) {
        element = document.createElement("meta")
        document.head.appendChild(element)
      }
      element.setAttribute(attribute, value)
    }
    setMeta('meta[name="description"]', "content", current.description)
    setMeta('meta[property="og:title"]', "content", current.title)
    setMeta('meta[property="og:description"]', "content", current.description)
    setMeta('meta[name="twitter:title"]', "content", current.title)
    setMeta('meta[name="twitter:description"]', "content", current.description)
    const isPrivateScreen = ["auth", "home", "create", "watch"].includes(screen)
    setMeta('meta[name="robots"]', "content", isPrivateScreen ? "noindex, nofollow" : "index, follow")
    const pageUrl = `${window.location.origin}${window.location.pathname}${screen === "privacy" || screen === "terms" ? window.location.hash : ""}`
    setMeta('meta[property="og:url"]', "content", pageUrl)
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement("link")
      canonical.rel = "canonical"
      document.head.appendChild(canonical)
    }
    canonical.href = pageUrl
  }, [screen])

  useEffect(
    () =>
      onAuthStateChanged(auth, (user) => {
        setUserId(user?.uid ?? null)
        setAuthReady(true)
        const requiresVerification = Boolean(
          user?.providerData.some((provider) => provider.providerId === "password") &&
          !user.emailVerified,
        )
        if (!authInitialized.current) {
          authInitialized.current = true
          const route = initialRoute
          if (requiresVerification) setScreen("auth")
          else if (route.roomCode) setScreen(user ? "create" : "auth")
          else if (!user && ["home", "create", "watch"].includes(route.screen))
            setScreen("auth")
          else if (user && route.screen === "auth") {
            setScreen("home")
            window.history.replaceState(
              {},
              "",
              `${window.location.pathname}${window.location.search}#/home`,
            )
          }
        } else if (requiresVerification) {
          setScreen("auth")
        } else if (
          !user &&
          ["home", "create", "watch"].includes(screenRef.current)
        ) {
          setScreen("auth")
        }
      }),
    [initialRoute],
  )

  const navigate = (next: Screen, code = "") => {
    const basePath = import.meta.env.BASE_URL || "/"
    const target =
      next === "privacy" || next === "terms"
        ? `${basePath}${next}`
        : `${basePath}${routeHash(next, code)}`
    window.history.pushState(
      {},
      "",
      `${target}${window.location.search}`,
    )
    setScreen(next)
  }

  const openLegal = (document: LegalDocument) => {
    if (screen !== "privacy" && screen !== "terms") setLegalReturnScreen(screen)
    navigate(document)
  }

  useEffect(() => {
    const syncRoute = () => {
      const route = readRoute()
      setPendingRoomCode(route.roomCode ?? "")
      const currentUser = auth.currentUser
      const requiresVerification = Boolean(
        currentUser?.providerData.some((provider) => provider.providerId === "password") &&
        !currentUser.emailVerified,
      )
      if (requiresVerification) setScreen("auth")
      else if (route.roomCode) setScreen(userId ? "create" : "auth")
      else if (!userId && ["home", "create", "watch"].includes(route.screen))
        setScreen("auth")
      else setScreen(route.screen)
    }
    window.addEventListener("popstate", syncRoute)
    return () => window.removeEventListener("popstate", syncRoute)
  }, [userId])

  if (!authReady)
    return (
      <div className="surface-wash flex min-h-[100dvh] flex-col items-center justify-center gap-5 px-6 text-center text-ink" role="status" aria-live="polite">
        <span className="liquid-logo-mark liquid-logo-mark-lg" aria-hidden="true"><span /></span>
        <div>
          <p className="display-serif text-3xl">A moment, together.</p>
          <p className="mt-2 text-sm text-muted-ink">Getting your Datecue space ready…</p>
        </div>
        <span className="loading-shimmer h-1 w-36 rounded-full" aria-hidden="true" />
      </div>
    )

  const theme = {
    darkMode,
    onToggleDark: () => setDarkMode((value) => !value),
  }
  const startCreating = (url = "") => {
    setPendingMovieUrl(url.trim())
    setPendingRoomCode("")
    const currentUser = auth.currentUser
    const verified = Boolean(
      userId &&
      (!currentUser?.providerData.some((provider) => provider.providerId === "password") ||
        currentUser.emailVerified),
    )
    setNextAfterAuth(verified ? null : "create")
    navigate(verified ? "create" : "auth")
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
              onLegal={openLegal}
            />
          )}
          {(screen === "privacy" || screen === "terms") && (
            <LegalPage
              document={screen}
              onBack={() => navigate(legalReturnScreen)}
              onNavigate={openLegal}
            />
          )}
          {screen === "auth" && (
            <AuthPage
              {...theme}
              onSuccess={() => {
                const next =
                  pendingRoomCode || pendingMovieUrl || nextAfterAuth
                    ? "create"
                    : "home"
                setNextAfterAuth(null)
                navigate(next, pendingRoomCode || undefined)
              }}
              onBack={() => {
                setPendingRoomCode("")
                setPendingMovieUrl("")
                setNextAfterAuth(null)
                navigate("landing")
              }}
              onLegal={openLegal}
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
              onLegal={openLegal}
            />
          )}
          {screen === "create" && userId && (
            <CreateRoom
              key={`${pendingRoomCode}:${pendingMovieUrl}`}
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
