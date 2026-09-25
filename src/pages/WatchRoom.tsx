import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'
import Logo, { Icon } from '../components/Logo'

interface ChatMsg {
  id: string
  sender: 'me' | 'partner'
  text: string
  videoTs: string
  wallTime: string
}

interface FloatingReaction {
  id: string
  emoji: string
  x: number
}

interface Props {
  onLeave: () => void
  darkMode: boolean
  onToggleDark: () => void
}

const ROOM_CODE = 'XK4P2R'
const REACTIONS = ['😂', '😭', '🔥', '❤️', '😮', '👏']
const INITIAL_MESSAGES: ChatMsg[] = [
  { id: '1', sender: 'partner', text: 'omg this opening scene 😭', videoTs: '2:14', wallTime: '9:02 PM' },
  { id: '2', sender: 'me', text: 'I know! been waiting for this part', videoTs: '2:16', wallTime: '9:02 PM' },
  { id: '3', sender: 'partner', text: 'the music is SO good', videoTs: '4:45', wallTime: '9:05 PM' },
  { id: '4', sender: 'me', text: '🔥🔥 absolute cinema', videoTs: '4:48', wallTime: '9:05 PM' },
  { id: '5', sender: 'partner', text: 'did you see that coming?? no way', videoTs: '11:22', wallTime: '9:13 PM' },
]

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${minutes}:${String(secs).padStart(2, '0')}`
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
}

export default function WatchRoom({ onLeave, darkMode, onToggleDark }: Props) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [videoTime, setVideoTime] = useState(692)
  const [videoProgress, setVideoProgress] = useState(692 / 6240)
  const [volume, setVolume] = useState(0.8)
  const [showVolume, setShowVolume] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [messages, setMessages] = useState<ChatMsg[]>(INITIAL_MESSAGES)
  const [inputText, setInputText] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([])
  const [partnerOnline, setPartnerOnline] = useState(true)
  const [partnerTyping, setPartnerTyping] = useState(false)
  const [synced, setSynced] = useState(true)
  const [showPanel, setShowPanel] = useState(true)
  const [togetherTime, setTogetherTime] = useState(5040)
  const [myTime, setMyTime] = useState(3720)
  const [partnerTime, setPartnerTime] = useState(4740)
  const [copied, setCopied] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const chatBottomRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const videoAreaRef = useRef<HTMLDivElement>(null)
  const hideControlsRef = useRef<number | null>(null)
  const videoTimeRef = useRef(videoTime)
  videoTimeRef.current = videoTime

  const surface = darkMode ? 'bg-night text-ivory' : 'bg-ivory text-ink'
  const panel = darkMode ? 'bg-night-card' : 'bg-paper'
  const muted = darkMode ? 'text-ivory/55' : 'text-muted-ink'
  const soft = darkMode ? 'bg-white/5' : 'bg-sand/45'
  const border = darkMode ? 'border-ivory/15' : 'border-ink/15'

  useEffect(() => {
    if (!isPlaying) return
    const interval = window.setInterval(() => {
      setVideoTime(value => {
        const next = Math.min(value + 1, 6240)
        setVideoProgress(next / 6240)
        return next
      })
      setTogetherTime(value => value + 1)
      setMyTime(value => value + 1)
      if (Math.random() > 0.5) setPartnerTime(value => value + 1)
    }, 1000)
    return () => window.clearInterval(interval)
  }, [isPlaying])

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, partnerTyping])

  useEffect(() => {
    const typingTimer = window.setTimeout(() => {
      setPartnerTyping(true)
      window.setTimeout(() => {
        setPartnerTyping(false)
        setMessages(current => [...current, {
          id: Date.now().toString(),
          sender: 'partner',
          text: 'this is literally our show now 💛',
          videoTs: formatTime(videoTimeRef.current),
          wallTime: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        }])
      }, 2600)
    }, 6000)
    return () => window.clearTimeout(typingTimer)
  }, [])

  const revealControls = useCallback(() => {
    setShowControls(true)
    if (hideControlsRef.current) window.clearTimeout(hideControlsRef.current)
    if (isPlaying) hideControlsRef.current = window.setTimeout(() => setShowControls(false), 2800)
  }, [isPlaying])

  const sendMessage = useCallback(() => {
    if (!inputText.trim()) return
    setMessages(current => [...current, {
      id: Date.now().toString(),
      sender: 'me',
      text: inputText.trim(),
      videoTs: formatTime(videoTime),
      wallTime: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    }])
    setInputText('')
  }, [inputText, videoTime])

  const sendReaction = useCallback((emoji: string) => {
    const id = `${Date.now()}-${Math.random()}`
    setFloatingReactions(current => [...current, { id, emoji, x: 14 + Math.random() * 72 }])
    window.setTimeout(() => setFloatingReactions(current => current.filter(item => item.id !== id)), 3000)
    setMessages(current => [...current, { id, sender: 'me', text: emoji, videoTs: formatTime(videoTime), wallTime: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) }])
    setShowPicker(false)
  }, [videoTime])

  const copyLink = () => {
    navigator.clipboard?.writeText(`https://together.app/room/${ROOM_CODE}`).catch(() => undefined)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2200)
  }

  const handleProgress = (event: MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current) return
    const rect = progressRef.current.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
    setVideoTime(Math.floor(ratio * 6240))
    setVideoProgress(ratio)
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      const request = videoAreaRef.current?.requestFullscreen?.()
      request?.then(() => setIsFullscreen(true)).catch(() => undefined)
    } else {
      const exit = document.exitFullscreen?.()
      exit?.then(() => setIsFullscreen(false)).catch(() => undefined)
    }
  }

  const SidePanel = () => (
    <aside className={`flex h-full min-h-0 flex-col ${panel}`}>
      <div className={`flex items-center justify-between border-b px-4 py-3 ${border}`}>
        <div><p className="display-serif text-xl">The conversation</p><p className={`text-[10px] ${muted}`}>A room for two</p></div>
        <button className="button-primary focus-ring flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold" onClick={copyLink}><Icon name={copied ? 'check' : 'copy'} size={14} /> {copied ? 'Copied' : 'Invite'}</button>
      </div>

      <div className={`border-b px-4 py-4 ${border}`}>
        <div className="mb-3 flex items-center justify-between"><p className={`mono text-[10px] uppercase tracking-[.16em] ${muted}`}>Watching now</p><span className={`text-xs ${muted}`}>2 people</span></div>
        <div className="flex items-center gap-3">
          <div className="relative"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-coral text-xs font-bold text-ivory">Y</span><span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-paper bg-moss" /></div>
          <div className="flex-1"><p className="text-sm font-bold">You</p><p className={`text-[10px] ${muted}`}>Watching</p></div>
          <div className="relative"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-moss text-xs font-bold text-navy">A</span><span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 ${darkMode ? 'border-night-card' : 'border-paper'} ${partnerOnline ? 'bg-moss' : 'bg-muted-ink'}`} /></div>
          <div><p className="text-sm font-bold">Alex</p><p className={`text-[10px] ${muted}`}>{partnerOnline ? 'Watching' : 'Away'}</p></div>
        </div>
      </div>

      <div className={`grid grid-cols-3 gap-2 border-b px-4 py-4 ${border}`}>
        {[['Together', formatDuration(togetherTime), 'bg-coral text-ivory'], ['You', formatDuration(myTime), soft], ['Alex', formatDuration(partnerTime), soft]].map(([label, value, color]) => (
          <div className={`rounded-xl border p-2 text-center ${border} ${color}`} key={label}><p className="mono text-[9px] uppercase tracking-tight opacity-70">{label}</p><p className="mt-1 text-sm font-bold">{value}</p></div>
        ))}
      </div>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-3">
          {messages.map(message => (
            <div className={`flex ${message.sender === 'me' ? 'justify-end' : 'justify-start'}`} key={message.id}>
              <div className="max-w-[85%]">
                <div className={`rounded-2xl border px-3 py-2 text-sm leading-snug ${border} ${message.sender === 'me' ? 'rounded-br-sm bg-coral text-ivory' : `${soft} rounded-bl-sm`}`}>
                  <span className={message.text.length <= 2 ? 'text-2xl' : ''}>{message.text}</span>
                </div>
                <div className={`mt-1 flex items-center gap-1.5 ${message.sender === 'me' ? 'justify-end' : ''}`}><span className={`mono rounded-full border px-1.5 py-0.5 text-[9px] ${border} ${muted}`}>{message.videoTs}</span><span className={`text-[9px] ${muted}`}>{message.wallTime}</span></div>
              </div>
            </div>
          ))}
          {partnerTyping && <div className={`w-fit rounded-2xl border px-3 py-2 ${border} ${soft}`} aria-label="Alex is typing"><span className="typing-dots">•••</span></div>}
          <div ref={chatBottomRef} />
        </div>
      </div>

      <div className={`relative flex items-center gap-2 border-t px-3 py-3 ${border}`}>
        {showPicker && <div className={`absolute bottom-[72px] left-3 flex gap-1 rounded-2xl border p-2 shadow-xl ${darkMode ? 'border-ivory/15 bg-night-card' : 'border-ink/10 bg-paper'}`}>
          {REACTIONS.map(reaction => <button aria-label={`Send ${reaction} reaction`} className="focus-ring flex h-9 w-9 items-center justify-center rounded-lg text-xl hover:bg-coral/10" key={reaction} onClick={() => sendReaction(reaction)}>{reaction}</button>)}
        </div>}
        <button aria-label="Open reactions" className={`focus-ring flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border text-lg ${border} ${showPicker ? 'bg-coral/15 text-coral' : soft}`} onClick={() => setShowPicker(value => !value)}>☺</button>
        <input aria-label="Chat message" className={`input-field focus-ring min-w-0 rounded-xl px-3 py-2.5 text-sm ${soft}`} onChange={event => setInputText(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') sendMessage() }} placeholder="Say something…" type="text" value={inputText} />
        <button aria-label="Send message" className="button-primary focus-ring flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl" onClick={sendMessage}><Icon name="send" size={16} /></button>
      </div>
    </aside>
  )

  return (
    <div className={`min-h-[100dvh] overflow-hidden ${surface}`}>
      <header className={`flex h-[68px] items-center justify-between border-b px-4 sm:px-6 ${border} ${panel}`}>
        <div className="flex items-center gap-3"><button className={`button-quiet focus-ring flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-bold ${border}`} onClick={onLeave}><Icon name="arrow-left" size={15} /> <span className="hidden sm:inline">Leave room</span></button><Logo compact dark={darkMode} /><span className={`hidden border-l pl-3 text-xs ${border} ${muted} md:block`}>Spirited Away</span></div>
        <div className="flex items-center gap-2">
          <button className={`button-quiet focus-ring rounded-full border px-3 py-2 ${border}`} onClick={copyLink}><span className="mono text-[10px] tracking-[.16em]">{copied ? 'COPIED' : ROOM_CODE}</span></button>
          <div className="hidden items-center gap-1.5 rounded-full bg-moss/20 px-3 py-2 text-xs font-bold text-moss sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-moss" />{synced ? 'Synced' : 'Catching up'}</div>
          <button aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'} className={`button-quiet focus-ring flex h-9 w-9 items-center justify-center rounded-full border ${border}`} onClick={onToggleDark}><Icon name={darkMode ? 'sun' : 'moon'} size={16} /></button>
          <button aria-label={showPanel ? 'Hide chat panel' : 'Show chat panel'} className={`button-quiet focus-ring flex h-9 w-9 items-center justify-center rounded-full border lg:hidden ${border}`} onClick={() => setShowPanel(value => !value)}><Icon name={showPanel ? 'film' : 'message'} size={16} /></button>
        </div>
      </header>

      <div className="flex min-h-[calc(100dvh-68px)] flex-col lg:flex-row">
        <section className="relative flex min-h-[52dvh] flex-1 flex-col overflow-hidden bg-[#102028]" onMouseMove={revealControls} onClick={() => showPicker && setShowPicker(false)} ref={videoAreaRef}>
          <div className="movie-surface absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_32%,rgba(5,12,15,.7)_100%)]" />
            <div className="absolute inset-x-0 top-0 h-[7%] bg-[#091115]" />
            <div className="absolute inset-x-0 bottom-0 h-[10%] bg-[#091115]" />
          </div>
          <div className="absolute left-5 right-5 top-7 z-10 flex items-start justify-between sm:left-9 sm:right-9 sm:top-10">
            <div><p className="mono text-[9px] uppercase tracking-[.22em] text-ivory/55">now playing</p><h1 className="mt-1 text-2xl text-ivory sm:text-3xl">Spirited Away</h1><p className="mt-1 text-xs text-ivory/55">Hayao Miyazaki · 2001</p></div>
            <div className="rounded-full border border-ivory/20 bg-navy/30 px-3 py-1.5 text-[10px] text-ivory/70 backdrop-blur-sm"><span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-moss" />together</div>
          </div>
          <div className={`absolute inset-0 z-10 flex items-center justify-center transition-opacity ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0'}`}>
            <button aria-label={isPlaying ? 'Pause film' : 'Play film'} className="button-primary flex h-16 w-16 items-center justify-center rounded-full border-2 border-ivory/60 bg-coral/90 text-ivory shadow-2xl sm:h-20 sm:w-20" onClick={() => setIsPlaying(value => !value)}><Icon name={isPlaying ? 'pause' : 'play'} size={isPlaying ? 24 : 28} /></button>
          </div>
          {floatingReactions.map(item => <div className="reaction-rise absolute bottom-24 z-20 text-4xl drop-shadow-lg" key={item.id} style={{ left: `${item.x}%` }}>{item.emoji}</div>)}

          <div className={`absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-[#091115] to-transparent px-5 pb-5 pt-20 transition-opacity sm:px-9 ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0'}`}>
            <div className="group mb-4 cursor-pointer" onClick={handleProgress} ref={progressRef}><div className="h-1 rounded-full bg-ivory/25 transition-all group-hover:h-1.5"><div className="relative h-full rounded-full bg-coral-light" style={{ width: `${videoProgress * 100}%` }}><span className="absolute -right-1.5 -top-1 h-3 w-3 rounded-full bg-ivory opacity-0 shadow-lg transition-opacity group-hover:opacity-100" /></div></div></div>
            <div className="flex items-center gap-3 text-ivory">
              <button aria-label={isPlaying ? 'Pause film' : 'Play film'} className="focus-ring" onClick={() => setIsPlaying(value => !value)}><Icon name={isPlaying ? 'pause' : 'play'} size={19} /></button>
              <span className="mono text-[10px] text-ivory/70">{formatTime(videoTime)} / 1:44:00</span>
              <span className="flex-1" />
              <div className="relative flex items-center gap-2"><button aria-label="Toggle volume control" className="focus-ring text-ivory/80" onClick={() => setShowVolume(value => !value)}><Icon name={volume === 0 ? 'mute' : volume < .5 ? 'volume-low' : 'volume'} size={17} /></button>{showVolume && <input aria-label="Volume" className="w-20 accent-coral" max="1" min="0" onChange={event => setVolume(Number(event.target.value))} step=".1" type="range" value={volume} />}</div>
              <button aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} className="focus-ring text-ivory/80" onClick={toggleFullscreen}><Icon name="expand" size={17} /></button>
            </div>
          </div>
        </section>

        <div className={`${showPanel ? 'flex' : 'hidden'} h-[48dvh] w-full flex-shrink-0 border-t lg:flex lg:h-auto lg:w-[370px] lg:border-l lg:border-t-0 ${border}`}><SidePanel /></div>
      </div>
    </div>
  )
}