import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

type ChatBubbleProps = {
  role: 'user' | 'assistant'
  children: ReactNode
  characterName?: string
  streaming?: boolean
  className?: string
}

function CharacterAvatar({ name }: { name: string }) {
  return (
    <span
      className="grid h-9 w-9 shrink-0 place-items-center self-end rounded-full font-serif text-[15px] font-bold text-on-primary"
      style={{
        background: 'linear-gradient(145deg, var(--ps-primary), var(--ps-primary-deep))',
        boxShadow: 'inset 0 1px 0 var(--ps-inset-shine)',
      }}
      aria-hidden
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  )
}

export function ChatBubble({
  role,
  children,
  characterName = '',
  streaming = false,
  className,
}: ChatBubbleProps) {
  if (role === 'user') {
    return (
      <div className={cn('flex w-full justify-end', className)}>
        <div
          className="max-w-[85%] whitespace-pre-wrap break-words rounded-[18px] rounded-br-[5px] px-[15px] py-[12px] text-[15px] leading-normal text-on-primary"
          style={{
            background: 'linear-gradient(160deg, var(--ps-primary), var(--ps-primary-deep))',
            boxShadow: 'var(--ps-shadow-glow)',
          }}
        >
          {children}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('grid w-full grid-cols-[36px_1fr] items-end gap-[11px]', className)}>
      <CharacterAvatar name={characterName} />
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="pl-0.5 text-xs font-bold text-ink-dim">{characterName}</span>
        <div
          className="relative max-w-[92%] rounded-[18px] rounded-bl-[5px] border border-[color:var(--ps-line)] px-[15px] py-[12px] text-[15px] leading-relaxed text-ink"
          style={{ background: 'var(--ps-surf-2)', boxShadow: 'var(--ps-shadow-md)' }}
          aria-busy={streaming || undefined}
        >
          {children}
          {streaming ? (
            <span className="ml-1 inline-block animate-pulse" aria-hidden>
              ▍
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}
