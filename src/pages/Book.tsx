import { useQuery } from '@tanstack/react-query'
import { BookX } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { bookQueryKey, fetchBook } from '@/api/books'
import { BookActions } from '@/features/book/BookActions'
import { BookDetails } from '@/features/book/BookDetails'
import { BookHeader } from '@/features/book/BookHeader'
import { ReadingHistory } from '@/features/book/ReadingHistory'
import { RecommendedBooks } from '@/features/book/RecommendedBooks'
import { ReviewsSection } from '@/features/book/ReviewsSection'
import { routes } from '@/router/paths'
import { ApiError } from '@/shared/lib/apiClient'
import { Card } from '@/shared/ui/card'

export function BookPage() {
  // react-router ya entrega el parámetro decodificado (`custom:...`).
  const { bookId = '' } = useParams()
  const book = useQuery({
    queryKey: bookQueryKey(bookId),
    queryFn: () => fetchBook(bookId),
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 1,
  })

  if (book.isPending) return <p className="text-ink-dim">Abriendo el libro…</p>

  if (book.isError) {
    const notFound = book.error instanceof ApiError && book.error.status === 404
    return (
      <Card className="mx-auto max-w-xl space-y-3 p-6 text-center">
        <BookX size={32} className="mx-auto text-accent-text" aria-hidden />
        <h1 className="font-serif text-headline-lg text-ink">
          {notFound ? 'No encontramos este libro' : 'No se pudo cargar el libro'}
        </h1>
        <p className="text-body-sm text-ink-dim">
          {notFound ? 'Puede que su autor lo haya retirado o hecho privado.' : 'Inténtalo de nuevo en un momento.'}
        </p>
        <Link to={routes.explorar} className="inline-block text-body-sm font-semibold text-accent-text underline">
          Ir a Explorar
        </Link>
      </Card>
    )
  }

  const data = book.data

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <BookHeader book={data} actions={<BookActions book={data} />} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-8">
        {/* En móvil los detalles van antes que las reseñas; en escritorio pasan a la columna lateral. */}
        <div className="min-w-0 space-y-6 lg:order-2">
          <BookDetails book={data} />
          <ReadingHistory bookId={data.id} />
        </div>
        <div className="min-w-0 lg:order-1">
          <ReviewsSection book={data} />
        </div>
      </div>

      <RecommendedBooks bookId={data.id} />
    </div>
  )
}
