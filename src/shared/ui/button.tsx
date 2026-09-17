import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Link, type LinkProps } from 'react-router-dom'
import { cn } from '@/shared/lib/utils'

const buttonVariants = cva(
  'inline-flex min-h-touch items-center justify-center gap-2 rounded-xl px-md text-body-sm font-semibold motion-safe:transition-colors motion-safe:duration-[180ms] motion-safe:ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ps-accent-text)] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-on-primary hover:bg-primary-deep',
        secondary: 'bg-surf-2 text-ink hover:bg-surf-3',
        outline:
          'border border-outline-variant bg-transparent text-ink hover:bg-surf-2',
        ghost: 'text-ink hover:bg-surf-2',
        danger: 'border border-[color:var(--ps-error)] text-error hover:bg-surf-2',
        brand: '',
      },
      size: {
        default: 'h-11 px-4 py-2',
        sm: 'h-9 min-h-0 rounded-lg px-3 text-xs',
        lg: 'h-12 rounded-2xl px-6 text-base',
        icon: 'h-10 w-10 min-h-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>

function variantStyle(variant: ButtonProps['variant'], style: React.CSSProperties | undefined) {
  return variant === 'brand'
    ? {
        color: 'var(--ps-on-primary)',
        background: 'linear-gradient(145deg, var(--ps-primary), var(--ps-primary-deep))',
        boxShadow: 'var(--ps-shadow-glow), inset 0 1px 0 var(--ps-inset-shine)',
        ...style,
      }
    : style
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = 'button', style, ...props }, ref) => {
    const brandStyle = variantStyle(variant, style)

    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          buttonVariants({ variant, size }),
          variant === 'brand' && 'ps-cta',
          className,
        )}
        style={brandStyle}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'

export type ButtonLinkProps = LinkProps & VariantProps<typeof buttonVariants>

/** Navegación con aspecto de botón: un enlace sigue siendo enlace para el lector de pantalla. */
export function ButtonLink({ className, variant, size, style, ...props }: ButtonLinkProps) {
  return (
    <Link
      className={cn(buttonVariants({ variant, size }), variant === 'brand' && 'ps-cta', className)}
      style={variantStyle(variant, style)}
      {...props}
    />
  )
}
