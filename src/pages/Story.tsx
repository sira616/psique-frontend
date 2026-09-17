import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Wrench } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { fetchUsage, LOW_TURNS_THRESHOLD, usageQueryKey } from '@/api/account'
import { activeRestriction } from '@/api/policy'
import { fetchStory } from '@/api/stories'
import { AdultConfirmDialog } from '@/features/policy/AdultConfirmDialog'
import { RedirectNotice, RestrictionNotice, StoryClosedNotice } from '@/features/policy/PolicyNotice'
import { ChapterLockNotice } from '@/features/story/ChapterLockNotice'
import { ChatComposer } from '@/features/story/chat/ChatComposer'
import { QuickActionBar } from '@/features/story/chat/QuickActionBar'
import { StoryStatus } from '@/features/story/StoryStatus'
import { StoryTranscript } from '@/features/story/StoryTranscript'
import { DailyLimitNotice, TurnsLeftHint } from '@/features/story/TurnLimitNotice'
import { useStoryStream } from '@/features/story/useStoryStream'
import { routes } from '@/router/paths'
import { useMediaQuery } from '@/shared/lib/useMediaQuery'
import { Button } from '@/shared/ui/button'
import { Dialog } from '@/shared/ui/Dialog'
import { useAuthStore } from '@/stores/authStore'

// Solo se descarga si la cuenta es dev: el resto no paga ese código en el bundle.
const DevStoryPanel = lazy(() => import('@/features/dev/DevTools'))

// Ancho de lectura de la conversación en escritorio.
const readingWidth = 'mx-auto w-full max-w-[70ch]'

export function StoryPage() {
  const { storyId = '' } = useParams()
  const story = useQuery({ queryKey: ['story', storyId], queryFn: () => fetchStory(storyId) })
  const stream = useStoryStream(storyId)
  const { seed } = stream
  const queryClient = useQueryClient()
  const sessionRestriction = useAuthStore((s) => s.user?.restrictedUntil)
  const isDev = useAuthStore((s) => Boolean(s.user?.isDev))
  const [devOpen, setDevOpen] = useState(false)
  const usage = useQuery({ queryKey: usageQueryKey, queryFn: fetchUsage })
  const endRef = useRef<HTMLDivElement | null>(null)
  // Con barra lateral cambia la estructura (dónde viven estado y sugerencias), no solo el estilo.
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  useEffect(() => {
    if (story.data) seed(story.data.messages, story.data.state)
  }, [story.data, seed])

  // Al cerrarse no se refresca la partida: eso llevaría al archivo y se perdería el aviso.
  const closedNow = Boolean(stream.closed)
  useEffect(() => {
    if (!closedNow) return
    void queryClient.invalidateQueries({ queryKey: ['stories'] })
    void queryClient.invalidateQueries({ queryKey: ['book'] })
  }, [closedNow, queryClient])

  // Cada turno terminado (o rechazado) cambia el cupo: se vuelve a pedir al acabar.
  const streaming = stream.streaming
  useEffect(() => {
    if (!streaming) void queryClient.invalidateQueries({ queryKey: usageQueryKey })
  }, [streaming, queryClient])

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

  if (story.data.status !== 'activa') return <Navigate to={routes.storyArchive(storyId)} replace />

  const name = story.data.characterName
  const state = stream.state ?? story.data.state
  const width = isDesktop ? readingWidth : ''
  // Con el capítulo bloqueado el servidor rechaza cualquier turno (409): no se ofrece escribir.
  const locked = Boolean(state.chapter_locked)
  const closed = stream.closed
  const restrictedUntil = activeRestriction(stream.restrictedUntil) ?? activeRestriction(sessionRestriction)
  // El cupo se da por renovado al pasar resetsAt, aunque la consulta aún no se haya refrescado.
  const limitResetsAt =
    stream.dailyLimit?.resetsAt ??
    (usage.data && !usage.data.unlimited && usage.data.turnsRemaining === 0 ? usage.data.resetsAt : null)
  const dailyLimitReached = Boolean(limitResetsAt) && Date.parse(limitResetsAt!) > Date.now()
  const turnsLeft =
    usage.data && !usage.data.unlimited && usage.data.turnsRemaining !== null ? usage.data.turnsRemaining : null
  const blocked = Boolean(closed) || Boolean(restrictedUntil) || dailyLimitReached
  const inputDisabled = stream.streaming || locked || blocked
  const placeholder = closed
    ? 'Esta partida está cerrada'
    : restrictedUntil
      ? 'Tu cuenta no puede continuar historias por ahora'
      : dailyLimitReached
        ? 'Límite de turnos de hoy alcanzado'
        : locked
        ? 'Desbloquea el capítulo para seguir'
        : undefined

  const quickActions = (
    <QuickActionBar
      choices={state.quickChoices}
      scene={state.scene}
      disabled={inputDisabled}
      layout={isDesktop ? 'stack' : 'scroll'}
      onChoose={(c) => void stream.send({ choiceId: c.id, message: c.message })}
    />
  )

  const conversation = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-[color:var(--ps-line)]" style={{ background: 'var(--ps-surf-1)' }}>
        <div className={`${width} flex items-center justify-between gap-2 px-4 pt-2.5 lg:py-3`}>
          <h1 className="min-w-0 font-serif text-headline-md break-words text-ink">{name}</h1>
          {isDev && !isDesktop ? (
            <Button size="sm" variant="outline" aria-haspopup="dialog" onClick={() => setDevOpen(true)}>
              <Wrench size={14} aria-hidden />
              Dev
            </Button>
          ) : null}
        </div>
        {isDesktop ? null : <StoryStatus state={state} />}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 lg:py-6" aria-live="polite" aria-busy={stream.streaming}>
        <StoryTranscript messages={stream.messages} characterName={name} className={width}>
          <div ref={endRef} />
        </StoryTranscript>
      </div>

      <div className={width}>
        {stream.transition && !locked && !blocked ? (
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

        {closed ? (
          <StoryClosedNotice
            role="alert"
            className="mx-4 mb-1"
            detail={closed.detail}
            restrictedUntil={activeRestriction(closed.restrictedUntil)}
          >
            <Link to={routes.storyArchive(storyId)} className="font-semibold text-accent-text underline">
              Ver en solo lectura
            </Link>{' '}
            ·{' '}
            <Link to={routes.book(story.data.characterId)} className="font-semibold text-accent-text underline">
              Volver al libro
            </Link>
          </StoryClosedNotice>
        ) : restrictedUntil ? (
          <RestrictionNotice
            role={stream.restrictedUntil ? 'alert' : 'status'}
            className="mx-4 mb-1"
            restrictedUntil={restrictedUntil}
          />
        ) : dailyLimitReached ? (
          <DailyLimitNotice role={stream.dailyLimit ? 'alert' : 'status'} className="mx-4 mb-1" resetsAt={limitResetsAt!} />
        ) : turnsLeft !== null && turnsLeft > 0 && turnsLeft <= LOW_TURNS_THRESHOLD ? (
          <TurnsLeftHint remaining={turnsLeft} />
        ) : null}

        {state.chapter_locked && !blocked ? (
          <ChapterLockNotice storyId={storyId} cost={state.chapter_cost ?? 0} onUnlocked={stream.applyState} />
        ) : null}

        {stream.redirectNotice && !blocked ? (
          <RedirectNotice className="mx-4 mb-1" detail={stream.redirectNotice} onDismiss={stream.dismissRedirect} />
        ) : null}

        {stream.error && !locked && !blocked ? (
          <p role="alert" className="mx-4 mb-1 text-body-sm text-error">
            {stream.error}
          </p>
        ) : null}
      </div>

      <div className={`${width} shrink-0 lg:pt-2 lg:pb-3`}>
        {isDesktop ? null : quickActions}
        <ChatComposer
          disabled={inputDisabled}
          placeholder={placeholder}
          restore={stream.restoredDraft}
          onSend={(message) => void stream.send({ message })}
        />
      </div>

      <AdultConfirmDialog
        open={Boolean(stream.adultPending)}
        onCancel={stream.cancelAdult}
        onConfirmed={() => {
          if (stream.adultPending) void stream.send(stream.adultPending)
        }}
      />
    </div>
  )

  const devPanel = isDev ? (
    <Suspense fallback={<p className="text-body-sm text-ink-dim">Cargando herramientas…</p>}>
      <DevStoryPanel
        storyId={storyId}
        state={state}
        closed={Boolean(closed)}
        onState={stream.applyState}
        onUnblocked={stream.clearBlocks}
      />
    </Suspense>
  ) : null

  if (!isDesktop) {
    return (
      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
        {conversation}
        {isDev ? (
          <Dialog open={devOpen} title="Herramientas de dev" onClose={() => setDevOpen(false)}>
            {devPanel}
          </Dialog>
        ) : null}
      </div>
    )
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
        {isDev ? (
          <section aria-labelledby="dev-titulo" className="flex flex-col gap-2">
            <h2 id="dev-titulo">
              <button
                type="button"
                aria-expanded={devOpen}
                aria-controls="dev-panel"
                onClick={() => setDevOpen((open) => !open)}
                className="inline-flex min-h-touch items-center gap-2 rounded-lg text-[11px] font-bold tracking-[0.12em] text-ink-faint uppercase hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ps-accent-text)]"
              >
                <Wrench size={14} aria-hidden />
                Herramientas de dev <span aria-hidden>{devOpen ? '▾' : '▸'}</span>
              </button>
            </h2>
            {devOpen ? <div id="dev-panel">{devPanel}</div> : null}
          </section>
        ) : null}
      </aside>
    </div>
  )
}
