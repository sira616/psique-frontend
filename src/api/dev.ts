import type { Wallet } from '@/api/economy'
import type { AppealStatus, IncidentLevel } from '@/api/incidents'
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

// Moderación: cola de incidentes de todas las cuentas.

export type ModerationFilter = 'pendientes' | 'sin_resolver' | 'recientes' | 'resueltos' | 'todos'

export type DevIncident = {
  id: number
  createdAt: string
  level: IncidentLevel | string
  rule: string | null
  user: { id: string; handle: string; username: string; restrictedUntil: string | null } | null
  story: { id: string; characterId: string; bookTitle: string; status: string } | null
  appealStatus: AppealStatus | null
  appealText: string | null
  appealedAt: string | null
  review: { status: 'aceptada' | 'rechazada'; reviewedAt: string; reviewedBy: string | null; note: string | null } | null
  hasExcerpt: boolean
  /** Solo en el detalle. */
  excerpt: string | null
  canReview: boolean
}

export type IncidentQuery = { filter: ModerationFilter; level: string; rule: string; limit: number; offset: number }

export const REVIEW_NOTE_MAX = 300

export function fetchIncidentQueue({ filter, level, rule, limit, offset }: IncidentQuery) {
  const params = new URLSearchParams({ filter, limit: String(limit), offset: String(offset) })
  if (level) params.set('level', level)
  if (rule.trim()) params.set('rule', rule.trim())
  return apiClient<{ items: DevIncident[]; total: number }>(`/api/dev/incidents?${params}`)
}

export function fetchIncident(id: number) {
  return apiClient<DevIncident>(`/api/dev/incidents/${id}`)
}

export function resolveIncident(id: number, decision: 'accept' | 'reject', note: string) {
  const trimmed = note.trim()
  return apiClient<{ incident: DevIncident; storyReopened: boolean }>(`/api/dev/incidents/${id}/${decision}`, {
    method: 'POST',
    body: trimmed ? { note: trimmed } : {},
  })
}
