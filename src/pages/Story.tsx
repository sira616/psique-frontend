import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, Navigate, useParams } from 'react-router-dom'
import { fetchStory } from '@/api/stories'
import { ChapterLockNotice } from '@/features/story/ChapterLockNotice'
import { ChatComposer } from '@/features/story/chat/ChatComposer'
import { QuickActionBar } from '@/features/story/chat/QuickActionBar'
import { StoryStatus } from '@/features/story/StoryStatus'
import { StoryTranscript } from '@/features/story/StoryTranscript'
import { useStoryStream } from '@/features/story/useStoryStream'
import { routes } from '@/router/paths'
import { useMediaQuery } from '@/shared/lib/useMediaQuery'

// Ancho de lectura de la conversación en escritorio.
const readingWidth = 'mx-auto w-full max-w-[70ch]'

export function StoryPage() {
  const { storyId = '' } = useParams()
  const story = useQuery({ queryKey: ['story', storyId], queryFn: () => fetchStory(storyId) })
  const stream = useStoryStream(storyId)
  const { seed } = stream
  const endRef = useRef<HTMLDivElement | null>(null)
  // Con barra lateral cambia la estructura (dónde viven estado y sugerencias), no solo el estilo.
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  useEffect(() => {
    if (story.data) seed(story.data.messages, story.data.state)
  }, [story.data, seed])

  const lastContent = stream.messages.at(-1)?.content
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [stream.messages.length, lastContent])

  if (story.isLoading) return <p className="p-md text-ink-dim">Abriendo la historia…</p>
  if (story.isError || !story.data) {
    return (
      <div className="space-y-3 p-md">
        <p role="alert" className="text-error">
          No se encontró esta historia.
        </p>
        <Link to={routes.characters} className="text-accent-text underline">
          Volver a los personajes
        </Link>
      </div>
    )
  }

  if (story.data.status === 'archivada') return <Navigate to={routes.storyArchive(storyId)} replace />

  const name = story.data.characterName
  const state = stream.state ?? story.data.state
  const width = isDesktop ? readingWidth : ''
  // Con el capítulo bloqueado el servidor rechaza cualquier turno (409): no se ofrece escribir.
  const locked = Boolean(state.chapter_locked)
  const inputDisabled = stream.streaming || locked

  const quickActions = (
    <QuickActionBar
      choices={state.quickChoices}
      disabled={inputDisabled}
      layout={isDesktop ? 'stack' : 'scroll'}
      onChoose={(c) => void stream.send({ choiceId: c.id, label: c.label })}
    />
  )

  const conversation = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-[color:var(--ps-line)]" style={{ background: 'var(--ps-surf-1)' }}>
        <h1 className={`${width} px-4 pt-2.5 font-serif text-headline-md text-ink lg:py-3`}>{name}</h1>
        {isDesktop ? null : <StoryStatus state={state} />}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 lg:py-6" aria-live="polite" aria-busy={stream.streaming}>
        <StoryTranscript messages={stream.messages} characterName={name} className={width}>
          <div ref={endRef} />
        </StoryTranscript>
      </div>

      <div className={width}>
        {stream.transition && !locked ? (
          <div
            role="status"
            className="ps-phase-toast mx-4 mb-1 flex items-start justify-between gap-3 rounded-xl px-3.5 py-2.5 text-body-sm"
            style={{ background: 'var(--ps-surf-2)', border: '1px solid var(--ps-line-strong)' }}
          >
            <span>
              <strong className="text-gold">Nueva fase: {state.phaseLabel}.</strong>{' '}
              <span className="text-ink-dim">{stream.transition.reason}</span>
            </span>
            <button type="button" className="text-ink-faint underline" onClick={stream.dismissTransition}>
              Cerrar
            </button>
          </div>
        ) : null}

        {state.chapter_locked ? (
          <ChapterLockNotice storyId={storyId} cost={state.chapter_cost ?? 0} onUnlocked={stream.applyState} />
        ) : null}

        {stream.error && !locked ? (
          <p role="alert" className="mx-4 mb-1 text-body-sm text-error">
            {stream.error}
          </p>
        ) : null}
      </div>

      <div className={`${width} shrink-0 lg:pt-2 lg:pb-3`}>
        {isDesktop ? null : quickActions}
        <ChatComposer
          disabled={inputDisabled}
          placeholder={locked ? 'Desbloquea el capítulo para seguir' : undefined}
          onSend={(message) => void stream.send({ message })}
        />
      </div>
    </div>
  )

  if (!isDesktop) {
    return <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">{conversation}</div>
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
      {conversation}
      <aside
        aria-label="Estado de la historia"
        className="flex min-h-0 flex-col gap-6 overflow-y-auto border-l border-[color:var(--ps-line)] p-6"
        style={{ background: 'var(--ps-surf-1)' }}
      >
        <StoryStatus state={state} layout="panel" />
        {state.quickChoices.length ? (
          <section aria-labelledby="sugerencias-titulo" className="flex flex-col gap-2">
            <h2 id="sugerencias-titulo" className="text-[11px] font-bold tracking-[0.12em] text-ink-faint uppercase">
              Sugerencias
            </h2>
            {quickActions}
          </section>
        ) : null}
      </aside>
    </div>
  )
}
