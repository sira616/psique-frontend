import { formatoMoneda } from '@/shared/economy/moneda'
import { parseApiDate } from '@/shared/lib/media'

const dateFormat = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

export function formatBookDate(value: string | null | undefined): string | null {
  return value ? dateFormat.format(parseApiDate(value)) : null
}

export function readersLabel(count: number) {
  return count === 1 ? '1 lector' : `${count} lectores`
}

export function reviewsLabel(count: number) {
  return count === 1 ? '1 reseña' : `${count} reseñas`
}

export function chaptersLabel(count: number) {
  return count === 1 ? '1 capítulo' : `${count} capítulos`
}

/** "Leer gratis" o "Leer · 3 óbolos". */
export function readLabel(cost: number) {
  return cost > 0 ? `Leer · ${formatoMoneda(cost)}` : 'Leer gratis'
}

export function modeLabel(mode: 'definida' | 'concepto' | null) {
  if (mode === 'concepto') return 'Por descubrir'
  if (mode === 'definida') return 'Definida'
  return 'Historia de Psique'
}
