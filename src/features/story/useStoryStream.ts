import { useCallback, useRef, useState } from 'react'
import {
  parseSseBuffer,
  type PhaseTransition,
  type StoryMessage,
  type StoryState,
} from '@/shared/lib/events'
import { dailyLimitFrom, type DailyTurnLimit } from '@/api/account'
import { policyErrorFrom, rememberRestriction, type StoryClosed } from '@/api/policy'
import { refreshSession } from '@/shared/lib/apiClient'
import { useAuthStore } from '@/stores/authStore'

/** `ephemeral`: réplica que el servidor no guarda (reconducción); desaparece en el siguiente turno. */
export type StreamMessage = StoryMessage & { streaming?: boolean; ephemeral?: boolean }

/** Con sugerencia, `message` es el texto que dio el servidor: el optimista enseña lo que se guarda. */
export type SendInput = { message: string } | { choiceId: string; message: string }

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
  /** La partida se cerró al enviar (403 `story_closed`). */
  closed: StoryClosed | null
  /** Fin de la restricción de cuenta recibida al enviar. */
  restrictedUntil: string | null
  /** Aviso de reconducción (422 `content_redirected`). */
  redirectNotice: string | null
  dismissRedirect: () => void
  /** Texto que vuelve al compositor cuando el servidor no aceptó el mensaje. */
  restoredDraft: { text: string; nonce: number } | null
  /** Turno pendiente de confirmar la mayoría de edad (403 `adult_required`). */
  adultPending: SendInput | null
  cancelAdult: () => void
  /** Cupo diario de turnos agotado al enviar (429 `daily_turn_limit`). */
  dailyLimit: DailyTurnLimit | null
  /** Olvida cierre, restricción y cupo recibidos (p. ej. tras reabrir desde las herramientas de dev). */
  clearBlocks: () => void
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
  const [closed, setClosed] = useState<StoryClosed | null>(null)
  const [restrictedUntil, setRestrictedUntil] = useState<string | null>(null)
  const [redirectNotice, setRedirectNotice] = useState<string | null>(null)
  const [restoredDraft, setRestoredDraft] = useState<{ text: string; nonce: number } | null>(null)
  const [adultPending, setAdultPending] = useState<SendInput | null>(null)
  const [dailyLimit, setDailyLimit] = useState<DailyTurnLimit | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const seed = useCallback((msgs: StoryMessage[], initial: StoryState) => {
    abortRef.current?.abort()
    setMessages(msgs)
    setState(initial)
    setStreaming(false)
    setError(null)
  }, [])

  const dismissTransition = useCallback(() => setTransition(null), [])
  const dismissRedirect = useCallback(() => setRedirectNotice(null), [])
  const clearBlocks = useCallback(() => {
    setClosed(null)
    setRestrictedUntil(null)
    setDailyLimit(null)
  }, [])
  // Al confirmar se reintenta solo; al cancelar, lo escrito vuelve al compositor para no perderlo.
  const cancelAdult = useCallback(() => {
    if (adultPending && !('choiceId' in adultPending)) {
      setRestoredDraft({ text: adultPending.message, nonce: Date.now() })
    }
    setAdultPending(null)
  }, [adultPending])

  const send = useCallback(
    async (input: SendInput) => {
      const shown = input.message.trim()
      if (!shown) return

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      const stamp = Date.now()
      const userId = `u-${stamp}`
      const assistantId = `a-${stamp}`
      setRedirectNotice(null)
      setAdultPending(null)
      setMessages((prev) => [
        ...prev.filter((m) => !m.ephemeral),
        { id: userId, role: 'user', content: shown },
        { id: assistantId, role: 'assistant', content: '', streaming: true },
      ])
      setStreaming(true)
      setError(null)

      const patchAssistant = (fn: (m: StreamMessage) => StreamMessage) =>
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? fn(m) : m)))
      const dropOptimistic = () => setMessages((prev) => prev.filter((m) => m.id !== userId && m.id !== assistantId))
      // Solo lo escrito a mano vuelve al compositor: una sugerencia sigue ahí para elegirla otra vez.
      const restoreDraft = () => {
        if (!('choiceId' in input)) setRestoredDraft({ text: shown, nonce: stamp })
      }

      try {
        // Con sugerencia solo viaja el id: el servidor usa su texto guardado, nunca el nuestro.
        const body = 'choiceId' in input ? { choiceId: input.choiceId } : { message: shown }
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
        if (response.status === 403) {
          // Rechazos de la política: llegan antes de abrir el stream y no se guarda nada.
          const policy = policyErrorFrom(await response.json().catch(() => null))
          dropOptimistic()
          if (policy?.code === 'story_closed') {
            setClosed(policy)
            setRestrictedUntil(policy.restrictedUntil)
            rememberRestriction(policy.restrictedUntil)
            return
          }
          if (policy?.code === 'account_restricted') {
            setRestrictedUntil(policy.restrictedUntil)
            rememberRestriction(policy.restrictedUntil)
            restoreDraft()
            return
          }
          if (policy?.code === 'adult_required') {
            setAdultPending(input)
            return
          }
          throw new Error(policy?.detail || 'No se pudo continuar la historia.')
        }
        if (response.status === 429) {
          // Cupo del día agotado: se rechaza antes del stream y no se guarda nada.
          const body = await response.json().catch(() => null)
          dropOptimistic()
          const limit = dailyLimitFrom(body)
          if (limit) {
            setDailyLimit(limit)
            restoreDraft()
            return
          }
          restoreDraft()
          throw new Error((body as { detail?: string } | null)?.detail || 'Demasiados mensajes seguidos. Espera un momento.')
        }
        if (response.status === 422) {
          const policy = policyErrorFrom(await response.json().catch(() => null))
          if (policy?.code === 'content_redirected') {
            // La réplica del personaje se enseña pero no se guarda: sustituye al turno optimista.
            setMessages((prev) =>
              prev
                .filter((m) => m.id !== userId)
                .map((m) =>
                  m.id === assistantId ? { ...m, id: `r-${stamp}`, content: policy.reply, streaming: false, ephemeral: true } : m,
                ),
            )
            setRedirectNotice(policy.detail)
            restoreDraft()
            return
          }
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

  return {
    messages,
    state,
    transition,
    streaming,
    error,
    send,
    seed,
    dismissTransition,
    applyState: setState,
    closed,
    restrictedUntil,
    redirectNotice,
    dismissRedirect,
    restoredDraft,
    adultPending,
    cancelAdult,
    dailyLimit,
    clearBlocks,
  }
}
