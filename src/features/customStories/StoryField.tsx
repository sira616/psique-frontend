import type { ChangeEvent } from 'react'
import { cn } from '@/shared/lib/utils'

type StoryFieldProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  hint?: string
  maxLength?: number
  multiline?: boolean
  rows?: number
  type?: 'text' | 'number' | 'url' | 'password'
  /** false: deja escribir de más y marca el contador; útil cuando pegar texto largo no debe recortarse en silencio. */
  enforceMaxLength?: boolean
  autoComplete?: string
  spellCheck?: boolean
  min?: number
  max?: number
  required?: boolean
  placeholder?: string
  className?: string
}

const controlClassName =
  'w-full rounded-[14px] border px-4 py-3 text-[14.5px] text-ink outline-none placeholder:text-ink-faint focus-visible:ring-2 focus-visible:ring-[color:var(--ps-accent-text)]'

/** Campo con etiqueta, pista, contador y error enlazados por aria-describedby. */
export function StoryField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  maxLength,
  multiline,
  rows = 3,
  type = 'text',
  enforceMaxLength = true,
  autoComplete,
  spellCheck,
  min,
  max,
  required,
  placeholder,
  className,
}: StoryFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  const shared = {
    id,
    name: id,
    value,
    required,
    placeholder,
    maxLength: enforceMaxLength ? maxLength : undefined,
    autoComplete,
    spellCheck,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
    className: cn(controlClassName, multiline && 'resize-y'),
    style: {
      background: 'linear-gradient(160deg, var(--ps-surf-2), var(--ps-surf-1))',
      borderColor: error ? 'var(--ps-error)' : 'var(--ps-line-strong)',
      fontFamily: 'inherit',
    },
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value),
  }

  return (
    <div className={cn('mb-4', className)}>
      <div className="mb-2 ml-0.5 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-[11px] font-bold tracking-[0.12em] text-ink-faint uppercase">
          {label}
        </label>
        {maxLength ? (
          <span
            className={cn('text-[12px] tabular-nums', value.length > maxLength ? 'font-bold text-error' : 'text-ink-faint')}
            aria-hidden
          >
            {value.length}/{maxLength}
          </span>
        ) : null}
      </div>
      {multiline ? (
        <textarea rows={rows} {...shared} />
      ) : (
        <input type={type} min={min} max={max} inputMode={type === 'number' ? 'numeric' : undefined} {...shared} />
      )}
      {hint ? (
        <p id={hintId} className="mt-1 ml-0.5 text-[12px] text-ink-faint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="mt-1 ml-0.5 text-[13px] text-error">
          {error}
        </p>
      ) : null}
    </div>
  )
}
