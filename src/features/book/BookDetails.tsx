import type { ReactNode } from 'react'
import type { BookOut } from '@/api/books'
import { chaptersLabel, formatBookDate, modeLabel, readersLabel, reviewsLabel } from '@/features/book/format'
import { formatoMoneda } from '@/shared/economy/moneda'
import { Card } from '@/shared/ui/card'

function Detail({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-t border-[color:var(--ps-line)] py-2.5 first:border-t-0 first:pt-0">
      <dt className="text-body-sm text-ink-dim">{term}</dt>
      <dd className="text-right text-body-sm font-semibold text-ink">{children}</dd>
    </div>
  )
}

export function BookDetails({ book }: { book: BookOut }) {
  const date = formatBookDate(book.publishedAt ?? book.createdAt)
  const { stats } = book
  return (
    <Card className="p-5">
      <h2 id="detalles-titulo" className="mb-3 font-serif text-headline-md text-ink">
        Detalles
      </h2>
      <dl aria-labelledby="detalles-titulo">
        <Detail term="Tipo">{modeLabel(book.mode)}</Detail>
        {book.tone ? (
          <Detail term="Tono">
            <span className="italic">{book.tone}</span>
          </Detail>
        ) : null}
        <Detail term="Extensión">{chaptersLabel(book.chapterCount)}</Detail>
        {date ? <Detail term={book.publishedAt ? 'Publicado' : 'Creado'}>{date}</Detail> : null}
        <Detail term="Primera lectura">{book.freeFirstRead ? 'Gratis' : formatoMoneda(book.readCost)}</Detail>
        <Detail term="Lectores">{readersLabel(stats.readers)}</Detail>
        <Detail term="Valoración">
          {stats.ratingAverage !== null
            ? `${stats.ratingAverage.toLocaleString('es-ES')} / 5 · ${reviewsLabel(stats.reviewCount)}`
            : 'Sin reseñas'}
        </Detail>
      </dl>
    </Card>
  )
}
