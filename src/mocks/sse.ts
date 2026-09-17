import type { StoryStreamEvent } from '@/shared/lib/events'

function encodeSse(event: StoryStreamEvent): Uint8Array {
  return new TextEncoder().encode(`event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`)
}

export function chunkText(text: string, size: number): string[] {
  const chunks: string[] = []
  for (let i = 0; i < text.length; i += size) chunks.push(text.slice(i, i + size))
  return chunks
}

/** Stream SSE con el mismo formato que el backend: token… → state → done. */
export function createStorySseStream(
  events: StoryStreamEvent[],
  delayMs = 30,
): ReadableStream<Uint8Array> {
  return new ReadableStream({
    async start(controller) {
      for (const event of events) {
        controller.enqueue(encodeSse(event))
        if (delayMs) await new Promise((r) => setTimeout(r, delayMs))
      }
      controller.close()
    },
  })
}
