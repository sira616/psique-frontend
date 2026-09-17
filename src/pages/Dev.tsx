import { useQuery } from '@tanstack/react-query'
import { Link, Navigate } from 'react-router-dom'
import { fetchStories } from '@/api/stories'
import { DevAccountPanel } from '@/features/dev/DevTools'
import { routes } from '@/router/paths'
import { Card } from '@/shared/ui/card'
import { useAuthStore } from '@/stores/authStore'

/** Herramientas de dev que no dependen de una partida, y atajos a las partidas en curso. */
export default function DevPage() {
  const isDev = useAuthStore((s) => Boolean(s.user?.isDev))
  const stories = useQuery({ queryKey: ['stories'], queryFn: fetchStories, enabled: isDev })

  if (!isDev) return <Navigate to={routes.characters} replace />

  const active = stories.data?.filter((s) => s.status !== 'archivada') ?? []

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="font-serif text-display text-ink">Dev</h1>
        <p className="mt-2 text-body-sm text-ink-dim">
          Herramientas internas. Fase, afinidad, capítulos y contexto están en el panel Dev de cada historia.
        </p>
      </header>

      <Card className="p-5">
        <h2 className="mb-3 font-serif text-headline-md text-ink">Tu cuenta</h2>
        <DevAccountPanel />
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 font-serif text-headline-md text-ink">Partidas</h2>
        {stories.isPending ? <p className="text-body-sm text-ink-dim">Cargando…</p> : null}
        {stories.data && !active.length ? <p className="text-body-sm text-ink-dim">No tienes partidas en curso.</p> : null}
        <ul className="flex flex-col gap-1">
          {active.map((story) => (
            <li key={story.id}>
              <Link
                to={story.status === 'cerrada' ? routes.storyArchive(story.id) : routes.story(story.id)}
                className="inline-flex min-h-touch items-center gap-2 text-body-sm font-semibold text-accent-text underline"
              >
                {story.characterName}
                <span className="font-normal text-ink-dim no-underline">
                  · {story.state.phaseLabel} · afinidad {story.state.affinity}
                  {story.status === 'cerrada' ? ' · cerrada' : ''}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
