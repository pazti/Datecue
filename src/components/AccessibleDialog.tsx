import { useEffect, useRef, type ReactNode } from "react"

interface Props {
  children: ReactNode
  labelledBy: string
  onClose: () => void
  closeOnEscape?: boolean
  closeOnBackdropClick?: boolean
  dialogClassName?: string
}

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "textarea:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",")

export default function AccessibleDialog({
  children,
  labelledBy,
  onClose,
  closeOnEscape = true,
  closeOnBackdropClick = true,
  dialogClassName = "soft-card w-full max-w-md rounded-3xl p-6 shadow-2xl",
}: Props) {
  const dialogRef = useRef<HTMLElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const dialog = dialogRef.current
    if (!dialog) return

    const focusFirst = () => {
      const target =
        dialog.querySelector<HTMLElement>("[autofocus]") ??
        dialog.querySelector<HTMLElement>(FOCUSABLE) ??
        dialog
      target.focus()
    }
    const frame = window.requestAnimationFrame(focusFirst)
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (closeOnEscape) {
          event.preventDefault()
          onCloseRef.current()
        }
        return
      }
      if (event.key !== "Tab" || !dialogRef.current) return

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((element) => element.getClientRects().length > 0)
      if (focusable.length === 0) {
        event.preventDefault()
        dialogRef.current.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const activeElement = document.activeElement
      if (
        event.shiftKey &&
        (activeElement === first || !dialogRef.current.contains(activeElement))
      ) {
        event.preventDefault()
        last.focus()
      } else if (
        !event.shiftKey &&
        (activeElement === last || !dialogRef.current.contains(activeElement))
      ) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener("keydown", handleKeyDown)
      previouslyFocused?.focus?.()
    }
  }, [closeOnEscape])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-5"
      role="presentation"
      onMouseDown={(event) => {
        if (closeOnBackdropClick && event.target === event.currentTarget) {
          onCloseRef.current()
        }
      }}
    >
      <section
        ref={dialogRef}
        aria-labelledby={labelledBy}
        aria-modal="true"
        className={dialogClassName}
        role="dialog"
        tabIndex={-1}
      >
        {children}
      </section>
    </div>
  )
}
