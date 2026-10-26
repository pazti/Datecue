import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  limitToLast,
  onDisconnect,
  onValue,
  orderByChild,
  push,
  query,
  ref,
  remove,
  serverTimestamp,
  set,
} from "firebase/database"
import { Icon } from "../components/Logo"
import { realtimeDatabase, youtubeIdFromUrl } from "../lib/firebase"
import { recordWatchSession } from "../lib/rooms"
import {
  isValidMessage,
  isValidReaction,
  sanitizeMessage,
} from "../lib/validation"
import { getUserProfile, saveUserProfile } from "../lib/rooms"

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
  senderName?: string
  text: string
  createdAt: number
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
const MAX_VISIBLE_MESSAGES = 100
const MAX_VISIBLE_REACTIONS = 30
const REACTION_LIFETIME_MS = 15_000
const WATCH_SAVE_ERROR = "Watch time hasn't synced yet; we'll retry."

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
  const [isPlaying, setIsPlaying] = useState(false)
  const [playerReady, setPlayerReady] = useState(false)
  const [text, setText] = useState("")
  const [showReactions, setShowReactions] = useState(false)
  const [videoError, setVideoError] = useState(false)
  const [copied, setCopied] = useState(false)
  const [inviteUrl, setInviteUrl] = useState("")
  const [sendError, setSendError] = useState("")
  const [roomError, setRoomError] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [participantNames, setParticipantNames] = useState<Record<string, string>>({})
  const [nameDraft, setNameDraft] = useState("")
  const [showNamePrompt, setShowNamePrompt] = useState(false)
  const [sending, setSending] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const playerRef = useRef<any>(null)
  const roomHostRef = useRef<string | null>(null)
  const membershipCleanupTimerRef = useRef(0)
  const isPlayingRef = useRef(false)
  const lastPublishAtRef = useRef(0)
  const hostSampleRef = useRef<{
    time: number
    at: number
    playing: boolean
  } | null>(null)
  const watchedSecondsRef = useRef(0)
  const savedWatchSecondsRef = useRef(0)
  const sessionIdRef = useRef("")
  if (!sessionIdRef.current) sessionIdRef.current = crypto.randomUUID()
  const messageEndRef = useRef<HTMLDivElement>(null)
  const videoId = youtubeIdFromUrl(movieUrl)
  const onlineCount = Object.values(presence).filter(
    (item) => item.online,
  ).length
  const surface = darkMode ? "bg-night text-ivory" : "bg-ivory text-ink"

  useEffect(() => {
    void getUserProfile(userId).then((profile) => {
      const name = profile?.displayName?.trim() ?? ""
      setDisplayName(name)
      setNameDraft(name)
      setShowNamePrompt(!name)
    }).catch(() => setShowNamePrompt(true))
  }, [userId])

  useEffect(() => {
    const names: Record<string, string> = {}
    for (const uid of Object.keys(presence)) {
      void getUserProfile(uid).then((profile) => {
        if (profile?.displayName) setParticipantNames((current) => ({ ...current, [uid]: profile.displayName! }))
      })
    }
    setParticipantNames((current) => ({ ...current, ...names }))
  }, [presence])

  const saveName = async () => {
    const name = nameDraft.trim().slice(0, 40)
    if (name.length < 2) return
    await saveUserProfile(userId, name)
    setDisplayName(name)
    setShowNamePrompt(false)
  }

  const publishPlayback = useCallback(
    async (playing: boolean, currentTime: number) => {
      if (roomHostRef.current !== userId || !Number.isFinite(currentTime))
        return
      const updatedAt = Date.now()
      try {
        await set(ref(realtimeDatabase, `rooms/${roomId}/playback`), {
          playing,
          currentTime: Math.max(0, currentTime),
          updatedAt: serverTimestamp(),
          hostId: userId,
        })
        lastPublishAtRef.current = updatedAt
      } catch {
        setRoomError(
          "Playback couldn't sync. Check the room's Firebase rules and your connection.",
        )
      }
    },
    [roomId, userId],
  )

  useEffect(() => {
    window.clearTimeout(membershipCleanupTimerRef.current)
    const presenceRef = ref(
      realtimeDatabase,
      `rooms/${roomId}/presence/${userId}`,
    )
    const memberRef = ref(realtimeDatabase, `rooms/${roomId}/members/${userId}`)
    const messagesQuery = query(
      ref(realtimeDatabase, `rooms/${roomId}/messages`),
      orderByChild("createdAt"),
      limitToLast(MAX_VISIBLE_MESSAGES),
    )
    const reactionsQuery = query(
      ref(realtimeDatabase, `rooms/${roomId}/reactions`),
      orderByChild("createdAt"),
      limitToLast(MAX_VISIBLE_REACTIONS),
    )
    const fail = () =>
      setRoomError(
        "Room updates are unavailable. Check the Firebase rules and try again.",
      )

    void set(presenceRef, { online: true, updatedAt: serverTimestamp() }).catch(
      fail,
    )
    void onDisconnect(presenceRef).remove().catch(fail)
    void onDisconnect(memberRef).remove().catch(fail)

    const stops = [
      onValue(
        ref(realtimeDatabase, `roomDirectory/${roomId}`),
        (snap) => {
          roomHostRef.current = snap.val()?.hostId ?? null
        },
        fail,
      ),
      onValue(
        ref(realtimeDatabase, `rooms/${roomId}/presence`),
        (snap) => setPresence(snap.val() ?? {}),
        fail,
      ),
      onValue(
        ref(realtimeDatabase, `rooms/${roomId}/playback`),
        (snap) => {
          const value = snap.val() ?? {}
          setPlayback(value)
        },
        fail,
      ),
      onValue(
        messagesQuery,
        (snap) => {
          setMessages(
            Object.entries(snap.val() ?? {})
              .map(([id, value]) => ({ id, ...value as Omit<Message, "id"> }))
              .sort((a, b) => a.createdAt - b.createdAt),
          )
        },
        fail,
      ),
      onValue(
        reactionsQuery,
        (snap) => {
          const recent = Object.entries(snap.val() ?? {})
            .map(([id, value]) => ({ id, ...value as Omit<Reaction, "id"> }))
            .filter(
              (item) => Date.now() - item.createdAt < REACTION_LIFETIME_MS,
            )
          setReactions(recent)
          for (const [id, value] of Object.entries(snap.val() ?? {})) {
            const reaction = value as Reaction
            if (
              reaction.uid === userId &&
              Date.now() - reaction.createdAt >= REACTION_LIFETIME_MS
            ) {
              void remove(
                ref(realtimeDatabase, `rooms/${roomId}/reactions/${id}`),
              )
            }
          }
        },
        fail,
      ),
    ]
    return () => {
      stops.forEach((stop) => stop())
      void remove(presenceRef)
      void recordWatchSession(
        userId,
        roomId,
        movieUrl,
        watchedSecondsRef.current,
        sessionIdRef.current,
      ).catch(() => setRoomError(WATCH_SAVE_ERROR))
      membershipCleanupTimerRef.current = window.setTimeout(() => {
        void remove(memberRef)
      }, 0)
    }
  }, [movieUrl, roomId, userId])

  useEffect(() => {
    setVideoError(false)
    setPlayerReady(false)
    if (!videoId) return

    let timeout = 0
    let script: HTMLScriptElement | null = null
    let previousReady: (() => void) | undefined
    let readyCallback: (() => void) | undefined
    let scriptError: (() => void) | undefined

    const createPlayer = () => {
      if (!window.YT?.Player) return
      window.clearTimeout(timeout)
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
          onReady: () => setPlayerReady(true),
          onError: () => {
            setVideoError(true)
            setRoomError(
              "YouTube couldn't play this video. It may be restricted from embedding.",
            )
          },
          onStateChange: (event: any) => {
            if (![0, 1, 2].includes(event.data)) return
            const playing = event.data === 1
            isPlayingRef.current = playing
            setIsPlaying(playing)
            void publishPlayback(playing, event.target.getCurrentTime())
          },
        },
      })
    }

    if (window.YT?.Player) {
      createPlayer()
    } else {
      script = document.querySelector("script[data-youtube-api]")
      if (!script) {
        script = document.createElement("script")
        script.src = "https://www.youtube.com/iframe_api"
        script.dataset.youtubeApi = "true"
        document.body.appendChild(script)
      }
      previousReady = window.onYouTubeIframeAPIReady
      readyCallback = () => {
        previousReady?.()
        createPlayer()
      }
      window.onYouTubeIframeAPIReady = readyCallback
      scriptError = () => {
        window.clearTimeout(timeout)
        setVideoError(true)
        setRoomError(
          "The YouTube player couldn't load. Check your connection and try again.",
        )
      }
      script.addEventListener("error", scriptError, { once: true })
      timeout = window.setTimeout(() => {
        setVideoError(true)
        setRoomError("The YouTube player took too long to load.")
      }, 12_000)
    }

    return () => {
      window.clearTimeout(timeout)
      if (script && scriptError)
        script.removeEventListener("error", scriptError)
      if (readyCallback && window.onYouTubeIframeAPIReady === readyCallback)
        window.onYouTubeIframeAPIReady = previousReady
      playerRef.current?.destroy?.()
      playerRef.current = null
      isPlayingRef.current = false
      setPlayerReady(false)
    }
  }, [roomId, videoId, publishPlayback])

  useEffect(() => {
    if (!playerReady || !playback.updatedAt || playback.hostId === userId)
      return
    const player = playerRef.current
    if (!player) return
    const target =
      (playback.currentTime ?? 0) +
      (playback.playing
        ? Math.max(0, Date.now() - playback.updatedAt) / 1000
        : 0)
    const currentTime = player.getCurrentTime?.() ?? 0
    if (Math.abs(currentTime - target) > 1.5) player.seekTo?.(target, true)
    isPlayingRef.current = Boolean(playback.playing)
    setIsPlaying(Boolean(playback.playing))
    playback.playing ? player.playVideo?.() : player.pauseVideo?.()
  }, [playback, playerReady, userId])

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (isPlayingRef.current) watchedSecondsRef.current += 1
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const timer = window.setInterval(async () => {
      const seconds = Math.floor(watchedSecondsRef.current)
      if (seconds <= savedWatchSecondsRef.current || !sessionIdRef.current)
        return
      try {
        await recordWatchSession(
          userId,
          roomId,
          movieUrl,
          seconds,
          sessionIdRef.current,
        )
        savedWatchSecondsRef.current = Math.max(
          savedWatchSecondsRef.current,
          seconds,
        )
        setRoomError((current) => (current === WATCH_SAVE_ERROR ? "" : current))
      } catch {
        setRoomError(WATCH_SAVE_ERROR)
      }
    }, 15_000)
    return () => window.clearInterval(timer)
  }, [movieUrl, roomId, userId])

  useEffect(() => {
    const timer = window.setInterval(() => {
      const player = playerRef.current
      if (!playerReady || roomHostRef.current !== userId || !player) return
      const now = Date.now()
      const currentTime = player.getCurrentTime?.()
      if (typeof currentTime !== "number") return
      const playing = player.getPlayerState?.() === 1
      const previous = hostSampleRef.current

      if (previous) {
        const expected =
          previous.time + (previous.playing ? (now - previous.at) / 1000 : 0)
        const wasSeeked = Math.abs(currentTime - expected) > 1.5
        const heartbeatDue = playing && now - lastPublishAtRef.current >= 5000
        if (wasSeeked || heartbeatDue)
          void publishPlayback(playing, currentTime)
      }

      hostSampleRef.current = { time: currentTime, at: now, playing }
      isPlayingRef.current = playing
      setIsPlaying(playing)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [playerReady, publishPlayback, userId])

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ block: "end" })
  }, [messages[messages.length - 1]?.id])

  useEffect(() => {
    if (!inviteUrl) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setInviteUrl("")
    }
    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [inviteUrl])

  const sendMessage = async () => {
    const value = sanitizeMessage(text.trim())
    if (!isValidMessage(value)) {
      setSendError("Write a message before sending (up to 500 characters).")
      return
    }
    setSending(true)
    setSendError("")
    try {
      await push(ref(realtimeDatabase, `rooms/${roomId}/messages`), {
        uid: userId,
        senderName: displayName || "Guest",
        text: value,
        createdAt: serverTimestamp(),
      })
      setText("")
    } catch {
      setSendError(
        "Message failed to send. Check your connection and try again.",
      )
    } finally {
      setSending(false)
    }
  }

  const sendReaction = async (emoji: string) => {
    if (!isValidReaction(emoji)) return
    setSendError("")
    try {
      const reactionRef = push(
        ref(realtimeDatabase, `rooms/${roomId}/reactions`),
      )
      await onDisconnect(reactionRef).remove()
      await set(reactionRef, {
        uid: userId,
        emoji,
        createdAt: serverTimestamp(),
      })
      setShowReactions(false)
      window.setTimeout(() => {
        void remove(reactionRef).catch(() => {
          setRoomError(
            "An old reaction couldn't be cleared. It will be hidden from the room.",
          )
        })
      }, REACTION_LIFETIME_MS)
    } catch {
      setSendError(
        "Reaction failed to send. Check your connection and try again.",
      )
    }
  }

  const invite = async () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}#/room/${roomId}`
    setInviteUrl(shareUrl)
    setCopied(false)
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
    } catch {
      setSendError(
        "Copy wasn't available here. Select the invite link and copy it.",
      )
    }
  }

  const copyInvite = async () => {
    if (!navigator.clipboard?.writeText) {
      setSendError("Select the invite link above and copy it.")
      return
    }
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setSendError("")
    } catch {
      setSendError("Select the invite link above and copy it.")
    }
  }

  const leaveRoom = async () => {
    if (leaving) return
    setLeaving(true)
    setSendError("")
    try {
      if (watchedSecondsRef.current > 0) {
        await recordWatchSession(
          userId,
          roomId,
          movieUrl,
          watchedSecondsRef.current,
          sessionIdRef.current,
        )
      }
      await Promise.all([
        remove(ref(realtimeDatabase, `rooms/${roomId}/presence/${userId}`)),
        remove(ref(realtimeDatabase, `rooms/${roomId}/members/${userId}`)),
      ])
      onLeave()
    } catch {
      setSendError(
        "Your session couldn't be saved or you couldn't leave. Check the connection and retry.",
      )
      setLeaving(false)
    }
  }

  const latestReactions = useMemo(() => reactions.slice(-12), [reactions])

  return (
    <div className={`min-h-[100dvh] ${surface}`}>
      <header className="flex min-h-16 items-center justify-between gap-2 border-b hairline px-3 py-3 sm:px-6">
        <button
          className="button-quiet focus-ring flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-bold"
          disabled={leaving}
          onClick={() => void leaveRoom()}
          type="button"
        >
          <Icon name="arrow-left" size={15} />
          <span>{leaving ? "Saving…" : "Leave room"}</span>
        </button>
        <div className="hidden text-sm font-bold sm:block">Room {roomId}</div>
        <div className="flex items-center gap-2">
          <button
            className="button-quiet focus-ring rounded-full border px-3 py-2 text-xs font-bold"
            onClick={() => void invite()}
            type="button"
          >
            Invite
          </button>
          <button
            className="button-quiet focus-ring h-10 w-10 rounded-full border"
            onClick={onToggleDark}
            aria-label={
              darkMode ? "Switch to light mode" : "Switch to dark mode"
            }
            type="button"
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
                  className="focus-ring text-coral-light underline"
                  href={movieUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open on YouTube
                </a>
              </div>
            )}
          </div>
          <div
            aria-live="polite"
            className="absolute bottom-4 left-4 rounded-full bg-navy/90 px-3 py-2 text-xs text-ivory"
          >
            <span className="mr-2 inline-block h-2 w-2 rounded-full bg-moss" />
            {onlineCount} watching ·{" "}
            {!playerReady
              ? "Connecting"
              : isPlaying
                ? "Playing together"
                : "Paused"}
          </div>
          <div className="absolute bottom-4 right-4 z-10">
            {showReactions ? (
              <div className="reaction-tray flex items-center gap-1 rounded-full border border-white/10 bg-[#25292d]/95 p-1.5 shadow-2xl backdrop-blur-md">
                {REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    aria-label={`React ${emoji}`}
                    onClick={() => void sendReaction(emoji)}
                    className="focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[22px] transition hover:bg-white/10"
                    type="button"
                  >
                    {emoji}
                  </button>
                ))}
                <button
                  aria-label="Close reactions"
                  onClick={() => setShowReactions(false)}
                  className="focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-xl text-white/80"
                  type="button"
                >
                  ×
                </button>
              </div>
            ) : (
              <button
                aria-label="Open reactions"
                onClick={() => setShowReactions(true)}
                className="focus-ring flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-[#25292d]/95 text-2xl text-white shadow-2xl backdrop-blur-md"
                type="button"
              >
                +
              </button>
            )}
          </div>
          {latestReactions.map((reaction) => (
            <span
              key={reaction.id}
              className="reaction-rise pointer-events-none absolute bottom-24 right-1/2 text-3xl"
              aria-hidden="true"
            >
              {reaction.emoji}
            </span>
          ))}
        </section>

        <aside className="flex w-full flex-col border-t hairline lg:w-[380px] lg:border-l lg:border-t-0">
          <div className="border-b hairline px-5 py-4">
            <h1 className="display-serif text-2xl">The conversation</h1>
            <p className="text-sm text-muted-ink" aria-live="polite">
              {onlineCount < 2
                ? "Waiting for another person to join"
                : `${onlineCount} people are watching`}
            </p>
          </div>
          {(roomError || sendError) && (
            <div className="space-y-1 px-4 pt-3">
              {roomError && (
                <p
                  className="rounded-lg bg-coral/10 px-3 py-2 text-sm text-coral"
                  role="alert"
                >
                  {roomError}
                </p>
              )}
              {sendError && (
                <p
                  className="rounded-lg bg-coral/10 px-3 py-2 text-sm text-coral"
                  role="alert"
                >
                  {sendError}
                </p>
              )}
            </div>
          )}
          <div className="min-h-[35dvh] max-h-[55dvh] flex-1 space-y-3 overflow-y-auto p-4 sm:p-5 lg:min-h-0 lg:max-h-none">
            {messages.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-ink">
                Your conversation will appear here. Say hello when you’re ready.
              </p>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`max-w-[88%] break-words rounded-2xl px-3 py-2 text-sm ${
                    message.uid === userId
                      ? "ml-auto bg-coral text-ivory"
                      : "bg-sand/60"
                  }`}
                  >
                  <span className="mb-1 block text-[10px] font-bold opacity-70">
                    {message.uid === userId ? "You" : message.senderName || participantNames[message.uid] || "Guest"}
                  </span>
                  {message.text}
                  <span className="mt-1 block text-[10px] opacity-70">

                    {new Date(message.createdAt).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))
            )}
            <div ref={messageEndRef} />
          </div>
          <div className="border-t hairline p-3 sm:p-4">
            <div className="flex gap-2">
              <input
                className="input-field focus-ring min-w-0 rounded-2xl px-4 py-3 text-sm"
                value={text}
                maxLength={500}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.nativeEvent.isComposing &&
                    event.keyCode !== 229
                  ) {
                    event.preventDefault()
                    void sendMessage()
                  }
                }}
                placeholder="Say something…"
                aria-label="Message"
              />
              <button
                className="button-primary focus-ring rounded-2xl px-4 text-sm font-bold"
                disabled={sending || !text.trim()}
                onClick={() => void sendMessage()}
                type="button"
              >
                {sending ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        </aside>
      </main>

      {showNamePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-5" role="dialog" aria-modal="true" aria-labelledby="name-title">
          <section className="soft-card w-full max-w-md rounded-3xl p-6 shadow-2xl">
            <p className="mono text-xs uppercase tracking-[.16em] text-coral">One small thing</p>
            <h2 className="mt-3 text-3xl" id="name-title">What should they call you?</h2>
            <p className="mt-2 text-sm text-muted-ink">Your name appears beside messages and in the room.</p>
            <input className="input-field focus-ring mt-5 w-full rounded-xl px-4 py-3" autoFocus maxLength={40} minLength={2} value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} placeholder="Display name" />
            <button className="button-primary focus-ring mt-4 w-full rounded-xl px-4 py-3 font-bold" disabled={nameDraft.trim().length < 2} onClick={() => void saveName()} type="button">Save name</button>
          </section>
        </div>
      )}

      {inviteUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setInviteUrl("")
          }}
        >
          <section
            aria-labelledby="invite-title"
            aria-modal="true"
            className="soft-card w-full max-w-md rounded-3xl p-6 shadow-2xl"
            role="dialog"
          >
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl" id="invite-title">
                Invite someone in
              </h2>
              <button
                aria-label="Close invite dialog"
                className="button-quiet focus-ring flex h-10 w-10 items-center justify-center rounded-full border"
                onClick={() => setInviteUrl("")}
                type="button"
              >
                ×
              </button>
            </div>
            <p className="mt-2 text-sm text-muted-ink">
              Share this link. Your guest will be taken to the room code.
            </p>
            <input
              autoFocus
              className="input-field focus-ring mt-5 rounded-xl px-3 py-3 text-sm"
              onFocus={(event) => event.currentTarget.select()}
              readOnly
              value={inviteUrl}
              aria-label="Room invite link"
            />
            <button
              className="button-primary focus-ring mt-4 w-full rounded-xl px-4 py-3 font-bold"
              onClick={() => void copyInvite()}
              type="button"
            >
              {copied ? "Link copied" : "Copy invite link"}
            </button>
            {sendError && (
              <p className="mt-3 text-sm text-coral" role="alert">
                {sendError}
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

declare global {
  interface Window {
    YT?: any
    onYouTubeIframeAPIReady?: () => void
  }
}
