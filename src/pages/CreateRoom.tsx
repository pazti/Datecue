import { useState } from 'react'
import Logo, { Icon } from '../components/Logo'

interface Props {
  onCreateRoom: () => void
  onJoinRoom: () => void
  onBack: () => void
  darkMode: boolean
  onToggleDark: () => void
}

const RECENT_ROOMS = [
  { title: 'Spirited Away', detail: 'A room from 2 days ago', code: 'XK4P' },
  { title: 'The Grand Budapest Hotel', detail: 'A room from 1 week ago', code: 'MN7Q' },
]

export default function CreateRoom({ onCreateRoom, onJoinRoom, onBack, darkMode, onToggleDark }: Props) {
  const [tab, setTab] = useState<'create' | 'join'>('create')
  const [url, setUrl] = useState('')
  const [code, setCode] = useState('')
  const [nickname, setNickname] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const surface = darkMode ? 'bg-night text-ivory' : 'bg-ivory text-ink'
  const muted = darkMode ? 'text-ivory/60' : 'text-muted-ink'

  const handleSubmit = () => {
    if (submitted) return
    setSubmitted(true)
    window.setTimeout(() => {
      if (tab === 'create') onCreateRoom()
      else onJoinRoom()
    }, 600)
  }

  return (
    <div className={`film-grain min-h-[100dvh] ${surface}`}>
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <button aria-label="Back to home" className={`button-quiet focus-ring flex items-center gap-2 rounded-full border hairline px-4 py-2 text-sm font-bold`} onClick={onBack}><Icon name="arrow-left" size={16} /> <span className="hidden sm:inline">Back home</span></button>
        <Logo dark={darkMode} />
        <button aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'} className="button-quiet focus-ring flex h-10 w-10 items-center justify-center rounded-full border hairline" onClick={onToggleDark}><Icon name={darkMode ? 'sun' : 'moon'} size={17} /></button>
      </header>

      <main className="mx-auto grid max-w-7xl items-start gap-14 px-5 pb-20 pt-12 sm:px-8 md:pt-20 lg:grid-cols-[.8fr_1.2fr] lg:px-12">
        <div className="reveal max-w-md lg:pt-10">
          <p className={`mono text-xs uppercase tracking-[.2em] ${muted}`}>a room for two / setup</p>
          <h1 className="mt-5 text-6xl leading-[.9] sm:text-7xl">Make some room.</h1>
          <p className={`mt-7 text-lg leading-relaxed ${muted}`}>Choose a film or bring a room code. We’ll keep the screen in step while you keep the conversation going.</p>
          <div className={`mt-12 border-l-2 border-coral pl-5 text-sm leading-relaxed ${muted}`}>
            <p className="font-bold text-coral">A small note</p>
            <p className="mt-1">This is a frontend demo, so any link or code will take you into the sample room.</p>
          </div>
        </div>

        <div className="reveal reveal-delay-2">
          <div className="soft-card rounded-[28px] p-6 sm:p-9">
            <div className="flex gap-1 border-b hairline">
              {(['create', 'join'] as const).map(item => (
                <button className={`focus-ring relative -mb-px px-4 pb-4 pt-1 text-sm font-bold capitalize transition-colors ${tab === item ? 'text-coral' : muted}`} key={item} onClick={() => { setTab(item); setSubmitted(false) }}>
                  {item === 'create' ? 'Create a room' : 'Join a room'}
                  {tab === item && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-coral" />}
                </button>
              ))}
            </div>

            <div className="mt-8">
              <div className="mb-7 flex h-11 w-11 items-center justify-center rounded-2xl bg-coral/10 text-coral"><Icon name={tab === 'create' ? 'film' : 'link'} size={21} /></div>
              <h2 className="text-4xl leading-none">{tab === 'create' ? 'Start with a film.' : 'Come on in.'}</h2>
              <p className={`mt-3 text-sm ${muted}`}>{tab === 'create' ? 'Paste the link you want to watch together.' : 'Enter the room details your person sent you.'}</p>
            </div>

            <div className="mt-8 space-y-5">
              {tab === 'create' ? (
                <div>
                  <label className={`mb-2 block text-xs font-bold uppercase tracking-[.16em] ${muted}`} htmlFor="movie-url">Film link</label>
                  <input className="input-field focus-ring rounded-xl px-4 py-3.5 text-sm" id="movie-url" onChange={e => setUrl(e.target.value)} placeholder="https://youtube.com/watch?v=…" type="url" value={url} />
                  <p className={`mt-2 text-xs ${muted}`}>You can use any YouTube link for this demo.</p>
                </div>
              ) : (
                <div>
                  <label className={`mb-2 block text-xs font-bold uppercase tracking-[.16em] ${muted}`} htmlFor="room-code">Room code</label>
                  <input autoComplete="off" className="input-field focus-ring rounded-xl px-4 py-3.5 text-center font-mono text-xl font-bold uppercase tracking-[.3em]" id="room-code" maxLength={6} onChange={e => setCode(e.target.value.toUpperCase().slice(0, 6))} placeholder="XK4P2R" value={code} />
                </div>
              )}
              <div>
                <label className={`mb-2 block text-xs font-bold uppercase tracking-[.16em] ${muted}`} htmlFor="nickname">Your name</label>
                <input className="input-field focus-ring rounded-xl px-4 py-3.5 text-sm" id="nickname" onChange={e => setNickname(e.target.value)} placeholder="How should we call you?" type="text" value={nickname} />
              </div>
            </div>

            <button className="button-primary focus-ring mt-8 flex w-full items-center justify-center gap-2 rounded-xl px-5 py-4 text-sm font-bold disabled:opacity-70" disabled={submitted} onClick={handleSubmit}>
              {submitted ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-ivory/40 border-t-ivory" /> Opening your room…</> : <>{tab === 'create' ? 'Create private room' : 'Join private room'} <Icon name="arrow-right" size={16} /></>}
            </button>
            <p className={`mt-4 text-center text-xs ${muted}`}>{tab === 'create' ? 'You’ll get a link to share as soon as the room opens.' : 'No account or download needed.'}</p>
          </div>

          <div className="mt-9">
            <div className="mb-3 flex items-center justify-between"><p className={`mono text-[10px] uppercase tracking-[.18em] ${muted}`}>Recent rooms</p><span className={`text-xs ${muted}`}>Demo history</span></div>
            <div className="space-y-2">
              {RECENT_ROOMS.map(room => (
                <button className={`button-quiet focus-ring flex w-full items-center gap-3 rounded-xl border hairline px-4 py-3 text-left`} key={room.code} onClick={onCreateRoom}>
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-coral/10 text-coral"><Icon name="film" size={16} /></span>
                  <span className="min-w-0 flex-1"><span className={`block truncate text-sm font-bold ${darkMode ? 'text-ivory' : 'text-ink'}`}>{room.title}</span><span className={`block text-xs ${muted}`}>{room.detail}</span></span>
                  <span className={`mono rounded-md border px-2 py-1 text-[10px] tracking-[.15em] ${darkMode ? 'border-ivory/15 text-ivory/70' : 'border-ink/15 text-muted-ink'}`}>{room.code}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}