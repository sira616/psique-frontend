import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/shared/lib/utils'

type SwitchProps = {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'role' | 'aria-checked'>

/**
 * Interruptor accesible (role="switch"). El nombre llega por `aria-label` o `aria-labelledby`.
 * Apagado se dibuja con borde en ink-faint para superar 3:1 contra la tarjeta.
 */
export function Switch({ checked, onCheckedChange, className, disabled, ...props }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        // El área táctil es de 44 px aunque el dibujo sea más pequeño.
        'group relative inline-flex h-touch w-14 shrink-0 items-center justify-center rounded-full focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          'relative h-6 w-11 rounded-full border-2 motion-safe:transition-colors motion-safe:duration-[180ms] group-focus-visible:ring-2 group-focus-visible:ring-[color:var(--ps-accent-text)] group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-[color:var(--ps-surf-1)]',
        )}
        style={{
          background: checked ? 'var(--ps-primary)' : 'transparent',
          borderColor: checked ? 'var(--ps-primary)' : 'var(--ps-ink-faint)',
        }}
      >
        <span
          className={cn(
            'absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full motion-safe:transition-[left] motion-safe:duration-[180ms]',
            checked ? 'left-[calc(100%-18px)]' : 'left-0.5',
          )}
          style={{ background: checked ? 'var(--ps-on-primary)' : 'var(--ps-ink-faint)' }}
        />
      </span>
    </button>
  )
}
