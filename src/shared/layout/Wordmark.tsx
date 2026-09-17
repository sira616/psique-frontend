import { cn } from '@/shared/lib/utils'

export function Wordmark({ size = 'sm', className }: { size?: 'sm' | 'hero'; className?: string }) {
  return (
    <span
      className={cn(
        'font-serif font-bold tracking-tight text-ink',
        size === 'hero' ? 'text-[40px] leading-none' : 'text-[22px] leading-none',
        className,
      )}
    >
      Psique<span className="text-accent-text">.</span>
    </span>
  )
}
