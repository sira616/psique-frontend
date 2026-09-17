import * as React from 'react'
import { cn } from '@/shared/lib/utils'

export function Card({
  className,
  style,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('relative overflow-hidden rounded-[20px] text-ink', className)}
      style={{
        background: 'linear-gradient(160deg, var(--ps-surf-2), var(--ps-surf-1))',
        border: '1px solid var(--ps-line)',
        boxShadow: 'var(--ps-shadow-md)',
        ...style,
      }}
      {...props}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent, var(--ps-sheen), transparent)',
        }}
        aria-hidden
      />
      {children}
    </div>
  )
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('relative flex flex-col gap-1.5 p-4', className)} {...props} />
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('text-headline-md font-bold leading-none tracking-tight', className)}
      {...props}
    />
  )
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-body-sm text-ink-dim', className)} {...props} />
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('relative p-4 pt-0', className)} {...props} />
}
