import { Hourglass } from 'lucide-react'
import { formatResetsAt } from '@/api/account'
import { Notice } from '@/features/policy/PolicyNotice'

export function DailyLimitNotice({
  resetsAt,
  className,
  role,
}: {
  resetsAt: string
  className?: string
  role?: 'alert' | 'status'
}) {
  return (
    <Notice icon={<Hourglass size={16} />} title="Has llegado al límite de turnos de hoy." className={className} role={role}>
      <span className="text-ink-dim">
        La historia te espera tal como la dejaste: podrás seguir {formatResetsAt(resetsAt)}.
      </span>
    </Notice>
  )
}

/** Aviso discreto cuando quedan pocos turnos; no es una alerta, así que no interrumpe al lector. */
export function TurnsLeftHint({ remaining, className }: { remaining: number; className?: string }) {
  return (
    <p className={className ?? 'px-4 pb-1 text-[12px] text-ink-faint'}>
      {remaining === 1 ? 'Te queda 1 turno hoy.' : `Te quedan ${remaining} turnos hoy.`}
    </p>
  )
}
