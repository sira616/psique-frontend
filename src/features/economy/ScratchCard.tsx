import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/lib/utils'

const COLS = 8
const ROWS = 5
const TOTAL = COLS * ROWS
/** Rascada la mitad, se da por rascada: pedir el 100 % con el dedo es frustrante. */
const REVEAL_RATIO = 0.5

type ScratchCardProps = {
  /** null hasta que responde reveal: antes la tarjeta tapada no contiene el número. */
  number: number | null
  revealing: boolean
  onReveal: () => void
}

export function ScratchCard({ number, revealing, onReveal }: ScratchCardProps) {
  const [scratched, setScratched] = useState<ReadonlySet<number>>(() => new Set())
  const scratchedRef = useRef(new Set<number>())
  const requested = useRef(false)
  const drawing = useRef(false)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const revealed = number !== null

  // Si reveal falla se puede volver a intentar.
  useEffect(() => {
    if (!revealing && number === null) requested.current = false
  }, [revealing, number])

  function requestReveal() {
    if (requested.current) return
    requested.current = true
    onReveal()
  }

  function scratchAt(event: PointerEvent<HTMLDivElement>) {
    const rect = surfaceRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0 || rect.height === 0) return
    const col = Math.floor(((event.clientX - rect.left) / rect.width) * COLS)
    const row = Math.floor(((event.clientY - rect.top) / rect.height) * ROWS)
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return
    const cell = row * COLS + col
    if (scratchedRef.current.has(cell)) return
    scratchedRef.current.add(cell)
    setScratched(new Set(scratchedRef.current))
    if (scratchedRef.current.size / TOTAL >= REVEAL_RATIO) requestReveal()
  }

  function scratchAll() {
    scratchedRef.current = new Set(Array.from({ length: TOTAL }, (_, i) => i))
    setScratched(scratchedRef.current)
    requestReveal()
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        ref={surfaceRef}
        className="relative aspect-[8/5] w-full max-w-sm touch-none overflow-hidden rounded-2xl select-none"
        style={{ background: 'var(--ps-surf-2)', border: '1px solid var(--ps-line-strong)' }}
        onPointerDown={(e) => {
          if (revealed) return
          drawing.current = true
          e.currentTarget.setPointerCapture?.(e.pointerId)
          scratchAt(e)
        }}
        onPointerMove={(e) => {
          if (drawing.current && !revealed) scratchAt(e)
        }}
        onPointerUp={() => {
          drawing.current = false
        }}
        onPointerCancel={() => {
          drawing.current = false
        }}
        aria-hidden
      >
        <div className="absolute inset-0 grid place-items-center">
          {revealed ? (
            <span className="font-serif text-[64px] leading-none text-ink" data-testid="numero-tarjeta">
              {number}
            </span>
          ) : revealing ? (
            <span className="text-body-sm text-ink-dim">Descubriendo…</span>
          ) : null}
        </div>
        <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
          {Array.from({ length: TOTAL }, (_, i) => (
            <div
              key={i}
              className={cn(
                'motion-safe:transition-opacity motion-safe:duration-300',
                revealed || scratched.has(i) ? 'opacity-0' : 'opacity-100',
              )}
              style={{ background: 'linear-gradient(145deg, var(--ps-gold), var(--ps-primary-deep))' }}
            />
          ))}
        </div>
      </div>
      {revealed ? null : (
        <Button variant="secondary" onClick={scratchAll} disabled={revealing}>
          Rascar todo
        </Button>
      )}
    </div>
  )
}
