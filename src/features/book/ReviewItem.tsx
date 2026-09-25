import { Link } from 'react-router-dom'
import type { ReviewOut } from '@/api/books'
import { formatBookDate } from '@/features/book/format'
import { StarsDisplay } from '@/features/book/StarRating'
import { routes } from '@/router/paths'
import { Avatar } from '@/shared/ui/Avatar'
import { Badge } from '@/shared/ui/badge'

/**
 * Una reseña, tal cual la pinta la página de libro. Vive aparte de `ReviewsSection` porque el
 * detalle de una historia propia también la usa para las reseñas recientes de sus métricas, y
 * no le hace falta arrastrar el formulario ni la paginación de la sección entera.
 */
export function ReviewItem({ review }: { review: ReviewOut }) {
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
