import { useCallback, useRef, useState } from 'react'
import {
  parseSseBuffer,
  type PhaseTransition,
  type StoryMessage,
  type StoryState,
} from '@/shared/lib/events'
import { refreshSession } from '@/shared/lib/apiClient'
import { useAuthStore } from '@/stores/authStore'

export type StreamMessage = StoryMessage & { streaming?: boolean }

export type SendInput = { message: string } | { choiceId: string; label: string }

type UseStoryStreamResult = {
  messages: StreamMessage[]
  state: StoryState | null
  transition: PhaseTransition | null
  streaming: boolean
  error: string | null
  send: (input: SendInput) => Promise<void>
  seed: (messages: StoryMessage[], state: StoryState) => void
  dismissTransition: () => void
  /** Estado que llega fuera del chat (p. ej. al desbloquear capítulo) sin tocar los mensajes. */
  applyState: (state: StoryState) => void
}

/** 409 de `POST /chat`: capítulo bloqueado (trae el estado) o partida archivada. */
type ChatConflict = { detail?: string; code?: 'chapter_locked' | 'story_archived'; state?: StoryState }

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

async function openStream(storyId: string, body: unknown, signal: AbortSignal) {
  const doFetch = () => {
    const token = useAuthStore.getState().accessToken
    return fetch(`${API_BASE}/api/stories/${encodeURIComponent(storyId)}/chat`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal,
    })
  }
  let response = await doFetch()
  // El access dura media hora: una historia larga lo agota a mitad de conversación.
  if (response.status === 401 && (await refreshSession())) {
    response = await doFetch()
  }
  return response
}

export function useStoryStream(storyId: string): UseStoryStreamResult {
  const [messages, setMessages] = useState<StreamMessage[]>([])
  const [state, setState] = useState<StoryState | null>(null)
  const [transition, setTransition] = useState<PhaseTransition | null>(null)
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const seed = useCallback((msgs: StoryMessage[], initial: StoryState) => {
    abortRef.current?.abort()
    setMessages(msgs)
    setState(initial)
    setStreaming(false)
    setError(null)
  }, [])

  const dismissTransition = useCallback(() => setTransition(null), [])

  const send = useCallback(
    async (input: SendInput) => {
      const shown = 'message' in input ? input.message.trim() : input.label
      if (!shown) return

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      const stamp = Date.now()
      const userId = `u-${stamp}`
      const assistantId = `a-${stamp}`
      setMessages((prev) => [
        ...prev,
        // Con quick choice el texto real lo pone el servidor; aquí se enseña la etiqueta
        // hasta que la historia se recargue.
        { id: userId, role: 'user', content: shown },
        { id: assistantId, role: 'assistant', content: '', streaming: true },
      ])
      setStreaming(true)
      setError(null)

      const patchAssistant = (fn: (m: StreamMessage) => StreamMessage) =>
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? fn(m) : m)))

      try {
        const body = 'message' in input ? { message: shown } : { choiceId: input.choiceId }
        const response = await openStream(storyId, body, controller.signal)
        if (response.status === 409) {
          // El servidor rechaza el turno antes de abrir el stream: no se guardó nada, así que
          // el mensaje optimista se retira para no dejar un turno fantasma.
          const conflict = (await response.json().catch(() => null)) as ChatConflict | null
          setMessages((prev) => prev.filter((m) => m.id !== userId && m.id !== assistantId))
          if (conflict?.code === 'chapter_locked' && conflict.state) {
            setState(conflict.state)
            return
          }
          throw new Error(conflict?.detail || 'No se pudo continuar la historia.')
        }
        if (response.status === 422) {
          throw new Error('Esa opción ya no está disponible.')
        }
        if (!response.ok || !response.body) {
          throw new Error('No se pudo continuar la historia.')
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const parsed = parseSseBuffer(buffer)
          buffer = parsed.rest

          for (const ev of parsed.events) {
            switch (ev.event) {
              case 'token':
                patchAssistant((m) => ({ ...m, content: m.content + ev.data.text }))
                break
              case 'state': {
                const { transition: tr, signals: _signals, ...next } = ev.data
                setState(next)
                if (tr) setTransition(tr)
                break
              }
              case 'error':
                setError(ev.data.message)
                break
              case 'done':
                break
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        setError((err as Error).message || 'Algo falló. Inténtalo de nuevo.')
      } finally {
        // Una burbuja vacía (error antes del primer token) no aporta nada.
        setMessages((prev) =>
          prev
            .map((m) => (m.id === assistantId ? { ...m, streaming: false } : m))
            .filter((m) => m.id !== assistantId || m.content.trim()),
        )
        setStreaming(false)
      }
    },
    [storyId],
  )

  return { messages, state, transition, streaming, error, send, seed, dismissTransition, applyState: setState }
}
