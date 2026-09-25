import { useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  customStoryQueryKey,
  customStoryQueryKeys,
  deleteCustomStory,
  fetchCustomStory,
  type CustomStory,
} from '@/api/customStories'
import { formatBookDate } from '@/features/book/format'
import { DeleteStoryDialog } from '@/features/customStories/DeleteStoryDialog'
import { StoryBadges } from '@/features/customStories/StoryBadges'
import { StoryCover } from '@/features/customStories/StoryCover'
import { StoryCoverField } from '@/features/customStories/StoryCoverField'
import { StoryCharacterForm, StoryDetailsForm } from '@/features/customStories/StoryEditForm'
import { StoryStatsPanel } from '@/features/customStories/StoryStatsPanel'
import { StoryVisibilitySettings } from '@/features/customStories/StoryVisibilitySettings'
import { routes } from '@/router/paths'
import { ApiError } from '@/shared/lib/apiClient'
import { Button, ButtonLink } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import {
  Icon,
  IconBorrar,
  IconFecha,
  IconModoConcepto,
  IconNoEncontrada,
  IconVerComoLector,
  IconVolver,
} from '@/shared/ui/icons'

/** Sección con su encabezado: todo el detalle se lee como una lista de h2 bajo el título. */
function Section({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section aria-labelledby={`${id}-titulo`} className="scroll-mt-6" id={id}>
      <Card className="space-y-4 p-5 sm:p-6">
        <div className="space-y-1">
          <h2 id={`${id}-titulo`} className="font-serif text-headline-md text-ink">
            {title}
          </h2>
          {description ? <p className="max-w-[70ch] text-body-sm text-ink-dim">{description}</p> : null}
        </div>
        {children}
      </Card>
    </section>
  )
}

function VolverLink() {
  return (
    <Link
      to={routes.misHistorias}
      className="inline-flex min-h-touch items-center gap-1 text-body-sm font-semibold text-accent-text underline"
    >
      <Icon icon={IconVolver} size={16} />
      Volver a Mis historias
    </Link>
  )
}

function Header({ story }: { story: CustomStory }) {
  const creada = formatBookDate(story.createdAt)
  const publicada = formatBookDate(story.publishedAt)
  return (
    <Card className="p-5 sm:p-6 lg:p-8">
      <div className="grid gap-5 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-6 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-8">
        <StoryCover
          id={story.id}
          title={story.title}
          coverUrl={story.coverUrl}
          mode={story.mode}
          className="aspect-[16/9] w-full rounded-2xl shadow-[var(--ps-shadow-md)]"
        />
        <div className="min-w-0 space-y-3">
          <StoryBadges story={story} />
          <h1 className="font-serif text-display break-words text-ink">{story.title}</h1>
          <p className="max-w-[65ch] text-ink-dim">{story.hook}</p>
          {story.definition ? (
            <p className="text-body-sm font-semibold text-ink">
              con {story.definition.name}, {story.definition.age} años
            </p>
          ) : null}
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-faint">
            <span className="inline-flex items-center gap-1.5">
              <Icon icon={IconFecha} size={14} />
              Creada el {creada}
            </span>
            <span>{publicada ? `Publicada el ${publicada}` : 'Sin publicar todavía'}</span>
          </p>
          <div className="pt-1">
            <ButtonLink variant="outline" to={routes.book(story.characterId)}>
              <Icon icon={IconVerComoLector} size={16} />
              Ver como lectores
            </ButtonLink>
          </div>
        </div>
      </div>
    </Card>
  )
}

export function MyStoryDetailPage() {
  const { storyId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState('')
  const [borrando, setBorrando] = useState<CustomStory | null>(null)

  const story = useQuery({
    queryKey: customStoryQueryKey(storyId),
    queryFn: () => fetchCustomStory(storyId),
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 1,
  })

  const borrar = useMutation({
    mutationFn: (target: CustomStory) => deleteCustomStory(target.id),
    onSuccess: async () => {
      setBorrando(null)
      await Promise.all(customStoryQueryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
      navigate(routes.misHistorias, { replace: true })
    },
  })

  if (story.isPending) return <p className="text-ink-dim">Abriendo tu historia…</p>

  if (story.isError) {
    // El backend responde 404 tanto si no existe como si es de otra cuenta: no se distingue
    // desde aquí, y tampoco hace falta contarlo.
    const notFound = story.error instanceof ApiError && story.error.status === 404
    return (
      <Card className="mx-auto max-w-xl space-y-3 p-6 text-center">
        <span className="mx-auto block w-fit text-accent-text">
          <Icon icon={IconNoEncontrada} size={32} />
        </span>
        <h1 className="font-serif text-headline-lg text-ink">
          {notFound ? 'No encontramos esta historia' : 'No se pudo cargar la historia'}
        </h1>
        <p className="text-body-sm text-ink-dim">
          {notFound
            ? 'Puede que la hayas borrado, o que sea de otra cuenta: aquí solo se editan las tuyas.'
            : 'Inténtalo de nuevo en un momento.'}
        </p>
        <VolverLink />
      </Card>
    )
  }

  const data = story.data
  const esConcepto = data.mode === 'concepto'

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <VolverLink />
      <Header story={data} />

      <p role="status" aria-live="polite" className="text-body-sm text-ink-dim empty:hidden">
        {status}
      </p>

      <Section
        id="portada"
        title="Portada"
        description="Es lo primero que se ve en Explorar y en tu biblioteca."
      >
        <StoryCoverField
          story={data}
          onChanged={(updated) => {
            queryClient.setQueryData(customStoryQueryKey(updated.id), updated)
            for (const key of customStoryQueryKeys) void queryClient.invalidateQueries({ queryKey: key })
          }}
          onAnnounce={setStatus}
        />
      </Section>

      <Section
        id="historia"
        title="La historia"
        description="Título, gancho, descripción y tono: lo que se lee antes de empezar."
      >
        <StoryDetailsForm story={data} />
      </Section>

      {esConcepto ? (
        <Section
          id="personaje"
          title="El personaje"
          description="En modo concepto el personaje lo inventa Psique a partir de tu premisa y forma parte de lo que descubre quien lee, así que no se enseña ni se edita. La premisa tampoco se puede cambiar: el personaje ya se creó a partir de ella."
        >
          <div className="space-y-2">
            <h3 className="flex items-center gap-2 text-[11px] font-bold tracking-[0.12em] text-ink-faint uppercase">
              <Icon icon={IconModoConcepto} size={14} />
              La premisa que escribiste
            </h3>
            <p
              className="max-w-[65ch] rounded-[14px] border p-3 whitespace-pre-line text-ink"
              style={{ borderColor: 'var(--ps-line-strong)', background: 'var(--ps-surf-2)' }}
            >
              {data.premise ?? 'No se guardó ninguna premisa.'}
            </p>
          </div>
        </Section>
      ) : (
        <Section
          id="personaje"
          title="El personaje"
          description="Con quién se encuentra quien lee, y el mundo donde empieza."
        >
          <StoryCharacterForm story={data} />
        </Section>
      )}

      <Section
        id="visibilidad"
        title="Visibilidad y lectura"
        description="Se guardan al momento, uno a uno."
      >
        <StoryVisibilitySettings story={data} />
      </Section>

      <Section id="metricas" title="Cómo le está yendo">
        <StoryStatsPanel storyId={data.id} />
      </Section>

      <Section
        id="borrar"
        title="Borrar la historia"
        description="Si otras cuentas la están jugando, sus partidas siguen jugables; la historia sale de Explorar y desaparece de tus historias."
      >
        {borrar.isError && !borrando ? (
          <p role="alert" className="text-body-sm text-error">
            {borrar.error instanceof ApiError ? borrar.error.message : 'No se pudo borrar la historia.'}
          </p>
        ) : null}
        <Button variant="danger" onClick={() => setBorrando(data)}>
          <Icon icon={IconBorrar} size={16} />
          Borrar «{data.title}»
        </Button>
      </Section>

      <DeleteStoryDialog
        story={borrando}
        pending={borrar.isPending}
        error={borrar.error}
        onCancel={() => {
          borrar.reset()
          setBorrando(null)
        }}
        onConfirm={(target) => borrar.mutate(target)}
      />
    </div>
  )
}
