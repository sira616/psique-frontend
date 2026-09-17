import { Sparkles } from 'lucide-react'
import type { QuickChoice } from '@/shared/lib/events'
import { cn } from '@/shared/lib/utils'

type QuickActionBarProps = {
  choices: QuickChoice[]
  onChoose: (choice: QuickChoice) => void
  disabled?: boolean
  /** `scroll`: fila deslizable bajo el chat. `stack`: lista vertical para la barra lateral. */
  layout?: 'scroll' | 'stack'
  className?: string
}

/** Sugerencias de la fase actual. Vienen del backend (reglas por fase), no del LLM. */
export function QuickActionBar({ choices, onChoose, disabled = false, layout = 'scroll', className }: QuickActionBarProps) {
  if (!choices.length) return null
  return (
    <div
      className={cn(
        layout === 'scroll'
          ? 'flex gap-2 overflow-x-auto px-4 pt-2 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
          : 'flex flex-col items-stretch gap-2',
        className,
      )}
      role="toolbar"
      aria-label="Sugerencias"
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
            layout === 'scroll' ? 'h-9 rounded-full' : 'min-h-touch rounded-xl py-2 text-left',
          )}
          style={{ background: 'var(--ps-surf-1)', border: '1px solid var(--ps-line-strong)' }}
        >
          {i === 0 ? <Sparkles size={14} className="text-accent-text" aria-hidden /> : null}
          {choice.label}
        </button>
      ))}
    </div>
  )
}
