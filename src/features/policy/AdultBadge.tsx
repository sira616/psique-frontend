import { Badge } from '@/shared/ui/badge'
import { cn } from '@/shared/lib/utils'

/** Marca discreta de libro +18. El texto oculto explica la cifra a quien usa lector de pantalla. */
export function AdultBadge({ className }: { className?: string }) {
  return (
    <Badge variant="outline" className={cn('tracking-normal text-gold', className)} title="Solo para cuentas mayores de edad">
      +18<span className="sr-only"> · solo para mayores de edad</span>
    </Badge>
  )
}
