import { useId, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  adjustAffinity,
  fetchDevContext,
  forcePhase,
  grantObolos,
  liftRestriction,
  reopenStory,
  unlockChapterFree,
  type DevContext,
} from '@/api/dev'
import { walletQueryKey } from '@/features/economy/useWallet'
import { MONEDA } from '@/shared/economy/moneda'
import { ApiError } from '@/shared/lib/apiClient'
import type { PhaseId, StateEventData, StoryState } from '@/shared/lib/events'
import { Button } from '@/shared/ui/button'
import { Dialog } from '@/shared/ui/Dialog'
import { useAuthStore } from '@/stores/authStore'

/**
 * Herramientas de desarrollo. Este módulo solo se descarga para cuentas `isDev` (se importa con
 * `lazy()`), así el bundle de las demás no lo lleva.
 */

const PHASE_OPTIONS: { id: PhaseId; label: string }[] = [
  { id: 'conocerse', label: 'Conocerse' },
  { id: 'confianza', label: 'Confianza' },
  { id: 'tension', label: 'Tensión' },
  { id: 'conflicto', label: 'Conflicto' },
  { id: 'desenlace', label: 'Desenlace' },
]

const inputClassName =
  'h-9 w-full min-w-0 rounded-lg border border-[color:var(--ps-line-strong)] bg-surf-1 px-2.5 text-body-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ps-accent-text)]'
const labelClassName = 'text-[11px] font-bold tracking-[0.12em] text-ink-faint uppercase'

type Runner = (label: string, action: () => Promise<unknown>) => Promise<void>

/** Una acción a la vez, con el resultado anunciado en una región viva. */
function useRunner() {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)
  const run: Runner = async (label, action) => {
    setBusy(true)
    setMessage(null)
    try {
      await action()
      setMessage({ text: `${label}: hecho.`, error: false })
    } catch (error) {
      setMessage({ text: `${label}: ${error instanceof ApiError ? error.message : 'falló.'}`, error: true })
    } finally {
      setBusy(false)
    }
  }
  return { busy, message, run }
}

function Result({ message }: { message: { text: string; error: boolean } | null }) {
  return (
    <p role="status" aria-live="polite" className={message?.error ? 'text-body-sm text-error' : 'text-body-sm text-ink-dim'}>
      {message?.text ?? ''}
    </p>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-2 border-t border-[color:var(--ps-line)] pt-3">
      <legend className={labelClassName}>{title}</legend>
      {children}
    </fieldset>
  )
}

/** Óbolos y restricción: valen fuera de una partida (página Dev) y dentro (panel de la historia). */
export function DevAccountTools({ onRestrictionLifted, run, busy }: { onRestrictionLifted?: () => void; run: Runner; busy: boolean }) {
  const queryClient = useQueryClient()
  const patchUser = useAuthStore((s) => s.patchUser)
  const [amount, setAmount] = useState('10')
  const amountId = useId()
  const parsed = Number(amount)
  const validAmount = Number.isInteger(parsed) && parsed >= 1 && parsed <= 1000

  return (
    <>
      <Group title={`Dar ${MONEDA.plural}`}>
        <div className="flex items-end gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <label htmlFor={amountId} className="text-body-sm text-ink-dim">
              Cantidad (1-1000)
            </label>
            <input
              id={amountId}
              type="number"
              min={1}
              max={1000}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className={inputClassName}
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={busy || !validAmount}
            onClick={() =>
              void run(`Dar ${MONEDA.plural}`, async () => {
                const wallet = await grantObolos(parsed)
                queryClient.setQueryData(walletQueryKey, wallet)
              })
            }
          >
            Dar
          </Button>
        </div>
      </Group>
      <Group title="Cuenta">
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() =>
            void run('Levantar restricción', async () => {
              const user = await liftRestriction()
              patchUser({ restrictedUntil: user.restrictedUntil })
              onRestrictionLifted?.()
            })
          }
        >
          Levantar restricción
        </Button>
      </Group>
    </>
  )
}

function ContextViewer({ context }: { context: DevContext }) {
  const blocks: [string, string][] = [
    ['Estado', `fase ${context.phase} · pendiente ${context.pendingPhase ?? '—'} · afinidad ${context.affinity} · turnos ${context.turnCount} · ${context.status}`],
    ['System prompt', context.systemPrompt ?? '(sin perfil)'],
    ['Ventana', context.window.map((m) => `[${m.role}] ${m.content}`).join('\n\n') || '(vacía)'],
    ['Resumen', context.summary || '(sin resumen)'],
    ['Escena', context.sceneTitle ?? '(sin escena)'],
    ['Sugerencias', JSON.stringify(context.suggestions, null, 2)],
  ]
  return (
    <div className="flex max-h-[65dvh] flex-col gap-4 overflow-y-auto">
      {blocks.map(([title, text]) => (
        <section key={title} className="flex flex-col gap-1">
          <h3 className={labelClassName}>{title}</h3>
          {/* Enfocable: con teclado también se desplaza un bloque largo. */}
          <pre
            tabIndex={0}
            className="max-h-72 overflow-auto rounded-lg border border-[color:var(--ps-line)] bg-surf-1 p-3 text-[12px] leading-relaxed whitespace-pre-wrap text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ps-accent-text)]"
          >
            {text}
          </pre>
        </section>
      ))}
    </div>
  )
}

type DevStoryPanelProps = {
  storyId: string
  state: StoryState
  closed: boolean
  /** Estado nuevo que devuelve el backend, para pintarlo sin esperar a recargar la partida. */
  onState: (state: StoryState) => void
  /** Partida reabierta o restricción levantada: olvidar los bloqueos recibidos al enviar. */
  onUnblocked: () => void
}

function stripEvent({ transition: _transition, signals: _signals, ...state }: StateEventData): StoryState {
  return state
}

export default function DevStoryPanel({ storyId, state, closed, onState, onUnblocked }: DevStoryPanelProps) {
  const queryClient = useQueryClient()
  const { busy, message, run } = useRunner()
  const [phase, setPhase] = useState<PhaseId>(state.phase)
  const [affinity, setAffinity] = useState(String(state.affinity))
  const [context, setContext] = useState<DevContext | null>(null)
  const phaseId = useId()
  const affinityId = useId()
  const affinityValue = Number(affinity)
  const validAffinity = affinity !== '' && Number.isInteger(affinityValue) && affinityValue >= 0 && affinityValue <= 100

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ['story', storyId] })
    void queryClient.invalidateQueries({ queryKey: walletQueryKey })
  }

  const applyStateAction = (label: string, action: () => Promise<StateEventData>) =>
    run(label, async () => {
      const next = stripEvent(await action())
      onState(next)
      setAffinity(String(next.affinity))
      refresh()
    })

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <Group title="Fase">
        <label htmlFor={phaseId} className="text-body-sm text-ink-dim">
          Fase destino
        </label>
        <div className="flex gap-2">
          <select
            id={phaseId}
            value={phase}
            onChange={(event) => setPhase(event.target.value as PhaseId)}
            className={inputClassName}
          >
            {PHASE_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void applyStateAction('Forzar fase', () => forcePhase(storyId, phase))}>
            Forzar
          </Button>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !state.chapter_locked}
          onClick={() => void applyStateAction('Desbloquear capítulo', () => unlockChapterFree(storyId))}
        >
          Desbloquear capítulo gratis
        </Button>
      </Group>

      <Group title={`Afinidad (ahora ${state.affinity})`}>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            aria-label="Restar 5 de afinidad"
            disabled={busy}
            onClick={() => void applyStateAction('Restar afinidad', () => adjustAffinity(storyId, { delta: -5 }))}
          >
            −5
          </Button>
          <Button
            size="sm"
            variant="outline"
            aria-label="Sumar 5 de afinidad"
            disabled={busy}
            onClick={() => void applyStateAction('Sumar afinidad', () => adjustAffinity(storyId, { delta: 5 }))}
          >
            +5
          </Button>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <label htmlFor={affinityId} className="text-body-sm text-ink-dim">
              Fijar afinidad (0-100)
            </label>
            <input
              id={affinityId}
              type="number"
              min={0}
              max={100}
              value={affinity}
              onChange={(event) => setAffinity(event.target.value)}
              className={inputClassName}
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={busy || !validAffinity}
            onClick={() => void applyStateAction('Fijar afinidad', () => adjustAffinity(storyId, { value: affinityValue }))}
          >
            Fijar
          </Button>
        </div>
      </Group>

      <Group title="Partida">
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !closed}
          onClick={() =>
            void run('Reabrir partida', async () => {
              await reopenStory(storyId)
              onUnblocked()
              refresh()
              void queryClient.invalidateQueries({ queryKey: ['stories'] })
            })
          }
        >
          Reabrir partida cerrada
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => void run('Ver contexto', async () => setContext(await fetchDevContext(storyId)))}
        >
          Ver contexto
        </Button>
      </Group>

      <DevAccountTools run={run} busy={busy} onRestrictionLifted={onUnblocked} />
      <Result message={message} />

      <Dialog open={Boolean(context)} title="Contexto del modelo" onClose={() => setContext(null)} className="max-w-3xl">
        {context ? <ContextViewer context={context} /> : null}
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => setContext(null)}>
            Cerrar
          </Button>
        </div>
      </Dialog>
    </div>
  )
}

/** Página Dev: lo que no depende de una partida. */
export function DevAccountPanel() {
  const { busy, message, run } = useRunner()
  return (
    <div className="flex flex-col gap-3">
      <DevAccountTools run={run} busy={busy} />
      <Result message={message} />
    </div>
  )
}

/** En el archivo de una partida cerrada: reabrirla y volver al chat. */
export function DevReopenButton({ storyId, onReopened }: { storyId: string; onReopened: () => void }) {
  const queryClient = useQueryClient()
  const { busy, message, run } = useRunner()
  return (
    <div className="flex flex-col gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() =>
          void run('Reabrir partida', async () => {
            await reopenStory(storyId)
            await queryClient.invalidateQueries({ queryKey: ['story', storyId] })
            void queryClient.invalidateQueries({ queryKey: ['stories'] })
            onReopened()
          })
        }
      >
        Reabrir partida (dev)
      </Button>
      <Result message={message} />
    </div>
  )
}
