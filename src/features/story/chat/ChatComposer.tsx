import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { Send } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

const MAX_LEN = 2000

type ChatComposerProps = {
  onSend: (message: string) => void
  disabled?: boolean
  placeholder?: string
  className?: string
}

export function ChatComposer({
  onSend,
  disabled = false,
  placeholder = 'Escribe qué dices o haces…',
  className,
}: ChatComposerProps) {
  const [draft, setDraft] = useState('')

  function submit() {
    const text = draft.trim()
    if (!text || disabled) return
    onSend(text)
    setDraft('')
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    submit()
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <form className={cn('flex items-end gap-2.5 px-4 pb-3', className)} onSubmit={onSubmit}>
      <div
        className="flex min-h-[48px] flex-1 items-end rounded-[16px] border border-[color:var(--ps-line-strong)] px-3 py-1.5"
        style={{ background: 'var(--ps-surf-2)', boxShadow: 'var(--ps-shadow-md)' }}
      >
        <textarea
          aria-label="Mensaje"
          rows={1}
          maxLength={MAX_LEN}
          disabled={disabled}
          placeholder={placeholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          className="max-h-28 flex-1 resize-none bg-transparent py-2 text-[15px] text-ink placeholder:text-ink-faint focus:outline-none disabled:opacity-50"
          style={{ fontFamily: 'inherit' }}
        />
      </div>
      <button
        type="submit"
        aria-label="Enviar mensaje"
        disabled={disabled || !draft.trim()}
        className="ps-cta inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] text-on-primary disabled:opacity-50"
        style={{
          background: 'linear-gradient(145deg, var(--ps-primary), var(--ps-primary-deep))',
          boxShadow: 'var(--ps-shadow-glow)',
        }}
      >
        <Send size={18} aria-hidden />
      </button>
    </form>
  )
}
