import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, BookHeart, Plus, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { fetchCharacters, fetchStories } from '@/api/stories'
import {
  customStoryIdFrom,
  customStoryQueryKeys,
  deleteCustomStory,
  listCustomStories,
  updateCustomStory,
  type CustomStory,
  type CustomStoryPatch,
} from '@/api/customStories'
import { AdultBadge } from '@/features/policy/AdultBadge'
import { routes } from '@/router/paths'
import { ApiError } from '@/shared/lib/apiClient'
import type { Character } from '@/shared/lib/events'
import { Badge } from '@/shared/ui/badge'
import { Button, ButtonLink } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Switch } from '@/shared/ui/Switch'

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
  const isOwn = character.origin === 'propia'
  return (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-serif text-headline-lg text-ink">{isOwn ? character.title : character.name}</h3>
        {character.age != null ? (
          <span className="shrink-0 text-body-sm text-ink-faint">{character.age} años</span>
        ) : null}
      </div>
      {character.adult ? <AdultBadge className="w-fit" /> : null}
      {isOwn && character.name ? <p className="text-body-sm font-semibold text-ink">{character.name}</p> : null}
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

/** Concepto: el perfil está oculto a propósito; solo se enseña el título y el gancho. */
function ConceptCard({ character }: { character: Character }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="w-fit gap-1 text-accent-text">
          <Sparkles size={12} aria-hidden />
          Por descubrir
        </Badge>
        {character.adult ? <AdultBadge /> : null}
      </div>
      <h3 className="font-serif text-headline-lg text-ink">{character.title}</h3>
      <p className="flex-1 text-body-sm italic text-ink-dim">{character.hook}</p>
      <BookLink character={character} />
    </>
  )
}

type ToggleField = keyof Required<CustomStoryPatch>

const TOGGLES: Record<
  ToggleField,
  { label: string; help: string; on: string; off: string; failure: string; invalidate: string[][] }
> = {
  isPublic: {
    label: 'Pública',
    help: 'visible en Explorar',
    on: 'Ahora es pública y aparece en Explorar.',
    off: 'Ahora es privada.',
    failure: 'No se pudo cambiar la visibilidad.',
    invalidate: [['explore'], ['profile'], ['book']],
  },
  freeFirstRead: {
    label: 'Primera lectura gratis',
    help: 'releer siempre cuesta óbolos',
    on: 'La primera lectura ahora es gratis.',
    off: 'Ahora leerla cuesta óbolos desde la primera vez.',
    failure: 'No se pudo cambiar el precio de lectura.',
    invalidate: [['book']],
  },
  adult: {
    label: '+18',
    help: 'solo la verán cuentas mayores de edad',
    on: 'Ahora es +18: solo la verán cuentas mayores de edad.',
    off: 'Ya no es +18: la puede ver cualquier cuenta.',
    failure: 'No se pudo cambiar la opción +18.',
    invalidate: [['characters'], ['explore'], ['profile'], ['book']],
  },
}

/**
 * Optimista: el interruptor cambia al instante y vuelve atrás si el servidor falla. El valor
 * sale de /api/custom-stories porque /api/characters no lo trae.
 */
function StoryToggle({
  character,
  story,
  field,
}: {
  character: Character
  story: CustomStory | undefined
  field: ToggleField
}) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState('')
  const copy = TOGGLES[field]

  const toggle = useMutation({
    mutationFn: (value: boolean) =>
      updateCustomStory(customStoryIdFrom(character.id) ?? character.id, { [field]: value }),
    onMutate: async (value) => {
      await queryClient.cancelQueries({ queryKey: ['custom-stories'] })
      const previous = queryClient.getQueryData<CustomStory[]>(['custom-stories'])
      queryClient.setQueryData<CustomStory[]>(['custom-stories'], (list) =>
        list?.map((s) => (s.characterId === character.id ? { ...s, [field]: value } : s)),
      )
      setStatus('')
      return { previous }
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<CustomStory[]>(['custom-stories'], (list) =>
        list?.map((s) => (s.id === updated.id ? updated : s)),
      )
      setStatus(updated[field] ? copy.on : copy.off)
      for (const queryKey of copy.invalidate) void queryClient.invalidateQueries({ queryKey })
    },
    onError: (_error, _value, context) => {
      if (context?.previous) queryClient.setQueryData(['custom-stories'], context.previous)
    },
  })

  const checked = story?.[field] ?? false
  return (
    <div className="space-y-1">
      {field === 'adult' ? (
        // +18 es una marca de contenido, no un interruptor de estado: casilla, como al crear.
        <label className="flex min-h-touch cursor-pointer items-center justify-between gap-3 text-body-sm text-ink">
          <span>
            <span className="font-semibold">{copy.label}</span>
            <span className="text-ink-dim"> · {copy.help}</span>
          </span>
          <input
            type="checkbox"
            checked={checked}
            disabled={!story}
            aria-label={`${copy.label}: ${character.title}`}
            onChange={(event) => toggle.mutate(event.target.checked)}
            className="h-5 w-5 shrink-0 cursor-pointer accent-[color:var(--ps-primary)] disabled:cursor-not-allowed"
          />
        </label>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <span className="text-body-sm text-ink">
            <span className="font-semibold">{copy.label}</span>
            <span className="text-ink-dim"> · {copy.help}</span>
          </span>
          <Switch
            checked={checked}
            disabled={!story}
            aria-label={`${copy.label}: ${character.title}`}
            onCheckedChange={(next) => toggle.mutate(next)}
          />
        </div>
      )}
      <p aria-live="polite" className="text-[13px] text-ink-dim empty:hidden">
        {toggle.isError ? '' : status}
      </p>
      {toggle.isError ? (
        <p role="alert" className="text-[13px] text-error">
          {toggle.error instanceof ApiError ? toggle.error.message : copy.failure}
        </p>
      ) : null}
    </div>
  )
}

function DeleteControl({ character, onDeleted }: { character: Character; onDeleted: () => void }) {
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const wasConfirming = useRef(false)
  const promptId = `borrar-${character.id.replace(/[^a-z0-9]/gi, '')}`

  const remove = useMutation({
    mutationFn: () => deleteCustomStory(customStoryIdFrom(character.id) ?? character.id),
    onSuccess: async () => {
      await Promise.all(customStoryQueryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
      onDeleted()
    },
  })

  // Al abrir, el foco va a la opción segura; al cancelar, vuelve al botón que abrió.
  useEffect(() => {
    if (confirming) cancelRef.current?.focus()
    else if (wasConfirming.current) triggerRef.current?.focus()
    wasConfirming.current = confirming
  }, [confirming])

  if (!confirming) {
    return (
      <Button
        ref={triggerRef}
        variant="ghost"
        size="sm"
        className="w-full"
        onClick={() => setConfirming(true)}
        aria-label={`Borrar ${character.title}`}
      >
        Borrar
      </Button>
    )
  }

  return (
    <div
      role="group"
      aria-labelledby={promptId}
      className="space-y-2 rounded-xl border p-3"
      style={{ borderColor: 'var(--ps-line-strong)' }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !remove.isPending) setConfirming(false)
      }}
    >
      <p id={promptId} className="text-body-sm text-ink">
        ¿Borrar «{character.title}»? También se borrarán las partidas jugadas con esta historia.
      </p>
      {remove.isError ? (
        <p role="alert" className="text-body-sm text-error">
          {remove.error instanceof ApiError ? remove.error.message : 'No se pudo borrar la historia.'}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button
          ref={cancelRef}
          variant="outline"
          size="sm"
          className="flex-1"
          disabled={remove.isPending}
          onClick={() => setConfirming(false)}
        >
          Cancelar
        </Button>
        <Button
          variant="danger"
          size="sm"
          className="flex-1"
          disabled={remove.isPending}
          onClick={() => remove.mutate()}
        >
          {remove.isPending ? 'Borrando…' : 'Sí, borrar'}
        </Button>
      </div>
    </div>
  )
}

export function CharactersPage() {
  const characters = useQuery({ queryKey: ['characters'], queryFn: fetchCharacters })
  const stories = useQuery({ queryKey: ['stories'], queryFn: fetchStories })
  const customStories = useQuery({ queryKey: ['custom-stories'], queryFn: listCustomStories })
  const ownHeadingRef = useRef<HTMLHeadingElement>(null)

  const psique = characters.data?.filter((c) => c.origin !== 'propia') ?? []
  const own = characters.data?.filter((c) => c.origin === 'propia') ?? []

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
        <>
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

          <section aria-labelledby="historias-propias" className="space-y-3">
            <h2
              id="historias-propias"
              ref={ownHeadingRef}
              tabIndex={-1}
              className="font-serif text-headline-md text-ink outline-none"
            >
              Mis historias
            </h2>
            {own.length ? (
              <ul className={cardGridClassName}>
                {own.map((c) => (
                  <li key={c.id}>
                    <Card className="flex h-full flex-col gap-3 p-5">
                      {c.mode === 'concepto' ? (
                        <ConceptCard character={c} />
                      ) : (
                        <ProfileCard character={c} />
                      )}
                      <StoryToggle
                        field="isPublic"
                        character={c}
                        story={customStories.data?.find((s) => s.characterId === c.id)}
                      />
                      <StoryToggle
                        field="freeFirstRead"
                        character={c}
                        story={customStories.data?.find((s) => s.characterId === c.id)}
                      />
                      <StoryToggle
                        field="adult"
                        character={c}
                        story={customStories.data?.find((s) => s.characterId === c.id)}
                      />
                      <DeleteControl character={c} onDeleted={() => ownHeadingRef.current?.focus()} />
                    </Card>
                  </li>
                ))}
              </ul>
            ) : (
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
            )}
          </section>
        </>
      ) : null}

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
