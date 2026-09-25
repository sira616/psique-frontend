import { useQuery } from '@tanstack/react-query'
import { ArrowRight, BookHeart, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { fetchCharacters, fetchStories } from '@/api/stories'
import { listCustomStories } from '@/api/customStories'
import { MyStoryCard, myStoriesGridClassName } from '@/features/customStories/MyStoryCard'
import { AdultBadge } from '@/features/policy/AdultBadge'
import { routes } from '@/router/paths'
import type { Character } from '@/shared/lib/events'
import { Badge } from '@/shared/ui/badge'
import { ButtonLink } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'

// Una columna en móvil y hasta cuatro en pantallas anchas, para no estirar las tarjetas.
const cardGridClassName = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4'

/** Las tarjetas solo llevan al libro: allí se ve el precio y se decide leer. */
function BookLink({ character }: { character: Character }) {
  return (
    <ButtonLink
      variant="brand"
      className="mt-1 w-full"
      to={routes.book(character.id)}
      aria-label={`Ver libro: ${character.title}`}
    >
      Ver libro
      <ArrowRight size={16} aria-hidden />
    </ButtonLink>
  )
}

function ProfileCard({ character }: { character: Character }) {
  return (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-serif text-headline-lg text-ink">{character.name}</h3>
        {character.age != null ? (
          <span className="shrink-0 text-body-sm text-ink-faint">{character.age} años</span>
        ) : null}
      </div>
      {character.adult ? <AdultBadge className="w-fit" /> : null}
      {character.tagline ?? character.hook ? (
        <p className="text-body-sm text-ink-dim">{character.tagline ?? character.hook}</p>
      ) : null}
      {character.traits?.length ? (
        <div className="flex flex-wrap gap-1.5">
          {character.traits.slice(0, 3).map((t) => (
            <Badge key={t} variant="outline" className="normal-case tracking-normal">
              {t}
            </Badge>
          ))}
        </div>
      ) : null}
      <p className="flex-1 text-body-sm italic text-ink-dim">{character.scenario}</p>
      <BookLink character={character} />
    </>
  )
}

/** Cuántas propias se ven en la portada: el resto están en /mis-historias. */
const RECIENTES = 3

export function CharactersPage() {
  const characters = useQuery({ queryKey: ['characters'], queryFn: fetchCharacters })
  const stories = useQuery({ queryKey: ['stories'], queryFn: fetchStories })
  const customStories = useQuery({ queryKey: ['custom-stories'], queryFn: listCustomStories })

  const psique = characters.data?.filter((c) => c.origin !== 'propia') ?? []
  // La lista viene de la más reciente a la más antigua, igual que en el backend.
  const propias = customStories.data ?? []
  const recientes = propias.slice(0, RECIENTES)

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-[70ch]">
          <h1 className="font-serif text-display text-ink">¿Con quién empieza tu historia?</h1>
          <p className="mt-2 text-body-sm text-ink-dim">
            Romance para todos los públicos. Cuando una escena se acerca demasiado, se funde a negro.
          </p>
        </div>
        <Link
          to={routes.nuevaHistoria}
          className="inline-flex min-h-touch items-center gap-2 rounded-xl border border-outline-variant px-4 text-body-sm font-semibold text-ink hover:bg-surf-2"
        >
          <Plus size={16} aria-hidden />
          Crear historia
        </Link>
      </header>

      {characters.isLoading ? <p className="text-ink-dim">Cargando personajes…</p> : null}
      {characters.isError ? (
        <p role="alert" className="text-error">
          No se pudieron cargar los personajes.
        </p>
      ) : null}

      {characters.data ? (
        <section aria-labelledby="historias-psique" className="space-y-3">
          <h2 id="historias-psique" className="font-serif text-headline-md text-ink">
            Historias de Psique
          </h2>
          <ul className={cardGridClassName}>
            {psique.map((c) => (
              <li key={c.id}>
                <Card className="flex h-full flex-col gap-3 p-5">
                  <ProfileCard character={c} />
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/*
        Tira corta y de solo lectura: aquí se ve de un vistazo lo último que has creado (es donde
        te deja el formulario de creación), pero editar, publicar y borrar se hacen en
        /mis-historias y en el detalle. Así no hay dos interfaces distintas para lo mismo.
      */}
      <section aria-labelledby="historias-propias" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="historias-propias" className="font-serif text-headline-md text-ink">
            Mis historias
          </h2>
          {propias.length ? (
            <Link to={routes.misHistorias} className="text-body-sm font-semibold text-accent-text underline">
              Ver todas ({propias.length})
            </Link>
          ) : null}
        </div>
        {customStories.isError ? (
          <p role="alert" className="text-body-sm text-error">
            No se pudieron cargar tus historias.
          </p>
        ) : null}
        {recientes.length ? (
          <ul className={myStoriesGridClassName}>
            {recientes.map((story) => (
              <li key={story.id}>
                <MyStoryCard story={story} headingLevel="h3" />
              </li>
            ))}
          </ul>
        ) : customStories.isSuccess ? (
          <Card className="p-5">
            <p className="text-body-sm text-ink-dim">
              Todavía no has creado ninguna historia. Describe a tu personaje o lanza una idea y deja
              que Psique la imagine.
            </p>
            <Link
              to={routes.nuevaHistoria}
              className="mt-2 inline-block text-body-sm font-semibold text-accent-text underline"
            >
              Crear mi primera historia
            </Link>
          </Card>
        ) : null}
      </section>

      {stories.data?.length ? (
        <section aria-labelledby="partidas-en-curso" className="space-y-3">
          <h2 id="partidas-en-curso" className="flex items-center gap-2 font-serif text-headline-md text-ink">
            <BookHeart size={20} className="text-accent-text" aria-hidden />
            Partidas en curso
          </h2>
          <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {stories.data.map((s) => (
              <li key={s.id}>
                <Link
                  to={routes.story(s.id)}
                  className="flex h-full items-center justify-between gap-3 rounded-xl border border-[color:var(--ps-line)] px-4 py-3 hover:bg-surf-2"
                  style={{ background: 'var(--ps-surf-1)' }}
                >
                  <span className="font-semibold text-ink">{s.characterName}</span>
                  <span className="text-body-sm text-ink-dim">
                    {s.state.phaseLabel} · afinidad {s.state.affinity}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
