import { apiClient, ApiError } from '@/shared/lib/apiClient'
import { parseApiDate } from '@/shared/lib/media'
import { useAuthStore, type AuthUser } from '@/stores/authStore'

/** Contrato de la política de contenido: mayoría de edad, cierre de partida y restricción de cuenta. */

export type AdultRequired = { code: 'adult_required'; detail: string }
export type AccountRestricted = { code: 'account_restricted'; detail: string; restrictedUntil: string }
export type StoryClosed = {
  code: 'story_closed'
  detail: string
  closedAt: string
  closedReason: string
  restrictedUntil: string | null
}
export type ContentRedirected = { code: 'content_redirected'; detail: string; reply: string }

export type PolicyError = AdultRequired | AccountRestricted | StoryClosed | ContentRedirected

const POLICY_CODES = new Set(['adult_required', 'account_restricted', 'story_closed', 'content_redirected'])

/** Lee un cuerpo de error (`{detail, code, ...}`) y lo devuelve solo si es de la política. */
export function policyErrorFrom(data: unknown): PolicyError | null {
  if (!data || typeof data !== 'object') return null
  const code = (data as { code?: unknown }).code
  return typeof code === 'string' && POLICY_CODES.has(code) ? (data as PolicyError) : null
}

export function policyErrorOf(error: unknown): PolicyError | null {
  return error instanceof ApiError ? policyErrorFrom(error.data) : null
}

export function isAdultRequired(error: unknown) {
  return policyErrorOf(error)?.code === 'adult_required'
}

const untilFormat = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/** "24 de septiembre de 2026, 18:30" en la hora local de quien lee. */
export function formatRestrictedUntil(value: string) {
  return untilFormat.format(parseApiDate(value))
}

/** La restricción que llega con la sesión puede haber caducado desde entonces. */
export function activeRestriction(restrictedUntil: string | null | undefined): string | null {
  if (!restrictedUntil) return null
  return parseApiDate(restrictedUntil).getTime() > Date.now() ? restrictedUntil : null
}

/** Un 403 con restricción también la deja en la sesión, para avisar en el resto de pantallas. */
export function rememberRestriction(restrictedUntil: string | null) {
  if (restrictedUntil) useAuthStore.getState().patchUser({ restrictedUntil })
}

function storeUser(user: AuthUser) {
  const { id: _id, username: _username, ...changes } = user
  useAuthStore.getState().patchUser(changes)
  return user
}

export async function confirmAdult() {
  return storeUser(
    await apiClient<AuthUser>('/api/me/adult-confirmation', { method: 'POST', body: { confirm: true } }),
  )
}

export async function revokeAdult() {
  return storeUser(await apiClient<AuthUser>('/api/me/adult-confirmation', { method: 'DELETE' }))
}
