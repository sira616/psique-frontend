import type { ReactNode } from 'react'
import { CircleSlash, Clock, Info } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatRestrictedUntil } from '@/api/policy'
import { routes } from '@/router/paths'
import { cn } from '@/shared/lib/utils'

type NoticeProps = {
  icon: ReactNode
  title: string
  children?: ReactNode
  className?: string
  /** `alert` para lo que acaba de pasar al enviar; `status` para un estado que ya estaba. */
  role?: 'alert' | 'status'
}

export function Notice({ icon, title, children, className, role = 'status' }: NoticeProps) {
  return (
    <div
      role={role}
      className={cn('flex flex-col gap-2 rounded-xl px-3.5 py-2.5 text-body-sm', className)}
      style={{ background: 'var(--ps-surf-2)', border: '1px solid var(--ps-line-strong)' }}
    >
      <p className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0 text-gold" aria-hidden>
          {icon}
        </span>
        <span>
          <strong className="text-ink">{title}</strong> {children}
        </span>
      </p>
    </div>
  )
}

/** A la lista de cierres que cuentan, donde se pueden apelar. */
export function IncidentsLink() {
  return (
    <Link to={routes.incidentes} className="font-semibold text-accent-text underline">
      Ver los cierres y apelar
    </Link>
  )
}

export function restrictionText(restrictedUntil: string) {
  return `Hasta el ${formatRestrictedUntil(restrictedUntil)} no puedes empezar ni continuar historias. Puedes seguir leyendo tus partidas y tu historial.`
}

type ClosedNoticeProps = {
  /** Explicación del servidor al cerrar; sin ella se usa un texto genérico. */
  detail?: string | null
  restrictedUntil?: string | null
  className?: string
  role?: 'alert' | 'status'
  children?: ReactNode
}

export function StoryClosedNotice({ detail, restrictedUntil, className, role, children }: ClosedNoticeProps) {
  return (
    <Notice icon={<CircleSlash size={16} />} title="Esta partida se ha cerrado." className={className} role={role}>
      <span className="text-ink-dim">
        {detail || 'Un mensaje incumplía las normas de Psique, así que la historia no puede continuar.'} La conversación
        queda guardada y puedes consultarla en solo lectura.
      </span>
      {restrictedUntil ? (
        <span className="mt-1 block text-ink-dim">
          <strong className="font-semibold text-ink">Tu cuenta queda restringida.</strong> {restrictionText(restrictedUntil)}{' '}
          <IncidentsLink />
        </span>
      ) : null}
      {children ? <span className="mt-1 block">{children}</span> : null}
    </Notice>
  )
}

export function RestrictionNotice({
  restrictedUntil,
  className,
  role,
}: {
  restrictedUntil: string
  className?: string
  role?: 'alert' | 'status'
}) {
  return (
    <Notice icon={<Clock size={16} />} title="Tu cuenta tiene una restricción temporal." className={className} role={role}>
      <span className="text-ink-dim">{restrictionText(restrictedUntil)}</span> <IncidentsLink />
    </Notice>
  )
}

export function RedirectNotice({ detail, onDismiss, className }: { detail: string; onDismiss: () => void; className?: string }) {
  return (
    <div
      role="status"
      className={cn('flex items-start justify-between gap-3 rounded-xl px-3.5 py-2.5 text-body-sm', className)}
      style={{ background: 'var(--ps-surf-2)', border: '1px solid var(--ps-line-strong)' }}
    >
      <p className="flex items-start gap-2">
        <Info size={16} aria-hidden className="mt-0.5 shrink-0 text-gold" />
        <span className="text-ink-dim">{detail}</span>
      </p>
      <button type="button" className="shrink-0 text-ink-faint underline" onClick={onDismiss}>
        Cerrar
      </button>
    </div>
  )
}
