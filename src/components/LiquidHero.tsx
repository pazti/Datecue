import type { ReactNode } from "react"

export function LiquidBackdrop() {
  return (
    <div className="liquid-backdrop" aria-hidden="true">
      <span className="liquid-backdrop-glow liquid-backdrop-glow-one" />
      <span className="liquid-backdrop-glow liquid-backdrop-glow-two" />
    </div>
  )
}

export default function LiquidHero() {
  return (
    <div className="liquid-hero" aria-hidden="true">
      <span className="liquid-hero-orb" />
      <span className="liquid-hero-halo" />
    </div>
  )
}

export function LiquidGlass({
  children,
  className = "",
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={`liquid-glass ${className}`}>{children}</div>
}

export function LiquidLogoMark() {
  return (
    <span className="liquid-logo-mark" aria-hidden="true">
      <span />
    </span>
  )
}
