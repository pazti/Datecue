import { useEffect, useState } from 'react'
import { onValue, ref } from 'firebase/database'
import Logo, { Icon } from '../components/Logo'
import { realtimeDatabase } from '../lib/firebase'

interface Props { userId: string; onCreate: () => void; onJoin: () => void; onLogout: () => void; darkMode: boolean; onToggleDark: () => void }
export default function HomePage({ userId, onCreate, onJoin, onLogout, darkMode, onToggleDark }: Props) {
  const [stats, setStats] = useState({ watchTime: 0, rooms: 0, messages: 0 })
  const muted = darkMode ? 'text-ivory/60' : 'text-muted-ink'
  const surface = darkMode ? 'bg-night text-ivory' : 'bg-ivory text-ink'
  useEffect(() => onValue(ref(realtimeDatabase, `users/${userId}/stats`), snap => setStats({ watchTime: snap.val()?.watchTime ?? 0, rooms: snap.val()?.rooms ?? 0, messages: snap.val()?.messages ?? 0 })), [userId])
  const hours = Math.floor(stats.watchTime / 3600); const minutes = Math.floor((stats.watchTime % 3600) / 60)
  return <div className={`film-grain min-h-[100dvh] ${surface}`}>
    <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8"><Logo dark={darkMode} /><div className="flex items-center gap-2"><button aria-label="Toggle theme" className="button-quiet focus-ring flex h-10 w-10 items-center justify-center rounded-full border hairline" onClick={onToggleDark}><Icon name={darkMode ? 'sun' : 'moon'} size={17} /></button><button className="button-quiet focus-ring rounded-full px-3 py-2 text-sm font-bold" onClick={onLogout}>Log out</button></div></header>
    <main className="mx-auto max-w-5xl px-5 pb-20 pt-10 sm:px-8 sm:pt-16"><p className={`mono text-xs uppercase tracking-[.2em] ${muted}`}>your cinema</p><h1 className="mt-4 text-5xl leading-none sm:text-7xl">Welcome back.</h1><p className={`mt-5 max-w-xl text-lg ${muted}`}>Pick a room and make some space for the people you miss.</p>
      <div className="mt-10 grid gap-3 sm:grid-cols-2"><button className="button-primary focus-ring rounded-2xl p-6 text-left" onClick={onCreate}><span className="block text-xl font-bold">Create a room</span><span className="mt-2 block text-sm text-ivory/75">Choose a YouTube film and invite someone in.</span></button><button className="button-dark focus-ring rounded-2xl p-6 text-left" onClick={onJoin}><span className="block text-xl font-bold">Join a room</span><span className="mt-2 block text-sm text-ivory/70">Enter a room code from your person.</span></button></div>
      <section className="mt-12"><p className={`mono text-xs uppercase tracking-[.18em] ${muted}`}>your stats</p><div className="mt-4 grid grid-cols-3 gap-2 sm:gap-4">{[[`${hours}h ${minutes}m`, 'watch time'], [stats.rooms, 'rooms joined'], [stats.messages, 'messages sent']].map(([value, label]) => <div className="soft-card rounded-2xl p-4 sm:p-6" key={label}><p className="text-xl font-bold sm:text-3xl">{value}</p><p className={`mt-2 text-xs ${muted}`}>{label}</p></div>)}</div></section>
    </main>
  </div>
}
