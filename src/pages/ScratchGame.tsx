import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import {
  drawScratchCard,
  fetchScratchToday,
  revealScratchCard,
  type MovementReason,
  type ScratchReveal,
} from '@/api/economy'
import { ScratchCard } from '@/features/economy/ScratchCard'
import { applyBalance, scratchTodayQueryKey, useWallet } from '@/features/economy/useWallet'
import { formatoMoneda, formatoMovimiento, MONEDA } from '@/shared/economy/moneda'
import { ApiError } from '@/shared/lib/apiClient'
import { Button } from '@/shared/ui/button'

const REASON_LABELS: Record<MovementReason, string> = {
  bienvenida: 'Regalo de bienvenida',
  rasca: 'Premio de Rasca y gana',
  capitulo: 'Capítulo desbloqueado',
  lectura: 'Lectura de un libro',
  ajuste_dev: 'Ajuste de desarrollo',
}

const HISTORY_SIZE = 10

export function resultMessage(result: Pick<ScratchReveal, 'number' | 'won' | 'prize'>) {
  return result.won
    ? `Ha salido un ${result.number}: ¡ganas ${formatoMoneda(result.prize)}!`
    : `Ha salido un ${result.number}. Sin premio esta vez.`
}

function cardsLeftLabel(remaining: number, limit: number) {
  return remaining === 1 ? `Te queda 1 tarjeta hoy (de ${limit}).` : `Te quedan ${remaining} tarjetas hoy (de ${limit}).`
}

const dateFormat = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' })

export function ScratchGamePage() {
  const queryClient = useQueryClient()
  const today = useQuery({ queryKey: scratchTodayQueryKey, queryFn: fetchScratchToday })
  const wallet = useWallet()
  // La tarjeta elegida a mano manda; si no, la pendiente que diga el servidor.
  const [drawnId, setDrawnId] = useState<number | null>(null)
  const [result, setResult] = useState<ScratchReveal | null>(null)
  const cardId = drawnId ?? result?.id ?? today.data?.pending_card?.id ?? null

  const draw = useMutation({
    mutationFn: drawScratchCard,
    onSuccess: (card) => {
      setResult(null)
      setDrawnId(card.id)
      void queryClient.invalidateQueries({ queryKey: scratchTodayQueryKey })
    },
  })

  const reveal = useMutation({
    mutationFn: revealScratchCard,
    onSuccess: (data) => {
      setResult(data)
      applyBalance(queryClient, data.balance)
      void queryClient.invalidateQueries({ queryKey: scratchTodayQueryKey })
    },
  })

  const revealedHere = result && result.id === cardId ? result : null
  const outOfCards = draw.error instanceof ApiError && draw.error.status === 409

  return (
    <div className="flex max-w-[70ch] flex-col gap-8">
      <header>
        <h1 className="flex items-center gap-2 font-serif text-display text-ink">
          <Sparkles size={26} aria-hidden className="text-gold" />
          Rasca y gana
        </h1>
        <p className="mt-2 text-body-sm text-ink-dim">
          Rasca una tarjeta al día para conseguir {MONEDA.plural} y desbloquear capítulos.
        </p>
      </header>

      <section aria-labelledby="tarjeta-titulo" className="flex flex-col gap-4">
        <h2 id="tarjeta-titulo" className="sr-only">
          Tu tarjeta
        </h2>
        {today.isLoading ? <p className="text-ink-dim">Buscando tus tarjetas…</p> : null}
        {today.isError ? (
          <p role="alert" className="text-error">
            No se pudieron cargar las tarjetas de hoy.
          </p>
        ) : null}
        {today.data ? (
          <>
            <p className="text-body-sm text-ink-dim">
              Si sale un {today.data.winning_number}, ganas {formatoMoneda(today.data.prize)}.{' '}
              {cardsLeftLabel(today.data.remaining, today.data.daily_limit)}
            </p>

            {cardId ? (
              <ScratchCard
                key={cardId}
                number={revealedHere?.number ?? null}
                revealing={reveal.isPending}
                onReveal={() => reveal.mutate(cardId)}
              />
            ) : null}

            {reveal.error ? (
              <p role="alert" className="text-error">
                {reveal.error.message}
              </p>
            ) : null}

            {!cardId || revealedHere ? (
              today.data.remaining > 0 && !outOfCards ? (
                <Button variant="brand" className="self-center" disabled={draw.isPending} onClick={() => draw.mutate()}>
                  {revealedHere ? 'Sacar otra tarjeta' : 'Sacar tarjeta'}
                </Button>
              ) : (
                <p className="text-center text-body-sm text-ink-dim">
                  Por hoy ya no quedan tarjetas. Vuelve mañana para rascar otra.
                </p>
              )
            ) : null}
            {draw.error && !outOfCards ? (
              <p role="alert" className="text-error">
                {draw.error.message}
              </p>
            ) : null}
          </>
        ) : null}

        <p aria-live="polite" className="min-h-[1.5em] text-center font-semibold text-ink">
          {revealedHere ? resultMessage(revealedHere) : ''}
        </p>
      </section>

      <section aria-labelledby="movimientos-titulo" className="flex flex-col gap-3">
        <h2 id="movimientos-titulo" className="font-serif text-headline-md text-ink">
          Tus {MONEDA.plural}
          {wallet.data ? <span className="text-ink-dim"> · {formatoMoneda(wallet.data.balance)}</span> : null}
        </h2>
        {wallet.data?.movements.length ? (
          <ul className="flex flex-col divide-y divide-[color:var(--ps-line)]">
            {wallet.data.movements.slice(0, HISTORY_SIZE).map((m) => (
              <li key={m.id} className="flex items-baseline justify-between gap-4 py-2 text-body-sm">
                <span>
                  <span className="text-ink">{REASON_LABELS[m.reason] ?? m.reason}</span>
                  <span className="block text-ink-faint">{dateFormat.format(new Date(m.created_at))}</span>
                </span>
                <span className={m.amount >= 0 ? 'font-semibold text-gold' : 'font-semibold text-ink-dim'}>
                  {formatoMovimiento(m.amount)}
                </span>
              </li>
            ))}
          </ul>
        ) : wallet.data ? (
          <p className="text-body-sm text-ink-dim">Aún no hay movimientos.</p>
        ) : null}
      </section>
    </div>
  )
}
