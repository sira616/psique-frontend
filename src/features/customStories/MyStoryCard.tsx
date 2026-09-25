import { Link } from 'react-router-dom'
import type { CustomStory, CustomStoryStats } from '@/api/customStories'
import { StoryBadges } from '@/features/customStories/StoryBadges'
import { StoryCover } from '@/features/customStories/StoryCover'
import { routes } from '@/router/paths'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import {
  Icon,
  IconBorrar,
  IconDespublicar,
  IconEditar,
  IconLectores,
  IconNota,
  IconPortada,
  IconPublicar,
  IconResenas,
  IconVerComoLector,
  type IconComponent,
} from '@/shared/ui/icons'

/**
 * Rejilla de estas tarjetas: 1 columna en móvil, 2 desde 768 y 3 desde 1280. Vive aquí y no en
 * la página para que la tira de la portada y la sección entera repartan igual.
 */
export const myStoriesGridClassName = 'grid gap-4 md:grid-cols-2 xl:grid-cols-3'

/** Solo lo que la tarjeta enseña: `GET /api/custom-stories` no trae métricas. */
export type MyStoryCardStats = Pick<CustomStoryStats, 'readers' | 'ratingAverage' | 'reviewCount'>

export type MyStoryCardProps = {
  story: CustomStory
  /**
   * Métricas. La lista de historias propias no las trae: cuando falten, la fila no se pinta
   * (no se inventan ceros). Salen de `GET /api/custom-stories/{id}/stats`.
   */
  stats?: MyStoryCardStats | null
  /** `h2` si las tarjetas cuelgan de la página; `h3` dentro de una sección con su título. */
  headingLevel?: 'h2' | 'h3'
  /** Sin callback, la acción no se pinta. La tarjeta nunca muta nada: solo avisa. */
  onEditar?: (story: CustomStory) => void
  onPortada?: (story: CustomStory) => void
  /** Publicar o despublicar según `story.isPublic`; recibe el valor que hay que guardar. */
  onVisibilidad?: (story: CustomStory, isPublic: boolean) => void
  onBorrar?: (story: CustomStory) => void
  /** Mientras el padre guarda algo: deshabilita las acciones sin mover el foco. */
  busy?: boolean
  className?: string
}

const notaFormat = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

function Metric({ icon, value, label }: { icon: IconComponent; value: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-dim">
      <Icon icon={icon} size={14} className="text-ink-faint" />
      <span className="font-semibold tabular-nums text-ink">{value}</span>
      <span>{label}</span>
    </span>
  )
}

/**
 * Tarjeta de una historia propia. Toda ella lleva al detalle a través del enlace del título,
 * estirado con `::after` sobre la tarjeta: así no hay botones dentro de un enlace (anidar
 * interactivos rompe el teclado y el lector de pantalla). Las acciones van por encima, con z-10.
 *
 * El ancho lo decide la rejilla de fuera; la tarjeta solo ocupa todo el alto de su celda.
 */
export function MyStoryCard({
  story,
  stats,
  headingLevel: Heading = 'h3',
  onEditar,
  onPortada,
  onVisibilidad,
  onBorrar,
  busy = false,
  className,
}: MyStoryCardProps) {
  return (
    <Card
      className={cn(
        'group flex h-full flex-col motion-safe:transition-shadow hover:shadow-[var(--ps-shadow-glow)]',
        'focus-within:ring-2 focus-within:ring-[color:var(--ps-accent-text)]',
        className,
      )}
    >
      <StoryCover
        id={story.id}
        title={story.title}
        coverUrl={story.coverUrl}
        mode={story.mode}
        className="aspect-[16/9] w-full border-b border-[color:var(--ps-line)]"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 sm:p-5">
        <StoryBadges story={story} />

        <Heading className="font-serif text-headline-lg text-ink">
          {/* El ::after cubre la tarjeta entera: pulsar en cualquier hueco libre abre el detalle. */}
          <Link
            to={routes.misHistoriaDetalle(story.id)}
            className="rounded-sm after:absolute after:inset-0 after:content-[''] group-hover:underline"
          >
            {story.title}
          </Link>
        </Heading>

        <p className="line-clamp-2 text-body-sm text-ink-dim">{story.hook}</p>

        {stats ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Metric
              icon={IconLectores}
              value={String(stats.readers)}
              label={stats.readers === 1 ? 'lectora' : 'lectoras'}
            />
            {stats.ratingAverage !== null ? (
              <Metric icon={IconNota} value={notaFormat.format(stats.ratingAverage)} label="de nota" />
            ) : null}
            <Metric
              icon={IconResenas}
              value={String(stats.reviewCount)}
              label={stats.reviewCount === 1 ? 'reseña' : 'reseñas'}
            />
          </div>
        ) : null}

        <div className="flex-1" aria-hidden />

        {/* z-10: por encima del ::after del título; si no, los botones no se podrían pulsar. */}
        <div className="relative z-10 -mx-1 flex flex-wrap items-center gap-1">
          {onEditar ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              aria-label={`Editar ${story.title}`}
              onClick={() => onEditar(story)}
            >
              <Icon icon={IconEditar} size={14} />
              Editar
            </Button>
          ) : null}
          {onPortada ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              aria-label={`Portada de ${story.title}`}
              onClick={() => onPortada(story)}
            >
              <Icon icon={IconPortada} size={14} />
              Portada
            </Button>
          ) : null}
          {onVisibilidad ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              aria-label={`${story.isPublic ? 'Despublicar' : 'Publicar'} ${story.title}`}
              onClick={() => onVisibilidad(story, !story.isPublic)}
            >
              <Icon icon={story.isPublic ? IconDespublicar : IconPublicar} size={14} />
              {story.isPublic ? 'Despublicar' : 'Publicar'}
            </Button>
          ) : null}
          <Link
            to={routes.book(story.characterId)}
            aria-label={`Ver ${story.title} como lector`}
            className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-semibold text-ink hover:bg-surf-2"
          >
            <Icon icon={IconVerComoLector} size={14} />
            Ver como lector
          </Link>
          {onBorrar ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              className="text-error"
              aria-label={`Borrar ${story.title}`}
              onClick={() => onBorrar(story)}
            >
              <Icon icon={IconBorrar} size={14} />
              Borrar
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  )
}
