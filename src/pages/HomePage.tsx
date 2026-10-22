import { useEffect, useState } from "react"
import { onValue, ref } from "firebase/database"
import { formatDuration, realtimeDatabase } from "../lib/firebase"
import { joinRoom } from "../lib/rooms"
import { clearNotification, markNotificationAsRead } from "../lib/notifications"
import Logo, { Icon } from "../components/Logo"

interface Props {
  userId: string
  darkMode: boolean
  onToggleDark: () => void
  onCreate: () => void
  onJoin: () => void
  onOpenRoom: (roomId: string, movieUrl: string) => void
  onLogout: () => Promise<void>
}

interface HistoryItem {
  roomId: string
  movieUrl: string
  title?: string
  watchedSeconds?: number
  updatedAt?: number
}

interface HomeNotification {
  title: string
  body: string
  createdAt?: number
  read?: boolean
}

export default function HomePage({
  userId,
  darkMode,
  onToggleDark,
  onCreate,
  onJoin,
  onOpenRoom,
  onLogout,
}: Props) {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [roomCount, setRoomCount] = useState(0)
  const [totalSeconds, setTotalSeconds] = useState(0)
  const [notifications, setNotifications] = useState<Record<string, HomeNotification>>({})
  const [showNotifications, setShowNotifications] = useState(false)
  const [error, setError] = useState("")
  const [logoutBusy, setLogoutBusy] = useState(false)

  useEffect(
    () =>
      onValue(
        ref(realtimeDatabase, `users/${userId}`),
        (snapshot) => {
          const value = snapshot.val() ?? {}
          const allHistory = Object.entries(value.history ?? {})
            .map(([roomId, item]) => ({
              roomId,
              ...(item as Omit<HistoryItem, "roomId">),
            }))
            .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
          setTotalSeconds(value.stats?.watchSeconds ?? 0)
          setRoomCount(allHistory.length)
          setHistory(allHistory.slice(0, 8))
          setNotifications(value.notifications ?? {})
          setError("")
        },
        () => setError("Your home data couldn't load. Check your connection and try again."),
      ),
    [userId],
  )

  const unread = Object.values(notifications).filter((item) => !item.read).length
  const surface = darkMode ? "bg-night text-ivory" : "bg-ivory text-ink"
  const muted = darkMode ? "text-ivory/60" : "text-muted-ink"

  const openHistoryRoom = async (item: HistoryItem) => {
    setError("")
    try {
      await joinRoom(item.roomId, userId)
      onOpenRoom(item.roomId, item.movieUrl)
    } catch {
      setError("That room is no longer available. Start a new room or join with a current code.")
    }
  }

  const changeNotification = async (
    id: string,
    action: "read" | "delete",
  ) => {
    setError("")
    try {
      if (action === "read") await markNotificationAsRead(userId, id)
      else await clearNotification(userId, id)
    } catch {
      setError("That notification couldn't be updated. Try again.")
    }
  }

  const logout = async () => {
    setLogoutBusy(true)
    setError("")
    try {
      await onLogout()
    } catch {
      setError("You couldn't be signed out. Check your connection and try again.")
    } finally {
      setLogoutBusy(false)
    }
  }

  return (
    <div className={`film-grain min-h-[100dvh] ${surface}`}>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo dark={darkMode} />
        <div className="flex items-center gap-2">
          <button
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            className="button-quiet focus-ring flex h-10 w-10 items-center justify-center rounded-full border"
            onClick={onToggleDark}
            type="button"
          >
            <Icon name={darkMode ? "sun" : "moon"} size={15} />
          </button>
          <button
            className="button-quiet focus-ring rounded-full border px-3 py-2 text-xs font-bold"
            disabled={logoutBusy}
            onClick={() => void logout()}
            type="button"
          >
            {logoutBusy ? "Signing out…" : "Log out"}
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 pb-16 pt-8">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <p className={`mono text-xs uppercase tracking-[.2em] ${muted}`}>
              your datecue home
            </p>
            <h1 className="mt-3 text-4xl sm:text-6xl">
              What are you watching next?
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="button-primary focus-ring rounded-xl px-4 py-3 text-sm font-bold"
              onClick={onCreate}
              type="button"
            >
              Create room
            </button>
            <button
              className="button-quiet focus-ring rounded-xl border px-4 py-3 text-sm font-bold"
              onClick={onJoin}
              type="button"
            >
              Join room
            </button>
          </div>
        </div>

        {error && (
          <p className="mt-6 rounded-xl bg-coral/10 px-4 py-3 text-sm text-coral" role="alert">
            {error}
          </p>
        )}

        <section className="mt-8 grid gap-3 sm:grid-cols-3" aria-label="Your activity">
          <div className="soft-card rounded-2xl p-5">
            <p className={`text-xs uppercase ${muted}`}>Total watch time</p>
            <p className="mt-2 text-3xl font-bold">{formatDuration(totalSeconds)}</p>
          </div>
          <div className="soft-card rounded-2xl p-5">
            <p className={`text-xs uppercase ${muted}`}>Rooms watched</p>
            <p className="mt-2 text-3xl font-bold">{roomCount}</p>
          </div>
          <button
            aria-expanded={showNotifications}
            className="soft-card focus-ring rounded-2xl p-5 text-left transition hover:-translate-y-0.5"
            onClick={() => setShowNotifications((open) => !open)}
            type="button"
          >
            <span className={`text-xs uppercase ${muted}`}>Notifications</span>
            <span className="mt-2 block text-3xl font-bold">{unread}</span>
            <span className={`mt-1 block text-sm ${muted}`}>
              {showNotifications ? "Close notifications" : "View notifications"}
            </span>
          </button>
        </section>

        {showNotifications && (
          <section
            aria-label="Notifications"
            className="soft-card mt-5 rounded-2xl p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-2xl">Notifications</h2>
              <button
                className="button-quiet focus-ring rounded-full border px-3 py-2 text-sm font-semibold"
                onClick={() => setShowNotifications(false)}
                type="button"
              >
                Close
              </button>
            </div>
            {Object.entries(notifications).length === 0 ? (
              <p className={`mt-4 text-sm ${muted}`}>You’re all caught up.</p>
            ) : (
              <ul className="mt-4 divide-y hairline">
                {Object.entries(notifications)
                  .sort((a, b) => (b[1].createdAt ?? 0) - (a[1].createdAt ?? 0))
                  .map(([id, item]) => (
                    <li
                      className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center"
                      key={id}
                    >
                      <div>
                        <p className="font-bold">{item.title}</p>
                        <p className={`mt-1 text-sm ${muted}`}>{item.body}</p>
                        {!item.read && (
                          <span className="mt-2 inline-block rounded-full bg-coral/10 px-2 py-1 text-xs font-semibold text-coral">
                            New
                          </span>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        {!item.read && (
                          <button
                            className="button-quiet focus-ring rounded-full border px-3 py-2 text-xs font-bold"
                            onClick={() => void changeNotification(id, "read")}
                            type="button"
                          >
                            Mark read
                          </button>
                        )}
                        <button
                          className="button-quiet focus-ring rounded-full border px-3 py-2 text-xs font-bold"
                          onClick={() => void changeNotification(id, "delete")}
                          type="button"
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </section>
        )}

        <section className="mt-10">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-3xl">Recent rooms</h2>
            <span className={`text-sm ${muted}`}>
              {roomCount ? `${roomCount} saved` : "Your watched rooms appear here"}
            </span>
          </div>
          <div className="mt-4 grid gap-3">
            {history.length === 0 ? (
              <div className="soft-card rounded-2xl p-7">
                <p className="font-semibold">No watch nights yet.</p>
                <p className={`mt-2 text-sm ${muted}`}>
                  Create a room and invite someone to start your history.
                </p>
                <button
                  className="button-primary focus-ring mt-5 rounded-xl px-4 py-3 text-sm font-bold"
                  onClick={onCreate}
                  type="button"
                >
                  Create your first room
                </button>
              </div>
            ) : (
              history.map((item) => (
                <button
                  key={item.roomId}
                  onClick={() => void openHistoryRoom(item)}
                  className="soft-card focus-ring flex w-full items-center justify-between gap-4 rounded-2xl p-4 text-left transition hover:-translate-y-0.5"
                  type="button"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-bold">
                      {item.title || `Room ${item.roomId}`}
                    </span>
                    <span className={`text-sm ${muted}`}>
                      {formatDuration(item.watchedSeconds ?? 0)} watched
                    </span>
                  </span>
                  <Icon name="arrow-right" size={18} />
                </button>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
