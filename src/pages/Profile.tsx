import { useQuery } from '@tanstack/react-query'
import { BookOpen, CalendarDays, EyeOff, Link2, Pencil, UserRoundX } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchProfile, profileQueryKey, type PublicProfile, type ReadingItem } from '@/api/profile'
import { PublicStoryCard, cardGridClassName } from '@/features/publicStories/PublicStoryCard'
import { routes } from '@/router/paths'
import { ApiError } from '@/shared/lib/apiClient'
import { mediaUrl, parseApiDate } from '@/shared/lib/media'
import { Avatar } from '@/shared/ui/Avatar'
import { Badge } from '@/shared/ui/badge'
import { Card } from '@/shared/ui/card'

const joinedFormat = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' })

/** Muestra el enlace sin esquema ni barra final: es más legible y el href sigue completo. */
function prettyLink(link: string) {
  return link.replace(/^https?:\/\//, '').replace(/\/$/, '')
}

function HiddenBadge() {
  return (
    <Badge variant="outline" className="gap-1 normal-case tracking-normal text-gold">
      <EyeOff size={12} aria-hidden />
      Oculta para otros
    </Badge>
  )
}

type ShelfSectionProps = {
  id: string
  title: string
  owner: boolean
  visibleToOthers: boolean
  children: ReactNode
}

function ShelfSection({ id, title, owner, visibleToOthers, children }: ShelfSectionProps) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 id={id} className="font-serif text-headline-md text-ink">
          {title}
        </h2>
        {owner && !visibleToOthers ? <HiddenBadge /> : null}
      </div>
      {owner && !visibleToOthers ? (
        <p className="text-body-sm text-ink-dim">
          Solo tú ves esta estantería.{' '}
          <Link to={`${routes.configuracion}#privacidad`} className="font-semibold text-accent-text underline">
            Cambiar en Privacidad
          </Link>
        </p>
      ) : null}
      {children}
    </section>
  )
}

function PrivateShelfNotice({ children }: { children: ReactNode }) {
  return (
    <Card className="flex items-center gap-3 p-5">
      <EyeOff size={18} className="text-ink-faint" aria-hidden />
      <p className="text-body-sm text-ink-dim">{children}</p>
    </Card>
  )
}

function EmptyShelf({ children }: { children: ReactNode }) {
  return (
    <Card className="p-5">
      <p className="text-body-sm text-ink-dim">{children}</p>
    </Card>
  )
}

function PhaseProgress({ progress }: { progress: ReadingItem['progress'] }) {
  const current = progress.phaseIndex + 1
  return (
    <div className="space-y-1.5">
      <p className="text-body-sm text-ink-dim">
        Fase {current} de {progress.phaseCount}: <span className="font-semibold text-gold">{progress.phaseLabel}</span>
      </p>
      <div className="flex gap-1" aria-hidden>
        {Array.from({ length: progress.phaseCount }, (_, i) => (
          <span
            key={i}
            className="h-1.5 flex-1 rounded-full"
            style={{ background: i < current ? 'var(--ps-primary)' : 'var(--ps-line-strong)' }}
          />
        ))}
      </div>
    </div>
  )
}

function ReadingList({ items }: { items: ReadingItem[] }) {
  return (
    <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item, index) => (
        // Se puede tener más de una partida con el mismo personaje y no llega id de partida.
        <li key={`${item.characterId}-${item.updatedAt ?? ''}-${index}`}>
          <Card className="flex h-full flex-col gap-2 p-4">
            <div className="flex items-start gap-2">
              <BookOpen size={16} className="mt-1 text-accent-text" aria-hidden />
              <div className="min-w-0">
                <h3 className="font-semibold text-ink">
                  <Link to={routes.book(item.characterId)} className="underline-offset-2 hover:underline">
                    {item.title}
                  </Link>
                </h3>
                {item.characterName && item.characterName !== item.title ? (
                  <p className="text-body-sm text-ink-dim">con {item.characterName}</p>
                ) : null}
              </div>
            </div>
            <PhaseProgress progress={item.progress} />
          </Card>
        </li>
      ))}
    </ul>
  )
}

function ProfileHeader({ profile }: { profile: PublicProfile }) {
  const banner = mediaUrl(profile.bannerUrl)
  return (
    <Card className="overflow-hidden">
      <div
        className="aspect-[3/1] max-h-72 w-full sm:aspect-[4/1]"
        style={{ background: 'linear-gradient(120deg, var(--ps-primary-deep), var(--ps-surf-3) 60%, var(--ps-gold))' }}
      >
        {/* Decorativo: la información del perfil está en el texto. */}
        {banner ? <img src={banner} alt="" className="h-full w-full object-cover" /> : null}
      </div>
      <div className="relative px-5 pb-5 sm:px-8 sm:pb-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Avatar
            name={profile.displayName}
            url={profile.avatarUrl}
            size="lg"
            alt={`Foto de perfil de ${profile.displayName}`}
            className="-mt-12 ring-4 ring-[color:var(--ps-surf-1)] sm:-mt-14"
          />
          {profile.isOwner ? (
            <Link
              to={routes.configuracion}
              className="inline-flex min-h-touch items-center gap-2 rounded-xl border border-outline-variant px-4 text-body-sm font-semibold text-ink hover:bg-surf-2"
            >
              <Pencil size={16} aria-hidden />
              Editar perfil
            </Link>
          ) : null}
        </div>
        <h1 className="mt-3 font-serif text-display break-words text-ink">{profile.displayName}</h1>
        <p className="text-body-sm text-ink-dim">@{profile.handle}</p>
        {profile.bio ? <p className="mt-3 max-w-[65ch] whitespace-pre-line text-ink">{profile.bio}</p> : null}
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-body-sm text-ink-dim">
          {profile.link ? (
            <a
              href={profile.link}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex min-h-touch items-center gap-1.5 font-semibold break-all text-accent-text underline sm:min-h-0"
            >
              <Link2 size={16} aria-hidden />
              {prettyLink(profile.link)}
              <span className="sr-only"> (se abre en otra pestaña)</span>
            </a>
          ) : null}
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays size={16} aria-hidden />
            Desde {joinedFormat.format(parseApiDate(profile.joinedAt))}
          </span>
        </div>
      </div>
    </Card>
  )
}

export function ProfilePage() {
  const { handle = '' } = useParams()
  const profile = useQuery({
    queryKey: profileQueryKey(handle),
    queryFn: () => fetchProfile(handle),
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 1,
  })

  if (profile.isPending) return <p className="text-ink-dim">Cargando perfil…</p>

  if (profile.isError) {
    const notFound = profile.error instanceof ApiError && profile.error.status === 404
    return (
      <Card className="mx-auto max-w-xl space-y-3 p-6 text-center">
        <UserRoundX size={32} className="mx-auto text-accent-text" aria-hidden />
        <h1 className="font-serif text-headline-lg text-ink">
          {notFound ? 'No encontramos este perfil' : 'No se pudo cargar el perfil'}
        </h1>
        <p className="text-body-sm text-ink-dim">
          {notFound
            ? `Nadie usa ahora @${handle}. Puede que haya cambiado de nombre.`
            : 'Inténtalo de nuevo en un momento.'}
        </p>
        <Link to={routes.explorar} className="inline-block text-body-sm font-semibold text-accent-text underline">
          Ir a Explorar
        </Link>
      </Card>
    )
  }

  const data = profile.data
  const { published, reading } = data.shelves
  const owner = data.isOwner

  return (
    <div className="space-y-8">
      <ProfileHeader profile={data} />

      <ShelfSection id="estanteria-publicadas" title="Publicadas" owner={owner} visibleToOthers={published.visibleToOthers}>
        {published.items === null ? (
          <PrivateShelfNotice>{data.displayName} no comparte sus historias publicadas.</PrivateShelfNotice>
        ) : published.items.length ? (
          <ul className={cardGridClassName}>
            {published.items.map((card) => (
              <li key={card.id}>
                <PublicStoryCard card={card} showAuthor={false} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyShelf>
            {owner ? (
              <>
                Aún no has publicado ninguna historia.{' '}
                <Link to={routes.characters} className="font-semibold text-accent-text underline">
                  Publica una desde Mis historias
                </Link>
              </>
            ) : (
              `${data.displayName} todavía no ha publicado ninguna historia.`
            )}
          </EmptyShelf>
        )}
      </ShelfSection>

      <ShelfSection id="estanteria-leyendo" title="Leyendo" owner={owner} visibleToOthers={reading.visibleToOthers}>
        {reading.items === null ? (
          <PrivateShelfNotice>{data.displayName} no comparte lo que está leyendo.</PrivateShelfNotice>
        ) : reading.items.length ? (
          <ReadingList items={reading.items} />
        ) : (
          <EmptyShelf>{owner ? 'No tienes ninguna partida empezada.' : 'Nada por aquí de momento.'}</EmptyShelf>
        )}
      </ShelfSection>
    </div>
  )
}
