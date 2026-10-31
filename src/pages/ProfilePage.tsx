import { useEffect, useMemo, useRef, useState } from "react"
import { onValue, ref } from "firebase/database"
import Logo, { Icon } from "../components/Logo"
import { formatDuration, realtimeDatabase } from "../lib/firebase"
import { saveUserProfile, type UserProfile } from "../lib/rooms"
import { deleteAccountData } from "../lib/account"
import AccessibleDialog from "../components/AccessibleDialog"

interface HistoryItem {
  roomId: string
  movieUrl: string
  title?: string
  thumbnailUrl?: string | null
  watchedSeconds?: number
  updatedAt?: number
}

interface Props {
  userId: string
  email: string
  darkMode: boolean
  onToggleDark: () => void
  onBack: () => void
  onLogout: () => Promise<void>
  onAccountDeleted: () => Promise<void>
  onLegal: (document: "privacy" | "terms") => void
}

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "D"
  )
}

export default function ProfilePage({
  userId,
  email,
  darkMode,
  onToggleDark,
  onBack,
  onLogout,
  onAccountDeleted,
  onLegal,
}: Props) {
  const [profile, setProfile] = useState<Partial<UserProfile>>({})
  const [nameDraft, setNameDraft] = useState("")
  const [bioDraft, setBioDraft] = useState("")
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [totalSeconds, setTotalSeconds] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [logoutBusy, setLogoutBusy] = useState(false)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)
  const [accountData, setAccountData] =
    useState<Record<string, unknown> | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [exported, setExported] = useState(false)
  const profileDraftDirty = useRef(false)

  useEffect(
    () =>
      onValue(
        ref(realtimeDatabase, `users/${userId}`),
        (snapshot) => {
          const value = snapshot.val() ?? {}
          setAccountData(value)
          const nextProfile = (value.profile ?? {}) as Partial<UserProfile>
          const nextHistory = Object.entries(value.history ?? {})
            .map(([key, item]) => ({
              ...item as Omit<HistoryItem, "roomId">,
              roomId: (item as { roomId?: string }).roomId || key,
            }))
            .sort(
              (left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0),
            )

          setProfile(nextProfile)
          if (!profileDraftDirty.current) {
            setNameDraft(nextProfile.displayName ?? "")
            setBioDraft(nextProfile.bio ?? "")
          }
          setHistory(nextHistory.slice(0, 12))
          setTotalSeconds(value.stats?.watchSeconds ?? 0)
          setError("")
          setLoading(false)
          setLoadError(false)
        },
        () => {
          setError(
            "Your profile couldn't load. Check your connection and try again.",
          )
          setLoading(false)
          setLoadError(true)
        },
      ),
    [userId],
  )

  const initialsText = useMemo(
    () => initials(nameDraft || profile.displayName || "Datecue"),
    [nameDraft, profile.displayName],
  )
  const surface = darkMode ? "bg-night text-ivory" : "bg-ivory text-ink"
  const muted = darkMode ? "text-ivory/65" : "text-muted-ink"

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedName = nameDraft.trim()
    if (normalizedName.length < 2) {
      setError("Your display name needs at least 2 characters.")
      return
    }
    setSaving(true)
    setError("")
    setSaved(false)
    try {
      await saveUserProfile(userId, normalizedName, bioDraft)
      profileDraftDirty.current = false
      setSaved(true)
    } catch {
      setError(
        "Your profile couldn't be saved. Check your connection and retry.",
      )
    } finally {
      setSaving(false)
    }
  }

  const logout = async () => {
    setLogoutBusy(true)
    setError("")
    try {
      await onLogout()
    } catch {
      setError(
        "You couldn't be signed out. Check your connection and try again.",
      )
    } finally {
      setLogoutBusy(false)
    }
  }

  const downloadData = () => {
    if (!accountData) {
      setError("Your account data is still loading. Try again in a moment.")
      return
    }
    const payload = {
      exportedAt: new Date().toISOString(),
      account: { userId, email },
      data: accountData,
    }
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      }),
    )
    const link = document.createElement("a")
    link.href = url
    link.download = `datecue-data-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    setExported(true)
  }

  const deleteAccount = async () => {
    setDeleting(true)
    setError("")
    try {
      await deleteAccountData()
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : ""
      setError(
        code.includes("functions/not-found")
          ? "Account deletion is not available on this deployment yet. Contact the service operator."
          : "Your account couldn't be deleted. Check your connection and try again.",
      )
      setDeleting(false)
      setDeleteOpen(false)
      return
    }
    try {
      await onAccountDeleted()
    } catch {
      setError(
        "Your account was deleted, but you couldn't be signed out automatically. Refresh this page.",
      )
      setDeleting(false)
      setDeleteOpen(false)
    }
  }

  return (
    <div className={`film-grain surface-wash min-h-[100dvh] ${surface}`}>
      <header className="sticky top-0 z-20 border-b hairline bg-ivory/90 px-5 py-4 backdrop-blur-xl dark:bg-night/90 sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <button
            className="button-quiet focus-ring flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold"
            onClick={onBack}
            type="button"
          >
            <Icon name="arrow-left" size={16} />
            Back
          </button>
          <Logo dark={darkMode} />
          <div className="flex items-center gap-2">
            <button
              aria-label={
                darkMode ? "Switch to light mode" : "Switch to dark mode"
              }
              className="button-quiet focus-ring flex h-10 w-10 items-center justify-center rounded-full border"
              onClick={onToggleDark}
              type="button"
            >
              <Icon name={darkMode ? "sun" : "moon"} size={16} />
            </button>
            <button
              className="button-quiet focus-ring rounded-full border px-3 py-2 text-xs font-bold"
              disabled={logoutBusy}
              onClick={() => void logout()}
              type="button"
            >
              {logoutBusy ? "Signing out…" : "Log out"}
            </button>
          </div>
        </div>
      </header>

      <main className="page-enter mx-auto max-w-6xl px-5 pb-20 pt-10 sm:px-8 sm:pt-14">
        <p className={`eyebrow ${muted}`}>Your Datecue account</p>
        <h1 className="mt-3 text-5xl sm:text-7xl">A little more you.</h1>
        <p className={`mt-4 max-w-2xl text-base leading-relaxed ${muted}`}>
          Keep your room name and personal watch history in one place. Your bio
          is only shared with someone while you’re in the same room.
        </p>

        {error && (
          <p
            className="mt-6 rounded-2xl border border-coral/20 bg-coral/10 px-4 py-3 text-sm text-coral"
            role="alert"
          >
            {error}
          </p>
        )}

        <div className="mt-9 grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
          <section className="soft-card rounded-[28px] p-6 sm:p-8">
            <div className="flex items-center gap-4">
              <span
                aria-label={`${nameDraft || profile.displayName || "Your"} initials: ${initialsText}`}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-coral text-xl font-bold text-ivory shadow-lg shadow-coral/15"
                role="img"
              >
                {initialsText}
              </span>
              <div>
                <p className="eyebrow text-coral">Your profile</p>
                <h2 className="mt-1 text-2xl">
                  {nameDraft || "Add your name"}
                </h2>
              </div>
            </div>
            <p className={`mt-5 text-sm leading-relaxed ${muted}`}>
              Your name and initials help the other person recognize you in a
              room. Your email and history stay private.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border hairline px-4 py-3">
                <p className={`eyebrow ${muted}`}>Shared watch time</p>
                <p className="mt-2 text-xl font-semibold">
                  {loading ? "—" : formatDuration(totalSeconds)}
                </p>
              </div>
              <div className="rounded-2xl border hairline px-4 py-3">
                <p className={`eyebrow ${muted}`}>Saved nights</p>
                <p className="mt-2 text-xl font-semibold">
                  {loading ? "—" : history.length}
                </p>
              </div>
            </div>
          </section>

          <form
            className="soft-card rounded-[28px] p-6 sm:p-8"
            onSubmit={(event) => void save(event)}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="eyebrow text-coral">Personal details</p>
                <h2 className="mt-2 text-3xl">Your room identity</h2>
              </div>
              {saved && (
                <p
                  className="rounded-full bg-moss/12 px-3 py-2 text-xs font-semibold text-moss"
                  role="status"
                >
                  Changes saved
                </p>
              )}
            </div>
            <label
              className={`mt-6 block text-xs font-bold uppercase tracking-[.12em] ${muted}`}
              htmlFor="profile-display-name"
            >
              Display name
            </label>
            <input
              autoComplete="nickname"
              className="input-field focus-ring mt-2 rounded-xl px-4 py-3.5"
              id="profile-display-name"
              maxLength={40}
              minLength={2}
              onChange={(event) => {
                profileDraftDirty.current = true
                setNameDraft(event.target.value)
                setSaved(false)
              }}
              required
              value={nameDraft}
            />
            <label
              className={`mt-5 block text-xs font-bold uppercase tracking-[.12em] ${muted}`}
              htmlFor="profile-bio"
            >
              A little about you
            </label>
            <textarea
              className="input-field focus-ring mt-2 min-h-28 resize-y rounded-xl px-4 py-3.5"
              id="profile-bio"
              maxLength={160}
              onChange={(event) => {
                profileDraftDirty.current = true
                setBioDraft(event.target.value)
                setSaved(false)
              }}
              placeholder="A short line you’d like your watch partner to know."
              value={bioDraft}
            />
            <p className={`mt-1 text-right text-xs ${muted}`}>
              {bioDraft.length}/160
            </p>
            <div className="mt-5 flex flex-col gap-3 border-t hairline pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p
                  className={`text-xs font-semibold uppercase tracking-[.12em] ${muted}`}
                >
                  Private account email
                </p>
                <p className="mt-1 break-all text-sm">
                  {email || "Not available"}
                </p>
              </div>
              <button
                className="button-primary focus-ring rounded-xl px-5 py-3 text-sm font-bold"
                disabled={saving || loading}
                type="submit"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </div>

        <section className="mt-12">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className={`eyebrow ${muted}`}>Only visible to you</p>
              <h2 className="mt-2 text-3xl sm:text-4xl">Watch history</h2>
            </div>
            <p className={`text-sm ${muted}`}>{history.length} recent nights</p>
          </div>
          <div className="mt-5 grid gap-3">
            {loading ? (
              <div
                className="space-y-3"
                role="status"
                aria-label="Loading watch history"
              >
                {[0, 1, 2].map((item) => (
                  <div
                    className="soft-card flex items-center gap-4 rounded-[22px] p-4"
                    key={item}
                  >
                    <span
                      className="loading-shimmer h-16 w-28 rounded-[14px]"
                      aria-hidden="true"
                    />
                    <span className="flex-1 space-y-2">
                      <span className="loading-shimmer block h-4 w-2/3 rounded-full" />
                      <span className="loading-shimmer block h-3 w-1/3 rounded-full" />
                    </span>
                  </div>
                ))}
              </div>
            ) : loadError ? (
              <div className="soft-card rounded-[26px] p-7 sm:p-9">
                <p className="display-serif text-3xl">
                  Your history is unavailable.
                </p>
                <p className={`mt-2 text-sm leading-relaxed ${muted}`}>
                  We couldn’t load your saved nights, so we haven’t shown an
                  empty state.
                </p>
              </div>
            ) : history.length === 0 ? (
              <div className="soft-card rounded-[26px] p-7 sm:p-9">
                <p className="display-serif text-3xl">No saved nights yet.</p>
                <p className={`mt-2 text-sm leading-relaxed ${muted}`}>
                  Your watch history will collect here after a room ends.
                </p>
              </div>
            ) : (
              history.map((item) => (
                <article
                  className="soft-card flex items-center gap-4 rounded-[22px] p-4"
                  key={item.roomId}
                >
                  {item.thumbnailUrl ? (
                    <img
                      alt=""
                      className="h-16 w-28 shrink-0 rounded-[14px] object-cover sm:h-[76px] sm:w-32"
                      loading="lazy"
                      src={item.thumbnailUrl}
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="flex h-16 w-28 shrink-0 items-center justify-center rounded-[14px] bg-navy text-ivory"
                    >
                      <Icon name="film" size={22} />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-lg">
                      {item.title || `Room ${item.roomId}`}
                    </h3>
                    <p className={`mt-1 text-sm ${muted}`}>
                      {formatDuration(item.watchedSeconds ?? 0)} watched
                    </p>
                  </div>
                  {item.updatedAt && (
                    <time
                      className={`hidden shrink-0 text-xs ${muted} sm:block`}
                      dateTime={new Date(item.updatedAt).toISOString()}
                    >
                      {new Date(item.updatedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </time>
                  )}
                </article>
              ))
            )}
          </div>
        </section>

        <section className="soft-card mt-10 rounded-[26px] p-6 sm:p-8">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
            <div className="max-w-xl">
              <p className="eyebrow text-coral">Your account data</p>
              <h2 className="mt-2 text-2xl">Keep a copy, or leave Datecue.</h2>
              <p className={`mt-2 text-sm leading-relaxed ${muted}`}>
                Export includes your saved profile, watch history, statistics,
                and notifications. Deleting your account removes this data and
                closes rooms you host.
              </p>
              {exported && (
                <p
                  className="mt-2 text-sm font-semibold text-moss"
                  role="status"
                >
                  Your data export is ready.
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                className="button-quiet focus-ring rounded-xl border px-4 py-3 text-sm font-bold"
                disabled={loading || !accountData}
                onClick={downloadData}
                type="button"
              >
                Download my data
              </button>
              <button
                className="focus-ring rounded-xl border border-coral/40 px-4 py-3 text-sm font-bold text-coral"
                onClick={() => setDeleteOpen(true)}
                type="button"
              >
                Delete account
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t hairline px-5 py-6 sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 text-sm">
          <span>Datecue</span>
          <nav aria-label="Legal documents" className="flex gap-4">
            <button
              className="focus-ring underline underline-offset-2"
              onClick={() => onLegal("privacy")}
              type="button"
            >
              Privacy
            </button>
            <button
              className="focus-ring underline underline-offset-2"
              onClick={() => onLegal("terms")}
              type="button"
            >
              Terms
            </button>
          </nav>
        </div>
      </footer>
      {deleteOpen && (
        <AccessibleDialog
          labelledBy="delete-account-title"
          onClose={() => setDeleteOpen(false)}
          closeOnEscape={!deleting}
          closeOnBackdropClick={!deleting}
        >
          <p className="eyebrow text-coral">This cannot be undone</p>
          <h2 className="mt-3 text-3xl" id="delete-account-title">
            Delete your Datecue account?
          </h2>
          <p className={`mt-3 text-sm leading-relaxed ${muted}`}>
            Your profile, history, statistics, and notifications will be
            removed. Rooms you host will end, and your guest seat will be
            released.
          </p>
          {error && (
            <p className="mt-4 text-sm text-coral" role="alert">
              {error}
            </p>
          )}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              className="button-quiet focus-ring rounded-xl border px-4 py-3 text-sm font-bold"
              disabled={deleting}
              onClick={() => setDeleteOpen(false)}
              type="button"
            >
              Keep my account
            </button>
            <button
              className="focus-ring rounded-xl bg-coral px-4 py-3 text-sm font-bold text-ivory"
              disabled={deleting}
              onClick={() => void deleteAccount()}
              type="button"
            >
              {deleting ? "Deleting account…" : "Delete account"}
            </button>
          </div>
        </AccessibleDialog>
      )}
    </div>
  )
}
