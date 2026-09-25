import type { ReactNode, SVGProps } from 'react'

interface LogoProps {
  dark?: boolean
  compact?: boolean
  className?: string
}

export function LogoMark({ dark = false, className = '' }: { dark?: boolean; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height="34"
      viewBox="0 0 34 34"
      width="34"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect fill={dark ? '#D86856' : '#D86856'} height="34" rx="11" width="34" />
      <path d="M10 11.5h14M10 17h14M10 22.5h8" stroke="#FBF7F0" strokeLinecap="round" strokeWidth="2.2" />
      <circle cx="23.5" cy="22.5" fill="#F2C69E" r="2.5" />
    </svg>
  )
}

export default function Logo({ dark = false, compact = false, className = '' }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark dark={dark} />
      {!compact && (
        <span className={`display-serif text-[22px] leading-none ${dark ? 'text-ivory' : 'text-ink'}`}>
          Datecue
        </span>
      )}
    </span>
  )
}

export type IconName = 'arrow-left' | 'arrow-right' | 'moon' | 'sun' | 'play' | 'pause' | 'send' | 'copy' | 'check' | 'volume' | 'volume-low' | 'mute' | 'expand' | 'message' | 'link' | 'film' | 'users' | 'spark' | 'close' | 'menu'

export function Icon({ name, size = 18, strokeWidth = 1.8, ...props }: { name: IconName; size?: number; strokeWidth?: number } & SVGProps<SVGSVGElement>) {
  const paths: Record<IconName, ReactNode> = {
    'arrow-left': <path d="m10 17-5-5 5-5M5 12h14" />,
    'arrow-right': <path d="M5 12h14m-5-5 5 5-5 5" />,
    moon: <path d="M20.2 15.8A8.5 8.5 0 0 1 8.2 3.8 8.5 8.5 0 1 0 20.2 15.8Z" />,
    sun: <><circle cx="12" cy="12" r="3.6" /><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" /></>,
    play: <path d="m9 6 9 6-9 6V6Z" />,
    pause: <path d="M9 6v12M15 6v12" />,
    send: <path d="m4 4 16 8-16 8 3-8-3-8Zm3 8h13" />,
    copy: <><rect height="13" rx="2" width="11" x="8" y="8" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    volume: <><path d="M5 10v4h3l4 4V6l-4 4H5Z" /><path d="M16 9.5a4 4 0 0 1 0 5M18.5 7a7.5 7.5 0 0 1 0 10" /></>,
    'volume-low': <><path d="M5 10v4h3l4 4V6l-4 4H5Z" /><path d="M16 10a3 3 0 0 1 0 4" /></>,
    mute: <><path d="M5 10v4h3l4 4V6l-4 4H5Z" /><path d="m17 10 4 4m0-4-4 4" /></>,
    expand: <path d="M8 4H4v4M16 4h4v4M20 16v4h-4M4 16v4h4" />,
    message: <path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.7 8.7 0 0 1-3.5-.7L4 20l1.7-4.1A7.2 7.2 0 0 1 4.5 12 7.5 7.5 0 0 1 12 4.5a7.5 7.5 0 0 1 8 7Z" />,
    link: <path d="m10 13 4-4m-6.5 8.5-1 1a3.5 3.5 0 0 1-5-5l3-3a3.5 3.5 0 0 1 5 0M14 11l1-1a3.5 3.5 0 0 1 5 5l-3 3a3.5 3.5 0 0 1-5 0" />,
    film: <><rect height="15" rx="2" width="17" x="3.5" y="4.5" /><path d="M7.5 4.5v15M16.5 4.5v15M3.5 9.5h4M16.5 9.5h4M3.5 14.5h4M16.5 14.5h4" /></>,
    users: <><path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20" /><circle cx="9.5" cy="7.5" r="3.5" /><path d="M16 4.5a3.5 3.5 0 0 1 0 6.8M21 20v-1.5a4 4 0 0 0-3-3.8" /></>,
    spark: <path d="m12 3 1.2 5.8L19 10l-5.8 1.2L12 17l-1.2-5.8L5 10l5.8-1.2L12 3Z" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  }
  return <svg aria-hidden="true" fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} viewBox="0 0 24 24" width={size} {...props}>{paths[name]}</svg>
}