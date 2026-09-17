import { Link } from 'react-router-dom'
import { routes } from '@/router/paths'
import { Wordmark } from '@/shared/layout/Wordmark'

export function NotFoundPage() {
  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center gap-3 px-md text-center"
      style={{ background: 'var(--ps-canvas-radial)' }}
    >
      <Wordmark size="hero" />
      <h1 className="font-serif text-headline-lg text-ink">Esta página no existe</h1>
      <p className="text-body-sm text-ink-dim">Quizá la historia siga por otro lado.</p>
      <Link to={routes.characters} className="text-body-sm font-semibold text-accent-text underline">
        Volver al inicio
      </Link>
    </div>
  )
}
