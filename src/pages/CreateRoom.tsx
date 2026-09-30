import { useState } from "react"
import { get, ref, set } from "firebase/database"
import Logo, { Icon } from "../components/Logo"
import { realtimeDatabase } from "../lib/firebase"
interface Props {
  onCreateRoom: (id: string, url: string) => void
  onJoinRoom: (id: string, url: string) => void
  onBack: () => void
  darkMode: boolean
  onToggleDark: () => void
  userId: string
}
export default function CreateRoom({
  onCreateRoom,
  onJoinRoom,
  onBack,
  darkMode,
  onToggleDark,
  userId,
}: Props) {
  const [tab, setTab] = useState<"create" | "join">("create")
  const [url, setUrl] = useState("")
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const surface = darkMode ? "bg-night text-ivory" : "bg-ivory text-ink"
  const muted = darkMode ? "text-ivory/60" : "text-muted-ink"
  const submit = async () => {
    setError("")
    const id =
      tab === "create"
        ? Math.random().toString(36).slice(2, 8).toUpperCase()
        : code.trim().toUpperCase()
    const youtube =
      /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)[\w-]{11}/.test(
        url.trim(),
      )
    if (tab === "create" && !youtube) {
      setError("Paste a valid YouTube watch link.")
      return
    }
    if (!/^[A-Z0-9]{6}$/.test(id)) {
      setError("Enter a 6-character room code.")
      return
    }
    setBusy(true)
    try {
      if (tab === "create")
        await set(ref(realtimeDatabase, `rooms/${id}`), {
          movieUrl: url.trim(),
          createdAt: Date.now(),
          hostId: userId,
          members: { [userId]: true },
          public: {
            movieUrl: url.trim(),
            hostId: userId,
            createdAt: Date.now(),
          },
        })
      else {
        const roomRef = ref(realtimeDatabase, `rooms/${id}/public`)
        const snap = await Promise.race([
          get(roomRef),
          new Promise<never>((_, reject) =>
            window.setTimeout(
              () => reject(new Error("ROOM_LOOKUP_TIMEOUT")),
              8000,
            ),
          ),
        ])
        if (!snap.exists() || !snap.val()?.movieUrl) {
          setError("That room does not exist or is no longer available.")
          return
        }
        await set(ref(realtimeDatabase, `rooms/${id}/members/${userId}`), true)
        onJoinRoom(id, snap.val().movieUrl)
        return
      }
      onCreateRoom(id, url.trim())
    } catch (error) {
      setError(
        error instanceof Error && error.message === "ROOM_LOOKUP_TIMEOUT"
          ? "Room lookup timed out. Check your connection and try again."
          : "Could not join this room. Check the code and try again.",
      )
    } finally {
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
        <div className="soft-card mt-10 rounded-[28px] p-6 sm:p-9">
          <div className="flex gap-5 border-b hairline">
            {(["create", "join"] as const).map((item) => (
              <button
                className={`pb-4 text-sm font-bold ${
                  tab === item ? "text-coral" : muted
                }`}
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
                className="input-field focus-ring mt-2 rounded-xl px-4 py-3.5"
                id="movie-url"
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
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
                className="input-field focus-ring mt-2 rounded-xl px-4 py-3.5 text-center font-mono text-xl uppercase tracking-[.3em]"
                id="room-code"
                maxLength={6}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
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
            onClick={submit}
          >
            {busy
              ? "Connecting…"
              : tab === "create"
                ? "Create private room"
                : "Join private room"}{" "}
            <Icon name="arrow-right" size={16} />
          </button>
        </div>
      </main>
    </div>
  )
}
