import { useMutation, useQueryClient } from '@tanstack/react-query'
import { LockKeyhole } from 'lucide-react'
import { Link } from 'react-router-dom'
import { unlockChapter } from '@/api/economy'
import { applyBalance, useWallet } from '@/features/economy/useWallet'
import { routes } from '@/router/paths'
import { formatoMoneda, MONEDA } from '@/shared/economy/moneda'
import type { StoryState } from '@/shared/lib/events'
import { Button } from '@/shared/ui/button'

type ChapterLockNoticeProps = {
  storyId: string
  cost: number
  onUnlocked: (state: StoryState) => void
}

export function ChapterLockNotice({ storyId, cost, onUnlocked }: ChapterLockNoticeProps) {
  const queryClient = useQueryClient()
  const wallet = useWallet()
  const unlock = useMutation({
    mutationFn: () => unlockChapter(storyId),
    onSuccess: ({ balance, transition: _transition, signals: _signals, ...state }) => {
      applyBalance(queryClient, balance)
      onUnlocked(state)
    },
  })
  // Sin saldo cargado se ofrece el botón: el servidor tiene la última palabra (402).
  const balance = wallet.data?.balance
  const short = balance !== undefined && balance < cost

  return (
    <div
      role="status"
      className="mx-4 mb-1 flex flex-col gap-2 rounded-xl px-3.5 py-2.5 text-body-sm"
      style={{ background: 'var(--ps-surf-2)', border: '1px solid var(--ps-line-strong)' }}
    >
      <p className="flex items-start gap-2">
        <LockKeyhole size={16} aria-hidden className="mt-0.5 shrink-0 text-gold" />
        <span>
          <strong className="text-ink">El siguiente capítulo está bloqueado.</strong>{' '}
          <span className="text-ink-dim">
            La conversación queda en pausa y la historia no avanzará hasta que lo desbloquees.
          </span>
        </span>
      </p>
      {short ? (
        <p className="text-ink-dim">
          Necesitas {formatoMoneda(cost)} y tienes {formatoMoneda(balance)}.{' '}
          <Link to={routes.rascaYGana} className="font-semibold text-accent-text underline">
            Consigue {MONEDA.plural} en Rasca y gana
          </Link>
        </p>
      ) : (
        <Button
          variant="brand"
          size="sm"
          className="self-start"
          disabled={unlock.isPending}
          onClick={() => unlock.mutate()}
        >
          Desbloquear capítulo · {formatoMoneda(cost)}
        </Button>
      )}
      {unlock.error ? (
        <p role="alert" className="text-error">
          {unlock.error.message}
        </p>
      ) : null}
    </div>
  )
}
