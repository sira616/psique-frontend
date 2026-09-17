import { useRef, type KeyboardEvent } from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

const VALUES = [1, 2, 3, 4, 5] as const

export function starsLabel(value: number) {
  return value === 1 ? '1 estrella' : `${value} estrellas`
}

type StarRatingProps = {
  value: number
  onChange: (value: number) => void
  labelledBy: string
  describedBy?: string
  invalid?: boolean
  disabled?: boolean
}

/**
 * Patrón radiogroup del APG: una sola parada de tabulador y flechas para cambiar la nota
 * (la selección sigue al foco, como en los radios nativos).
 */
export function StarRating({ value, onChange, labelledBy, describedBy, invalid, disabled }: StarRatingProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  // Sin nota todavía, el tabulador entra por la primera estrella.
  const tabStop = value >= 1 ? value : 1

  function select(next: number) {
    onChange(next)
    refs.current[next - 1]?.focus()
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, current: number) {
    const moves: Record<string, number> = {
      ArrowRight: current + 1,
      ArrowUp: current + 1,
      ArrowLeft: current - 1,
      ArrowDown: current - 1,
      Home: 1,
      End: 5,
    }
    let next = moves[event.key]
    if (next === undefined) {
      if (event.key === ' ') {
        event.preventDefault()
        onChange(current)
      }
      return
    }
    event.preventDefault()
    // Con las flechas se da la vuelta, igual que en un grupo de radios nativo.
    if (next > 5) next = 1
    if (next < 1) next = 5
    select(next)
  }

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      aria-required
      className="flex gap-1"
    >
      {VALUES.map((n) => {
        const filled = n <= value
        return (
          <button
            key={n}
            ref={(el) => {
              refs.current[n - 1] = el
            }}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={starsLabel(n)}
            tabIndex={n === tabStop ? 0 : -1}
            disabled={disabled}
            onClick={() => select(n)}
            onKeyDown={(event) => onKeyDown(event, n)}
            className={cn(
              'grid h-touch w-touch place-items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ps-accent-text)] disabled:opacity-50',
              'hover:bg-surf-2',
            )}
          >
            <Star
              size={26}
              aria-hidden
              className={filled ? 'text-gold' : 'text-ink-faint'}
              fill={filled ? 'currentColor' : 'none'}
            />
          </button>
        )
      })}
    </div>
  )
}

/** Nota en solo lectura, para listas. */
export function StarsDisplay({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span role="img" aria-label={`${starsLabel(Math.round(value))} de 5`} className="inline-flex gap-0.5">
      {VALUES.map((n) => (
        <Star
          key={n}
          size={size}
          aria-hidden
          className={n <= Math.round(value) ? 'text-gold' : 'text-ink-faint'}
          fill={n <= Math.round(value) ? 'currentColor' : 'none'}
        />
      ))}
    </span>
  )
}
