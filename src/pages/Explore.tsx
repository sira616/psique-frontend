import { useEffect, useRef, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Compass } from 'lucide-react'
import { Link } from 'react-router-dom'
import { dedupeCards, fetchExplore } from '@/api/explore'
import { PublicStoryCard, cardGridClassName } from '@/features/publicStories/PublicStoryCard'
import { routes } from '@/router/paths'
import type { CustomStoryMode } from '@/shared/lib/events'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'

type ModeFilter = CustomStoryMode | 'todas'

const FILTERS: { id: ModeFilter; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'definida', label: 'Definidas' },
  { id: 'concepto', label: 'Por descubrir' },
]

function countLabel(count: number) {
  return count === 1 ? '1 historia' : `${count} historias`
}

export function ExplorePage() {
  const [filter, setFilter] = useState<ModeFilter>('todas')
  const mode = filter === 'todas' ? null : filter
  const explore = useInfiniteQuery({
    queryKey: ['explore', mode ?? 'todas'],
    queryFn: ({ pageParam }) => fetchExplore({ offset: pageParam, mode }),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset ?? undefined,
  })

  const cards = explore.data ? dedupeCards(explore.data.pages) : []
  const [announcement, setAnnouncement] = useState('')
  const previousCount = useRef<number | null>(null)
  const loadedFromButton = useRef(false)
  const endRef = useRef<HTMLParagraphElement>(null)

  // Se anuncia el cambio de resultados (filtro o "Cargar más") sin mover el foco.
  useEffect(() => {
    if (!explore.data) return
    const count = cards.length
    const before = previousCount.current
    if (before !== null && count > before && explore.data.pages.length > 1) {
      setAnnouncement(`Se han cargado ${countLabel(count - before)} más.`)
    } else {
      setAnnouncement(count ? `${countLabel(count)} en pantalla.` : 'No hay historias.')
    }
    previousCount.current = count
  }, [explore.data])

  // Al cargar la última página el botón desaparece: el foco pasa al aviso de final, no a <body>.
  useEffect(() => {
    if (loadedFromButton.current && !explore.hasNextPage && !explore.isFetchingNextPage) {
      loadedFromButton.current = false
      endRef.current?.focus()
    }
  }, [explore.hasNextPage, explore.isFetchingNextPage])

  function changeFilter(next: ModeFilter) {
    previousCount.current = null
    loadedFromButton.current = false
    setFilter(next)
  }

  return (
    <div className="space-y-6">
      <header className="max-w-[70ch]">
        <h1 className="flex items-center gap-2 font-serif text-display text-ink">
          <Compass size={28} className="text-accent-text" aria-hidden />
          Explorar
        </h1>
        <p className="mt-2 text-body-sm text-ink-dim">
          Historias que otras personas han decidido compartir. Abre una para ver sus detalles y reseñas, y empezar tu propia partida.
        </p>
      </header>

      <fieldset>
        <legend className="mb-2 text-[11px] font-bold tracking-[0.12em] text-ink-faint uppercase">
          Tipo de historia
        </legend>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const active = filter === f.id
            return (
              <label
                key={f.id}
                className={cn(
                  'inline-flex min-h-touch cursor-pointer items-center rounded-full border px-4 text-body-sm font-semibold has-focus-visible:ring-2 has-focus-visible:ring-[color:var(--ps-accent-text)]',
                  active ? 'bg-surf-3 text-ink' : 'text-ink-dim hover:bg-surf-2 hover:text-ink',
                )}
                style={{ borderColor: active ? 'var(--ps-accent-text)' : 'var(--ps-line-strong)' }}
              >
                <input
                  type="radio"
                  name="explore-mode"
                  value={f.id}
                  checked={active}
                  onChange={() => changeFilter(f.id)}
                  className="sr-only"
                />
                {f.label}
              </label>
            )
          })}
        </div>
      </fieldset>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {explore.isPending ? <p className="text-ink-dim">Cargando historias…</p> : null}

      {explore.isError ? (
        <Card className="space-y-3 p-5">
          <p role="alert" className="text-body-sm text-error">
            No se pudieron cargar las historias.
          </p>
          <Button variant="outline" onClick={() => void explore.refetch()}>
            Reintentar
          </Button>
        </Card>
      ) : null}

      {explore.isSuccess && cards.length === 0 ? (
        <Card className="p-5">
          <p className="text-body-sm text-ink-dim">
            {mode
              ? 'Todavía no hay historias públicas de este tipo.'
              : 'Todavía no hay historias públicas. ¿Te animas a compartir la primera?'}
          </p>
          <Link
            to={routes.characters}
            className="mt-2 inline-block text-body-sm font-semibold text-accent-text underline"
          >
            Ir a Mis historias
          </Link>
        </Card>
      ) : null}

      {cards.length ? (
        <section aria-label="Historias públicas" aria-busy={explore.isFetching}>
          <ul className={cardGridClassName}>
            {cards.map((card) => (
              <li key={card.id}>
                <PublicStoryCard card={card} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {explore.hasNextPage ? (
        <div className="flex flex-col items-center gap-2">
          {explore.isFetchNextPageError ? (
            <p role="alert" className="text-body-sm text-error">
              No se pudieron cargar más historias.
            </p>
          ) : null}
          {/* aria-disabled y no disabled: un botón deshabilitado pierde el foco del teclado. */}
          <Button
            variant="outline"
            className="w-full sm:w-auto sm:min-w-64"
            aria-disabled={explore.isFetchingNextPage}
            onClick={() => {
              if (explore.isFetchingNextPage) return
              loadedFromButton.current = true
              void explore.fetchNextPage()
            }}
          >
            {explore.isFetchingNextPage ? 'Cargando…' : 'Cargar más'}
          </Button>
        </div>
      ) : explore.isSuccess && cards.length > 0 && explore.data.pages.length > 1 ? (
        <p ref={endRef} tabIndex={-1} className="text-center text-body-sm text-ink-faint outline-none">
          Has llegado al final.
        </p>
      ) : null}
    </div>
  )
}
