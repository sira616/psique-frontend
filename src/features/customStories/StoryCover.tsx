import { coverFallback, coverInitial } from '@/features/customStories/coverFallback'
import { mediaUrl } from '@/shared/lib/media'
import { cn } from '@/shared/lib/utils'
import { Icon, IconModoConcepto, IconModoDefinida } from '@/shared/ui/icons'
import type { CustomStoryMode } from '@/shared/lib/events'

type StoryCoverProps = {
  /** Id de la historia: de él sale el fondo cuando no hay portada. */
  id: string
  /** Solo para la inicial del fondo; el título de verdad va en texto, fuera de la portada. */
  title: string
  coverUrl: string | null
  mode?: CustomStoryMode | null
  /** Proporción y tamaño los decide quien la coloca (`aspect-[16/9] w-full`, `w-28`…). */
  className?: string
  /** Tamaño de la inicial del fondo. */
  initialClassName?: string
}

/**
 * Portada de una historia. Con `coverUrl` es la imagen; sin ella, el degradado determinista de
 * `coverFallback`. Siempre decorativa (`alt=""` / `aria-hidden`): el título va al lado.
 */
export function StoryCover({
  id,
  title,
  coverUrl,
  mode,
  className,
  initialClassName = 'text-[clamp(28px,12cqw,64px)]',
}: StoryCoverProps) {
  const src = mediaUrl(coverUrl)
  if (src) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        className={cn('object-cover', className)}
        style={{ background: 'var(--ps-surf-3)' }}
      />
    )
  }

  const fallback = coverFallback(id)
  return (
    <div
      aria-hidden
      data-testid="portada-generada"
      className={cn('relative grid place-items-center overflow-hidden [container-type:inline-size]', className)}
      style={{ background: fallback.background }}
    >
      {/* Velo en el centro: la inicial se lee igual sea cual sea la pareja de tonos. */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(circle at 50% 50%, var(--ps-scrim), transparent 72%)' }}
      />
      <span
        className={cn('relative font-serif leading-none text-on-primary opacity-95', initialClassName)}
        style={{ color: 'var(--ps-on-primary)' }}
      >
        {coverInitial(title)}
      </span>
      {mode ? (
        <span className="absolute right-2 bottom-2 text-on-primary opacity-90" style={{ color: 'var(--ps-on-primary)' }}>
          <Icon icon={mode === 'concepto' ? IconModoConcepto : IconModoDefinida} size={16} />
        </span>
      ) : null}
    </div>
  )
}
