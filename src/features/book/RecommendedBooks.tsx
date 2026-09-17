import { useQuery } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { bookRecommendedQueryKey, fetchRecommended } from '@/api/books'
import { readersLabel } from '@/features/book/format'
import { AdultBadge } from '@/features/policy/AdultBadge'
import { routes } from '@/router/paths'
import { Card } from '@/shared/ui/card'

export function RecommendedBooks({ bookId }: { bookId: string }) {
  const recommended = useQuery({ queryKey: bookRecommendedQueryKey(bookId), queryFn: () => fetchRecommended(bookId) })

  // Sección secundaria: si falla o no hay nada, no merece un hueco en la página.
  if (!recommended.data?.length) return null

  return (
    <section aria-labelledby="recomendados-titulo" className="space-y-3">
      <h2 id="recomendados-titulo" className="font-serif text-headline-md text-ink">
        También te puede gustar
      </h2>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {recommended.data.map((card) => (
          <li key={card.id}>
            <Link
              to={routes.book(card.id)}
              className="group block h-full rounded-[20px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ps-accent-text)]"
            >
              <Card className="flex h-full flex-col gap-2 p-5 motion-safe:transition-colors group-hover:bg-surf-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1 text-[11px] font-bold tracking-[0.12em] text-ink-faint uppercase">
                    {card.mode === 'concepto' ? <Sparkles size={12} className="text-accent-text" aria-hidden /> : null}
                    {card.author ? `@${card.author.handle}` : 'Psique'}
                  </p>
                  {card.adult ? <AdultBadge /> : null}
                </div>
                <h3 className="font-serif text-headline-lg text-ink group-hover:underline">{card.title}</h3>
                <p className="flex-1 text-body-sm text-ink-dim">{card.hook}</p>
                <p className="text-[13px] text-ink-faint">
                  {card.tone ? <span className="italic">{card.tone}</span> : null}
                  {card.tone ? ' · ' : null}
                  {readersLabel(card.readers)}
                </p>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
