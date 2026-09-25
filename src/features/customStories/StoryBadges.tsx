import type { CustomStory } from '@/api/customStories'
import { cn } from '@/shared/lib/utils'
import { Badge } from '@/shared/ui/badge'
import {
  Icon,
  IconAdulto,
  IconModoConcepto,
  IconModoDefinida,
  IconPrimeraLecturaGratis,
  IconPrivada,
  IconPublica,
  type IconComponent,
} from '@/shared/ui/icons'

export function StoryBadge({
  icon,
  children,
  tone,
}: {
  icon: IconComponent
  children: string
  tone?: string
}) {
  return (
    <Badge variant="outline" className={cn('gap-1 normal-case tracking-normal', tone)}>
      <Icon icon={icon} size={12} />
      {children}
    </Badge>
  )
}

/**
 * Estado de una historia propia en cuatro etiquetas: visibilidad, modo, +18 y primera lectura
 * gratis. Una sola implementación para la tarjeta y para la cabecera del detalle, para que la
 * misma historia no se describa de dos maneras según dónde se mire.
 */
export function StoryBadges({ story, className }: { story: CustomStory; className?: string }) {
  const esConcepto = story.mode === 'concepto'
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {story.isPublic ? (
        <StoryBadge icon={IconPublica}>Pública</StoryBadge>
      ) : (
        <StoryBadge icon={IconPrivada}>Privada</StoryBadge>
      )}
      <StoryBadge
        icon={esConcepto ? IconModoConcepto : IconModoDefinida}
        tone={esConcepto ? 'text-accent-text' : undefined}
      >
        {esConcepto ? 'Concepto' : 'Definida'}
      </StoryBadge>
      {story.adult ? (
        <StoryBadge icon={IconAdulto} tone="text-gold">
          +18
        </StoryBadge>
      ) : null}
      {story.freeFirstRead ? (
        <StoryBadge icon={IconPrimeraLecturaGratis}>Primera lectura gratis</StoryBadge>
      ) : null}
    </div>
  )
}
