import type { Wallet } from '@/api/economy'
import { apiClient } from '@/shared/lib/apiClient'
import type { PhaseId, StateEventData, Story } from '@/shared/lib/events'
import type { AuthUser } from '@/stores/authStore'

/** Herramientas de desarrollo: solo cuentas `isDev` (el backend responde 403 al resto). */

export type DevContext = {
  storyId: string
  status: string
  phase: PhaseId
  pendingPhase: string | null
  affinity: number
  turnCount: number
  systemPrompt: string | null
  window: { role: string; content: string }[]
  summary: string
  summaryUptoMessageId: number | null
  sceneTitle: string | null
  suggestions: unknown
  suggestionsTurn: number | null
}

const base = (storyId: string) => `/api/dev/stories/${encodeURIComponent(storyId)}`

export function forcePhase(storyId: string, phase: PhaseId) {
  return apiClient<StateEventData>(`${base(storyId)}/phase`, { method: 'POST', body: { phase } })
}

export function adjustAffinity(storyId: string, change: { delta: number } | { value: number }) {
  return apiClient<StateEventData>(`${base(storyId)}/affinity`, { method: 'POST', body: change })
}

export function unlockChapterFree(storyId: string) {
  return apiClient<StateEventData>(`${base(storyId)}/unlock-chapter`, { method: 'POST' })
}

export function fetchDevContext(storyId: string) {
  return apiClient<DevContext>(`${base(storyId)}/context`)
}

export function reopenStory(storyId: string) {
  return apiClient<Story>(`${base(storyId)}/reopen`, { method: 'POST' })
}

export function grantObolos(amount: number) {
  return apiClient<Wallet>('/api/dev/obolos', { method: 'POST', body: { amount } })
}

export function liftRestriction() {
  return apiClient<AuthUser>('/api/dev/me/lift-restriction', { method: 'POST' })
}
