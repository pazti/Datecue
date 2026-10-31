import { useEffect, useRef, useState } from "react"
import { onAuthStateChanged, signOut } from "firebase/auth"
import { onValue, ref, update } from "firebase/database"
import { createNotification } from "./lib/notifications"
import LandingPage from "./pages/LandingPage"
import CreateRoom from "./pages/CreateRoom"
import WatchRoom from "./pages/WatchRoom"
import AuthPage from "./pages/AuthPage"
import HomePage from "./pages/HomePage"
import LegalPage from "./pages/LegalPage"
import ProfilePage from "./pages/ProfilePage"
import type { LegalDocument } from "./pages/LegalPage"
import AppErrorBoundary from "./components/AppErrorBoundary"
import { LiquidBackdrop } from "./components/LiquidHero"
import { auth, realtimeDatabase } from "./lib/firebase"

type Screen = "landing" | "auth" | "home" | "profile" | "create" | "watch" | LegalDocument
interface Route {
  screen: Screen
  roomCode?: string
}

interface PageMetadata {
  title: string
  description: string
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
  if (route === "profile") return { screen: "profile" }
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
  const [darkMode, setDarkMode] = useState(
    () =>
      window.localStorage.getItem("datecue-theme") === "dark" ||
      (!window.localStorage.getItem("datecue-theme") &&
        window.matchMedia("(prefers-color-scheme: dark)").matches),
  )
  const [userId, setUserId] = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [roomId, setRoomId] = useState("")
  const [movieUrl, setMovieUrl] = useState("")
  const [resumePosition, setResumePosition] = useState<number | undefined>()
  const [pendingRoomCode, setPendingRoomCode] = useState(
    initialRoute.roomCode ?? "",
  )
  const [pendingMovieUrl, setPendingMovieUrl] = useState("")
  const [nextAfterAuth, setNextAfterAuth] = useState<"create" | null>(null)
  const [legalReturnScreen, setLegalReturnScreen] = useState<Screen>("landing")
  const authInitialized = useRef(false)
  const screenRef = useRef(screen)

  useEffect(() => {
    window.localStorage.setItem("datecue-theme", darkMode ? "dark" : "light")
  }, [darkMode])

  useEffect(() => {
    screenRef.current = screen
  }, [screen])

  useEffect(() => {
    const metadata: Record<Screen, PageMetadata> = {
      landing: {
        title: "Datecue | Watch YouTube Together in Sync",
        description:
          "Start a private, two-person YouTube watch party with synced playback, scene-timestamped chat, and live reactions.",
      },
      auth: {
        title: "Sign In or Create an Account | Datecue",
        description:
          "Create a Datecue account or sign in to start a private watch room and keep your watch history.",
      },
      home: {
        title: "Your Watch History | Datecue",
        description:
          "Return to your Datecue rooms, review watch history, and start another shared YouTube watch party.",
      },
      profile: {
        title: "Your Profile | Datecue",
        description:
          "Manage your Datecue display name, room identity, and private watch history.",
      },
      create: {
        title: "Create or Join a Watch Room | Datecue",
        description:
          "Choose a YouTube video to watch together or join a private Datecue room with its six-character code.",
      },
      watch: {
        title: "Watch Together in Sync | Datecue",
        description:
          "Watch a YouTube video together with synchronized playback, private chat, and reactions.",
      },
      privacy: {
        title: "Privacy Policy | Datecue",
        description:
          "Learn what Datecue collects, how room and account data is used, and the choices available to you.",
      },
      terms: {
        title: "Terms of Service | Datecue",
        description:
          "Read the terms for using Datecue private watch rooms, chat, reactions, and third-party YouTube embeds.",
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
    const isPrivateScreen = [
      "auth",
      "home",
      "profile",
      "create",
      "watch",
    ].includes(screen)
    setMeta(
      'meta[name="robots"]',
      "content",
      isPrivateScreen ? "noindex, nofollow" : "index, follow",
    )
    const pageUrl = `${window.location.origin}${window.location.pathname}${
      screen === "privacy" || screen === "terms" ? window.location.hash : ""
    }`
    setMeta('meta[property="og:url"]', "content", pageUrl)
    let canonical = document.head.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    )
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
          user?.providerData.some(
            (provider) => provider.providerId === "password",
          ) && !user.emailVerified,
        )
        if (!authInitialized.current) {
          authInitialized.current = true
          const route = initialRoute
          if (requiresVerification) setScreen("auth")
          else if (route.roomCode) setScreen(user ? "create" : "auth")
          else if (
            !user &&
            ["home", "profile", "create", "watch"].includes(route.screen)
          )
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
          ["home", "profile", "create", "watch"].includes(screenRef.current)
        ) {
          setScreen("auth")
        }
      }),
    [initialRoute],
  )

  useEffect(() => {
    const root = document.documentElement
    if (!userId) {
      root.classList.remove("reduce-motion", "large-chat")
      return
    }
    return onValue(
      ref(realtimeDatabase, `users/${userId}/preferences/accessibility`),
      (snapshot) => {
        const preferences = snapshot.val() ?? {}
        root.classList.toggle(
          "reduce-motion",
          preferences.reduceMotion === true,
        )
        root.classList.toggle("large-chat", preferences.largerChatText === true)
      },
    )
  }, [userId])

  useEffect(() => {
    if (!userId) return
    const timers = new Map<string, number>()
    const requested = new Set<string>()
    const armReminder = (
      roomId: string,
      room: {
        title?: string
        scheduledAt: number
        reminderSentAt?: number | null
      },
    ) => {
      if (
        room.reminderSentAt ||
        room.scheduledAt < Date.now() - 60 * 60 * 1000 ||
        requested.has(roomId) ||
        timers.has(roomId)
      )
        return
      const timer = window.setTimeout(
        () => {
          timers.delete(roomId)
          if (room.scheduledAt > Date.now()) {
            armReminder(roomId, room)
            return
          }
          requested.add(roomId)
          void createNotification(
            userId,
            {
              title: "Your watch time is here",
              body: `${room.title || "Your scheduled room"} is ready. Share the invite and start watching.`,
              type: "schedule",
              roomId,
            },
            `schedule-${roomId}`,
          )
            .then(() =>
              update(
                ref(
                  realtimeDatabase,
                  `users/${userId}/scheduledRooms/${roomId}`,
                ),
                { reminderSentAt: Date.now() },
              ),
            )
            .catch((error: unknown) => {
              requested.delete(roomId)
              console.error(
                "Could not save the scheduled-room reminder.",
                error,
              )
            })
        },
        Math.min(Math.max(0, room.scheduledAt - Date.now()), 2_147_000_000),
      )
      timers.set(roomId, timer)
    }

    const unsubscribe = onValue(
      ref(realtimeDatabase, `users/${userId}/scheduledRooms`),
      (snapshot) => {
        const scheduledRooms = snapshot.val() as Record<string, {
          title?: string
          scheduledAt?: number
          reminderSentAt?: number | null
        }> | null
        const activeRoomIds = new Set(Object.keys(scheduledRooms ?? {}))
        for (const [roomId, timer] of timers) {
          if (
            !activeRoomIds.has(roomId) ||
            scheduledRooms?.[roomId]?.reminderSentAt
          ) {
            window.clearTimeout(timer)
            timers.delete(roomId)
          }
        }
        for (const [roomId, scheduled] of Object.entries(
          scheduledRooms ?? {},
        )) {
          if (typeof scheduled.scheduledAt === "number") {
            armReminder(roomId, {
              title: scheduled.title,
              scheduledAt: scheduled.scheduledAt,
              reminderSentAt: scheduled.reminderSentAt,
            })
          }
        }
      },
      (error) =>
        console.error("Could not load scheduled-room reminders.", error),
    )
    return () => {
      unsubscribe()
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [userId])

  const navigate = (next: Screen, code = "") => {
    const basePath = import.meta.env.BASE_URL || "/"
    const target =
      next === "privacy" || next === "terms"
        ? `${basePath}${next}`
        : `${basePath}${routeHash(next, code)}`
    window.history.pushState({}, "", `${target}${window.location.search}`)
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
        currentUser?.providerData.some(
          (provider) => provider.providerId === "password",
        ) && !currentUser.emailVerified,
      )
      if (requiresVerification) setScreen("auth")
      else if (route.roomCode) setScreen(userId ? "create" : "auth")
      else if (
        !userId &&
        ["home", "profile", "create", "watch"].includes(route.screen)
      )
        setScreen("auth")
      else setScreen(route.screen)
    }
    window.addEventListener("popstate", syncRoute)
    return () => window.removeEventListener("popstate", syncRoute)
  }, [userId])

  const isPublicRoute =
    initialRoute.screen === "landing" ||
    initialRoute.screen === "privacy" ||
    initialRoute.screen === "terms"

  if (!authReady && !isPublicRoute)
    return (
      <div
        className="surface-wash flex min-h-[100dvh] flex-col items-center justify-center gap-5 px-6 text-center text-ink"
        role="status"
        aria-live="polite"
      >
        <span
          className="liquid-logo-mark liquid-logo-mark-lg"
          aria-hidden="true"
        >
          <span />
        </span>
        <div>
          <p className="display-serif text-3xl">A moment, together.</p>
          <p className="mt-2 text-sm text-muted-ink">
            Getting your Datecue space ready…
          </p>
        </div>
        <span
          className="loading-shimmer h-1 w-36 rounded-full"
          aria-hidden="true"
        />
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
        (!currentUser?.providerData.some(
          (provider) => provider.providerId === "password",
        ) ||
          currentUser.emailVerified),
    )
    setNextAfterAuth(verified ? null : "create")
    navigate(verified ? "create" : "auth")
  }

  return (
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
        {screen === "profile" && userId && (
          <ProfilePage
            {...theme}
            userId={userId}
            email={auth.currentUser?.email ?? ""}
            onBack={() => navigate("home")}
            onLogout={async () => {
              await signOut(auth)
              navigate("landing")
            }}
            onAccountDeleted={async () => {
              await signOut(auth)
              navigate("landing")
            }}
            onLegal={openLegal}
          />
        )}
        {(screen === "privacy" || screen === "terms") && (
          <LegalPage
            document={screen}
            {...theme}
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
            onProfile={() => navigate("profile")}
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
            onOpenRoom={(id, url, position) => {
              setRoomId(id)
              setMovieUrl(url)
              setResumePosition(position)
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
              setResumePosition(undefined)
              navigate("watch", id)
            }}
            onJoinRoom={(id, url) => {
              setPendingRoomCode("")
              setPendingMovieUrl("")
              setRoomId(id)
              setMovieUrl(url)
              setResumePosition(undefined)
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
            resumePosition={resumePosition}
            userId={userId}
            onLeave={() => navigate("home")}
          />
        )}
      </div>
    </div>
  )
}
