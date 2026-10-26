import { useState } from "react"
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth"
import Logo, { Icon } from "../components/Logo"
import { auth } from "../lib/firebase"
import { recordLegalAcceptance, saveUserProfile } from "../lib/rooms"
import { LEGAL_VERSION, type LegalDocument } from "./LegalPage"

interface Props {
  darkMode: boolean
  onToggleDark: () => void
  onBack: () => void
  onSuccess: () => void
  onLegal: (document: LegalDocument) => void
}

export default function AuthPage({
  darkMode,
  onToggleDark,
  onBack,
  onSuccess,
  onLegal,
}: Props) {
  const [mode, setMode] = useState<"login" | "signup">("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [error, setError] = useState("")
  const [resetSent, setResetSent] = useState(false)
  const [verificationSent, setVerificationSent] = useState(false)
  const [verificationRequired, setVerificationRequired] = useState(false)
  const [profileNeedsSaving, setProfileNeedsSaving] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [busy, setBusy] = useState(false)
  const surface = darkMode ? "bg-night text-ivory" : "bg-ivory text-ink"
  const muted = darkMode ? "text-ivory/60" : "text-muted-ink"

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError("")
    setResetSent(false)
    if (mode === "signup" && !acceptedTerms) {
      setError("Agree to the Terms of Service before creating an account.")
      return
    }
    setBusy(true)
    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email.trim(), password)
        if (auth.currentUser && !auth.currentUser.emailVerified) {
          setVerificationRequired(true)
          await sendEmailVerification(auth.currentUser)
          setVerificationSent(true)
          return
        }
      } else {
        if (displayName.trim().length < 2) {
          setError("Choose a display name with at least 2 characters.")
          return
        }
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password)
        setProfileNeedsSaving(true)
        setVerificationRequired(true)
        await sendEmailVerification(credential.user)
        setVerificationSent(true)
        return
      }
      onSuccess()
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : ""
      setError(
        code.includes("invalid-credential") || code.includes("wrong-password")
          ? "Email or password is incorrect."
          : code.includes("user-not-found")
            ? "No account was found for that email."
            : code.includes("email-already-in-use")
              ? "An account already exists for this email."
              : code.includes("invalid-email")
                ? "Enter a valid email address."
                : code.includes("weak-password")
                  ? "Use a password with at least 6 characters."
                  : code.includes("network-request-failed")
                    ? "Connection failed. Check your internet and try again."
                    : code.includes("too-many-requests")
                      ? "Too many attempts. Wait a moment and try again."
                      : code.includes("operation-not-allowed")
                        ? "Email sign-in is disabled for this Firebase project."
                        : "Unable to authenticate. Check your details and try again.",
      )
    } finally {
      setBusy(false)
    }
  }

  const checkVerification = async () => {
    setError("")
    setBusy(true)
    try {
      await auth.currentUser?.reload()
      if (!auth.currentUser?.emailVerified) {
        setError("Your email is not verified yet. Open the link in your inbox and try again.")
        return
      }
      await auth.currentUser.getIdToken(true)
      if (profileNeedsSaving) {
        await saveUserProfile(auth.currentUser.uid, displayName)
        setProfileNeedsSaving(false)
      }
      await recordLegalAcceptance(auth.currentUser.uid, LEGAL_VERSION)
      onSuccess()
    } catch {
      setError("We couldn't check verification yet. Check your connection and retry.")
    } finally {
      setBusy(false)
    }
  }

  const resendVerification = async () => {
    if (!auth.currentUser) return
    setError("")
    setBusy(true)
    try {
      await sendEmailVerification(auth.currentUser)
      setVerificationSent(true)
    } catch {
      setError("We couldn't resend the verification link. Wait a moment and retry.")
    } finally {
      setBusy(false)
    }
  }

  const signInWithGoogle = async () => {
    setError("")
    if (!acceptedTerms) {
      setError("Agree to the Terms of Service before continuing with Google.")
      return
    }
    setBusy(true)
    try {
      const credential = await signInWithPopup(auth, new GoogleAuthProvider())
      const profile = await saveUserProfile(
        credential.user.uid,
        credential.user.displayName || displayName || "Datecue guest",
      )
      void profile
      await recordLegalAcceptance(credential.user.uid, LEGAL_VERSION)
      onSuccess()
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : ""
      setError(code.includes("popup-closed-by-user") ? "Google sign-in was cancelled." : "Google sign-in failed. Try again.")
    } finally {
      setBusy(false)
    }
  }

  const resetPassword = async () => {
    if (!email.trim()) {
      setError("Enter your email address first.")
      return
    }
    setError("")
    setBusy(true)
    try {
      await sendPasswordResetEmail(auth, email.trim())
      setResetSent(true)
    } catch {
      setError(
        "We couldn't send a reset link. Check the email address and try again.",
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`film-grain min-h-[100dvh] ${surface}`}>
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <button
          aria-label="Back to home"
          className="button-quiet focus-ring flex items-center gap-2 rounded-full border hairline px-4 py-2 text-sm font-bold"
          onClick={onBack}
        >
          <Icon name="arrow-left" size={16} />{" "}
          <span className="hidden sm:inline">Back home</span>
        </button>
        <Logo dark={darkMode} />
        <button
          aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          className="button-quiet focus-ring flex h-10 w-10 items-center justify-center rounded-full border hairline"
          onClick={onToggleDark}
        >
          <Icon name={darkMode ? "sun" : "moon"} size={17} />
        </button>
      </header>
      <main className="mx-auto flex max-w-md flex-col px-5 pb-20 pt-16 sm:px-8">
        <p className={`mono text-xs uppercase tracking-[.2em] ${muted}`}>
          your datecue account
        </p>
        <h1 className="mt-5 text-5xl leading-[.95] sm:text-6xl">
          Keep the night going.
        </h1>
        <p className={`mt-6 text-base leading-relaxed ${muted}`}>
          {mode === "login"
            ? "Sign in to return to your rooms and pick up where you left off."
            : "Create an account to save rooms and keep your watch history close."}
        </p>
        <form
          className="soft-card mt-9 rounded-[28px] p-6 sm:p-9"
          onSubmit={submit}
        >
          <div className="mb-7 flex gap-1 border-b hairline">
            {(["login", "signup"] as const).map((item) => (
              <button
                className={`focus-ring relative -mb-px px-4 pb-4 pt-1 text-sm font-bold capitalize ${
                  mode === item ? "text-coral" : muted
                }`}
                aria-pressed={mode === item}
                key={item}
                onClick={() => {
                  setMode(item)
                  setError("")
                  setResetSent(false)
                }}
                type="button"
              >
                {item === "login" ? "Log in" : "Sign up"}
                {mode === item && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-coral" />
                )}
              </button>
            ))}
          </div>
          <div className="mb-5 flex items-start gap-3 text-sm leading-relaxed">
            <input
              checked={acceptedTerms}
              className="mt-1 accent-[#d86856]"
              id="accept-legal"
              onChange={(event) => setAcceptedTerms(event.target.checked)}
              type="checkbox"
            />
            <div>
              <label htmlFor="accept-legal">I agree to the Terms of Service and acknowledge the Privacy Policy.</label>
              <p className="mt-1">
              <button className="text-coral underline underline-offset-2" onClick={() => onLegal("terms")} type="button">Terms of Service</button>
              {" · "}
              <button className="text-coral underline underline-offset-2" onClick={() => onLegal("privacy")} type="button">Privacy Policy</button>.
              </p>
            </div>
          </div>
          {mode === "signup" && (
            <>
              <label
                className={`mb-2 block text-xs font-bold uppercase tracking-[.16em] ${muted}`}
                htmlFor="auth-display-name"
              >
                Display name
              </label>
              <input
                autoComplete="nickname"
                className="input-field focus-ring rounded-xl px-4 py-3.5 text-sm"
                id="auth-display-name"
                maxLength={40}
                minLength={2}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="How should people call you?"
                required
                value={displayName}
              />
            </>
          )}
          <label
            className={`mb-2 mt-5 block text-xs font-bold uppercase tracking-[.16em] ${muted}`}
            htmlFor="auth-email"
          >
            Email
          </label>
          <input
            autoComplete="email"
            className="input-field focus-ring rounded-xl px-4 py-3.5 text-sm"
            id="auth-email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
          {mode === "login" && (
            <div className="mt-2 flex items-center justify-between gap-3">
              {resetSent ? (
                <p className="text-sm text-moss" role="status">
                  Reset link sent. Check your inbox.
                </p>
              ) : (
                <span />
              )}
              <button
                className="focus-ring rounded-md text-sm font-semibold text-coral underline-offset-4 hover:underline"
                disabled={busy}
                onClick={() => void resetPassword()}
                type="button"
              >
                Forgot password?
              </button>
            </div>
          )}
          <label
            className={`mb-2 mt-5 block text-xs font-bold uppercase tracking-[.16em] ${muted}`}
            htmlFor="auth-password"
          >
            Password
          </label>
          <input
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            className="input-field focus-ring rounded-xl px-4 py-3.5 text-sm"
            id="auth-password"
            minLength={6}
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
          {verificationRequired && (
            <div className="mt-4 space-y-3 rounded-xl bg-moss/10 px-3 py-3 text-sm text-moss" role="status">
              <p>{verificationSent ? "We sent a verification link. Verify your email before continuing." : "Verify your email before continuing."}</p>
              <button className="button-primary focus-ring w-full rounded-lg px-3 py-2 font-bold" disabled={busy} onClick={() => void checkVerification()} type="button">
                {busy ? "Checking…" : "I've verified my email"}
              </button>
              <button className="focus-ring w-full rounded-lg border border-current px-3 py-2 font-bold" disabled={busy} onClick={() => void resendVerification()} type="button">
                Resend verification link
              </button>
            </div>
          )}
          {error && (
            <p
              role="alert"
              className="mt-4 rounded-xl bg-coral/10 px-3 py-2 text-sm text-coral"
            >
              {error}
            </p>
          )}
          <button
            className="button-quiet focus-ring flex w-full items-center justify-center gap-2 rounded-xl border px-5 py-3.5 text-sm font-bold"
            disabled={busy}
            onClick={() => void signInWithGoogle()}
            type="button"
          >
            Continue with Google
          </button>
          <div className={`my-4 flex items-center gap-3 text-xs ${muted}`}><span className="h-px flex-1 bg-current opacity-20" />or<span className="h-px flex-1 bg-current opacity-20" /></div>
          <button
            className="button-primary focus-ring flex w-full items-center justify-center gap-2 rounded-xl px-5 py-4 text-sm font-bold"
            disabled={busy}
            type="submit"
          >
            {busy
              ? "Please wait…"
              : mode === "login"
                ? "Log in"
                : "Create account"}{" "}
            <Icon name="arrow-right" size={16} />
          </button>
        </form>
      </main>
    </div>
  )
}
