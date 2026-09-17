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
  premise: string | null
  tone: string | null
  definition: CustomStoryDefinition | null
  isPublic: boolean
  /** Si la primera partida de cada lector no cuesta óbolos. */
  freeFirstRead: boolean
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
}

export type CreateConcepto = {
  mode: 'concepto'
  premise: string
  tone?: string | null
  isPublic?: boolean
  freeFirstRead?: boolean
}

export type CreateCustomStory = CreateDefinida | CreateConcepto

/** Claves de react-query que dependen de las historias propias. */
export const customStoryQueryKeys = [['characters'], ['custom-stories'], ['stories'], ['explore'], ['profile'], ['book']] as const

export function createCustomStory(body: CreateCustomStory) {
  return apiClient<CustomStory>('/api/custom-stories', { method: 'POST', body })
}

export function listCustomStories() {
  return apiClient<CustomStory[]>('/api/custom-stories')
}

export type CustomStoryPatch = { isPublic?: boolean; freeFirstRead?: boolean }

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

/** `custom:<id>` → `<id>`; null si no es un personaje propio. */
export function customStoryIdFrom(characterId: string): string | null {
  return characterId.startsWith('custom:') ? characterId.slice('custom:'.length) : null
}

type ValidationItem = { loc?: unknown[]; msg?: string }

/**
 * Traduce un 422 de esquema (lista de FastAPI) a errores por campo. Los 422 de contenido
 * traen `detail` como string y no tienen campo: van al error general.
 */
export function fieldErrorsFrom(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || error.status !== 422) return {}
  const detail = (error.data as { detail?: unknown } | null)?.detail
  if (!Array.isArray(detail)) return {}
  const errors: Record<string, string> = {}
  for (const item of detail as ValidationItem[]) {
    const field = item.loc?.[2]
    if (typeof field !== 'string' || errors[field]) continue
    errors[field] = (item.msg ?? 'Valor no válido.').replace(/^Value error, /, '')
  }
  return errors
}

export function generalErrorFrom(error: unknown): string {
  if (error instanceof ApiError) {
    const detail = (error.data as { detail?: unknown } | null)?.detail
    if (Array.isArray(detail)) return 'Revisa los campos marcados.'
    return error.message
  }
  return 'No se pudo crear la historia. Inténtalo de nuevo.'
}
