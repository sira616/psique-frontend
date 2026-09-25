import { useQuery } from '@tanstack/react-query'
import { customStoryStatsQueryKey, fetchCustomStoryStats } from '@/api/customStories'
import { ReviewItem } from '@/features/book/ReviewItem'
import { StarsDisplay } from '@/features/book/StarRating'
import { Card } from '@/shared/ui/card'
import {
  Icon,
  IconLectores,
  IconNota,
  IconPartidasActivas,
  IconResenas,
  type IconComponent,
} from '@/shared/ui/icons'

const notaFormat = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

function Metric({ icon, value, label }: { icon: IconComponent; value: string; label: string }) {
  return (
    <div className="rounded-[14px] border p-3" style={{ borderColor: 'var(--ps-line-strong)' }}>
      <p className="flex items-center gap-2 text-[11px] font-bold tracking-[0.12em] text-ink-faint uppercase">
        <Icon icon={icon} size={14} />
        {label}
      </p>
      <p className="mt-1 font-serif text-headline-lg tabular-nums text-ink">{value}</p>
    </div>
  )
}

/**
 * Métricas de la historia y sus últimas reseñas. Van en su propia consulta porque
 * `GET /api/custom-stories/{id}` no las trae y se recargan a otro ritmo que el detalle.
 */
export function StoryStatsPanel({ storyId }: { storyId: string }) {
  const stats = useQuery({
    queryKey: customStoryStatsQueryKey(storyId),
    queryFn: () => fetchCustomStoryStats(storyId),
  })

  if (stats.isPending) return <p className="text-ink-dim">Cargando métricas…</p>

  if (stats.isError) {
    return (
      <p role="alert" className="text-body-sm text-error">
        No se pudieron cargar las métricas.
      </p>
    )
  }

  const { readers, activeStories, ratingAverage, reviewCount, recentReviews } = stats.data

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric icon={IconLectores} value={String(readers)} label="Lectoras" />
        <Metric icon={IconPartidasActivas} value={String(activeStories)} label="Partidas activas" />
        <Metric
          icon={IconNota}
          value={ratingAverage === null ? '—' : notaFormat.format(ratingAverage)}
          label="Nota media"
        />
        <Metric icon={IconResenas} value={String(reviewCount)} label="Reseñas" />
      </div>

      {ratingAverage !== null ? (
        <p className="flex flex-wrap items-center gap-2 text-body-sm text-ink-dim">
          <StarsDisplay value={ratingAverage} />
          {notaFormat.format(ratingAverage)} de media sobre {reviewCount === 1 ? '1 reseña' : `${reviewCount} reseñas`}.
        </p>
      ) : null}

      <div className="space-y-3">
        <h3 className="font-semibold text-ink">Últimas reseñas</h3>
        {recentReviews.length ? (
          <ul className="space-y-5">
            {recentReviews.map((review) => (
              <li key={review.id} className="border-t border-[color:var(--ps-line)] pt-4 first:border-t-0 first:pt-0">
                <ReviewItem review={review} />
              </li>
            ))}
          </ul>
        ) : (
          <Card className="p-4">
            <p className="text-body-sm text-ink-dim">
              Todavía no hay reseñas. Aparecerán aquí en cuanto alguien termine de leerla y cuente qué le
              ha parecido.
            </p>
          </Card>
        )}
      </div>
    </div>
  )
}
