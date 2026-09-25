import type { StoryCard } from '@/api/explore'
import { apiClient, ApiError } from '@/shared/lib/apiClient'
import type { CharacterOrigin, CustomStoryMode, PhaseId } from '@/shared/lib/events'

export type MyProfile = {
  handle: string
  displayName: string
  bio: string | null
  link: string | null
  avatarUrl: string | null
  bannerUrl: string | null
  showPublished: boolean
  showReading: boolean
}

export type ProfileUpdate = Partial<
  Pick<MyProfile, 'displayName' | 'handle' | 'showPublished' | 'showReading'> & {
    bio: string | null
    link: string | null
  }
>

export type ReadingItem = {
  characterId: string
  origin: CharacterOrigin
  mode: CustomStoryMode | null
  title: string
  characterName: string | null
  /** Portada de la historia; null en los libros de Psique y en las propias sin portada. */
  coverUrl: string | null
  progress: { phase: PhaseId; phaseLabel: string; phaseIndex: number; phaseCount: number }
  updatedAt: string | null
}

/** Para otros usuarios, una estantería oculta llega con `items: null`; el dueño siempre la recibe. */
export type Shelf<T> = { items: T[] | null; visibleToOthers: boolean }

export type PublicProfile = {
  handle: string
  displayName: string
  bio: string | null
  link: string | null
  avatarUrl: string | null
  bannerUrl: string | null
  joinedAt: string
  isOwner: boolean
  shelves: { published: Shelf<StoryCard>; reading: Shelf<ReadingItem> }
}

export type ImageKind = 'avatar' | 'banner'

export const myProfileQueryKey = ['me', 'profile'] as const
export const profileQueryKey = (handle: string) => ['profile', handle.toLowerCase()] as const

export function fetchMyProfile() {
  return apiClient<MyProfile>('/api/me/profile')
}

export function updateMyProfile(body: ProfileUpdate) {
  return apiClient<MyProfile>('/api/me/profile', { method: 'PATCH', body })
}

export function fetchProfile(handle: string) {
  return apiClient<PublicProfile>(`/api/profiles/${encodeURIComponent(handle)}`)
}

export function uploadProfileImage(kind: ImageKind, file: File) {
  const form = new FormData()
  form.append('file', file)
  return apiClient<MyProfile>(`/api/me/${kind}`, { method: 'POST', body: form })
}

export function deleteProfileImage(kind: ImageKind) {
  return apiClient<void>(`/api/me/${kind}`, { method: 'DELETE' })
}

type FieldItem = { loc?: unknown[]; msg?: string }

/**
 * Perfil e imágenes devuelven los errores por campo con `loc: ["body", "<campo>"]`, también en
 * el 409 del handle y en los 411/413/415 de subida. A diferencia de las historias, el campo va
 * en `loc[1]`.
 */
export function profileFieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) return {}
  const detail = (error.data as { detail?: unknown } | null)?.detail
  if (!Array.isArray(detail)) return {}
  const errors: Record<string, string> = {}
  for (const item of detail as FieldItem[]) {
    const field = item.loc?.[1]
    if (typeof field !== 'string' || errors[field]) continue
    errors[field] = (item.msg ?? 'Valor no válido.').replace(/^Value error, /, '')
  }
  return errors
}

export function profileGeneralError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    const detail = (error.data as { detail?: unknown } | null)?.detail
    if (typeof detail === 'string' && detail) return detail
    if (error.status === 429) return 'Demasiados intentos seguidos. Espera un poco y vuelve a probar.'
  }
  return fallback
}
