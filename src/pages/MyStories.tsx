import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import {
  customStoryQueryKeys,
  deleteCustomStory,
  listCustomStories,
  updateCustomStory,
  type CustomStory,
} from '@/api/customStories'
import { DeleteStoryDialog } from '@/features/customStories/DeleteStoryDialog'
import { MyStoryCard, myStoriesGridClassName } from '@/features/customStories/MyStoryCard'
import { routes } from '@/router/paths'
import { ApiError } from '@/shared/lib/apiClient'
import { cn } from '@/shared/lib/utils'
import { Button, ButtonLink } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Icon, IconCrearHistoria, IconMisHistorias } from '@/shared/ui/icons'

type Visibilidad = 'todas' | 'publicas' | 'privadas'
type Modo = 'todos' | 'definida' | 'concepto'

const VISIBILIDADES: { id: Visibilidad; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'publicas', label: 'Públicas' },
  { id: 'privadas', label: 'Privadas' },
]

const MODOS: { id: Modo; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'definida', label: 'Definida' },
  { id: 'concepto', label: 'Concepto' },
]

function countLabel(count: number) {
  return count === 1 ? '1 historia' : `${count} historias`
}

/** Sin acentos ni mayúsculas: buscar "cafe" tiene que encontrar «Café a medianoche». */
function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
}

/** Grupo de filtros: radios de verdad (flechas para cambiar) con aspecto de chip. */
function FilterGroup<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
}: {
  legend: string
  name: string
  options: { id: T; label: string }[]
  value: T
  onChange: (next: T) => void
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-[11px] font-bold tracking-[0.12em] text-ink-faint uppercase">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = value === option.id
          return (
            <label
              key={option.id}
              className={cn(
                'inline-flex min-h-touch cursor-pointer items-center rounded-full border px-4 text-body-sm font-semibold has-focus-visible:ring-2 has-focus-visible:ring-[color:var(--ps-accent-text)]',
                active ? 'bg-surf-3 text-ink' : 'text-ink-dim hover:bg-surf-2 hover:text-ink',
              )}
              style={{ borderColor: active ? 'var(--ps-accent-text)' : 'var(--ps-line-strong)' }}
            >
              <input
                type="radio"
                name={name}
                value={option.id}
                checked={active}
                onChange={() => onChange(option.id)}
                className="sr-only"
              />
              {option.label}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

export function MyStoriesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const stories = useQuery({ queryKey: ['custom-stories'], queryFn: listCustomStories })
  const [query, setQuery] = useState('')
  const [visibilidad, setVisibilidad] = useState<Visibilidad>('todas')
  const [modo, setModo] = useState<Modo>('todos')
  const [borrando, setBorrando] = useState<CustomStory | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  const all = stories.data ?? []
  const shown = useMemo(() => {
    const needle = normalize(query)
    return all.filter((story) => {
      if (needle && !normalize(story.title).includes(needle)) return false
      if (visibilidad === 'publicas' && !story.isPublic) return false
      if (visibilidad === 'privadas' && story.isPublic) return false
      if (modo !== 'todos' && story.mode !== modo) return false
      return true
    })
  }, [all, query, visibilidad, modo])

  const filtrando = Boolean(query.trim()) || visibilidad !== 'todas' || modo !== 'todos'

  /**
   * Optimista: la tarjeta cambia al instante y vuelve atrás si el servidor falla. Mismo patrón
   * que los interruptores de la pantalla de Historias.
   */
  const visibilidadMutation = useMutation({
    mutationFn: ({ story, isPublic }: { story: CustomStory; isPublic: boolean }) =>
      updateCustomStory(story.id, { isPublic }),
    onMutate: async ({ story, isPublic }) => {
      await queryClient.cancelQueries({ queryKey: ['custom-stories'] })
      const previous = queryClient.getQueryData<CustomStory[]>(['custom-stories'])
      queryClient.setQueryData<CustomStory[]>(['custom-stories'], (list) =>
        list?.map((s) => (s.id === story.id ? { ...s, isPublic } : s)),
      )
      return { previous }
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<CustomStory[]>(['custom-stories'], (list) =>
        list?.map((s) => (s.id === updated.id ? updated : s)),
      )
      for (const key of customStoryQueryKeys) void queryClient.invalidateQueries({ queryKey: key })
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(['custom-stories'], context.previous)
    },
  })

  const borrar = useMutation({
    mutationFn: (story: CustomStory) => deleteCustomStory(story.id),
    onSuccess: async () => {
      setBorrando(null)
      await Promise.all(customStoryQueryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
      // La tarjeta que tenía el foco ya no existe: el foco vuelve al título de la página.
      headingRef.current?.focus()
    },
  })

  const anuncio = stories.isSuccess
    ? shown.length
      ? `${countLabel(shown.length)} en pantalla.`
      : filtrando
        ? 'Ninguna historia cuadra con la búsqueda.'
        : 'Todavía no tienes historias.'
    : ''

  function limpiarFiltros() {
    setQuery('')
    setVisibilidad('todas')
    setModo('todos')
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-[70ch]">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="flex items-center gap-2 font-serif text-display text-ink outline-none"
          >
            <Icon icon={IconMisHistorias} size={28} className="text-accent-text" />
            Mis historias
          </h1>
          <p className="mt-2 text-body-sm text-ink-dim">
            Las historias que has creado. Abre una para editarla, ponerle portada o ver cómo le está yendo.
          </p>
        </div>
        <ButtonLink variant="brand" to={routes.nuevaHistoria}>
          <Icon icon={IconCrearHistoria} size={16} />
          Crear historia
        </ButtonLink>
      </header>

      {stories.isPending ? <p className="text-ink-dim">Cargando tus historias…</p> : null}

      {stories.isError ? (
        <Card className="space-y-3 p-5">
          <p role="alert" className="text-body-sm text-error">
            No se pudieron cargar tus historias.
          </p>
          <Button variant="outline" onClick={() => void stories.refetch()}>
            Reintentar
          </Button>
        </Card>
      ) : null}

      {stories.isSuccess && all.length ? (
        <>
          <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
            <div className="min-w-0 grow sm:max-w-sm">
              <label
                htmlFor="buscar-historia"
                className="mb-2 block text-[11px] font-bold tracking-[0.12em] text-ink-faint uppercase"
              >
                Buscar por título
              </label>
              <input
                id="buscar-historia"
                type="search"
                value={query}
                autoComplete="off"
                placeholder="Café, faro…"
                onChange={(event) => setQuery(event.target.value)}
                className="min-h-touch w-full rounded-[14px] border px-4 py-3 text-[14.5px] text-ink outline-none placeholder:text-ink-faint focus-visible:ring-2 focus-visible:ring-[color:var(--ps-accent-text)]"
                style={{
                  background: 'linear-gradient(160deg, var(--ps-surf-2), var(--ps-surf-1))',
                  borderColor: 'var(--ps-line-strong)',
                }}
              />
            </div>
            <FilterGroup
              legend="Visibilidad"
              name="mis-historias-visibilidad"
              options={VISIBILIDADES}
              value={visibilidad}
              onChange={setVisibilidad}
            />
            <FilterGroup
              legend="Tipo de historia"
              name="mis-historias-modo"
              options={MODOS}
              value={modo}
              onChange={setModo}
            />
          </div>

          <p role="status" aria-live="polite" className="text-body-sm text-ink-dim empty:hidden">
            {anuncio}
          </p>

          {visibilidadMutation.isError ? (
            <p role="alert" className="text-body-sm text-error">
              {visibilidadMutation.error instanceof ApiError
                ? visibilidadMutation.error.message
                : 'No se pudo cambiar la visibilidad.'}
            </p>
          ) : null}
        </>
      ) : null}

      {stories.isSuccess && !all.length ? (
        <Card className="space-y-2 p-5">
          <p className="text-body-sm text-ink-dim">
            Todavía no has creado ninguna historia. Describe a tu personaje o lanza una idea y deja que
            Psique la imagine.
          </p>
          <Link to={routes.nuevaHistoria} className="text-body-sm font-semibold text-accent-text underline">
            Crear mi primera historia
          </Link>
        </Card>
      ) : null}

      {stories.isSuccess && all.length && !shown.length ? (
        <Card className="space-y-2 p-5">
          <p className="text-body-sm text-ink-dim">
            Tienes {countLabel(all.length)}, pero ninguna cuadra con lo que has pedido.
          </p>
          <Button variant="outline" size="sm" onClick={limpiarFiltros}>
            Quitar filtros
          </Button>
        </Card>
      ) : null}

      {shown.length ? (
        <section aria-label="Historias propias">
          <ul className={myStoriesGridClassName}>
            {shown.map((story) => (
              <li key={story.id}>
                <MyStoryCard
                  story={story}
                  headingLevel="h2"
                  busy={borrar.isPending && borrando?.id === story.id}
                  onEditar={(s) => navigate(routes.misHistoriaDetalle(s.id))}
                  onPortada={(s) => navigate(`${routes.misHistoriaDetalle(s.id)}#portada`)}
                  onVisibilidad={(s, isPublic) => visibilidadMutation.mutate({ story: s, isPublic })}
                  onBorrar={setBorrando}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <DeleteStoryDialog
        story={borrando}
        pending={borrar.isPending}
        error={borrar.error}
        onCancel={() => {
          borrar.reset()
          setBorrando(null)
        }}
        onConfirm={(story) => borrar.mutate(story)}
      />
    </div>
  )
}
