import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

type IconButtonProps = {
  children: ReactNode
  label: string
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'>

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { children, label, className, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      className={cn(
        'grid h-[38px] w-[38px] place-items-center rounded-[11px] text-ink-dim motion-safe:transition-colors motion-safe:duration-[180ms] motion-safe:ease-out',
        'hover:text-ink',
        className,
      )}
      style={{
        background: 'var(--ps-surf-1)',
        border: '1px solid var(--ps-line)',
      }}
      {...props}
    >
      {children}
    </button>
  )
})
