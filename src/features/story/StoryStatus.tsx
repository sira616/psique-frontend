import { Heart } from 'lucide-react'
import type { StoryState } from '@/shared/lib/events'
import { cn } from '@/shared/lib/utils'

const PHASES = ['Conocerse', 'Confianza', 'Tensión', 'Conflicto', 'Desenlace']

type StoryStatusProps = {
  state: StoryState
  /** `bar`: franja horizontal sobre el chat (móvil/tablet). `panel`: lista vertical para la barra lateral. */
  layout?: 'bar' | 'panel'
}

function AffinityMeter({ affinity, showLabel }: { affinity: number; showLabel: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      {showLabel ? (
        <p className="text-[11px] font-bold tracking-[0.12em] text-ink-faint uppercase" aria-hidden>
          Afinidad
        </p>
      ) : null}
      <div className="flex items-center gap-2">
        <Heart size={14} className="text-accent-text" aria-hidden />
        <div
          className="h-1.5 flex-1 overflow-hidden rounded-full"
          style={{ background: 'var(--ps-line-strong)' }}
          role="meter"
          aria-label="Afinidad"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={affinity}
        >
          <div
            className="ps-affinity-fill h-full rounded-full"
            style={{
              width: `${affinity}%`,
              background: 'linear-gradient(90deg, var(--ps-primary-deep), var(--ps-primary))',
            }}
          />
        </div>
        <span className="w-8 text-right text-[12px] tabular-nums text-ink-dim">{affinity}</span>
      </div>
    </div>
  )
}

/** Fase y afinidad. Solo muestra lo que calcula el backend; aquí no se decide nada. */
export function StoryStatus({ state, layout = 'bar' }: StoryStatusProps) {
  const affinity = Math.max(0, Math.min(100, state.affinity))

  if (layout === 'panel') {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-bold tracking-[0.12em] text-ink-faint uppercase" aria-hidden>
            Fase {state.phaseIndex + 1} de {state.phaseCount}
          </p>
          <ol className="flex flex-col gap-1" aria-label="Fases de la historia">
            {PHASES.map((label, i) => {
              const current = i === state.phaseIndex
              const done = i < state.phaseIndex
              return (
                <li
                  key={label}
                  aria-current={current ? 'step' : undefined}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-body-sm',
                    current ? 'font-bold text-gold' : 'text-ink-faint',
                  )}
                  style={current ? { background: 'var(--ps-surf-2)' } : undefined}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{
                      background: done || current ? 'var(--ps-primary)' : 'var(--ps-line-strong)',
                      opacity: done ? 0.6 : 1,
                    }}
                  />
                  {label}
                </li>
              )
            })}
          </ol>
        </div>
        <AffinityMeter affinity={affinity} showLabel />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 px-4 py-2.5">
      <p className="text-[12px] font-bold text-gold sm:hidden" aria-hidden>
        {state.phaseLabel} · {state.phaseIndex + 1}/{state.phaseCount}
      </p>
      <ol className="flex items-center gap-1" aria-label="Fases de la historia">
        {PHASES.map((label, i) => {
          const current = i === state.phaseIndex
          const done = i < state.phaseIndex
          return (
            <li
              key={label}
              aria-current={current ? 'step' : undefined}
              className="flex min-w-0 flex-1 flex-col gap-1"
            >
              <span
                className="h-1 rounded-full"
                style={{
                  background: done || current ? 'var(--ps-primary)' : 'var(--ps-line-strong)',
                  opacity: current ? 1 : done ? 0.6 : 1,
                }}
              />
              {/* En móvil no caben cinco etiquetas: se leen por lector y la actual va arriba. */}
              <span
                className={`truncate text-[11px] max-sm:sr-only ${current ? 'font-bold text-gold' : 'text-ink-faint'}`}
              >
                {label}
              </span>
            </li>
          )
        })}
      </ol>
      <AffinityMeter affinity={affinity} showLabel={false} />
    </div>
  )
}
