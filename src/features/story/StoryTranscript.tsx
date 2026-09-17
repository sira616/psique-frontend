import type { ReactNode } from 'react'
import { ChatBubble } from '@/features/story/chat/ChatBubble'
import { MarkdownStream } from '@/features/story/MarkdownStream'
import type { StreamMessage } from '@/features/story/useStoryStream'
import { cn } from '@/shared/lib/utils'

type StoryTranscriptProps = {
  messages: StreamMessage[]
  characterName: string
  className?: string
  /** Hueco al final (p. ej. el ancla de scroll de la partida en curso). */
  children?: ReactNode
}

/** Conversación de una partida. La comparten la partida en curso y el archivo de solo lectura. */
export function StoryTranscript({ messages, characterName, className, children }: StoryTranscriptProps) {
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {messages.map((m) => (
        <ChatBubble key={m.id} role={m.role} characterName={characterName} streaming={m.streaming}>
          {m.role === 'assistant' ? <MarkdownStream content={m.content} /> : m.content}
          {m.ephemeral ? (
            <span className="mt-1.5 block text-[12px] text-ink-faint">Este momento no queda guardado en la historia.</span>
          ) : null}
        </ChatBubble>
      ))}
      {children}
    </div>
  )
}
