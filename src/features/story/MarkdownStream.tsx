import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'

/** Texto del personaje: *acciones en cursiva* y párrafos. Saneado: sale de un LLM. */
export function MarkdownStream({ content }: { content: string }) {
  if (!content) return null
  return (
    <div className="space-y-2 [&_em]:text-ink-dim">
      <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{content}</ReactMarkdown>
    </div>
  )
}
