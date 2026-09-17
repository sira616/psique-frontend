import { ArrowRight, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { StoryCard } from '@/api/explore'
import { routes } from '@/router/paths'
import { Avatar } from '@/shared/ui/Avatar'
import { Badge } from '@/shared/ui/badge'
import { ButtonLink } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'

/** Misma rejilla que la portada: una columna en móvil y hasta cuatro en pantallas anchas. */
export const cardGridClassName = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4'

type PublicStoryCardProps = {
  card: StoryCard
  /** En la estantería de un perfil el autor ya está en la cabecera. */
  showAuthor?: boolean
  headingLevel?: 'h2' | 'h3'
}

function traitsOf(personality: string) {
  return personality
    .split(/[,;\n]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 3)
}

export function PublicStoryCard({
  card,
  showAuthor = true,
  headingLevel: Heading = 'h3',
}: PublicStoryCardProps) {
  const def = card.definition
  const isConcept = card.mode === 'concepto'

  return (
    <Card className="flex h-full flex-col gap-3 p-5">
      <div className="flex flex-wrap items-center gap-1.5">
        {isConcept ? (
          <Badge variant="outline" className="gap-1 text-accent-text">
            <Sparkles size={12} aria-hidden />
            Por descubrir
          </Badge>
        ) : (
          <Badge variant="outline">Definida</Badge>
        )}
        {card.isMine && showAuthor ? <Badge variant="outline">Tuya</Badge> : null}
      </div>

      <Heading className="font-serif text-headline-lg text-ink">{card.title}</Heading>

      {def ? (
        <p className="text-body-sm font-semibold text-ink">
          {def.name}
          <span className="font-normal text-ink-faint"> · {def.age} años</span>
        </p>
      ) : null}

      <p className="text-body-sm text-ink-dim">{card.hook}</p>

      {def ? (
        <div className="flex flex-wrap gap-1.5">
          {traitsOf(def.personality).map((t) => (
            <Badge key={t} variant="outline" className="normal-case tracking-normal">
              {t}
            </Badge>
          ))}
        </div>
      ) : null}

      {card.tone ? (
        <p className="text-body-sm text-ink-dim">
          <span className="text-ink-faint">Tono: </span>
          <span className="italic">{card.tone}</span>
        </p>
      ) : null}
      <div className="flex-1" aria-hidden />

      {showAuthor ? (
        <Link
          to={routes.profile(card.author.handle)}
          className="-mx-2 flex min-h-touch items-center gap-2.5 rounded-xl px-2 hover:bg-surf-2"
        >
          <Avatar name={card.author.displayName} url={card.author.avatarUrl} />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-body-sm font-semibold text-ink">{card.author.displayName}</span>
            <span className="block truncate text-[13px] text-ink-dim">@{card.author.handle}</span>
          </span>
        </Link>
      ) : null}

      {/* Leer (y cobrar) se decide en la página del libro, donde se ve el precio. */}
      <ButtonLink variant="brand" className="w-full" to={routes.book(card.characterId)} aria-label={`Ver libro: ${card.title}`}>
        Ver libro
        <ArrowRight size={16} aria-hidden />
      </ButtonLink>
    </Card>
  )
}
