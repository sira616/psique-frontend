import { apiClient, ApiError } from '@/shared/lib/apiClient'
import { useAuthStore, type AuthUser } from '@/stores/authStore'

/** Cierres por la política vistos por quien los recibió: sin regla ni extracto. */

export type AppealStatus = 'pendiente' | 'aceptada' | 'rechazada'
export type IncidentLevel = 'ok' | 'sensual' | 'explicito' | 'prohibido'

export type MyIncident = {
  id: number
  storyId: string
  bookTitle: string
  level: IncidentLevel | string
  createdAt: string
  appealStatus: AppealStatus | null
  appealText: string | null
  appealedAt: string | null
  reviewedAt: string | null
  reviewNote: string | null
  /** Sigue contando para la restricción (no aceptado en revisión). */
  counts: boolean
}

export const APPEAL_MAX = 500
export const myIncidentsQueryKey = ['me', 'incidents'] as const
export const meQueryKey = ['me'] as const

export function fetchMyIncidents() {
  return apiClient<MyIncident[]>('/api/me/incidents')
}

export function appealIncident(id: number, text: string) {
  const trimmed = text.trim()
  return apiClient<MyIncident>(`/api/me/incidents/${id}/appeal`, {
    method: 'POST',
    body: trimmed ? { text: trimmed } : {},
  })
}

/** Una revisión aceptada puede levantar la restricción: la sesión se pone al día con /api/me. */
export async function fetchMe() {
  const user = await apiClient<AuthUser>('/api/me')
  const { id: _id, username: _username, ...changes } = user
  useAuthStore.getState().patchUser(changes)
  return user
}

/** Texto para quien apela: el `detail` del servidor ya es mostrable salvo en fallos genéricos. */
export function appealErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) return 'No se pudo enviar la apelación. Inténtalo de nuevo.'
  if (error.status === 404) return 'No encontramos este incidente.'
  return error.message
}
