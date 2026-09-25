import { useState } from 'react'
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth'
import Logo, { Icon } from '../components/Logo'
import { auth } from '../lib/firebase'

interface Props {
  darkMode: boolean
  onToggleDark: () => void
  onBack: () => void
  onSuccess: () => void
}

export default function AuthPage({ darkMode, onToggleDark, onBack, onSuccess }: Props) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const surface = darkMode ? 'bg-night text-ivory' : 'bg-ivory text-ink'
  const muted = darkMode ? 'text-ivory/60' : 'text-muted-ink'

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (mode === 'login') await signInWithEmailAndPassword(auth, email.trim(), password)
      else await createUserWithEmailAndPassword(auth, email.trim(), password)
      onSuccess()
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : ''
      setError(code.includes('invalid-credential') || code.includes('wrong-password') ? 'Email or password is incorrect.' : code.includes('email-already-in-use') ? 'An account already exists for this email.' : code.includes('weak-password') ? 'Use a password with at least 6 characters.' : 'Unable to authenticate. Check your details and try again.')
    } finally { setBusy(false) }
  }

  return <div className={`film-grain min-h-[100dvh] ${surface}`}>
    <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
      <button aria-label="Back to home" className="button-quiet focus-ring flex items-center gap-2 rounded-full border hairline px-4 py-2 text-sm font-bold" onClick={onBack}><Icon name="arrow-left" size={16} /> <span className="hidden sm:inline">Back home</span></button>
      <Logo dark={darkMode} />
      <button aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'} className="button-quiet focus-ring flex h-10 w-10 items-center justify-center rounded-full border hairline" onClick={onToggleDark}><Icon name={darkMode ? 'sun' : 'moon'} size={17} /></button>
    </header>
    <main className="mx-auto flex max-w-md flex-col px-5 pb-20 pt-16 sm:px-8">
      <p className={`mono text-xs uppercase tracking-[.2em] ${muted}`}>your datecue account</p>
      <h1 className="mt-5 text-6xl leading-[.9]">Keep the night going.</h1>
      <p className={`mt-6 text-base leading-relaxed ${muted}`}>{mode === 'login' ? 'Sign in to return to your rooms and pick up where you left off.' : 'Create an account to save rooms and keep your watch history close.'}</p>
      <form className="soft-card mt-9 rounded-[28px] p-6 sm:p-9" onSubmit={submit}>
        <div className="mb-7 flex gap-1 border-b hairline">
          {(['login', 'signup'] as const).map(item => <button className={`focus-ring relative -mb-px px-4 pb-4 pt-1 text-sm font-bold capitalize ${mode === item ? 'text-coral' : muted}`} key={item} onClick={() => { setMode(item); setError('') }} type="button">{item === 'login' ? 'Log in' : 'Sign up'}{mode === item && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-coral" />}</button>)}
        </div>
        <label className={`mb-2 block text-xs font-bold uppercase tracking-[.16em] ${muted}`} htmlFor="auth-email">Email</label>
        <input autoComplete="email" className="input-field focus-ring rounded-xl px-4 py-3.5 text-sm" id="auth-email" onChange={event => setEmail(event.target.value)} required type="email" value={email} />
        <label className={`mb-2 mt-5 block text-xs font-bold uppercase tracking-[.16em] ${muted}`} htmlFor="auth-password">Password</label>
        <input autoComplete={mode === 'login' ? 'current-password' : 'new-password'} className="input-field focus-ring rounded-xl px-4 py-3.5 text-sm" id="auth-password" minLength={6} onChange={event => setPassword(event.target.value)} required type="password" value={password} />
        {error && <p aria-live="polite" className="mt-4 rounded-xl bg-coral/10 px-3 py-2 text-sm text-coral">{error}</p>}
        <button className="button-primary focus-ring mt-7 flex w-full items-center justify-center gap-2 rounded-xl px-5 py-4 text-sm font-bold" disabled={busy} type="submit">{busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'} <Icon name="arrow-right" size={16} /></button>
      </form>
    </main>
  </div>
}
