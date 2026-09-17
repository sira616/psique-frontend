import type { ReactNode } from 'react'
import { Wordmark } from '@/shared/layout/Wordmark'
import { ThemeToggle } from '@/shared/layout/ThemeToggle'

/** Envoltorio común a login y registro: mismo fondo, marca y ThemeToggle. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative flex min-h-dvh flex-col overflow-hidden text-ink"
      style={{ background: 'var(--ps-canvas-radial)' }}
    >
      <div className="absolute top-4 right-4 z-[2]">
        <ThemeToggle />
      </div>

      <div
        className="pointer-events-none absolute top-[-80px] left-1/2 h-[380px] w-[380px] -translate-x-1/2 rounded-full"
        style={{ background: 'var(--ps-glow-rose)', filter: 'blur(8px)' }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute top-[18%] left-[-20%] h-[220px] w-[220px] rounded-full opacity-40"
        style={{ background: 'var(--ps-glow-gold)', filter: 'blur(30px)' }}
        aria-hidden
      />

      <div className="relative z-[1] mx-auto flex w-full max-w-[412px] flex-1 flex-col justify-center px-6 pt-5 pb-7 lg:grid lg:max-w-6xl lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:content-center lg:items-center lg:gap-16 lg:px-10 xl:gap-24">
        <header className="mb-5 flex flex-col items-center lg:mb-0 lg:items-start">
          <Wordmark size="hero" className="lg:text-[64px]" />
          <p className="mt-2 text-center text-body-sm text-ink-dim lg:mt-4 lg:max-w-[32ch] lg:text-left lg:font-serif lg:text-headline-lg">
            Historias románticas en las que tú decides cómo sigue.
          </p>
          {/* En escritorio sobra espacio: se aprovecha para contar qué es Psique sin recargar el móvil. */}
          <ul className="mt-8 hidden max-w-[44ch] flex-col gap-3 text-body-sm text-ink-dim lg:flex">
            {CLAIMS.map((claim) => (
              <li key={claim} className="flex items-start gap-3">
                <span className="mt-0.5 text-accent-text">
                  <CheckIcon />
                </span>
                {claim}
              </li>
            ))}
          </ul>
        </header>
        <div
          className="lg:rounded-[24px] lg:border lg:border-[color:var(--ps-line)] lg:p-8 lg:shadow-[var(--ps-shadow-md)] lg:[background:linear-gradient(160deg,var(--ps-surf-2),var(--ps-surf-1))]"
        >
          {children}
        </div>
      </div>
    </div>
  )
}

const CLAIMS = [
  'Elige un personaje de Psique o crea tu propia historia.',
  'La relación avanza por fases según lo que dices y haces.',
  'Romance para todos los públicos: lo íntimo se funde a negro.',
]

export function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="M4 7l8 6 8-6" />
    </svg>
  )
}

export function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="10" width="16" height="10" rx="3" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

export function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
      <path d="M9.9 5.1A10.5 10.5 0 0 1 12 5c6.5 0 10 7 10 7a17.3 17.3 0 0 1-3.2 4.1" />
      <path d="M6.1 6.1A17.5 17.5 0 0 0 2 12s3.5 7 10 7a9.8 9.8 0 0 0 4.2-.9" />
    </svg>
  )
}

export function ArrowIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="13 6 19 12 13 18" />
    </svg>
  )
}

export function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

export const authCtaClassName =
  'ps-cta flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border-none px-[15px] py-[15px] text-[15px] font-extrabold disabled:opacity-70'

export const authCtaStyle = {
  color: 'var(--ps-on-primary)',
  background: 'linear-gradient(145deg, var(--ps-primary), var(--ps-primary-deep))',
  boxShadow: 'var(--ps-shadow-glow), inset 0 1px 0 var(--ps-inset-shine)',
  fontFamily: 'inherit',
} as const
