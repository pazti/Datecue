import { useEffect, useState } from 'react'
import Logo from '../components/Logo'
import { Icon } from '../components/Logo'

interface Props {
  onGetStarted: () => void
  darkMode: boolean
  onToggleDark: () => void
}

const FEATURES = [
  { index: '01', title: 'Stay in the same scene', copy: 'A shared timeline keeps every pause, play and rewind exactly where it should be.', icon: 'film' as const },
  { index: '02', title: 'Talk without leaving the story', copy: 'Messages carry a timestamp, so the little comments become part of the memory.', icon: 'message' as const },
  { index: '03', title: 'Feel the room, from anywhere', copy: 'A quiet presence layer shows when your person is there — without interrupting the film.', icon: 'users' as const },
]

function PhonePreview({ darkMode }: { darkMode: boolean }) {
  return (
    <div className="relative mx-auto w-full max-w-[380px]">
      <div className="absolute -inset-7 rounded-[42px] bg-coral/15 blur-2xl" aria-hidden="true" />
      <div className="relative overflow-hidden rounded-[28px] border-[7px] border-navy bg-navy shadow-[22px_28px_0_rgba(23,43,53,.12)]">
        <div className="flex h-7 items-center justify-between bg-navy px-4 text-[9px] text-ivory/70">
          <span className="mono">9:41</span>
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-moss" /> connected</span>
        </div>
        <div className="movie-surface relative h-[210px] overflow-hidden sm:h-[240px]">
          <div className="absolute left-5 top-5">
            <p className="mono text-[8px] uppercase tracking-[.2em] text-ivory/50">now playing</p>
            <p className="display-serif mt-1 text-xl text-ivory">Spirited Away</p>
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-ivory/40 bg-ivory/10 text-ivory backdrop-blur-sm">
              <Icon name="play" size={21} />
            </div>
          </div>
          <div className="absolute bottom-5 left-5 right-5">
            <div className="mb-2 flex items-center justify-between text-[9px] text-ivory/70"><span className="mono">11:22</span><span className="mono">1:56:00</span></div>
            <div className="h-1 rounded-full bg-ivory/25"><div className="h-full w-[42%] rounded-full bg-coral-light" /></div>
          </div>
          <div className="absolute bottom-14 right-8 rounded-full bg-ivory/90 px-3 py-1.5 text-[10px] font-bold text-navy shadow-lg">that reveal.</div>
          <div className="absolute bottom-24 left-10 h-2 w-2 rounded-full bg-coral-light opacity-80 drift" />
        </div>
        <div className={`${darkMode ? 'bg-night-card' : 'bg-paper'} px-4 pb-4 pt-3`}>
          <div className="flex items-center justify-between border-b border-ivory/10 pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-coral text-[10px] font-bold text-ivory">Y</div>
              <div><p className={`text-[10px] font-bold ${darkMode ? 'text-ivory' : 'text-ink'}`}>You + Alex</p><p className="text-[9px] text-muted-ink">in the room</p></div>
            </div>
            <span className="flex items-center gap-1 text-[9px] text-moss"><span className="h-1.5 w-1.5 rounded-full bg-moss" /> synced</span>
          </div>
          <div className="space-y-2 py-3">
            <div className="w-fit rounded-2xl rounded-bl-sm bg-sand px-3 py-2 text-[10px] text-ink">Did you see that coming? <span className="mono ml-1 text-[8px] text-muted-ink">11:22</span></div>
            <div className="ml-auto w-fit rounded-2xl rounded-br-sm bg-coral px-3 py-2 text-[10px] text-ivory">No way. <span className="mono ml-1 text-[8px] text-ivory/70">11:24</span></div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 flex-1 rounded-lg border border-ink/10 bg-sand/45 px-3 py-2 text-[9px] text-muted-ink">Say something about this scene…</div>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-coral text-ivory"><Icon name="send" size={14} /></div>
          </div>
        </div>
      </div>
      <div className="absolute -bottom-8 -left-8 hidden h-20 w-20 rounded-full border border-coral/30 sm:block" aria-hidden="true" />
    </div>
  )
}

export default function LandingPage({ onGetStarted, darkMode, onToggleDark }: Props) {
  const [url, setUrl] = useState('')
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setMounted(true), 50)
    return () => window.clearTimeout(timer)
  }, [])

  const surface = darkMode ? 'bg-night text-ivory' : 'bg-ivory text-ink'
  const muted = darkMode ? 'text-ivory/60' : 'text-muted-ink'
  const raised = darkMode ? 'bg-night-card' : 'bg-paper'

  return (
    <div className={`film-grain min-h-[100dvh] overflow-x-hidden ${surface}`}>
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12" aria-label="Primary navigation">
        <Logo dark={darkMode} />
        <div className="flex items-center gap-2 sm:gap-4">
          <button aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'} className="button-quiet focus-ring flex h-10 w-10 items-center justify-center rounded-full border hairline" onClick={onToggleDark}>
            <Icon name={darkMode ? 'sun' : 'moon'} size={17} />
          </button>
          <button className="button-dark focus-ring hidden rounded-full px-5 py-2.5 text-sm font-bold sm:block" onClick={onGetStarted}>Open a room</button>
        </div>
      </nav>

      <main>
        <section className="mx-auto grid max-w-7xl items-center gap-14 px-5 pb-24 pt-12 sm:px-8 md:pb-32 md:pt-20 lg:grid-cols-[1fr_420px] lg:gap-24 lg:px-12">
          <div className={mounted ? 'reveal' : 'opacity-0'}>
            <div className={`mb-6 flex items-center gap-2 text-xs font-bold uppercase tracking-[.2em] ${muted}`}><span className="h-px w-8 bg-coral" /> a room for two</div>
            <h1 className="max-w-3xl text-[clamp(3.6rem,8vw,7.4rem)] leading-[.9]">
              The best part is <em className="text-coral">who’s there.</em>
            </h1>
            <p className={`mt-8 max-w-xl text-lg leading-relaxed ${muted} sm:text-xl`}>
              A private cinema for the people you miss. Share a film, stay in sync, and make the distance feel a little smaller.
            </p>
            <div className="mt-9 max-w-xl">
              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="sr-only" htmlFor="landing-url">Film link</label>
                <input id="landing-url" className="input-field focus-ring rounded-full px-5 py-3.5 text-sm" onChange={e => setUrl(e.target.value)} placeholder="Paste a film link to begin…" type="url" value={url} />
                <button className="button-primary focus-ring flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-bold" onClick={onGetStarted}>Create room <Icon name="arrow-right" size={16} /></button>
              </div>
              <p className={`mt-3 text-xs ${muted}`}>No account needed for the demo. Invite someone in one tap.</p>
            </div>
            <div className={`mt-12 flex items-center gap-3 border-t pt-5 hairline text-sm ${muted}`}>
              <div className="flex -space-x-2" aria-hidden="true">
                {['M', 'A', 'J', 'S'].map((letter, index) => <span className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${darkMode ? 'border-night' : 'border-ivory'} ${['bg-coral', 'bg-moss', 'bg-ochre', 'bg-navy'][index]} text-[10px] font-bold text-ivory`} key={letter}>{letter}</span>)}
              </div>
              <span><strong className={darkMode ? 'text-ivory' : 'text-ink'}>12,400</strong> quiet movie nights started</span>
            </div>
          </div>
          <div className={`${mounted ? 'reveal reveal-delay-2' : 'opacity-0'} lg:pt-4`}>
            <PhonePreview darkMode={darkMode} />
            <p className={`mt-8 text-center text-xs uppercase tracking-[.18em] ${muted}`}>A little closer, frame by frame</p>
          </div>
        </section>

        <section className={`border-y py-16 hairline ${darkMode ? 'bg-navy' : 'bg-navy'} text-ivory`}>
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
            <div className="grid gap-10 md:grid-cols-[.7fr_1.3fr] md:items-end">
              <div>
                <p className="mono text-xs uppercase tracking-[.2em] text-coral-light">01 / the ritual</p>
                <h2 className="mt-4 max-w-md text-4xl leading-tight sm:text-5xl">Less setup. More “press play.”</h2>
              </div>
              <div className="grid gap-5 sm:grid-cols-3">
                {[['01', 'Drop in a link', 'Choose the thing you both want to see.'], ['02', 'Send the invite', 'A room code makes the distance disappear.'], ['03', 'Make a memory', 'Watch, talk, pause — it all stays together.']].map(([n, title, copy]) => (
                  <div className="border-t border-ivory/20 pt-4" key={n}><span className="mono text-xs text-coral-light">{n}</span><h3 className="mt-5 text-2xl">{title}</h3><p className="mt-2 text-sm leading-relaxed text-ivory/60">{copy}</p></div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-24 sm:px-8 md:py-32 lg:px-12">
          <div className="max-w-xl">
            <p className={`mono text-xs uppercase tracking-[.2em] ${muted}`}>02 / made for the in-between</p>
            <h2 className="mt-4 text-5xl leading-none sm:text-6xl">A shared screen can hold a lot.</h2>
          </div>
          <div className="mt-14 grid gap-8 border-t hairline pt-8 md:grid-cols-3">
            {FEATURES.map(feature => (
              <article className="group" key={feature.index}>
                <div className="flex items-center justify-between"><span className={`mono text-xs ${muted}`}>{feature.index}</span><span className="flex h-10 w-10 items-center justify-center rounded-full bg-coral/10 text-coral transition-transform duration-300 group-hover:rotate-12"><Icon name={feature.icon} size={19} /></span></div>
                <h3 className="mt-9 text-3xl leading-tight">{feature.title}</h3>
                <p className={`mt-4 max-w-xs text-sm leading-relaxed ${muted}`}>{feature.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="px-5 pb-24 sm:px-8 md:pb-32 lg:px-12">
          <div className="mx-auto grid max-w-7xl overflow-hidden rounded-[28px] bg-coral text-ivory md:grid-cols-[1.2fr_.8fr]">
            <div className="px-7 py-12 sm:px-12 sm:py-16">
              <p className="mono text-xs uppercase tracking-[.2em] text-ivory/65">03 / your next double feature</p>
              <h2 className="mt-5 max-w-2xl text-5xl leading-[.95] sm:text-6xl">Save a seat for someone.</h2>
              <p className="mt-6 max-w-lg leading-relaxed text-ivory/75">The little comments, the dramatic pauses, the shared “wait, rewind that” — make space for all of it.</p>
              <button className="button-dark focus-ring mt-8 inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-bold" onClick={onGetStarted}>Start a watch party <Icon name="arrow-right" size={16} /></button>
            </div>
            <div className="relative hidden min-h-[300px] overflow-hidden bg-navy md:block">
              <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full border border-coral-light/40" />
              <div className="absolute right-20 top-20 h-36 w-36 rounded-full border border-ivory/20" />
              <div className="absolute bottom-10 right-12 h-24 w-24 rounded-full bg-coral-light/20 blur-xl" />
              <div className="absolute bottom-10 left-12 text-[120px] leading-none text-ivory/10">"</div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t hairline px-5 py-7 sm:px-8 lg:px-12">
        <div className={`mx-auto flex max-w-7xl flex-col gap-3 text-xs ${muted} sm:flex-row sm:items-center sm:justify-between`}>
          <Logo compact dark={darkMode} />
          <span>Made for the people you’d rather be watching with.</span>
          <span className="mono text-[10px] uppercase tracking-[.15em]">Together / 2024</span>
        </div>
      </footer>
    </div>
  )
}