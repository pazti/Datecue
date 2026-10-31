import { useEffect, useState } from "react"
import { onValue, ref } from "firebase/database"
import { formatDuration, realtimeDatabase } from "../lib/firebase"
import { joinRoom } from "../lib/rooms"
import {
  clearNotification,
  createNotification,
  markNotificationAsRead,
} from "../lib/notifications"
import {
  disableBrowserNotifications,
  enableBrowserNotifications,
  listenForBrowserNotifications,
} from "../lib/browserNotifications"
import Logo, { Icon } from "../components/Logo"
import type { LegalDocument } from "./LegalPage"

interface RoomRecap {
  roomId: string
  endedAt: number
  durationSeconds: number
  participantNames: string[]
  videos: {
    title: string
    movieUrl: string
    watchedSeconds: number
  }[]
  highlights: {
    text: string
    senderName: string
    videoTime: number
    createdAt: number
  }[]
}

interface RoomCheckpoint {
  movieUrl: string
  position: number
  title?: string
  updatedAt?: number
}

interface Props {
  userId: string
  darkMode: boolean
  onToggleDark: () => void
  onProfile: () => void
  onCreate: () => void
  onJoin: () => void
  onOpenRoom: (
    roomId: string,
    movieUrl: string,
    resumePosition?: number,
  ) => void
  onLogout: () => Promise<void>
  onLegal: (document: LegalDocument) => void
}

interface HistoryItem {
  roomId: string
  movieUrl: string
  title?: string
  thumbnailUrl?: string | null
  watchedSeconds?: number
  updatedAt?: number
}

interface HomeNotification {
  title: string
  body: string
  createdAt?: number
  read?: boolean
  roomId?: string
}

interface ScheduledRoom {
  roomId: string
  movieUrl: string
  title?: string
  scheduledAt: number
  reminderSentAt?: number | null
}

export default function HomePage({
  userId,
  darkMode,
  onToggleDark,
  onProfile,
  onCreate,
  onJoin,
  onOpenRoom,
  onLogout,
  onLegal,
}: Props) {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [recaps, setRecaps] = useState<RoomRecap[]>([])
  const [roomCheckpoints, setRoomCheckpoints] =
    useState<Record<string, RoomCheckpoint>>({})
  const [scheduledRooms, setScheduledRooms] = useState<ScheduledRoom[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [roomCount, setRoomCount] = useState(0)
  const [totalSeconds, setTotalSeconds] = useState(0)
  const [notifications, setNotifications] =
    useState<Record<string, HomeNotification>>({})
  const [showNotifications, setShowNotifications] = useState(false)
  const [error, setError] = useState("")
  const [logoutBusy, setLogoutBusy] = useState(false)
  const [browserAlertsEnabled, setBrowserAlertsEnabled] = useState(
    () =>
      typeof Notification !== "undefined" &&
      Notification.permission === "granted" &&
      window.localStorage.getItem(`datecue-browser-alerts-${userId}`) ===
        "true",
  )
  const [browserAlertsBusy, setBrowserAlertsBusy] = useState(false)
  const [browserAlertsError, setBrowserAlertsError] = useState("")
  useEffect(() => {
    let unsubscribe: (() => void) | undefined
    let cancelled = false
    void listenForBrowserNotifications((title, body) => {
      if (Notification.permission === "granted") {
        new Notification(title, { body })
      }
    })
      .then((stop) => {
        if (cancelled) stop()
        else unsubscribe = stop
      })
      .catch(() => {
        setBrowserAlertsError(
          "Browser notifications could not start. Check your browser settings.",
        )
      })
    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [])

  useEffect(
    () =>
      onValue(
        ref(realtimeDatabase, `users/${userId}`),
        (snapshot) => {
          const value = snapshot.val() ?? {}
          const allHistory = Object.entries(value.history ?? {})
            .map(([historyKey, item]) => ({
              ...item as Omit<HistoryItem, "roomId">,
              roomId: (item as { roomId?: string }).roomId || historyKey,
            }))
            .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
          setTotalSeconds(value.stats?.watchSeconds ?? 0)
          setRoomCount(allHistory.length)
          setHistory(allHistory.slice(0, 8))
          setRecaps(
            Object.entries(value.recaps ?? {})
              .map(([roomId, recap]) => ({
                roomId,
                ...recap as Omit<RoomRecap, "roomId">,
              }))
              .sort((left, right) => right.endedAt - left.endedAt)
              .slice(0, 4),
          )
          setRoomCheckpoints(value.roomCheckpoints ?? {})
          setScheduledRooms(
            (Object.values(value.scheduledRooms ?? {}) as ScheduledRoom[])
              .filter(
                (room) =>
                  Number.isFinite(room.scheduledAt) &&
                  room.scheduledAt > Date.now() - 60 * 60 * 1000,
              )
              .sort((left, right) => left.scheduledAt - right.scheduledAt),
          )
          setNotifications(value.notifications ?? {})
          setError("")
          setLoading(false)
          setLoadError(false)
        },
        () => {
          setError(
            "Your home data couldn't load. Check your connection and try again.",
          )
          setLoading(false)
          setLoadError(true)
        },
      ),
    [loadAttempt, userId],
  )

  const unread = Object.values(notifications).filter(
    (item) => !item.read,
  ).length
  const surface = darkMode ? "bg-night text-ivory" : "bg-ivory text-ink"
  const muted = darkMode ? "text-ivory/60" : "text-muted-ink"

  const openHistoryRoom = async (item: HistoryItem) => {
    setError("")
    try {
      const room = await joinRoom(item.roomId, userId)
      if (room.hostId && room.hostId !== userId) {
        void createNotification(room.hostId, {
          title: "Someone rejoined your room",
          body: `${room.title || "Your video"} is ready to watch together.`,
          type: "invite",
          roomId: item.roomId,
        }).catch(() => {})
      }
      const checkpoint = roomCheckpoints[item.roomId]
      onOpenRoom(
        item.roomId,
        item.movieUrl,
        checkpoint?.movieUrl === item.movieUrl
          ? checkpoint.position
          : undefined,
      )
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : ""
      setError(
        code === "ROOM_EXPIRED"
          ? "That room has ended or expired. Start a new room or join with a current code."
          : code.includes("PERMISSION_DENIED")
            ? "That room is full or unavailable. Join with a current room code instead."
            : "That room is no longer available. Start a new room or join with a current code.",
      )
    }
  }

  const openScheduledRoom = async (item: ScheduledRoom) => {
    setError("")
    try {
      await joinRoom(item.roomId, userId)
      const checkpoint = roomCheckpoints[item.roomId]
      onOpenRoom(
        item.roomId,
        item.movieUrl,
        checkpoint?.movieUrl === item.movieUrl
          ? checkpoint.position
          : undefined,
      )
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : ""
      setError(
        code === "ROOM_EXPIRED"
          ? "That scheduled room has expired. Create a new room to watch together."
          : "That room couldn't be opened. Check your connection and try again.",
      )
    }
  }

  const copyScheduledInvite = async (roomId: string) => {
    const url = `${window.location.origin}${window.location.pathname}#/room/${roomId}`
    try {
      await navigator.clipboard.writeText(url)
      setError("")
    } catch {
      setError(
        "The invite couldn't be copied. Open the room to share its invite.",
      )
    }
  }

  const openNotificationRoom = async (roomId: string) => {
    setError("")
    try {
      const room = await joinRoom(roomId, userId)
      const checkpoint = roomCheckpoints[roomId]
      onOpenRoom(
        roomId,
        room.movieUrl,
        checkpoint?.movieUrl === room.movieUrl
          ? checkpoint.position
          : undefined,
      )
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : ""
      setError(
        code === "ROOM_EXPIRED"
          ? "That room has ended or expired. Start a new room or join with a current code."
          : "That room couldn't be opened. Check your connection and try again.",
      )
    }
  }

  const changeNotification = async (id: string, action: "read" | "delete") => {
    setError("")
    try {
      if (action === "read") await markNotificationAsRead(userId, id)
      else await clearNotification(userId, id)
    } catch {
      setError("That notification couldn't be updated. Try again.")
    }
  }

  const toggleBrowserAlerts = async () => {
    setBrowserAlertsBusy(true)
    setBrowserAlertsError("")
    try {
      if (browserAlertsEnabled) {
        await disableBrowserNotifications(userId)
        window.localStorage.removeItem(`datecue-browser-alerts-${userId}`)
        setBrowserAlertsEnabled(false)
      } else {
        await enableBrowserNotifications(userId)
        window.localStorage.setItem(`datecue-browser-alerts-${userId}`, "true")
        setBrowserAlertsEnabled(true)
      }
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : ""
      setBrowserAlertsError(
        code === "PUSH_UNSUPPORTED"
          ? "This browser does not support web notifications."
          : code === "PUSH_VAPID_KEY_MISSING"
            ? "Browser notifications are not configured for this deployment yet."
            : code === "PUSH_PERMISSION_DENIED"
              ? "Notifications are blocked in your browser settings."
              : code === "PUSH_NOT_SIGNED_IN"
                ? "Your sign-in session expired. Refresh and try again."
                : "Browser notifications couldn't be updated. Check your connection and retry.",
      )
    } finally {
      setBrowserAlertsBusy(false)
    }
  }

  const logout = async () => {
    setLogoutBusy(true)
    setError("")
    try {
      await onLogout()
    } catch {
      setError(
        "You couldn't be signed out. Check your connection and try again.",
      )
    } finally {
      setLogoutBusy(false)
    }
  }

  return (
    <div className={`film-grain surface-wash min-h-[100dvh] ${surface}`}>
      <header className="mx-auto flex max-w-6xl items-center justify-between border-b hairline px-5 py-4 sm:px-8">
        <Logo dark={darkMode} />
        <div className="flex items-center gap-2">
          <button
            className="button-quiet focus-ring rounded-full border px-3 py-2 text-xs font-bold sm:px-4 sm:text-sm"
            onClick={onProfile}
            type="button"
          >
            Your profile
          </button>
          <button
            aria-label={
              darkMode ? "Switch to light mode" : "Switch to dark mode"
            }
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
      <main className="page-enter mx-auto max-w-6xl px-5 pb-16 pt-9 sm:px-8 sm:pt-12">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <p className={`eyebrow ${muted}`}>your datecue home</p>
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
          <div
            className="mt-6 flex flex-col items-start justify-between gap-3 rounded-2xl border border-coral/20 bg-coral/10 px-4 py-3 text-sm text-coral sm:flex-row sm:items-center"
            role="alert"
          >
            <p>{error}</p>
            {loadError && (
              <button
                className="focus-ring shrink-0 rounded-full border border-coral/30 px-3 py-2 text-xs font-bold"
                onClick={() => {
                  setLoading(true)
                  setLoadAttempt((attempt) => attempt + 1)
                }}
                type="button"
              >
                Try again
              </button>
            )}
          </div>
        )}

        <section
          className="mt-9 grid gap-3 md:grid-cols-[1.15fr_.85fr]"
          aria-label="Your activity"
        >
          <div className="soft-card relative flex min-h-36 flex-col justify-between overflow-hidden rounded-[24px] p-6 sm:p-7">
            <div
              aria-hidden="true"
              className="absolute -right-5 -top-12 h-44 w-44 rounded-full border border-coral/20"
            />
            <p className={`eyebrow relative ${muted}`}>Time spent together</p>
            <p className="display-serif relative mt-4 text-5xl leading-none sm:text-6xl">
              {loading ? (
                <span
                  className="loading-shimmer inline-block h-12 w-28 rounded-xl align-middle"
                  aria-label="Loading watch time"
                />
              ) : loadError ? (
                "—"
              ) : (
                formatDuration(totalSeconds)
              )}
            </p>
            <p className={`relative mt-3 text-sm ${muted}`}>
              Your shared screen time, saved for you.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
            <div className="soft-card flex items-center justify-between gap-4 rounded-[22px] px-5 py-4">
              <div>
                <p className={`eyebrow ${muted}`}>Watch nights</p>
                <p className="mt-1 text-2xl font-semibold">
                  {loading || loadError ? "—" : roomCount}
                </p>
              </div>
              <span
                aria-hidden="true"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-moss/15 text-moss"
              >
                <Icon name="film" size={19} />
              </span>
            </div>
            <button
              aria-expanded={showNotifications}
              className="soft-card focus-ring flex items-center justify-between gap-4 rounded-[22px] px-5 py-4 text-left transition hover:-translate-y-0.5"
              onClick={() => setShowNotifications((open) => !open)}
              type="button"
            >
              <span>
                <span className={`eyebrow block ${muted}`}>Notifications</span>
                <span className="mt-1 block text-2xl font-semibold">
                  {loading || loadError ? "—" : unread}
                </span>
                <span className={`mt-1 block text-xs ${muted}`}>
                  {showNotifications ? "Close notifications" : "View updates"}
                </span>
              </span>
              <span
                aria-hidden="true"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-coral/12 text-coral"
              >
                <Icon name="message" size={19} />
              </span>
            </button>
          </div>
        </section>

        {scheduledRooms.length > 0 && (
          <section aria-labelledby="scheduled-rooms-title" className="mt-8">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className={`eyebrow ${muted}`}>Save the date</p>
                <h2 className="mt-2 text-3xl" id="scheduled-rooms-title">
                  Upcoming watch rooms
                </h2>
              </div>
              <span className={`text-xs ${muted}`}>
                In-app reminders at start time
              </span>
            </div>
            <ul className="mt-4 grid gap-3">
              {scheduledRooms.map((room) => (
                <li
                  className="soft-card flex flex-col gap-3 rounded-[22px] p-4 sm:flex-row sm:items-center"
                  key={room.roomId}
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold">
                      {room.title || "YouTube video"}
                    </h3>
                    <p className={`mt-1 text-sm ${muted}`}>
                      {new Date(room.scheduledAt).toLocaleString([], {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                      {" · Room "}
                      <span className="mono">{room.roomId}</span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="button-quiet focus-ring rounded-xl border px-3 py-2 text-xs font-bold"
                      onClick={() => void copyScheduledInvite(room.roomId)}
                      type="button"
                    >
                      Copy invite
                    </button>
                    <button
                      className="button-primary focus-ring rounded-xl px-3 py-2 text-xs font-bold"
                      onClick={() => void openScheduledRoom(room)}
                      type="button"
                    >
                      Open room
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {recaps.length > 0 && (
          <section aria-labelledby="room-recaps-title" className="mt-10">
            <p className={`eyebrow ${muted}`}>A little look back</p>
            <h2 className="mt-2 text-3xl" id="room-recaps-title">
              Watch-together recaps
            </h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {recaps.map((recap) => (
                <article
                  className="soft-card rounded-[22px] p-5"
                  key={recap.roomId}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {recap.participantNames.join(" · ") ||
                          "Your watch night"}
                      </p>
                      <p className={`mt-1 text-xs ${muted}`}>
                        {new Date(recap.endedAt).toLocaleDateString([], {
                          dateStyle: "long",
                        })}
                        {" · "}
                        {formatDuration(recap.durationSeconds)} together
                      </p>
                    </div>
                    <span className="mono shrink-0 text-xs text-coral">
                      {recap.videos.length}{" "}
                      {recap.videos.length === 1 ? "video" : "videos"}
                    </span>
                  </div>
                  <ul className="mt-4 space-y-2 border-t hairline pt-3">
                    {recap.videos.slice(0, 3).map((video) => (
                      <li
                        className="flex items-center justify-between gap-3 text-sm"
                        key={video.movieUrl}
                      >
                        <span className="truncate">{video.title}</span>
                        <span className={`shrink-0 text-xs ${muted}`}>
                          {formatDuration(video.watchedSeconds)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {recap.highlights[0] && (
                    <p className={`mt-3 line-clamp-2 text-sm italic ${muted}`}>
                      “{recap.highlights[0].text}”
                      <span className="not-italic">
                        {" "}
                        — {recap.highlights[0].senderName}
                      </span>
                    </p>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}

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
            {loading ? (
              <p className={`mt-4 text-sm ${muted}`} role="status">
                Loading notifications…
              </p>
            ) : loadError ? (
              <p className={`mt-4 text-sm ${muted}`} role="alert">
                Notifications couldn’t load. Try again when your connection is
                back.
              </p>
            ) : Object.entries(notifications).length === 0 ? (
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
                        {item.roomId && (
                          <button
                            className="button-quiet focus-ring rounded-full border px-3 py-2 text-xs font-bold"
                            onClick={() =>
                              item.roomId &&
                              void openNotificationRoom(item.roomId)
                            }
                            type="button"
                          >
                            Open room
                          </button>
                        )}
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
            <div className="mt-4 flex flex-col justify-between gap-3 border-t hairline pt-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm font-bold">Browser notifications</p>
                <p className={`mt-1 text-xs ${muted}`}>
                  Get room updates when Datecue is in the background.
                </p>
                {browserAlertsError && (
                  <p className="mt-2 text-sm text-coral" role="alert">
                    {browserAlertsError}
                  </p>
                )}
              </div>
              <button
                className="button-quiet focus-ring shrink-0 rounded-xl border px-4 py-3 text-sm font-bold"
                disabled={browserAlertsBusy}
                onClick={() => void toggleBrowserAlerts()}
                type="button"
              >
                {browserAlertsBusy
                  ? "Updating…"
                  : browserAlertsEnabled
                    ? "Turn off alerts"
                    : "Enable alerts"}
              </button>
            </div>
          </section>
        )}

        <section className="mt-12">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-3xl sm:text-4xl">A few nights to revisit</h2>
            <span className={`text-sm ${muted}`}>
              {loadError
                ? "History unavailable"
                : loading
                  ? "Loading your history…"
                  : roomCount
                    ? `${roomCount} saved`
                    : "Your watched rooms appear here"}
            </span>
          </div>
          <div className="mt-4 grid gap-3">
            {loading ? (
              <div
                className="space-y-3"
                role="status"
                aria-label="Loading recent rooms"
              >
                {[0, 1, 2].map((item) => (
                  <div
                    className="soft-card flex items-center gap-4 rounded-[22px] p-4"
                    key={item}
                  >
                    <span
                      className="loading-shimmer h-16 w-28 shrink-0 rounded-[14px]"
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 space-y-2">
                      <span className="loading-shimmer block h-4 w-2/3 rounded-full" />
                      <span className="loading-shimmer block h-3 w-1/3 rounded-full" />
                    </span>
                  </div>
                ))}
              </div>
            ) : loadError ? (
              <div className="soft-card rounded-[26px] p-7 sm:p-9">
                <p className="display-serif text-3xl">
                  Your history is taking a moment.
                </p>
                <p className={`mt-2 text-sm leading-relaxed ${muted}`}>
                  We couldn’t load your saved rooms, so we haven’t shown an
                  empty state.
                </p>
                <button
                  className="button-primary focus-ring mt-5 rounded-xl px-4 py-3 text-sm font-bold"
                  onClick={() => {
                    setLoading(true)
                    setLoadAttempt((attempt) => attempt + 1)
                  }}
                  type="button"
                >
                  Try again
                </button>
              </div>
            ) : history.length === 0 ? (
              <div className="soft-card relative overflow-hidden rounded-[26px] p-7 sm:p-9">
                <div
                  aria-hidden="true"
                  className="absolute -right-8 -top-10 h-48 w-48 rounded-full border border-moss/20"
                />
                <p className="display-serif relative text-3xl">
                  Your story starts with a play button.
                </p>
                <p
                  className={`relative mt-2 max-w-md text-sm leading-relaxed ${muted}`}
                >
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
                  className="soft-card focus-ring group flex w-full items-center justify-between gap-4 rounded-[22px] p-3 text-left transition hover:-translate-y-0.5 sm:p-4"
                  type="button"
                >
                  {item.thumbnailUrl && (
                    <img
                      alt=""
                      className="h-16 w-28 shrink-0 rounded-[14px] object-cover sm:h-[76px] sm:w-32"
                      loading="lazy"
                      src={item.thumbnailUrl}
                    />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate font-bold">
                      {item.title || `Room ${item.roomId}`}
                    </span>
                    <span className={`text-sm ${muted}`}>
                      {formatDuration(item.watchedSeconds ?? 0)} watched
                    </span>
                  </span>
                  <Icon
                    className="shrink-0 transition-transform group-hover:translate-x-1"
                    name="arrow-right"
                    size={18}
                  />
                </button>
              ))
            )}
          </div>
        </section>
      </main>
      <footer className="border-t hairline px-5 py-6 sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 text-sm text-muted-ink">
          <span>Datecue</span>
          <nav aria-label="Legal documents" className="flex gap-4">
            <button
              className="focus-ring underline underline-offset-2"
              onClick={() => onLegal("privacy")}
              type="button"
            >
              Privacy
            </button>
            <button
              className="focus-ring underline underline-offset-2"
              onClick={() => onLegal("terms")}
              type="button"
            >
              Terms
            </button>
          </nav>
        </div>
      </footer>
    </div>
  )
}
