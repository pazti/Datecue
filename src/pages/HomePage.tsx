import { useEffect, useState } from "react"
import { onValue, ref } from "firebase/database"
import { formatDuration, realtimeDatabase } from "../lib/firebase"
import Logo, { Icon } from "../components/Logo"

interface Props {
  userId: string
  darkMode: boolean
  onToggleDark: () => void
  onCreate: () => void
  onJoin: () => void
  onLogout: () => void
}
interface HistoryItem {
  roomId: string
  movieUrl: string
  title?: string
  watchedSeconds?: number
  updatedAt?: number
}

export default function HomePage({
  userId,
  darkMode,
  onToggleDark,
  onCreate,
  onJoin,
  onLogout,
}: Props) {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [totalSeconds, setTotalSeconds] = useState(0)
  const [notifications, setNotifications] = useState<Record<string, {
    title: string
    body: string
    read?: boolean
  }>>({})
  useEffect(
    () =>
      onValue(ref(realtimeDatabase, `users/${userId}`), (snapshot) => {
        const value = snapshot.val() ?? {}
        setTotalSeconds(value.stats?.watchSeconds ?? 0)
        setHistory(
          Object.entries(value.history ?? {})
            .map(([roomId, item]) => ({
              roomId,
              ...item as Omit<HistoryItem, "roomId">,
            }))
            .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
            .slice(0, 8),
        )
        setNotifications(value.notifications ?? {})
      }),
    [userId],
  )
  const unread = Object.values(notifications).filter(
    (item) => !item.read,
  ).length
  const surface = darkMode ? "bg-night text-ivory" : "bg-ivory text-ink"
  const muted = darkMode ? "text-ivory/60" : "text-muted-ink"
  return (
    <div className={`film-grain min-h-[100dvh] ${surface}`}>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo dark={darkMode} />
        <div className="flex items-center gap-2">
          <button
            className="button-quiet rounded-full border px-3 py-2 text-xs font-bold"
            onClick={onToggleDark}
          >
            <Icon name={darkMode ? "sun" : "moon"} size={15} />
          </button>
          <button
            className="button-quiet rounded-full border px-3 py-2 text-xs font-bold"
            onClick={onLogout}
          >
            Log out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 pb-16 pt-8">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <p className={`mono text-xs uppercase tracking-[.2em] ${muted}`}>
              your datecue home
            </p>
            <h1 className="mt-3 text-5xl sm:text-6xl">
              What are you watching next?
            </h1>
          </div>
          <div className="flex gap-2">
            <button
              className="button-primary rounded-xl px-4 py-3 text-sm font-bold"
              onClick={onCreate}
            >
              Create room
            </button>
            <button
              className="button-quiet rounded-xl border px-4 py-3 text-sm font-bold"
              onClick={onJoin}
            >
              Join room
            </button>
          </div>
        </div>
        <section className="mt-8 grid gap-3 sm:grid-cols-3">
          <div className="soft-card rounded-2xl p-5">
            <p className={`text-xs uppercase ${muted}`}>Total watch time</p>
            <p className="mt-2 text-3xl font-bold">
              {formatDuration(totalSeconds)}
            </p>
          </div>
          <div className="soft-card rounded-2xl p-5">
            <p className={`text-xs uppercase ${muted}`}>Rooms watched</p>
            <p className="mt-2 text-3xl font-bold">{history.length}</p>
          </div>
          <div className="soft-card rounded-2xl p-5">
            <p className={`text-xs uppercase ${muted}`}>Notifications</p>
            <p className="mt-2 text-3xl font-bold">{unread}</p>
          </div>
        </section>
        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl">Recent rooms</h2>
            <span className={`text-sm ${muted}`}>
              {history.length ? "Synced from Firebase" : "No rooms yet"}
            </span>
          </div>
          <div className="mt-4 grid gap-3">
            {history.map((item) => (
              <button
                key={item.roomId}
                onClick={onJoin}
                className="soft-card flex w-full items-center justify-between rounded-2xl p-4 text-left"
              >
                <span>
                  <span className="block font-bold">Room {item.roomId}</span>
                  <span className={`text-sm ${muted}`}>
                    {formatDuration(item.watchedSeconds ?? 0)} watched
                  </span>
                </span>
                <Icon name="arrow-right" size={18} />
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
