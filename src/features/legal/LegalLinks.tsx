import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { routes } from '@/router/paths'
import { cn } from '@/shared/lib/utils'

type LegalLinkProps = {
  to: string
  children: ReactNode
  /** En formularios y en el diálogo de aceptación: leer no debe hacer perder lo escrito. */
  newTab?: boolean
  className?: string
}

export function LegalLink({ to, children, newTab = false, className }: LegalLinkProps) {
  return (
    <Link
      to={to}
      className={cn('font-semibold text-accent-text underline', className)}
      {...(newTab ? { target: '_blank', rel: 'noopener' } : {})}
    >
      {children}
      {newTab ? <span className="sr-only"> (se abre en otra pestaña)</span> : null}
    </Link>
  )
}

/** Pie con los textos legales: layout con sesión, login y registro. */
export function LegalFooter({ className }: { className?: string }) {
  return (
    <nav aria-label="Textos legales" className={cn('text-[12px] text-ink-faint', className)}>
      <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        <li>
          <Link to={routes.terminos} className="inline-flex min-h-touch items-center underline hover:text-ink">
            Términos de uso
          </Link>
        </li>
        <li>
          <Link to={routes.privacidad} className="inline-flex min-h-touch items-center underline hover:text-ink">
            Privacidad
          </Link>
        </li>
      </ul>
    </nav>
  )
}

type ConsentCheckboxProps = {
  id: string
  checked: boolean
  onChange: (checked: boolean) => void
  children: ReactNode
  invalid?: boolean
  errorId?: string
  disabled?: boolean
}

/** Casilla con etiqueta larga (puede llevar enlaces) y área táctil de 44 px. */
export function ConsentCheckbox({ id, checked, onChange, children, invalid, errorId, disabled }: ConsentCheckboxProps) {
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid && errorId ? errorId : undefined}
        className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-[color:var(--ps-primary)]"
      />
      <label htmlFor={id} className="cursor-pointer text-body-sm text-ink-dim">
        {children}
      </label>
    </div>
  )
}
