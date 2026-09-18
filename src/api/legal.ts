import { apiClient, ApiError } from '@/shared/lib/apiClient'
import { useAuthStore, type AuthUser } from '@/stores/authStore'

export type TermsOutdated = { code: 'terms_outdated'; detail: string; termsVersion: string }

/** 409 de accept-terms: la versión cambió mientras se leía. Trae la vigente. */
export function termsOutdatedOf(error: unknown): TermsOutdated | null {
  if (!(error instanceof ApiError) || error.status !== 409) return null
  const data = error.data as Partial<TermsOutdated> | null
  return data?.code === 'terms_outdated' && typeof data.termsVersion === 'string' ? (data as TermsOutdated) : null
}

export async function acceptTerms(version: string) {
  const user = await apiClient<AuthUser>('/api/me/accept-terms', { method: 'POST', body: { version, confirm: true } })
  const { id: _id, username: _username, ...changes } = user
  useAuthStore.getState().patchUser(changes)
  return user
}
