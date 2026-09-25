import type { ReviewOut } from '@/api/books'
import { apiClient, ApiError } from '@/shared/lib/apiClient'
import type { CustomStoryMode } from '@/shared/lib/events'

export type CustomStoryDefinition = {
  name: string
  age: number
  personality: string
  speakingStyle: string
  setting: string
  tone: string
  backstory: string
}

export type CustomStory = {
  id: string
  characterId: string
  mode: CustomStoryMode
  title: string
  hook: string
  /** Texto largo opcional que escribe quien la crea; null si no hay. */
  description: string | null
  premise: string | null
  tone: string | null
  definition: CustomStoryDefinition | null
  /** Ruta relativa tipo `/media/covers/<aleatorio>.webp`; null mientras no haya portada. */
  coverUrl: string | null
  isPublic: boolean
  /** Si la primera partida de cada lector no cuesta óbolos. */
  freeFirstRead: boolean
  /** Solo la ven cuentas mayores de edad. */
  adult: boolean
  /** Última vez que pasó de privada a pública; null si nunca lo fue. */
  publishedAt: string | null
  createdAt: string
}

export type CreateDefinida = CustomStoryDefinition & {
  mode: 'definida'
  title: string
  hook?: string | null
  isPublic?: boolean
  freeFirstRead?: boolean
  adult?: boolean
}

export type CreateConcepto = {
  mode: 'concepto'
  premise: string
  tone?: string | null
  isPublic?: boolean
  freeFirstRead?: boolean
  adult?: boolean
}

export type CreateCustomStory = CreateDefinida | CreateConcepto

/** Métricas de una historia propia. `recentReviews`: 5 como mucho, la más reciente primero. */
export type CustomStoryStats = {
  readers: number
  activeStories: number
  ratingAverage: number | null
  reviewCount: number
  recentReviews: ReviewOut[]
}

/** Detalle de una historia propia. */
export const customStoryQueryKey = (id: string) => ['custom-story', id] as const
/** Métricas de una historia propia: se recargan aparte del detalle. */
export const customStoryStatsQueryKey = (id: string) => ['custom-story-stats', id] as const

/**
 * Claves de react-query que dependen de las historias propias. Van por prefijo: invalidar
 * `['custom-story']` alcanza a `['custom-story', id]` de cualquier historia.
 */
export const customStoryQueryKeys = [
  ['characters'],
  ['custom-stories'],
  ['custom-story'],
  ['custom-story-stats'],
  ['stories'],
  ['explore'],
  ['profile'],
  ['book'],
] as const

export function createCustomStory(body: CreateCustomStory) {
  return apiClient<CustomStory>('/api/custom-stories', { method: 'POST', body })
}

export function listCustomStories() {
  return apiClient<CustomStory[]>('/api/custom-stories')
}

export function fetchCustomStory(id: string) {
  return apiClient<CustomStory>(`/api/custom-stories/${encodeURIComponent(id)}`)
}

export function fetchCustomStoryStats(id: string) {
  return apiClient<CustomStoryStats>(`/api/custom-stories/${encodeURIComponent(id)}/stats`)
}

/**
 * Campos editables. Todos opcionales y hay que mandar al menos uno. Los de personaje solo
 * valen en modo `definida`; en `concepto` el backend responde 422 con `detail` en texto.
 * `premise` no se edita.
 */
export type CustomStoryPatch = {
  title?: string
  hook?: string
  /** `null` o `''` borra la descripción. */
  description?: string | null
  /** `null` o `''` la deja sin tono. */
  tone?: string | null
  isPublic?: boolean
  freeFirstRead?: boolean
  adult?: boolean
  // Solo en modo definida:
  name?: string
  age?: number
  personality?: string
  speakingStyle?: string
  setting?: string
  backstory?: string
}

/** Manda solo lo que cambia: el backend exige al menos un campo. */
export function updateCustomStory(id: string, patch: CustomStoryPatch) {
  return apiClient<CustomStory>(`/api/custom-stories/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: patch,
  })
}

export function setCustomStoryPublic(id: string, isPublic: boolean) {
  return updateCustomStory(id, { isPublic })
}

export function deleteCustomStory(id: string) {
  return apiClient<void>(`/api/custom-stories/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

/** Portada: mismo multipart que `/api/me/avatar`, campo `file`, 4 MB como mucho. */
export function uploadCustomStoryCover(id: string, file: File) {
  const form = new FormData()
  form.append('file', file)
  return apiClient<CustomStory>(`/api/custom-stories/${encodeURIComponent(id)}/cover`, {
    method: 'POST',
    body: form,
  })
}

/** Idempotente: quitar una portada que ya no está también responde 204. */
export function deleteCustomStoryCover(id: string) {
  return apiClient<void>(`/api/custom-stories/${encodeURIComponent(id)}/cover`, { method: 'DELETE' })
}

/** `custom:<id>` → `<id>`; null si no es un personaje propio. */
export function customStoryIdFrom(characterId: string): string | null {
  return characterId.startsWith('custom:') ? characterId.slice('custom:'.length) : null
}

type ValidationItem = { loc?: unknown[]; msg?: string }

/**
 * El campo es el último tramo de `loc` que sea texto, saltándose el `"body"` inicial. Así sirve
 * igual para el POST de creación, que anida el modo (`["body", "definida", "age"]`), que para
 * el PATCH y la subida de portada, que no lo anidan (`["body", "description"]`).
 * Un `loc` de solo `["body"]` (modo no válido) no señala campo alguno y se descarta.
 */
function fieldOf(loc: unknown): string | null {
  if (!Array.isArray(loc)) return null
  for (let i = loc.length - 1; i >= 1; i -= 1) {
    if (typeof loc[i] === 'string') return loc[i] as string
  }
  return null
}

/**
 * Errores por campo de cualquier respuesta con `detail` en lista: el 422 de esquema y también
 * los 411/413/415/422 de la subida de portada, que no son 422.
 */
export function customStoryFieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) return {}
  const detail = (error.data as { detail?: unknown } | null)?.detail
  if (!Array.isArray(detail)) return {}
  const errors: Record<string, string> = {}
  for (const item of detail as ValidationItem[]) {
    const field = fieldOf(item.loc)
    if (!field || errors[field]) continue
    errors[field] = (item.msg ?? 'Valor no válido.').replace(/^Value error, /, '')
  }
  return errors
}

/**
 * Traduce un 422 de esquema (lista de FastAPI) a errores por campo. Los 422 de contenido
 * traen `detail` como string y no tienen campo: van al error general.
 */
export function fieldErrorsFrom(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || error.status !== 422) return {}
  return customStoryFieldErrors(error)
}

export function generalErrorFrom(error: unknown, fallback = 'No se pudo crear la historia. Inténtalo de nuevo.'): string {
  if (error instanceof ApiError) {
    const detail = (error.data as { detail?: unknown } | null)?.detail
    if (Array.isArray(detail)) return 'Revisa los campos marcados.'
    return error.message
  }
  return fallback
}
