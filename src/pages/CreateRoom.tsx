import { useEffect, useState, type FormEvent } from "react"
import { get, ref, serverTimestamp, update } from "firebase/database"
import Logo, { Icon } from "../components/Logo"
import { createNotification } from "../lib/notifications"
import { auth, realtimeDatabase, trackAnalyticsEvent } from "../lib/firebase"
import { getUserProfile, joinRoom, saveUserProfile } from "../lib/rooms"
import { canonicalYoutubeUrl } from "../lib/youtube"

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

interface Props {
  onCreateRoom: (id: string, url: string) => void
  onJoinRoom: (id: string, url: string) => void
  onBack: () => void
  darkMode: boolean
  onToggleDark: () => void
  userId: string
  initialRoomCode?: string
  initialMovieUrl?: string
}
export default function CreateRoom({
  onCreateRoom,
  onJoinRoom,
  onBack,
  darkMode,
  onToggleDark,
  userId,
  initialRoomCode = "",
  initialMovieUrl = "",
}: Props) {
  const [tab, setTab] = useState<"create" | "join">(
    initialRoomCode ? "join" : "create",
  )
  const [url, setUrl] = useState(initialMovieUrl)
  const [code, setCode] = useState(initialRoomCode.toUpperCase())
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [hasProfileName, setHasProfileName] = useState(false)
  const [profileName, setProfileName] = useState("")
  let roomLookupTimeout = 0
  const surface = darkMode ? "bg-night text-ivory" : "bg-ivory text-ink"
  const muted = darkMode ? "text-ivory/60" : "text-muted-ink"
  useEffect(() => {
    void getUserProfile(userId)
      .then((profile) => {
        setProfileName(profile?.displayName || "")
        setHasProfileName(Boolean(profile?.displayName?.trim()))
      })
      .catch(() => {
        setProfileName("")
        setHasProfileName(false)
      })
      .finally(() => setProfileLoaded(true))
  }, [userId])
  const submit = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault()
    setError("")
    if (!profileLoaded) {
      setError("Your profile is still loading. Try again in a moment.")
      return
    }
    if (profileName.trim().length < 2) {
      setError("Add a display name before creating or joining a room.")
      return
    }
    const id =
      tab === "create"
        ? Array.from(
            crypto.getRandomValues(new Uint8Array(6)),
            (value) => ROOM_CODE_ALPHABET[value & 31],
          ).join("")
        : code
            .replace(/[^a-z0-9]/gi, "")
            .slice(0, 6)
            .toUpperCase()
    const canonicalUrl = canonicalYoutubeUrl(url)
    if (tab === "create" && !canonicalUrl) {
      setError("Paste a valid YouTube video, Shorts, or embed link.")
      return
    }
    if (!/^[A-Z0-9]{6}$/.test(id)) {
      setError("Enter a 6-character room code.")
      return
    }
    const currentUser = auth.currentUser
    if (!currentUser || currentUser.uid !== userId) {
      setError("Your sign-in session is still loading. Refresh and try again.")
      return
    }
    if (
      currentUser.providerData.some((provider) => provider.providerId === "password") &&
      !currentUser.emailVerified
    ) {
      setError("Verify your email before creating or joining a room.")
      return
    }
    setBusy(true)
    try {
      await saveUserProfile(userId, profileName)
      setHasProfileName(true)
      if (tab === "create") {
        const createdAt = serverTimestamp()
        let title = "YouTube video"
        try {
          const oembed = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl!)}&format=json`)
          if (oembed.ok) title = String((await oembed.json()).title || title).slice(0, 120)
        } catch {
          // History can still be saved when YouTube metadata is unavailable.
        }
        await update(ref(realtimeDatabase), {
          [`rooms/${id}`]: {
            movieUrl: canonicalUrl,
            title,
            createdAt,
            updatedAt: createdAt,
            hostId: userId,
            public: {
              movieUrl: canonicalUrl,
              hostId: userId,
              createdAt,
            },
          },
          [`roomDirectory/${id}`]: {
            movieUrl: canonicalUrl,
            title,
            hostId: userId,
            createdAt,
            updatedAt: createdAt,
          },
        })
        void trackAnalyticsEvent("room_created")
      } else {
        void trackAnalyticsEvent("room_join_attempt")
        const roomRef = ref(realtimeDatabase, `roomDirectory/${id}`)
        const snap = await Promise.race([
          get(roomRef),
          new Promise<never>(
            (_, reject) =>
              (roomLookupTimeout = window.setTimeout(
                () => reject(new Error("ROOM_LOOKUP_TIMEOUT")),
                8000,
              )),
          ),
        ])
        window.clearTimeout(roomLookupTimeout)
        const room = snap.val()
        const roomAge = Date.now() - Number(room?.updatedAt ?? room?.createdAt ?? 0)
        if (!snap.exists() || !room?.movieUrl || room.cleanupPending || roomAge > 48 * 60 * 60 * 1000) {
          void trackAnalyticsEvent("room_join_failure", { reason: "expired" })
          setError(room?.cleanupPending
            ? "That room is closing and can no longer be joined. Start a new room instead."
            : "That room has expired or is no longer available. Start a new room instead.")
          return
        }
        await joinRoom(id, currentUser.uid)
        void trackAnalyticsEvent("room_join_success")
        if (room.hostId && room.hostId !== currentUser.uid) {
          void createNotification(room.hostId, {
            title: "Someone joined your room",
            body: `${room.title || "Your video"} is ready to watch together.`,
            type: "invite",
            roomId: id,
          }).catch(() => {})
        }
        onJoinRoom(id, snap.val().movieUrl)
        return
      }
      onCreateRoom(id, canonicalUrl!)
    } catch (error) {
      const codeError = error instanceof Error ? error.message : ""
      if (tab === "join") void trackAnalyticsEvent("room_join_failure")
      setError(
        codeError === "ROOM_LOOKUP_TIMEOUT"
          ? "Room lookup timed out. Check your connection and try again."
          : codeError === "MEMBERSHIP_NOT_CONFIRMED"
            ? "Firebase did not confirm your membership. Deploy the latest database rules and try again."
            : codeError.includes("PERMISSION_DENIED")
              ? tab === "join"
                ? "That room is full or unavailable. Check the code and try again."
                : "Firebase denied room creation. Check the database rules and try again."
              : tab === "join"
                ? "Could not join this room. Check the code and try again."
                : "Room creation failed. Check your connection and try again.",
      )
    } finally {
      window.clearTimeout(roomLookupTimeout)
      setBusy(false)
    }
  }
  return (
    <div className={`film-grain min-h-[100dvh] ${surface}`}>
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5">
        <button
          className="button-quiet focus-ring rounded-full border px-4 py-2 text-sm font-bold"
          onClick={onBack}
        >
          <Icon name="arrow-left" size={16} /> Back home
        </button>
        <Logo dark={darkMode} />
        <button
          aria-label="Toggle theme"
          className="button-quiet focus-ring h-10 w-10 rounded-full border"
          onClick={onToggleDark}
        >
          <Icon name={darkMode ? "sun" : "moon"} size={17} />
        </button>
      </header>
      <main className="mx-auto max-w-xl px-5 pb-20 pt-12">
        <p className={`mono text-xs uppercase tracking-[.2em] ${muted}`}>
          a room for two / setup
        </p>
        <h1 className="mt-5 text-6xl leading-[.9]">Make some room.</h1>
        <form
          className="soft-card mt-10 rounded-[28px] p-6 sm:p-9"
          onSubmit={(event) => void submit(event)}
        >
          <div
            className="flex gap-5 border-b hairline"
            role="group"
            aria-label="Choose whether to create or join a room"
          >
            {(["create", "join"] as const).map((item) => (
              <button
                aria-pressed={tab === item}
                className={`focus-ring pb-4 text-sm font-bold ${
                  tab === item ? "text-coral" : muted
                }`}
                type="button"
                onClick={() => {
                  setTab(item)
                  setError("")
                }}
                key={item}
              >
                {item === "create" ? "Create a room" : "Join a room"}
              </button>
            ))}
          </div>
          {tab === "create" ? (
            <>
              <label
                className={`mt-8 block text-xs font-bold uppercase ${muted}`}
                htmlFor="movie-url"
              >
                YouTube link
              </label>
              <input
                autoComplete="url"
                className="input-field focus-ring mt-2 rounded-xl px-4 py-3.5"
                id="movie-url"
                maxLength={500}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="YouTube video, Shorts, or embed link"
                required
                type="url"
                value={url}
              />
            </>
          ) : (
            <>
              <label
                className={`mt-8 block text-xs font-bold uppercase ${muted}`}
                htmlFor="room-code"
              >
                Room code
              </label>
              <input
                autoComplete="off"
                className="input-field focus-ring mt-2 rounded-xl px-4 py-3.5 text-center font-mono text-xl uppercase tracking-[.3em]"
                id="room-code"
                inputMode="text"
                maxLength={6}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                required
                aria-label="Six-character room code"
                value={code}
              />
            </>
          )}
          {profileLoaded && !hasProfileName && (
            <>
              <label className={`mt-6 block text-xs font-bold uppercase ${muted}`} htmlFor="room-display-name">
                Your display name
              </label>
              <input
                autoComplete="nickname"
                className="input-field focus-ring mt-2 rounded-xl px-4 py-3.5"
                id="room-display-name"
                maxLength={40}
                minLength={2}
                onChange={(event) => setProfileName(event.target.value)}
                placeholder="How should people call you?"
                value={profileName}
              />
            </>
          )}
          {error && (
            <p className="mt-4 text-sm text-coral" role="alert">
              {error}
            </p>
          )}
          <button
            className="button-primary focus-ring mt-8 w-full rounded-xl px-5 py-4 text-sm font-bold"
            disabled={busy}
            type="submit"
          >
            {busy
              ? "Connecting…"
              : tab === "create"
                ? "Create private room"
                : "Join private room"}{" "}
            <Icon name="arrow-right" size={16} />
          </button>
        </form>
      </main>
    </div>
  )
}
