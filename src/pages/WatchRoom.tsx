import { useEffect, useMemo, useRef, useState } from "react"
import {
  onDisconnect,
  onValue,
  push,
  ref,
  remove,
  set,
  update,
} from "firebase/database"
import { Icon } from "../components/Logo"
import { realtimeDatabase, youtubeIdFromUrl } from "../lib/firebase"
import {
  isValidMessage,
  isValidReaction,
  sanitizeMessage,
} from "../lib/validation"

interface Props {
  onLeave: () => void
  darkMode: boolean
  onToggleDark: () => void
  roomId: string
  movieUrl: string
  userId: string
}
interface Message {
  id: string
  uid: string
  text: string
  createdAt: number
  edited?: boolean
  replyTo?: string
}
interface Reaction {
  id: string
  uid: string
  emoji: string
  createdAt: number
}
interface Playback {
  playing?: boolean
  currentTime?: number
  updatedAt?: number
  hostId?: string
}

const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "👋"]

export default function WatchRoom({
  onLeave,
  darkMode,
  onToggleDark,
  roomId,
  movieUrl,
  userId,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [reactions, setReactions] = useState<Reaction[]>([])
  const [presence, setPresence] = useState<Record<string, {
    online?: boolean
  }>>({})
  const [playback, setPlayback] = useState<Playback>({})
  const [text, setText] = useState("")
  const [showReactions, setShowReactions] = useState(false)
  const [videoError, setVideoError] = useState(false)
  const [copied, setCopied] = useState(false)
  const [sendError, setSendError] = useState("")
  const playerRef = useRef<any>(null)
  const lastWrite = useRef(0)
  const videoId = youtubeIdFromUrl(movieUrl)
  const onlineCount = Object.values(presence).filter(
    (item) => item.online,
  ).length
  const surface = darkMode ? "bg-night text-ivory" : "bg-ivory text-ink"

  useEffect(() => {
    const presenceRef = ref(
      realtimeDatabase,
      `rooms/${roomId}/presence/${userId}`,
    )
    void set(presenceRef, { online: true, updatedAt: Date.now() })
    void onDisconnect(presenceRef).remove()
    const stops = [
      onValue(ref(realtimeDatabase, `rooms/${roomId}/presence`), (snap) =>
        setPresence(snap.val() ?? {}),
      ),
      onValue(ref(realtimeDatabase, `rooms/${roomId}/playback`), (snap) =>
        setPlayback(snap.val() ?? {}),
      ),
      onValue(ref(realtimeDatabase, `rooms/${roomId}/messages`), (snap) =>
        setMessages(
          Object.entries(snap.val() ?? {})
            .map(([id, value]) => ({ id, ...value as Omit<Message, "id"> }))
            .sort((a, b) => a.createdAt - b.createdAt),
        ),
      ),
      onValue(ref(realtimeDatabase, `rooms/${roomId}/reactions`), (snap) =>
        setReactions(
          Object.entries(snap.val() ?? {})
            .map(([id, value]) => ({ id, ...value as Omit<Reaction, "id"> }))
            .filter((item) => Date.now() - item.createdAt < 15000),
        ),
      ),
    ]
    return () => {
      stops.forEach((stop) => stop())
      void remove(presenceRef)
    }
  }, [roomId, userId])

  useEffect(() => {
    if (!videoId) return
    const existing = document.querySelector("script[data-youtube-api]")
    if (!existing) {
      const script = document.createElement("script")
      script.src = "https://www.youtube.com/iframe_api"
      script.dataset.youtubeApi = "true"
      document.body.appendChild(script)
    }
    const createPlayer = () => {
      if (!window.YT?.Player) return
      playerRef.current?.destroy?.()
      playerRef.current = new window.YT.Player(`youtube-player-${roomId}`, {
        videoId,
        playerVars: {
          playsinline: 1,
          controls: 1,
          rel: 0,
          modestbranding: 1,
          origin: window.location.origin,
        },
        events: {
          onError: () => setVideoError(true),
          onStateChange: (event: any) => {
            if (event.data === 1 || event.data === 2)
              void publishPlayback(
                event.data === 1,
                event.target.getCurrentTime(),
              )
          },
        },
      })
    }
    if (window.YT?.Player) createPlayer()
    else {
      const previous = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => {
        previous?.()
        createPlayer()
      }
    }
    return () => {
      playerRef.current?.destroy?.()
      playerRef.current = null
    }
  }, [roomId, videoId])

  useEffect(() => {
    if (
      !playerRef.current ||
      !playback.updatedAt ||
      playback.hostId === userId ||
      Date.now() - playback.updatedAt > 8000
    )
      return
    const target =
      (playback.currentTime ?? 0) +
      (playback.playing ? (Date.now() - playback.updatedAt) / 1000 : 0)
    if (Math.abs((playerRef.current.getCurrentTime?.() ?? 0) - target) > 2)
      playerRef.current.seekTo?.(target, true)
    playback.playing
      ? playerRef.current.playVideo?.()
      : playerRef.current.pauseVideo?.()
  }, [playback, userId])

  const publishPlayback = async (playing: boolean, currentTime: number) => {
    if (playback.hostId && playback.hostId !== userId) return
    if (Date.now() - lastWrite.current < 700) return
    lastWrite.current = Date.now()
    await set(ref(realtimeDatabase, `rooms/${roomId}/playback`), {
      playing,
      currentTime,
      updatedAt: Date.now(),
      hostId: userId,
    })
  }
  const sendMessage = async () => {
    const value = sanitizeMessage(text.trim())
    if (!isValidMessage(value)) {
      setSendError("Keep messages between 1 and 500 characters.")
      return
    }
    try {
      await push(ref(realtimeDatabase, `rooms/${roomId}/messages`), {
        uid: userId,
        text: value,
        createdAt: Date.now(),
      })
      setText("")
      setSendError("")
    } catch {
      setSendError("Message failed. Check your connection and try again.")
    }
  }
  const sendReaction = async (emoji: string) => {
    if (!isValidReaction(emoji)) return
    try {
      await push(ref(realtimeDatabase, `rooms/${roomId}/reactions`), {
        uid: userId,
        emoji,
        createdAt: Date.now(),
      })
      setShowReactions(false)
    } catch {
      setSendError("Reaction failed. Check your connection and try again.")
    }
  }
  const invite = async () => {
    await navigator.clipboard?.writeText(`${location.origin}/room/${roomId}`)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }
  const latestReactions = useMemo(() => reactions.slice(-12), [reactions])

  return (
    <div className={`min-h-[100dvh] ${surface}`}>
      <header className="flex min-h-16 items-center justify-between gap-2 border-b hairline px-3 py-3 sm:px-6">
        <button
          className="button-quiet flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-bold"
          onClick={async () => {
            await remove(
              ref(realtimeDatabase, `rooms/${roomId}/presence/${userId}`),
            )
            onLeave()
          }}
        >
          <Icon name="arrow-left" size={15} />
          <span>Leave</span>
        </button>
        <div className="hidden text-sm font-bold sm:block">Room {roomId}</div>
        <div className="flex items-center gap-2">
          <button
            className="button-quiet rounded-full border px-3 py-2 text-xs font-bold"
            onClick={invite}
          >
            {copied ? "Copied" : "Invite"}
          </button>
          <button
            className="button-quiet h-9 w-9 rounded-full border"
            onClick={onToggleDark}
            aria-label="Toggle theme"
          >
            <Icon name={darkMode ? "sun" : "moon"} size={16} />
          </button>
        </div>
      </header>
      <main className="flex min-h-[calc(100dvh-64px)] flex-col lg:flex-row">
        <section className="relative min-h-[42dvh] flex-1 bg-[#10181d] sm:min-h-[58dvh]">
          <div className="absolute inset-0">
            {videoId && !videoError ? (
              <div id={`youtube-player-${roomId}`} className="h-full w-full" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-ivory">
                <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-ivory/30 text-3xl">
                  !
                </div>
                <p className="font-semibold">
                  This YouTube video can&apos;t be played here.
                </p>
                <a
                  className="text-coral-light underline"
                  href={movieUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open on YouTube
                </a>
              </div>
            )}
          </div>
          <div className="absolute bottom-4 left-4 rounded-full bg-navy/90 px-3 py-2 text-xs text-ivory">
            <span className="mr-2 inline-block h-2 w-2 rounded-full bg-moss" />
            {onlineCount} watching ·{" "}
            {playback.playing ? "Playing together" : "Paused together"}
          </div>
          <div className="absolute bottom-4 right-4 z-10">
            <div className="flex items-center gap-1 rounded-full border border-white/10 bg-[#25292d]/95 p-1.5 shadow-2xl backdrop-blur-md">
              {REACTIONS.slice(0, 6).map((emoji) => (
                <button
                  key={emoji}
                  aria-label={`React ${emoji}`}
                  onClick={() => void sendReaction(emoji)}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-[22px] transition hover:scale-125 hover:bg-white/10"
                >
                  {emoji}
                </button>
              ))}
              <button
                aria-label="More reactions"
                onClick={() => setShowReactions((value) => !value)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-2xl text-white/80"
              >
                +
              </button>
            </div>
            {showReactions && (
              <div className="absolute bottom-14 right-0 flex gap-1 rounded-2xl bg-[#25292d]/95 p-2 shadow-2xl">
                {REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => void sendReaction(emoji)}
                    className="flex h-10 w-10 items-center justify-center rounded-full text-xl hover:bg-white/10"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
          {latestReactions.map((reaction) => (
            <span
              key={reaction.id}
              className="reaction-rise absolute bottom-24 right-1/2 text-3xl"
            >
              {reaction.emoji}
            </span>
          ))}
        </section>
        <aside className="flex w-full flex-col border-t hairline lg:w-[380px] lg:border-l lg:border-t-0">
          <div className="border-b hairline px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="display-serif text-2xl">The conversation</h1>
                <p className="text-sm text-muted-ink">
                  {onlineCount < 2
                    ? "Waiting for another person to join"
                    : `${onlineCount} people are watching`}
                </p>
              </div>
              <button
                className="button-primary rounded-full px-4 py-2 text-sm font-bold"
                onClick={invite}
              >
                {copied ? "Copied" : "Invite"}
              </button>
            </div>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
            {messages.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-ink">
                Your conversation will appear here.
              </p>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm ${
                    message.uid === userId
                      ? "ml-auto bg-coral text-ivory"
                      : "bg-sand/60"
                  }`}
                >
                  {message.text}
                  <span className="mt-1 block text-[10px] opacity-60">
                    {new Date(message.createdAt).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))
            )}
          </div>
          <div className="border-t hairline p-3 sm:p-4">
            <div className="flex gap-2">
              <input
                className="input-field rounded-2xl px-4 py-3 text-sm"
                value={text}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.nativeEvent.isComposing &&
                    event.keyCode !== 229
                  )
                    void sendMessage()
                }}
                placeholder="Say something…"
                aria-label="Message"
              />
              <button
                className="button-primary rounded-2xl px-4 text-sm font-bold"
                onClick={() => void sendMessage()}
              >
                Send
              </button>
            </div>
          </div>
        </aside>
      </main>
    </div>
  )
}

declare global {
  interface Window {
    YT?: any
    onYouTubeIframeAPIReady?: () => void
  }
}
