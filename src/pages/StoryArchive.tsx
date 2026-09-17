import { useQuery } from '@tanstack/react-query'
import { Archive, ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { fetchStory } from '@/api/stories'
import { formatBookDate } from '@/features/book/format'
import { StoryStatus } from '@/features/story/StoryStatus'
import { StoryTranscript } from '@/features/story/StoryTranscript'
import { routes } from '@/router/paths'
import { Card } from '@/shared/ui/card'

/** Partida de solo lectura: mensajes y estado final, sin compositor ni sugerencias. */
export function StoryArchivePage() {
  const { storyId = '' } = useParams()
  const story = useQuery({ queryKey: ['story', storyId], queryFn: () => fetchStory(storyId) })

  if (story.isLoading) return <p className="text-ink-dim">Abriendo el archivo…</p>
  if (story.isError || !story.data) {
    return (
      <div className="space-y-3">
        <p role="alert" className="text-error">
          No se encontró esta historia.
        </p>
        <Link to={routes.characters} className="text-accent-text underline">
          Volver a las historias
        </Link>
      </div>
    )
  }

  const data = story.data
  const archived = data.status === 'archivada'

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header className="space-y-2">
        <Link
          to={routes.book(data.characterId)}
          className="inline-flex min-h-touch items-center gap-1 text-body-sm font-semibold text-accent-text underline"
        >
          <ArrowLeft size={16} aria-hidden />
          Volver al libro
        </Link>
        <h1 className="font-serif text-display break-words text-ink">{data.characterName}</h1>
        <p className="flex flex-wrap items-center gap-x-2 text-body-sm text-ink-dim">
          <Archive size={16} aria-hidden className="text-gold" />
          {archived
            ? `Lectura archivada${data.archivedAt ? ` el ${formatBookDate(data.archivedAt)}` : ''}. Solo lectura.`
            : 'Esta partida sigue en curso.'}
          {archived ? null : (
            <Link to={routes.story(data.id)} className="font-semibold text-accent-text underline">
              Continuar
            </Link>
          )}
        </p>
      </header>

      <Card className="p-4 sm:p-5">
        <h2 className="sr-only">Estado final</h2>
        <StoryStatus state={data.state} layout="panel" />
      </Card>

      <section aria-labelledby="archivo-conversacion">
        <h2 id="archivo-conversacion" className="sr-only">
          Conversación
        </h2>
        <StoryTranscript messages={data.messages} characterName={data.characterName} />
      </section>
    </div>
  )
}
