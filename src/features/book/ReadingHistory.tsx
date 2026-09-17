import { useQuery } from '@tanstack/react-query'
import { Archive, CircleSlash, EyeOff } from 'lucide-react'
import { Link } from 'react-router-dom'
import { bookHistoryQueryKey, fetchBookHistory } from '@/api/books'
import { formatBookDate } from '@/features/book/format'
import { routes } from '@/router/paths'
import { Card } from '@/shared/ui/card'

/** Lecturas archivadas y cerradas del usuario actual. El backend solo devuelve las suyas. */
export function ReadingHistory({ bookId }: { bookId: string }) {
  const history = useQuery({ queryKey: bookHistoryQueryKey(bookId), queryFn: () => fetchBookHistory(bookId) })

  if (!history.data?.length) return null

  return (
    <Card className="p-5">
      <section aria-labelledby="historial-titulo" className="space-y-3">
        <div>
          <h2 id="historial-titulo" className="flex items-center gap-2 font-serif text-headline-md text-ink">
            <Archive size={18} className="text-accent-text" aria-hidden />
            Tus lecturas anteriores
          </h2>
          <p className="mt-1 flex items-center gap-1.5 text-[13px] text-ink-faint">
            <EyeOff size={13} aria-hidden />
            Solo tú ves este historial.
          </p>
        </div>
        <ol className="space-y-3">
          {history.data.map((item) => {
            const closed = item.status === 'cerrada'
            const start = formatBookDate(item.startedAt)
            const end = formatBookDate(closed ? item.closedAt : item.archivedAt)
            return (
              <li key={item.storyId} className="border-t border-[color:var(--ps-line)] pt-3 first:border-t-0 first:pt-0">
                <p className="text-body-sm text-ink">
                  {start ?? 'Fecha desconocida'}
                  {end ? ` – ${end}` : ''}
                </p>
                {closed ? (
                  <p className="flex items-center gap-1.5 text-body-sm font-semibold text-ink-dim">
                    <CircleSlash size={14} aria-hidden className="text-gold" />
                    Cerrada por incumplir las normas
                  </p>
                ) : null}
                <p className="text-body-sm text-ink-dim">
                  Capítulo {item.phaseIndex + 1} de {item.phaseCount}:{' '}
                  <span className="font-semibold text-gold">{item.phaseLabel}</span> · afinidad final {item.affinity}
                </p>
                <Link
                  to={routes.storyArchive(item.storyId)}
                  className="inline-flex min-h-touch items-center text-body-sm font-semibold text-accent-text underline"
                >
                  Ver la conversación
                  <span className="sr-only">
                    {' '}
                    de la lectura {start ? `empezada el ${start}` : closed ? 'cerrada' : 'archivada'}
                  </span>
                </Link>
              </li>
            )
          })}
        </ol>
      </section>
    </Card>
  )
}
