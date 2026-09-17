import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MessageSquareText } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  bookQueryKey,
  bookReviewsQueryKey,
  deleteMyReview,
  fetchReviews,
  REVIEW_TEXT_MAX,
  reviewTextError,
  saveMyReview,
  type BookOut,
  type ReviewOut,
} from '@/api/books'
import { formatBookDate, reviewsLabel } from '@/features/book/format'
import { StarRating, StarsDisplay } from '@/features/book/StarRating'
import { routes } from '@/router/paths'
import { ApiError } from '@/shared/lib/apiClient'
import { Avatar } from '@/shared/ui/Avatar'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'

function ReviewItem({ review }: { review: ReviewOut }) {
  const edited = review.updatedAt && review.createdAt && review.updatedAt !== review.createdAt
  return (
    <article className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link
          to={routes.profile(review.author.handle)}
          className="-mx-1 inline-flex min-h-touch items-center gap-2 rounded-xl px-1 hover:bg-surf-2"
        >
          <Avatar name={review.author.displayName} url={review.author.avatarUrl} />
          <span className="leading-tight">
            <span className="block text-body-sm font-semibold text-ink">{review.author.displayName}</span>
            <span className="block text-[13px] text-ink-dim">@{review.author.handle}</span>
          </span>
        </Link>
        <StarsDisplay value={review.rating} />
        {review.isMine ? <Badge variant="outline">Tuya</Badge> : null}
      </div>
      {review.text ? <p className="max-w-[65ch] whitespace-pre-line break-words text-ink">{review.text}</p> : null}
      {review.createdAt ? (
        <p className="text-[13px] text-ink-faint">
          {formatBookDate(review.createdAt)}
          {edited ? ' · editada' : ''}
        </p>
      ) : null}
    </article>
  )
}

type ReviewFormProps = {
  bookId: string
  initial: ReviewOut | null
  onDone: (message: string) => void
  onCancel?: () => void
}

function ReviewForm({ bookId, initial, onDone, onCancel }: ReviewFormProps) {
  const queryClient = useQueryClient()
  const id = useId()
  const [rating, setRating] = useState(initial?.rating ?? 0)
  const [text, setText] = useState(initial?.text ?? '')
  const [ratingError, setRatingError] = useState<string | null>(null)
  const ratingRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)

  const save = useMutation({
    mutationFn: () => saveMyReview(bookId, { rating, text: text.trim() || null }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: bookQueryKey(bookId) })
      onDone(initial ? 'Reseña actualizada.' : 'Reseña publicada.')
    },
    onError: (error) => {
      if (reviewTextError(error)) textRef.current?.focus()
    },
  })

  const textError = reviewTextError(save.error)
  const generalError = save.error && !textError ? save.error : null
  const ids = {
    rating: `${id}-nota`,
    ratingError: `${id}-nota-error`,
    text: `${id}-texto`,
    textError: `${id}-texto-error`,
    counter: `${id}-contador`,
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (rating < 1) {
      setRatingError('Elige una nota de 1 a 5 estrellas.')
      ratingRef.current?.querySelector<HTMLButtonElement>('[tabindex="0"]')?.focus()
      return
    }
    setRatingError(null)
    save.mutate()
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={save.isPending} className="space-y-4">
      <div ref={ratingRef} className="space-y-1">
        <p id={ids.rating} className="text-body-sm font-semibold text-ink">
          Tu nota
        </p>
        <StarRating
          value={rating}
          onChange={(next) => {
            setRating(next)
            setRatingError(null)
          }}
          labelledBy={ids.rating}
          describedBy={ratingError ? ids.ratingError : undefined}
          invalid={Boolean(ratingError)}
          disabled={save.isPending}
        />
        {ratingError ? (
          <p id={ids.ratingError} className="text-[13px] text-error">
            {ratingError}
          </p>
        ) : null}
      </div>

      <div className="space-y-1">
        <label htmlFor={ids.text} className="block text-body-sm font-semibold text-ink">
          Tu reseña <span className="font-normal text-ink-dim">(opcional)</span>
        </label>
        <textarea
          ref={textRef}
          id={ids.text}
          rows={4}
          maxLength={REVIEW_TEXT_MAX}
          value={text}
          disabled={save.isPending}
          onChange={(e) => setText(e.target.value)}
          aria-invalid={Boolean(textError) || undefined}
          aria-describedby={[textError ? ids.textError : null, ids.counter].filter(Boolean).join(' ')}
          className="w-full resize-y rounded-[14px] border px-4 py-3 text-[15px] text-ink placeholder:text-ink-faint focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ps-accent-text)]"
          style={{
            background: 'var(--ps-surf-2)',
            borderColor: textError ? 'var(--ps-error)' : 'var(--ps-line-strong)',
            fontFamily: 'inherit',
          }}
          placeholder="¿Qué te ha parecido?"
        />
        <div className="flex flex-wrap justify-between gap-2">
          {textError ? (
            <p id={ids.textError} className="text-[13px] text-error">
              {textError}
            </p>
          ) : (
            <span />
          )}
          <p id={ids.counter} className="text-[13px] tabular-nums text-ink-faint">
            {text.length}/{REVIEW_TEXT_MAX} caracteres
          </p>
        </div>
      </div>

      {generalError ? (
        <p role="alert" className="text-body-sm text-error">
          {generalError instanceof ApiError ? generalError.message : 'No se pudo guardar la reseña.'}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" variant="brand" disabled={save.isPending}>
          {save.isPending ? 'Guardando…' : initial ? 'Guardar cambios' : 'Publicar reseña'}
        </Button>
        {onCancel ? (
          <Button variant="outline" disabled={save.isPending} onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}
      </div>
    </form>
  )
}

function MyReview({ bookId, review, onStatus }: { bookId: string; review: ReviewOut; onStatus: (m: string) => void }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const editRef = useRef<HTMLButtonElement>(null)
  const cancelDeleteRef = useRef<HTMLButtonElement>(null)

  const remove = useMutation({
    mutationFn: () => deleteMyReview(bookId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: bookQueryKey(bookId) })
      onStatus('Reseña borrada.')
    },
  })

  useEffect(() => {
    if (confirming) cancelDeleteRef.current?.focus()
  }, [confirming])

  if (editing) {
    return (
      <ReviewForm
        bookId={bookId}
        initial={review}
        onDone={(message) => {
          setEditing(false)
          onStatus(message)
        }}
        onCancel={() => {
          setEditing(false)
          requestAnimationFrame(() => editRef.current?.focus())
        }}
      />
    )
  }

  return (
    <div className="space-y-3">
      <ReviewItem review={review} />
      {confirming ? (
        <div
          role="group"
          aria-labelledby="borrar-resena"
          className="space-y-2 rounded-xl border p-3"
          style={{ borderColor: 'var(--ps-line-strong)' }}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && !remove.isPending) setConfirming(false)
          }}
        >
          <p id="borrar-resena" className="text-body-sm text-ink">
            ¿Borrar tu reseña?
          </p>
          {remove.isError ? (
            <p role="alert" className="text-body-sm text-error">
              No se pudo borrar la reseña.
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button
              ref={cancelDeleteRef}
              variant="outline"
              size="sm"
              disabled={remove.isPending}
              onClick={() => setConfirming(false)}
            >
              Cancelar
            </Button>
            <Button variant="danger" size="sm" disabled={remove.isPending} onClick={() => remove.mutate()}>
              {remove.isPending ? 'Borrando…' : 'Sí, borrar'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button ref={editRef} variant="outline" size="sm" onClick={() => setEditing(true)}>
            Editar
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
            Borrar
          </Button>
        </div>
      )}
    </div>
  )
}

/** Por qué no hay formulario: autor del libro o sin haberlo empezado. */
function cannotReviewReason(book: BookOut) {
  if (book.isMine) return 'No puedes reseñar tu propio libro.'
  return 'Solo puedes reseñar libros que hayas empezado. Empieza a leerlo y vuelve para contar qué te ha parecido.'
}

export function ReviewsSection({ book }: { book: BookOut }) {
  const [status, setStatus] = useState('')
  const reviews = useInfiniteQuery({
    queryKey: bookReviewsQueryKey(book.id),
    queryFn: ({ pageParam }) => fetchReviews(book.id, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset ?? undefined,
  })

  const myReview = book.viewer.myReview
  // La propia va arriba con sus acciones: en la lista se omitiría repetida.
  const items = (reviews.data?.pages.flatMap((p) => p.items) ?? []).filter(
    (r, i, all) => !r.isMine && all.findIndex((x) => x.id === r.id) === i,
  )
  const { reviewCount, ratingAverage } = book.stats

  return (
    <section aria-labelledby="resenas-titulo" className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 id="resenas-titulo" className="flex items-center gap-2 font-serif text-headline-md text-ink">
          <MessageSquareText size={20} className="text-accent-text" aria-hidden />
          Reseñas
        </h2>
        {ratingAverage !== null ? (
          <span className="inline-flex items-center gap-2 text-body-sm text-ink-dim">
            <StarsDisplay value={ratingAverage} />
            {ratingAverage.toLocaleString('es-ES')} de media · {reviewsLabel(reviewCount)}
          </span>
        ) : null}
      </div>

      <p aria-live="polite" className="text-body-sm text-ink-dim empty:hidden">
        {status}
      </p>

      <Card className="p-4 sm:p-5">
        <h3 className="mb-3 font-semibold text-ink">Tu reseña</h3>
        {myReview ? (
          <MyReview bookId={book.id} review={myReview} onStatus={setStatus} />
        ) : book.viewer.canReview ? (
          <ReviewForm bookId={book.id} initial={null} onDone={setStatus} />
        ) : (
          <p className="text-body-sm text-ink-dim">{cannotReviewReason(book)}</p>
        )}
      </Card>

      {reviews.isPending ? <p className="text-ink-dim">Cargando reseñas…</p> : null}
      {reviews.isError ? (
        <p role="alert" className="text-body-sm text-error">
          No se pudieron cargar las reseñas.
        </p>
      ) : null}
      {reviews.isSuccess && items.length === 0 ? (
        <p className="text-body-sm text-ink-dim">
          {myReview ? 'Nadie más ha reseñado este libro todavía.' : 'Todavía no hay reseñas.'}
        </p>
      ) : null}

      {items.length ? (
        <ul className="space-y-5" aria-busy={reviews.isFetchingNextPage}>
          {items.map((review) => (
            <li key={review.id} className="border-t border-[color:var(--ps-line)] pt-4 first:border-t-0 first:pt-0">
              <ReviewItem review={review} />
            </li>
          ))}
        </ul>
      ) : null}

      {reviews.hasNextPage ? (
        <div className="flex flex-col items-center gap-2">
          {reviews.isFetchNextPageError ? (
            <p role="alert" className="text-body-sm text-error">
              No se pudieron cargar más reseñas.
            </p>
          ) : null}
          {/* aria-disabled y no disabled: un botón deshabilitado pierde el foco del teclado. */}
          <Button
            variant="outline"
            className="w-full sm:w-auto sm:min-w-56"
            aria-disabled={reviews.isFetchingNextPage}
            onClick={() => {
              if (!reviews.isFetchingNextPage) void reviews.fetchNextPage()
            }}
          >
            {reviews.isFetchingNextPage ? 'Cargando…' : 'Ver más'}
          </Button>
        </div>
      ) : null}
    </section>
  )
}
