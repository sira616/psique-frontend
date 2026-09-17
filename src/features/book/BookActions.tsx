import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, BookOpen, LockKeyhole, RotateCcw } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { bookQueryKey, rereadBook, type BookOut } from '@/api/books'
import { createStory } from '@/api/stories'
import { readLabel } from '@/features/book/format'
import { useWallet, walletQueryKey } from '@/features/economy/useWallet'
import { routes } from '@/router/paths'
import { formatoMoneda } from '@/shared/economy/moneda'
import { ApiError } from '@/shared/lib/apiClient'
import type { Story } from '@/shared/lib/events'
import { Button, ButtonLink } from '@/shared/ui/button'

type BookActionsProps = { book: BookOut }

/**
 * Único sitio desde el que se empieza o se relee un libro. El precio lo decide el servidor: aquí
 * solo se enseña el que llega en `viewer` y se respeta el 402 si el saldo cambió entretanto.
 */
export function BookActions({ book }: BookActionsProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const wallet = useWallet()
  const { viewer } = book
  const [confirmingReread, setConfirmingReread] = useState(false)
  // Al abrir la confirmación el foco va a la opción segura, como al borrar una historia.
  const cancelRef = useRef<HTMLButtonElement>(null)

  function afterCharge(story: Story) {
    // La respuesta no trae saldo: el monedero se vuelve a pedir.
    for (const queryKey of [walletQueryKey, ['stories'], bookQueryKey(book.id), ['profile']]) {
      void queryClient.invalidateQueries({ queryKey })
    }
    navigate(routes.story(story.id))
  }

  const read = useMutation({ mutationFn: () => createStory(book.id), onSuccess: afterCharge })
  const reread = useMutation({ mutationFn: () => rereadBook(book.id), onSuccess: afterCharge })
  const pending = read.isPending || reread.isPending
  const error = read.error ?? reread.error

  useEffect(() => {
    if (confirmingReread) cancelRef.current?.focus()
  }, [confirmingReread])

  const continuing = viewer.primaryAction.kind === 'continuar' && viewer.activeStoryId
  // Sin partida activa, "Leer" ya crea una nueva al mismo precio: "Releer" sería un botón repetido.
  const showReread = viewer.canReread && Boolean(viewer.activeStoryId)
  const balance = wallet.data?.balance
  const progress = viewer.progress

  return (
    <div className="space-y-3">
      {progress ? (
        <p className="text-body-sm text-ink-dim">
          {viewer.status === 'leido' ? 'Has llegado al final' : 'Vas por'} el capítulo {progress.phaseIndex + 1} de{' '}
          {progress.phaseCount}: <span className="font-semibold text-gold">{progress.phaseLabel}</span> · afinidad{' '}
          {progress.affinity}
          {progress.chapterLocked ? (
            <span className="mt-1 flex items-center gap-1.5">
              <LockKeyhole size={14} aria-hidden className="text-gold" />
              El siguiente capítulo espera a que lo desbloquees.
            </span>
          ) : null}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {continuing ? (
          <ButtonLink variant="brand" size="lg" className="sm:min-w-56" to={routes.story(viewer.activeStoryId!)}>
            <BookOpen size={18} aria-hidden />
            Continuar
          </ButtonLink>
        ) : (
          <Button variant="brand" size="lg" className="sm:min-w-56" disabled={pending} onClick={() => read.mutate()}>
            <BookOpen size={18} aria-hidden />
            {read.isPending ? 'Preparando la escena…' : readLabel(viewer.primaryAction.cost)}
          </Button>
        )}

        {showReread && !confirmingReread ? (
          <Button variant="outline" size="lg" disabled={pending} onClick={() => setConfirmingReread(true)}>
            <RotateCcw size={18} aria-hidden />
            Releer · {formatoMoneda(viewer.rereadCost)}
          </Button>
        ) : null}
      </div>

      {showReread && confirmingReread ? (
        <div
          role="group"
          aria-labelledby="releer-aviso"
          className="space-y-2 rounded-xl border p-3"
          style={{ borderColor: 'var(--ps-line-strong)' }}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && !reread.isPending) setConfirmingReread(false)
          }}
        >
          <p id="releer-aviso" className="text-body-sm text-ink">
            Empezarás desde el principio por {formatoMoneda(viewer.rereadCost)}. Tu lectura actual pasará al historial
            y podrás consultarla, pero no seguirla.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              ref={cancelRef}
              variant="outline"
              size="sm"
              disabled={reread.isPending}
              onClick={() => setConfirmingReread(false)}
            >
              Cancelar
            </Button>
            <Button variant="brand" size="sm" disabled={pending} onClick={() => reread.mutate()}>
              {reread.isPending ? 'Preparando la escena…' : `Sí, releer · ${formatoMoneda(viewer.rereadCost)}`}
              <ArrowRight size={14} aria-hidden />
            </Button>
          </div>
        </div>
      ) : null}

      {balance !== undefined ? (
        <p className="text-body-sm text-ink-dim">
          Tienes {formatoMoneda(balance)}.{' '}
          <Link to={routes.rascaYGana} className="font-semibold text-accent-text underline">
            Consigue más en Rasca y gana
          </Link>
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="text-body-sm text-error">
          {error instanceof ApiError && error.status === 402 ? (
            <>
              {error.message}{' '}
              <Link to={routes.rascaYGana} className="font-semibold text-accent-text underline">
                Ir a Rasca y gana
              </Link>
            </>
          ) : error instanceof ApiError ? (
            error.message
          ) : (
            'No se pudo abrir el libro. Inténtalo de nuevo.'
          )}
        </p>
      ) : null}
    </div>
  )
}
