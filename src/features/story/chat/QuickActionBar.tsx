import { useId } from 'react'
import type { QuickChoice } from '@/shared/lib/events'
import { cn } from '@/shared/lib/utils'
import { Icon, IconSugerencia } from '@/shared/ui/icons'

type QuickActionBarProps = {
  choices: QuickChoice[]
  /** Escena en curso a la que responden las sugerencias. */
  scene?: string | null
  onChoose: (choice: QuickChoice) => void
  disabled?: boolean
  /** `scroll`: fila deslizable bajo el chat. `stack`: lista vertical para la barra lateral. */
  layout?: 'scroll' | 'stack'
  className?: string
}

/**
 * Sugerencias para la escena en curso. Vienen del backend, que valida lo que propone el LLM
 * y cae a las de la fase si no vale.
 */
export function QuickActionBar({
  choices,
  scene,
  onChoose,
  disabled = false,
  layout = 'scroll',
  className,
}: QuickActionBarProps) {
  const sceneId = useId()
  if (!choices.length) return null
  const scroll = layout === 'scroll'
  return (
    <div className={cn(scroll ? 'pt-2' : 'flex flex-col gap-2', className)}>
      {scene ? (
        <p
          id={sceneId}
          className={cn('text-body-sm text-ink-dim', scroll && 'truncate px-4')}
          title={scroll ? scene : undefined}
        >
          <span className="font-semibold">Escena:</span> {scene}
        </p>
      ) : null}
      <div
        className={cn(
          scroll
            ? 'flex gap-2 overflow-x-auto px-4 pt-1.5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
            : 'flex flex-col items-stretch gap-2',
        )}
        role="toolbar"
        aria-label="Sugerencias"
        aria-describedby={scene ? sceneId : undefined}
      >
        {choices.map((choice, i) => (
          <button
            key={choice.id}
            type="button"
            disabled={disabled}
            onClick={() => onChoose(choice)}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 px-3.5 text-[13px] font-semibold text-ink motion-safe:transition-transform motion-safe:duration-[180ms] active:scale-[0.97] disabled:opacity-50',
              // Apiladas, las etiquetas largas pueden partir línea en vez de salirse del panel.
              scroll ? 'h-9 rounded-full' : 'min-h-touch rounded-xl py-2 text-left',
            )}
            style={{ background: 'var(--ps-surf-1)', border: '1px solid var(--ps-line-strong)' }}
          >
            {i === 0 ? <Icon icon={IconSugerencia} size={14} className="text-accent-text" /> : null}
            {choice.label}
          </button>
        ))}
      </div>
    </div>
  )
}
