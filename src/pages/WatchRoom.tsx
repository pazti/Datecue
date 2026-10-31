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
  update,
} from "firebase/database"
import { Icon } from "../components/Logo"
import AccessibleDialog from "../components/AccessibleDialog"
import {
  realtimeDatabase,
  trackAnalyticsEvent,
  youtubeIdFromUrl,
} from "../lib/firebase"
import { createNotification } from "../lib/notifications"
import { recordWatchSession } from "../lib/rooms"
import { canonicalYoutubeUrl } from "../lib/youtube"
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
  videoTime?: number
  videoId?: string
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
const REACTION_LABELS: Record<string, string> = {
  "👍": "Like",
  "❤️": "Love",
  "😂": "Laugh",
  "😮": "Surprised",
  "😢": "Moved",
  "🙏": "Thanks",
  "👋": "Wave",
}
const MAX_VISIBLE_MESSAGES = 100
const MAX_VISIBLE_REACTIONS = 30
const REACTION_LIFETIME_MS = 15_000
const WATCH_SAVE_ERROR = "Watch time hasn't synced yet; we'll retry."

function formatVideoTime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const remaining = safe % 60
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`
    : `${minutes}:${String(remaining).padStart(2, "0")}`
}

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
    displayName?: string
    bio?: string
  }>>({})
  const presenceRef = useRef(presence)
  presenceRef.current = presence
  const [playback, setPlayback] = useState<Playback>({})
  const [hostId, setHostId] = useState<string | null>(null)
  const [roomMovieUrl, setRoomMovieUrl] = useState(movieUrl)
  const [roomTitle, setRoomTitle] = useState("YouTube video")
  const [isPlaying, setIsPlaying] = useState(false)
  const [videoTime, setVideoTime] = useState(0)
  const [videoDuration, setVideoDuration] = useState(0)
  const [playerReady, setPlayerReady] = useState(false)
  const [text, setText] = useState("")
  const [videoDraft, setVideoDraft] = useState("")
  const [changingVideo, setChangingVideo] = useState(false)
  const [showReactions, setShowReactions] = useState(false)
  const [videoError, setVideoError] = useState("")
  const [copied, setCopied] = useState(false)
  const [roomCodeCopied, setRoomCodeCopied] = useState(false)
  const [inviteUrl, setInviteUrl] = useState("")
  const [sendError, setSendError] = useState("")
  const [roomError, setRoomError] = useState("")
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({})
  const [displayName, setDisplayName] = useState("")
  const [profileBio, setProfileBio] = useState("")
  const [nameError, setNameError] = useState("")
  const [participantNames, setParticipantNames] =
    useState<Record<string, string>>({})
  const [nameDraft, setNameDraft] = useState("")
  const [showNamePrompt, setShowNamePrompt] = useState(false)
  const [profilePreview, setProfilePreview] = useState<{
    uid: string
    name: string
    online: boolean
    bio?: string
  } | null>(null)
  const [hostLeft, setHostLeft] = useState(false)
  const [roomEnded, setRoomEnded] = useState(false)
  const [sending, setSending] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const playerRef = useRef<any>(null)
  const playerContainerRef = useRef<HTMLDivElement>(null)
  const publishPlaybackRef = useRef<(
    playing: boolean,
    currentTime: number,
  ) => Promise<void>>(async () => {})
  const roomHostRef = useRef<string | null>(null)
  const displayNameRef = useRef(displayName)
  displayNameRef.current = displayName
  const roomTitleRef = useRef("YouTube video")
  const activeVideoTitleRef = useRef("YouTube video")
  const activeVideoUrlRef = useRef(movieUrl)
  const lastPlayingRef = useRef(false)
  const isPlayingRef = useRef(false)
  const lastWatchTickRef = useRef(0)
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
  const videoId = youtubeIdFromUrl(roomMovieUrl)
  const onlineCount = Object.values(presence).filter(
    (item) => item.online,
  ).length
  const surface = darkMode ? "bg-night text-ivory" : "bg-ivory text-ink"

  useEffect(() => {
    if (!videoId) return
    let cancelled = false
    let player: any = null
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]',
    )
    const loadApi = new Promise<void>((resolve) => {
      if (window.YT?.Player) {
        resolve()
        return
      }
      const previousCallback = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => {
        previousCallback?.()
        resolve()
      }
      if (!existingScript) {
        const script = document.createElement("script")
        script.src = "https://www.youtube.com/iframe_api"
        script.async = true
        script.onerror = () =>
          setVideoError(
            "The YouTube player couldn't load. Check your connection and try again.",
          )
        document.head.appendChild(script)
      }
    })

    void loadApi.then(() => {
      if (cancelled || !playerContainerRef.current || !window.YT?.Player) return
      const target = document.createElement("div")
      target.className = "h-full w-full"
      playerContainerRef.current.replaceChildren(target)
      player = new window.YT.Player(target, {
        width: "100%",
        height: "100%",
        videoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          playsinline: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (event: any) => {
            if (cancelled) return
            playerRef.current = event.target
            setVideoDuration(event.target.getDuration?.() ?? 0)
            setPlayerReady(true)
          },
          onStateChange: (event: any) => {
            const playing = event.data === 1
            isPlayingRef.current = playing
            setIsPlaying(playing)
            setVideoTime(event.target.getCurrentTime?.() ?? 0)
            if (roomHostRef.current === userId) {
              const currentTime = event.target.getCurrentTime?.() ?? 0
              void publishPlaybackRef.current(playing, currentTime)
              if (playing && !lastPlayingRef.current) {
                void trackAnalyticsEvent("host_started_playing")
                for (const uid of Object.keys(presenceRef.current)) {
                  if (uid !== userId) {
                    void createNotification(uid, {
                      title: "The host started the video",
                      body: `${roomTitleRef.current} is playing now.`,
                      type: "system",
                      roomId,
                    }).catch(() => {})
                  }
                }
              }
              lastPlayingRef.current = playing
            }
          },
          onError: (event: any) => {
            const messages: Record<number, string> = {
              2: "That YouTube link is invalid.",
              5: "This video couldn't be played in the browser.",
              100: "This video is unavailable or has been removed.",
              101: "The video owner doesn't allow playback in other websites.",
              150: "The video owner doesn't allow playback in other websites.",
            }
            setVideoError(
              messages[event.data] ||
                "This YouTube video can't be played here.",
            )
          },
        },
      })
    })

    return () => {
      cancelled = true
      setPlayerReady(false)
      playerRef.current = null
      player?.destroy?.()
      playerContainerRef.current?.replaceChildren()
    }
  }, [roomId, userId, videoId])

  useEffect(() => {
    const player = playerRef.current
    if (!playerReady || hostId === userId || !player || !playback.updatedAt)
      return
    const target =
      (playback.currentTime ?? 0) +
      (playback.playing
        ? Math.max(0, Date.now() - playback.updatedAt) / 1000
        : 0)
    const currentTime = player.getCurrentTime?.() ?? 0
    if (Math.abs(currentTime - target) > 1.5) player.seekTo?.(target, true)
    if (playback.playing) player.playVideo?.()
    else player.pauseVideo?.()
  }, [hostId, playback, playerReady, userId])

  useEffect(() => {
    void getUserProfile(userId)
      .then((profile) => {
        const name = profile?.displayName?.trim() ?? ""
        setDisplayName(name)
        setNameDraft(name)
        setProfileBio(profile?.bio ?? "")
        setShowNamePrompt(!name)
      })
      .catch(() => {
        setRoomError("Your room profile couldn't load. Check your connection and try again.")
        setShowNamePrompt(true)
      })
  }, [userId])

  useEffect(() => {
    void trackAnalyticsEvent("watch_session_start")
  }, [roomId])

  useEffect(
    () => () => {
      void trackAnalyticsEvent("watch_session_end", {
        duration_seconds: Math.floor(watchedSecondsRef.current),
      })
    },
    [roomId],
  )

  useEffect(() => {
    const hostId = roomHostRef.current
    setHostLeft(
      Boolean(hostId && hostId !== userId && !presence[hostId]?.online),
    )
  }, [hostId, presence, userId, playback.hostId])

  useEffect(() => {
    const names: Record<string, string> = {}
    for (const [uid, value] of Object.entries(presence)) {
      if (value.displayName) names[uid] = value.displayName
    }
    setParticipantNames(names)
  }, [presence])

  const saveName = async () => {
    const name = nameDraft.trim().slice(0, 40)
    if (name.length < 2) return
    setNameError("")
    try {
      await saveUserProfile(userId, name, profileBio)
      setDisplayName(name)
      setShowNamePrompt(false)
    } catch {
      setNameError(
        "Your name couldn't be saved. Check your connection and retry.",
      )
    }
  }

  useEffect(() => {
    if (!displayName) return
    void update(ref(realtimeDatabase, `rooms/${roomId}/presence/${userId}`), {
      displayName,
      bio: profileBio,
    }).catch(() => {
      setRoomError("Your room profile couldn't sync. Check the room rules and retry.")
    })
  }, [displayName, profileBio, roomId, userId])

  const publishPlayback = useCallback(
    async (playing: boolean, currentTime: number) => {
      if (roomHostRef.current !== userId || !Number.isFinite(currentTime))
        return
      const updatedAt = Date.now()
      try {
        await update(ref(realtimeDatabase), {
          [`rooms/${roomId}/playback`]: {
            playing,
            currentTime: Math.max(0, currentTime),
            updatedAt: serverTimestamp(),
            hostId: userId,
          },
          [`rooms/${roomId}/updatedAt`]: serverTimestamp(),
          [`roomDirectory/${roomId}/updatedAt`]: serverTimestamp(),
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
  publishPlaybackRef.current = publishPlayback

  useEffect(() => {
    const presenceRef = ref(
      realtimeDatabase,
      `rooms/${roomId}/presence/${userId}`,
    )
    const typingRef = ref(realtimeDatabase, `rooms/${roomId}/typing/${userId}`)
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

    void set(presenceRef, {
      online: true,
      updatedAt: serverTimestamp(),
      displayName: displayNameRef.current || "Guest",
      bio: profileBio,
    }).catch(fail)
    void onDisconnect(presenceRef).remove().catch(fail)
    void onDisconnect(typingRef).remove().catch(fail)
    const activityHeartbeat = window.setInterval(() => {
      void update(ref(realtimeDatabase), {
        [`rooms/${roomId}/updatedAt`]: serverTimestamp(),
        [`roomDirectory/${roomId}/updatedAt`]: serverTimestamp(),
        [`rooms/${roomId}/presence/${userId}/updatedAt`]: serverTimestamp(),
      }).catch(fail)
    }, 30_000)

    const stops = [
      onValue(
        ref(realtimeDatabase, `roomDirectory/${roomId}`),
        (snap) => {
          if (!snap.exists()) {
            setRoomEnded(true)
            setRoomError(
              "This room has ended or expired. You can leave and return home.",
            )
            return
          }
          setRoomEnded(false)
          const value = snap.val() ?? {}
          roomHostRef.current = value.hostId ?? null
          setHostId(value.hostId ?? null)
          const title = value.title || "YouTube video"
          roomTitleRef.current = title
          setRoomTitle(title)
          if (value.movieUrl) {
            if (value.movieUrl !== activeVideoUrlRef.current) {
              void recordWatchSession(
                userId,
                roomId,
                activeVideoUrlRef.current,
                watchedSecondsRef.current,
                sessionIdRef.current,
                activeVideoTitleRef.current,
              ).catch(() => setRoomError(WATCH_SAVE_ERROR))
              activeVideoUrlRef.current = value.movieUrl
              watchedSecondsRef.current = 0
              savedWatchSecondsRef.current = 0
              sessionIdRef.current = crypto.randomUUID()
              hostSampleRef.current = null
              lastPublishAtRef.current = 0
              lastPlayingRef.current = false
              isPlayingRef.current = false
              setIsPlaying(false)
              setVideoTime(0)
              setVideoError("")
            }
            activeVideoTitleRef.current = title
            setRoomMovieUrl(value.movieUrl)
          }
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
        ref(realtimeDatabase, `rooms/${roomId}/typing`),
        (snap) => setTypingUsers(snap.val() ?? {}),
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
      window.clearInterval(activityHeartbeat)
      stops.forEach((stop) => stop())
      void remove(presenceRef)
      void remove(typingRef)
      void recordWatchSession(
        userId,
        roomId,
        activeVideoUrlRef.current,
        watchedSecondsRef.current,
        sessionIdRef.current,
        roomTitleRef.current,
      ).catch(() => setRoomError(WATCH_SAVE_ERROR))
    }
  }, [movieUrl, roomId, userId])

  useEffect(() => {
    if (!hostId || hostId === userId) return
    const guestSeatRef = ref(realtimeDatabase, `rooms/${roomId}/guestSeat`)
    void onDisconnect(guestSeatRef)
      .remove()
      .catch(() => {})
    return () => void onDisconnect(guestSeatRef).cancel()
  }, [hostId, roomId, userId])

  useEffect(() => {
    const timer = window.setInterval(async () => {
      const seconds = Math.floor(watchedSecondsRef.current)
      if (seconds <= savedWatchSecondsRef.current || !sessionIdRef.current)
        return
      try {
        await recordWatchSession(
          userId,
          roomId,
          activeVideoUrlRef.current,
          seconds,
          sessionIdRef.current,
          roomTitleRef.current,
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
      if (!playerReady || !player) return
      const now = Date.now()
      const currentTime = player.getCurrentTime?.()
      if (typeof currentTime !== "number") return
      const playing = player.getPlayerState?.() === 1
      setVideoTime(currentTime)
      setVideoDuration(player.getDuration?.() || 0)
      if (playing && lastWatchTickRef.current) {
        watchedSecondsRef.current += Math.min(
          1.5,
          (now - lastWatchTickRef.current) / 1000,
        )
      }
      lastWatchTickRef.current = playing ? now : 0
      isPlayingRef.current = playing
      setIsPlaying(playing)
      if (roomHostRef.current !== userId) {
        if (playback.updatedAt) {
          const target =
            (playback.currentTime ?? 0) +
            (playback.playing
              ? Math.max(0, now - playback.updatedAt) / 1000
              : 0)
          if (Math.abs(target - currentTime) > 1.5)
            player.seekTo?.(target, true)
          if (playback.playing && !playing) player.playVideo?.()
          else if (!playback.playing && playing) player.pauseVideo?.()
        }
        return
      }
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
    }, 1000)
    return () => window.clearInterval(timer)
  }, [playback, playerReady, publishPlayback, userId])

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ block: "end" })
  }, [messages[messages.length - 1]?.id])

  const syncNow = () => {
    const player = playerRef.current
    if (!player || !playback.updatedAt) return
    const target =
      (playback.currentTime ?? 0) +
      (playback.playing
        ? Math.max(0, Date.now() - playback.updatedAt) / 1000
        : 0)
    player.seekTo?.(target, true)
    playback.playing ? player.playVideo?.() : player.pauseVideo?.()
  }

  const takeControl = async () => {
    if (!hostLeft) return
    try {
      await update(ref(realtimeDatabase), {
        [`rooms/${roomId}/hostId`]: userId,
      })
      await update(ref(realtimeDatabase), {
        [`roomDirectory/${roomId}/hostId`]: userId,
      })
      await update(ref(realtimeDatabase), {
        [`rooms/${roomId}/updatedAt`]: serverTimestamp(),
        [`roomDirectory/${roomId}/updatedAt`]: serverTimestamp(),
      })
      await remove(ref(realtimeDatabase, `rooms/${roomId}/guestSeat`))
      roomHostRef.current = userId
      setHostLeft(false)
      const currentTime =
        playerRef.current?.getCurrentTime?.() ?? playback.currentTime ?? 0
      void publishPlayback(Boolean(playback.playing), currentTime)
    } catch {
      setRoomError(
        "Could not take control yet. Check your connection and try again.",
      )
    }
  }

  const changeVideo = async (event: React.FormEvent) => {
    event.preventDefault()
    if (hostId !== userId || changingVideo) return
    const nextUrl = canonicalYoutubeUrl(videoDraft)
    if (!nextUrl) {
      setSendError("Paste a valid YouTube video, Shorts, or embed link.")
      return
    }
    setChangingVideo(true)
    setSendError("")
    try {
      let title = "YouTube video"
      try {
        const response = await fetch(
          `https://www.youtube.com/oembed?url=${encodeURIComponent(nextUrl)}&format=json`,
        )
        if (response.ok)
          title = String((await response.json()).title || title).slice(0, 120)
      } catch {
        // Keep video changes available when YouTube metadata is unavailable.
      }
      await update(ref(realtimeDatabase), {
        [`rooms/${roomId}/movieUrl`]: nextUrl,
        [`rooms/${roomId}/title`]: title,
        [`rooms/${roomId}/updatedAt`]: serverTimestamp(),
        [`rooms/${roomId}/playback`]: {
          playing: false,
          currentTime: 0,
          updatedAt: serverTimestamp(),
          hostId: userId,
        },
        [`roomDirectory/${roomId}/movieUrl`]: nextUrl,
        [`roomDirectory/${roomId}/title`]: title,
        [`roomDirectory/${roomId}/updatedAt`]: serverTimestamp(),
      })
      void trackAnalyticsEvent("room_video_changed")
      setVideoDraft("")
    } catch {
      setSendError(
        "The video couldn't be changed. Check the room rules and try again.",
      )
    } finally {
      setChangingVideo(false)
    }
  }

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
        videoTime: playerRef.current?.getCurrentTime?.() ?? videoTime,
        videoId: youtubeIdFromUrl(activeVideoUrlRef.current) || undefined,
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
    setRoomCodeCopied(false)
    setSendError("")
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

  const copyRoomCode = async () => {
    if (!navigator.clipboard?.writeText) {
      setSendError(
        "Copy isn't available here. Select the room code and copy it.",
      )
      return
    }
    try {
      await navigator.clipboard.writeText(roomId)
      setRoomCodeCopied(true)
      setSendError("")
    } catch {
      setSendError(
        "Copy isn't available here. Select the room code and copy it.",
      )
    }
  }

  const shareInvite = async () => {
    if (!navigator.share) {
      await copyInvite()
      return
    }
    try {
      await navigator.share({
        title: "Join my Datecue room",
        text: `Join me to watch ${roomTitle}`,
        url: inviteUrl,
      })
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        setSendError("Sharing wasn't available. Copy the invite link instead.")
      }
    }
  }

  const endRoom = async () => {
    if (hostId !== userId || leaving) return
    if (
      !window.confirm(
        "End this room for everyone? Your watch time will be saved.",
      )
    )
      return
    setLeaving(true)
    try {
      await recordWatchSession(
        userId,
        roomId,
        activeVideoUrlRef.current,
        watchedSecondsRef.current,
        sessionIdRef.current,
        roomTitleRef.current,
      )
      void trackAnalyticsEvent("room_ended", {
        duration_seconds: Math.floor(watchedSecondsRef.current),
      })
      await Promise.all([
        remove(ref(realtimeDatabase, `rooms/${roomId}`)),
        remove(ref(realtimeDatabase, `roomDirectory/${roomId}`)),
      ])
      onLeave()
    } catch {
      setRoomError(
        "The room could not be ended. Check your connection and try again.",
      )
      setLeaving(false)
    }
  }

  const leaveRoom = async () => {
    if (leaving) return
    if (roomEnded) {
      onLeave()
      return
    }
    if (
      watchedSecondsRef.current >= 5 * 60 &&
      !window.confirm("Leave and save your watch time for this room?")
    )
      return
    setLeaving(true)
    setSendError("")
    try {
      if (watchedSecondsRef.current > 0) {
        await recordWatchSession(
          userId,
          roomId,
          activeVideoUrlRef.current,
          watchedSecondsRef.current,
          sessionIdRef.current,
          roomTitleRef.current,
        )
      }
      if (hostId !== userId) {
        await onDisconnect(
          ref(realtimeDatabase, `rooms/${roomId}/guestSeat`),
        ).cancel()
      }
      const roomChanges: Record<string, null> = {
        [`presence/${userId}`]: null,
      }
      if (hostId !== userId) roomChanges.guestSeat = null
      await update(ref(realtimeDatabase, `rooms/${roomId}`), roomChanges)
      onLeave()
    } catch {
      setSendError(
        "Your session couldn't be saved or you couldn't leave. Check the connection and retry.",
      )
      setLeaving(false)
    }
  }

  const latestReactions = useMemo(() => reactions.slice(-12), [reactions])
  const initials = (name: string) =>
    name
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "G"
  const avatarColor = (uid: string) =>
    ["bg-coral", "bg-moss", "bg-navy", "bg-[#9b6b43]"][uid.charCodeAt(0) % 4]

  return (
    <div className={`min-h-[100dvh] ${surface}`}>
      <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-2 border-b hairline bg-ivory/90 px-3 py-3 backdrop-blur-xl dark:bg-night/90 sm:px-6">
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
          {hostId === userId && (
            <button
              className="button-quiet focus-ring rounded-full border px-3 py-2 text-xs font-bold"
              disabled={leaving}
              onClick={() => void endRoom()}
              type="button"
            >
              End room
            </button>
          )}
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
        <section className="relative aspect-video w-full shrink-0 bg-[#172327] lg:aspect-auto lg:min-h-[calc(100dvh-4rem)] lg:flex-1">
          <div className="absolute inset-0">
            {videoId && !videoError ? (
              <div
                id={`youtube-player-${roomId}`}
                ref={playerContainerRef}
                className="h-full w-full"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-ivory">
                <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-ivory/30 text-3xl">
                  !
                </div>
                <p className="font-semibold">
                  {videoError || "This YouTube video can't be played here."}
                </p>
                <a
                  className="focus-ring text-coral-light underline"
                  href={roomMovieUrl}
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
            className="absolute left-4 top-4 rounded-full bg-navy/90 px-3 py-2 text-xs text-ivory"
          >
            <span className="mr-2 inline-block h-2 w-2 rounded-full bg-moss" />
            {onlineCount} watching ·{" "}
            {!playerReady
              ? "Connecting"
              : isPlaying
                ? "Playing together"
                : "Paused"}
          </div>
          {hostId !== userId && !hostLeft && (
            <div className="absolute left-4 right-4 top-14 z-20 flex flex-wrap items-center justify-center gap-2 rounded-2xl bg-navy/90 px-3 py-2 text-xs text-ivory shadow-lg">
              <span>Guest mode · playback follows the host</span>
              <button
                className="rounded-full border border-white/30 px-3 py-1 font-bold hover:bg-white/10"
                onClick={syncNow}
                type="button"
              >
                Sync now
              </button>
            </div>
          )}
          {hostId !== userId && videoId && !videoError && (
            <div
              className="absolute inset-0 z-10"
              aria-label="Guest playback is controlled by the host"
            />
          )}
          {hostId === userId && playerReady && (
            <div className="absolute bottom-4 left-4 right-20 z-20 flex items-center gap-2 rounded-xl bg-black/75 px-3 py-2 text-xs text-white">
              <button
                aria-label={isPlaying ? "Pause video" : "Play video"}
                className="focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/30"
                onClick={() => {
                  if (isPlaying) playerRef.current?.pauseVideo?.()
                  else playerRef.current?.playVideo?.()
                }}
                type="button"
              >
                <Icon name={isPlaying ? "pause" : "play"} size={14} />
              </button>
              <span className="mono shrink-0">
                {formatVideoTime(videoTime)}
              </span>
              <input
                aria-label="Seek video"
                className="min-w-0 flex-1 accent-[#d86856]"
                max={Math.max(1, videoDuration)}
                min={0}
                onChange={(event) => {
                  const nextTime = Number(event.target.value)
                  setVideoTime(nextTime)
                  playerRef.current?.seekTo?.(nextTime, true)
                }}
                type="range"
                value={Math.min(videoTime, videoDuration || videoTime)}
              />
              <span className="mono shrink-0">
                {formatVideoTime(videoDuration)}
              </span>
            </div>
          )}
          {hostLeft && (
            <div className="absolute left-4 right-4 top-16 z-20 flex items-center justify-between gap-3 rounded-2xl bg-coral px-4 py-3 text-sm text-ivory shadow-lg">
              <span>Host left — take control?</span>
              <button
                className="rounded-full bg-ivory px-3 py-1 font-bold text-ink"
                onClick={() => void takeControl()}
                type="button"
              >
                Take control
              </button>
            </div>
          )}
          <div className="absolute bottom-4 right-4 z-10">
            {showReactions ? (
              <div className="reaction-tray no-scrollbar flex max-w-[calc(100vw-2rem)] items-center gap-1 overflow-x-auto rounded-full border border-white/10 bg-[#25292d]/95 p-1.5 shadow-2xl backdrop-blur-md">
                {REACTIONS.map((reaction) => (
                  <button
                    key={reaction}
                    aria-label={`React: ${REACTION_LABELS[reaction]}`}
                    onClick={() => void sendReaction(reaction)}
                    className="focus-ring shrink-0 rounded-full px-3 py-2 text-xs font-semibold text-white/90 transition hover:bg-white/10"
                    type="button"
                  >
                    {REACTION_LABELS[reaction]}
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
              {REACTION_LABELS[reaction.emoji] || "Reaction"}
            </span>
          ))}
          {roomEnded && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/85 p-6 text-center text-ivory">
              <h2 className="text-2xl">This room has ended</h2>
              <p className="text-sm text-ivory/70">
                Your saved watch history is still available from home.
              </p>
              <button
                className="button-primary focus-ring rounded-lg px-4 py-2 font-bold"
                onClick={onLeave}
                type="button"
              >
                Return home
              </button>
            </div>
          )}
        </section>

        <aside className="flex w-full flex-col border-t hairline lg:w-[380px] lg:border-l lg:border-t-0">
          <div className="border-b hairline px-5 py-4">
            <h1 className="display-serif text-2xl">The conversation</h1>
            <p
              className="mt-1 truncate text-sm font-semibold"
              title={roomTitle}
            >
              {roomTitle}
            </p>
            <p className="text-sm text-muted-ink" aria-live="polite">
              {onlineCount < 2
                ? "Waiting for another person to join"
                : `${onlineCount} people are watching`}
            </p>
            <div className="mt-3 flex items-center gap-2">
              {Object.entries(presence)
                .slice(0, 2)
                .map(([uid, person]) => (
                  <button
                    key={uid}
                    className={`focus-ring flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold text-ivory ring-2 ring-paper transition hover:scale-105 ${avatarColor(uid)}`}
                    title={`View ${person.displayName || "Guest"}'s room profile`}
                    aria-label={`View ${person.displayName || "Guest"}'s room profile`}
                    onClick={() =>
                      setProfilePreview({
                        uid,
                        name: person.displayName || "Guest",
                        online: Boolean(person.online),
                        bio: person.bio,
                      })
                    }
                    type="button"
                  >
                    {initials(person.displayName || "Guest")}
                  </button>
                ))}
              <span className="text-xs text-muted-ink">
                {Object.values(presence)
                  .map((person) => person.displayName || "Guest")
                  .join(" · ")}
              </span>
            </div>
            {hostId === userId && (
              <form
                className="mt-4 flex gap-2"
                onSubmit={(event) => void changeVideo(event)}
              >
                <input
                  aria-label="Change the room video"
                  className="input-field focus-ring min-w-0 rounded-lg px-3 py-2 text-xs"
                  maxLength={500}
                  onChange={(event) => setVideoDraft(event.target.value)}
                  placeholder="Paste a YouTube link to change video"
                  type="url"
                  value={videoDraft}
                />
                <button
                  className="button-quiet focus-ring shrink-0 rounded-lg border px-3 py-2 text-xs font-bold"
                  disabled={changingVideo || !videoDraft.trim()}
                  type="submit"
                >
                  {changingVideo ? "Changing…" : "Change"}
                </button>
              </form>
            )}
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
          <div className="min-h-[35dvh] max-h-[55dvh] flex-1 space-y-3 overflow-y-auto overscroll-contain p-4 sm:p-5 lg:min-h-0 lg:max-h-none">
            {messages.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-ink">
                Your conversation will appear here. Say hello when you’re ready.
              </p>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex max-w-[92%] items-end gap-2 ${
                    message.uid === userId ? "ml-auto flex-row-reverse" : ""
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-ivory ${avatarColor(message.uid)}`}
                    aria-hidden="true"
                  >
                    {initials(
                      message.uid === userId
                        ? displayName
                        : message.senderName ||
                            participantNames[message.uid] ||
                            "Guest",
                    )}
                  </span>
                  <div
                    className={`break-words rounded-2xl px-3 py-2 text-sm ${
                      message.uid === userId
                        ? "ml-auto bg-coral text-ivory"
                        : "bg-sand/60"
                    }`}
                  >
                    <span className="mb-1 block text-[10px] font-bold opacity-70">
                      {message.uid === userId
                        ? "You"
                        : message.senderName ||
                          participantNames[message.uid] ||
                          "Guest"}
                    </span>
                    {message.text}
                    <span className="mt-1 flex items-center gap-2 text-[10px] opacity-70">
                      {new Date(message.createdAt).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                      {typeof message.videoTime === "number" &&
                        (message.videoId === videoId ? (
                          <button
                            className="underline underline-offset-2"
                            onClick={() => {
                              if (hostId === userId)
                                playerRef.current?.seekTo?.(
                                  message.videoTime,
                                  true,
                                )
                              else syncNow()
                            }}
                            title={
                              hostId === userId
                                ? "Jump to this moment"
                                : "Sync with the host"
                            }
                            type="button"
                          >
                            {formatVideoTime(message.videoTime)}
                          </button>
                        ) : (
                          <span title="Timestamp from a different room video">
                            {formatVideoTime(message.videoTime)}
                          </span>
                        ))}
                    </span>
                  </div>
                </div>
              ))
            )}
            {Object.entries(typingUsers).some(
              ([uid, typing]) => uid !== userId && typing,
            ) && (
              <p className="px-2 text-xs italic text-muted-ink" role="status">
                {Object.entries(typingUsers).find(
                  ([uid, typing]) => uid !== userId && typing,
                )?.[0] &&
                  `${presence[Object.entries(typingUsers).find(([uid, typing]) => uid !== userId && typing)![0]]?.displayName || "Someone"} is typing…`}
              </p>
            )}
            <div ref={messageEndRef} />
          </div>
          <div className="border-t hairline p-3 sm:p-4">
            <div className="flex gap-2">
              <input
                className="input-field focus-ring min-w-0 rounded-2xl px-4 py-3 text-sm"
                value={text}
                maxLength={500}
                onChange={(event) => {
                  const next = event.target.value
                  setText(next)
                  void set(
                    ref(realtimeDatabase, `rooms/${roomId}/typing/${userId}`),
                    Boolean(next.trim()),
                  )
                }}
                onBlur={() =>
                  void remove(
                    ref(realtimeDatabase, `rooms/${roomId}/typing/${userId}`),
                  )
                }
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
        <AccessibleDialog
          labelledBy="name-title"
          onClose={() => {}}
          closeOnEscape={false}
          closeOnBackdropClick={false}
        >
          <p className="mono text-xs uppercase tracking-[.16em] text-coral">
            One small thing
          </p>
          <h2 className="mt-3 text-3xl" id="name-title">
            What should they call you?
          </h2>
          <p className="mt-2 text-sm text-muted-ink">
            Your name appears beside messages and in the room.
          </p>
          <input
            className="input-field focus-ring mt-5 w-full rounded-xl px-4 py-3"
            autoFocus
            maxLength={40}
            minLength={2}
            value={nameDraft}
            onChange={(event) => setNameDraft(event.target.value)}
            placeholder="Display name"
          />
          {nameError && (
            <p className="mt-2 text-sm text-coral" role="alert">
              {nameError}
            </p>
          )}
          <button
            className="button-primary focus-ring mt-4 w-full rounded-xl px-4 py-3 font-bold"
            disabled={nameDraft.trim().length < 2}
            onClick={() => void saveName()}
            type="button"
          >
            Save name
          </button>
        </AccessibleDialog>
      )}

      {profilePreview && (
        <AccessibleDialog
          labelledBy="participant-profile-title"
          onClose={() => setProfilePreview(null)}
          dialogClassName="soft-card page-enter w-full max-w-sm rounded-[26px] p-6 shadow-2xl"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span
                className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold text-ivory ${avatarColor(profilePreview.uid)}`}
                aria-hidden="true"
              >
                {initials(profilePreview.name)}
              </span>
              <div>
                <p className="eyebrow text-coral">Room profile</p>
                <h2 className="mt-1 text-2xl" id="participant-profile-title">
                  {profilePreview.name}
                </h2>
              </div>
            </div>
            <button
              aria-label="Close participant profile"
              className="button-quiet focus-ring flex h-9 w-9 items-center justify-center rounded-full border"
              onClick={() => setProfilePreview(null)}
              type="button"
            >
              <Icon name="close" size={16} />
            </button>
          </div>
          <p className="mt-5 flex items-center gap-2 text-sm text-muted-ink">
            <span
              className={`h-2 w-2 rounded-full ${
                profilePreview.online ? "bg-moss" : "bg-ochre"
              }`}
            />
            {profilePreview.online ? "Here in the room" : "Away from the room"}
          </p>
          {profilePreview.bio && (
            <p className="mt-4 text-sm leading-relaxed">{profilePreview.bio}</p>
          )}
          <p className="mt-4 border-t hairline pt-4 text-sm leading-relaxed text-muted-ink">
            Only details shared in this room appear here. Personal watch history
            and private account details stay private.
          </p>
        </AccessibleDialog>
      )}

      {inviteUrl && (
        <AccessibleDialog
          labelledBy="invite-title"
          onClose={() => setInviteUrl("")}
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
          <label
            className="mt-5 block text-xs font-bold uppercase tracking-[.12em] text-muted-ink"
            htmlFor="room-code-copy"
          >
            Or share just the room code
          </label>
          <div className="mt-2 flex gap-2">
            <input
              autoComplete="off"
              className="input-field focus-ring min-w-0 flex-1 rounded-xl px-3 py-3 text-center font-mono font-bold tracking-[.2em]"
              id="room-code-copy"
              onFocus={(event) => event.currentTarget.select()}
              readOnly
              value={roomId}
            />
            <button
              aria-live="polite"
              className="button-quiet focus-ring shrink-0 rounded-xl border px-4 py-3 text-sm font-bold"
              onClick={() => void copyRoomCode()}
              type="button"
            >
              {roomCodeCopied ? "Copied" : "Copy code"}
            </button>
          </div>
          <button
            className="button-quiet focus-ring mt-2 w-full rounded-xl border px-4 py-3 font-bold"
            onClick={() => void shareInvite()}
            type="button"
          >
            Share invite…
          </button>
          {sendError && (
            <p className="mt-3 text-sm text-coral" role="alert">
              {sendError}
            </p>
          )}
        </AccessibleDialog>
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
