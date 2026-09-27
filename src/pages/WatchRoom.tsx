import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { onDisconnect, onValue, push, ref, remove, set, update } from 'firebase/database'
import { Icon } from '../components/Logo'
import { formatDuration, realtimeDatabase, youtubeIdFromUrl } from '../lib/firebase'

interface Props { onLeave: () => void; darkMode: boolean; onToggleDark: () => void; roomId: string; movieUrl: string; userId: string }
interface Message { id: string; uid: string; text: string; createdAt: number; edited?: boolean; replyTo?: string }
interface Reaction { id: string; uid: string; emoji: string; createdAt: number }
interface RoomState { playing?: boolean; currentTime?: number; updatedAt?: number; hostId?: string }
const emojis = ['heart', 'laugh', 'wow', 'clap'] as const
const emojiChar: Record<(typeof emojis)[number], string> = { heart: '♥', laugh: '☺', wow: '✦', clap: '✋' }

export default function WatchRoom({ onLeave, darkMode, onToggleDark, roomId, movieUrl, userId }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [reactions, setReactions] = useState<Reaction[]>([])
  const [presence, setPresence] = useState<Record<string, { online?: boolean; displayName?: string }>>({})
  const [roomState, setRoomState] = useState<RoomState>({})
  const [text, setText] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [replying, setReplying] = useState<string | null>(null)
  const [showChat, setShowChat] = useState(true)
  const [copied, setCopied] = useState(false)
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>('unsupported')
  const playerRef = useRef<any>(null)
  const lastSyncedRef = useRef(0)
  const watchStartedRef = useRef(Date.now())
  const videoId = youtubeIdFromUrl(movieUrl)
  const onlineUsers = Object.values(presence).filter(value => value.online).length
  const muted = darkMode ? 'text-ivory/60' : 'text-muted-ink'
  const surface = darkMode ? 'bg-night text-ivory' : 'bg-ivory text-ink'

  useEffect(() => {
    if ('Notification' in window) setNotificationPermission(Notification.permission)
    const presenceRef = ref(realtimeDatabase, `rooms/${roomId}/presence/${userId}`)
    void set(presenceRef, { online: true, updatedAt: Date.now() })
    void onDisconnect(presenceRef).remove()
    const stopPresence = onValue(ref(realtimeDatabase, `rooms/${roomId}/presence`), snapshot => setPresence(snapshot.val() ?? {}))
    const stopState = onValue(ref(realtimeDatabase, `rooms/${roomId}/playback`), snapshot => setRoomState(snapshot.val() ?? {}))
    const stopMessages = onValue(ref(realtimeDatabase, `rooms/${roomId}/messages`), snapshot => setMessages(Object.entries(snapshot.val() ?? {}).map(([id, value]) => ({ id, ...(value as Omit<Message, 'id'>) })).sort((a, b) => a.createdAt - b.createdAt)))
    const stopReactions = onValue(ref(realtimeDatabase, `rooms/${roomId}/reactions`), snapshot => setReactions(Object.entries(snapshot.val() ?? {}).map(([id, value]) => ({ id, ...(value as Omit<Reaction, 'id'>) })).filter(value => Date.now() - value.createdAt < 10000)))
    return () => { stopPresence(); stopState(); stopMessages(); stopReactions(); void update(ref(realtimeDatabase, `users/${userId}/history/${roomId}`), { movieUrl, updatedAt: Date.now() }) }
  }, [movieUrl, roomId, userId])

  useEffect(() => {
    if (!videoId) return
    const existing = document.querySelector('script[data-youtube-api]')
    if (!existing) { const script = document.createElement('script'); script.src = 'https://www.youtube.com/iframe_api'; script.dataset.youtubeApi = 'true'; document.body.appendChild(script) }
    const makePlayer = () => { if (!window.YT?.Player) return; playerRef.current = new window.YT.Player(`youtube-player-${roomId}`, { events: { onStateChange: (event: any) => { if (event.data === 1 || event.data === 2) void publishPlayback(event.data === 1, event.target.getCurrentTime()) } } }) }
    if (window.YT?.Player) makePlayer(); else { const previous = window.onYouTubeIframeAPIReady; window.onYouTubeIframeAPIReady = () => { previous?.(); makePlayer() } }
    return () => { playerRef.current?.destroy?.(); playerRef.current = null }
  }, [roomId, videoId])

  useEffect(() => { if (!playerRef.current || !roomState.updatedAt || Date.now() - roomState.updatedAt > 5000) return; const target = (roomState.currentTime ?? 0) + (roomState.playing ? (Date.now() - roomState.updatedAt) / 1000 : 0); if (Math.abs((playerRef.current.getCurrentTime?.() ?? 0) - target) > 2) playerRef.current.seekTo?.(target, true); roomState.playing ? playerRef.current.playVideo?.() : playerRef.current.pauseVideo?.() }, [roomState])
  useEffect(() => { const timer = window.setInterval(() => { const delta = Math.floor((Date.now() - watchStartedRef.current) / 1000); if (delta > 0) { void update(ref(realtimeDatabase, `users/${userId}/stats`), { watchSeconds: (delta + (roomState.playing ? 0 : 0)) }); watchStartedRef.current = Date.now() } }, 30000); return () => window.clearInterval(timer) }, [roomState.playing, userId])

  const publishPlayback = useCallback(async (playing: boolean, currentTime: number) => { if (Date.now() - lastSyncedRef.current < 500) return; lastSyncedRef.current = Date.now(); await set(ref(realtimeDatabase, `rooms/${roomId}/playback`), { playing, currentTime, updatedAt: Date.now(), hostId: userId }) }, [roomId, userId])
  const sendMessage = async () => { const value = text.trim(); if (!value) return; if (editing) await update(ref(realtimeDatabase, `rooms/${roomId}/messages/${editing}`), { text: value, edited: true }); else await push(ref(realtimeDatabase, `rooms/${roomId}/messages`), { uid: userId, text: value, createdAt: Date.now(), ...(replying ? { replyTo: replying } : {}) }); setText(''); setEditing(null); setReplying(null) }
  const react = async (emoji: string) => { await push(ref(realtimeDatabase, `rooms/${roomId}/reactions`), { uid: userId, emoji, createdAt: Date.now() }) }
  const invite = async () => { await navigator.clipboard?.writeText(`${location.origin}/room/${roomId}`); setCopied(true); window.setTimeout(() => setCopied(false), 1800) }
  const askNotifications = async () => { if ('Notification' in window) setNotificationPermission(await Notification.requestPermission()) }
  const unread = useMemo(() => reactions.filter(item => item.uid !== userId).length, [reactions, userId])

  return <div className={`min-h-[100dvh] ${surface}`}><header className="flex min-h-16 items-center justify-between gap-2 border-b px-3 py-3 sm:px-6"><button className="button-quiet flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-bold" onClick={async () => { await remove(ref(realtimeDatabase, `rooms/${roomId}/presence/${userId}`)); onLeave() }}><Icon name="arrow-left" size={15}/><span>Leave</span></button><div className="hidden text-sm font-bold sm:block">Room {roomId}</div><div className="flex items-center gap-2"><button className="button-quiet rounded-full border px-3 py-2 text-xs font-bold" onClick={invite}>{copied ? 'Copied' : roomId}</button><button className="button-quiet h-9 w-9 rounded-full border" onClick={onToggleDark} aria-label="Toggle theme"><Icon name={darkMode ? 'sun' : 'moon'} size={16}/></button><button className="button-quiet h-9 w-9 rounded-full border lg:hidden" onClick={() => setShowChat(value => !value)} aria-label="Toggle chat"><Icon name="message" size={16}/></button></div></header><main className="flex min-h-[calc(100dvh-64px)] flex-col lg:flex-row"><section className="relative min-h-[46dvh] flex-1 bg-[#102028] sm:min-h-[60dvh]"><div className="absolute inset-0">{videoId ? <div id={`youtube-player-${roomId}`} className="h-full w-full"/> : <div className="flex h-full items-center justify-center p-8 text-center text-ivory">This room does not have a valid YouTube film.</div>}</div><div className="absolute bottom-4 left-4 flex flex-wrap items-center gap-2 rounded-full bg-navy/90 px-3 py-2 text-xs text-ivory"><span className="h-2 w-2 rounded-full bg-moss"/>{onlineUsers} watching<span className="hidden sm:inline"> · {roomState.playing ? 'Playing together' : 'Paused together'}</span></div><div className="absolute bottom-4 right-4 flex gap-1 rounded-2xl bg-navy/90 p-1.5"><button onClick={() => react('heart')} className="rounded-xl px-3 py-2 text-lg text-ivory">♥</button><button onClick={() => react('laugh')} className="rounded-xl px-3 py-2 text-lg text-ivory">☺</button><button onClick={() => react('wow')} className="rounded-xl px-3 py-2 text-lg text-ivory">✦</button><button onClick={() => react('clap')} className="rounded-xl px-3 py-2 text-lg text-ivory">✋</button></div>{reactions.map(reaction => <div key={reaction.id} className="reaction-rise absolute bottom-20 right-8 text-4xl">{emojiChar[reaction.emoji as keyof typeof emojiChar]}</div>)}</section><aside className={`${showChat ? 'flex' : 'hidden'} max-h-[54dvh] w-full flex-col border-t lg:flex lg:max-h-none lg:h-auto lg:w-[370px] lg:border-l lg:border-t-0`}><div className="flex items-center justify-between border-b p-4"><div><h1 className="display-serif text-2xl">The conversation</h1><p className={`text-xs ${muted}`}>{onlineUsers > 1 ? `${onlineUsers} people watching` : 'Waiting for another person to join'}</p></div><button onClick={invite} className="button-primary rounded-full px-4 py-2 text-sm font-bold">Invite</button></div><div className="flex items-center justify-between border-b p-4"><span className={`text-xs ${muted}`}>{onlineUsers} online</span><button className={`text-xs font-bold ${muted}`} onClick={askNotifications}>{notificationPermission === 'granted' ? 'Notifications on' : 'Enable notifications'}</button></div><div className="no-scrollbar flex-1 space-y-3 overflow-y-auto p-4">{messages.length === 0 ? <p className={`py-8 text-center text-sm ${muted}`}>No messages yet. Say hello when your guest joins.</p> : messages.map(message => <article key={message.id} className="group rounded-2xl border p-3"><p className="text-sm">{message.text}{message.edited && <span className={`ml-2 text-xs ${muted}`}>(edited)</span>}</p><div className="mt-2 flex gap-3 text-xs opacity-70"><button onClick={() => { setReplying(message.id); setText(`@${message.uid.slice(0, 5)} `) }}>Reply</button>{message.uid === userId && <><button onClick={() => { setEditing(message.id); setText(message.text) }}>Edit</button><button onClick={() => void remove(ref(realtimeDatabase, `rooms/${roomId}/messages/${message.id}`))}>Delete</button></>}</div></article>)}</div><div className="border-t p-3"><div className="mb-2 flex gap-2">{emojis.map(emoji => <button key={emoji} className="rounded-lg border px-2 py-1 text-sm" onClick={() => void react(emoji)}>{emojiChar[emoji]}</button>)}<span className={`ml-auto text-xs ${muted}`}>{unread} reactions</span></div><div className="flex gap-2"><input className="input-field min-w-0 rounded-xl px-3 py-2" value={text} onChange={event => setText(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.keyCode !== 229) void sendMessage() }} placeholder={replying ? 'Reply to message…' : 'Say something…'}/><button className="button-primary rounded-xl px-4 py-2 text-sm font-bold" onClick={() => void sendMessage()}>{editing ? 'Save' : 'Send'}</button></div></div></aside></main></div>
}

declare global { interface Window { YT?: any; onYouTubeIframeAPIReady?: () => void } }
