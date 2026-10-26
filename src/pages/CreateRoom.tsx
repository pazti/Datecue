import { useState, type FormEvent } from "react"
import { get, ref, serverTimestamp, set, update } from "firebase/database"
import Logo, { Icon } from "../components/Logo"
import { auth, realtimeDatabase } from "../lib/firebase"
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
  let roomLookupTimeout = 0
  const surface = darkMode ? "bg-night text-ivory" : "bg-ivory text-ink"
  const muted = darkMode ? "text-ivory/60" : "text-muted-ink"
  const submit = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault()
    setError("")
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
    setBusy(true)
    try {
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
            members: { [userId]: true },
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
      } else {
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
        if (!snap.exists() || !room?.movieUrl || roomAge > 48 * 60 * 60 * 1000) {
          setError("That room has expired or is no longer available. Start a new room instead.")
          return
        }
        await set(
          ref(realtimeDatabase, `rooms/${id}/members/${currentUser.uid}`),
          true,
        )
        const membership = await get(
          ref(realtimeDatabase, `rooms/${id}/members/${currentUser.uid}`),
        )
        if (membership.val() !== true) {
          throw new Error("MEMBERSHIP_NOT_CONFIRMED")
        }
        onJoinRoom(id, snap.val().movieUrl)
        return
      }
      onCreateRoom(id, canonicalUrl!)
    } catch (error) {
      const codeError = error instanceof Error ? error.message : ""
      setError(
        codeError === "ROOM_LOOKUP_TIMEOUT"
          ? "Room lookup timed out. Check your connection and try again."
          : codeError === "MEMBERSHIP_NOT_CONFIRMED"
            ? "Firebase did not confirm your membership. Deploy the latest database rules and try again."
            : codeError.includes("PERMISSION_DENIED")
              ? tab === "join"
                ? "That room may be full, or Firebase denied access. Check the code and try again."
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
