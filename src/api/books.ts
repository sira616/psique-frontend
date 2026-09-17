import type { StoryAuthor } from '@/api/explore'
import { apiClient, ApiError } from '@/shared/lib/apiClient'
import type { CharacterOrigin, CustomStoryMode, Story } from '@/shared/lib/events'

/** Contrato de la página de libro. "Libro" = historia jugable: `lucia` o `custom:<hex>`. */

export type BookAuthor = StoryAuthor

export type BookReadingStatus = 'sin_empezar' | 'leyendo' | 'leido'

export type BookProgress = {
  phase: string
  phaseLabel: string
  phaseIndex: number
  phaseCount: number
  affinity: number
  chapterLocked: boolean
}

export type ReviewOut = {
  id: number
  rating: number
  text: string | null
  author: BookAuthor
  isMine: boolean
  createdAt: string | null
  updatedAt: string | null
}

export type ReviewPage = {
  items: ReviewOut[]
  limit: number
  offset: number
  nextOffset: number | null
}

export type BookViewer = {
  status: BookReadingStatus
  activeStoryId: string | null
  progress: BookProgress | null
  primaryAction: { kind: 'leer' | 'continuar'; cost: number }
  canReread: boolean
  rereadCost: number
  canReview: boolean
  myReview: ReviewOut | null
}

export type BookOut = {
  id: string
  origin: CharacterOrigin
  /** null en predefinidos. */
  mode: CustomStoryMode | null
  title: string
  hook: string
  /** null en concepto: el personaje se descubre jugando. */
  characterName: string | null
  tone: string | null
  /** null = Psique (predefinido). */
  author: BookAuthor | null
  isMine: boolean
  isPublic: boolean
  chapterCount: number
  freeFirstRead: boolean
  readCost: number
  publishedAt: string | null
  createdAt: string | null
  stats: { readers: number; ratingAverage: number | null; reviewCount: number }
  viewer: BookViewer
}

export type HistoryItem = {
  storyId: string
  startedAt: string | null
  archivedAt: string | null
  phase: string
  phaseLabel: string
  phaseIndex: number
  phaseCount: number
  affinity: number
}

export type BookCard = {
  id: string
  origin: CharacterOrigin
  mode: CustomStoryMode | null
  title: string
  hook: string
  tone: string | null
  author: BookAuthor | null
  readers: number
}

export type ReviewInput = { rating: number; text: string | null }

export const REVIEW_TEXT_MAX = 1000
export const REVIEWS_PAGE_SIZE = 10

/** Todo lo del libro cuelga de `['book', id]`: invalidar esa raíz refresca ficha, reseñas e historial. */
export const bookQueryKey = (bookId: string) => ['book', bookId] as const
export const bookReviewsQueryKey = (bookId: string) => ['book', bookId, 'reviews'] as const
export const bookHistoryQueryKey = (bookId: string) => ['book', bookId, 'history'] as const
export const bookRecommendedQueryKey = (bookId: string) => ['book', bookId, 'recommended'] as const

const base = (bookId: string) => `/api/books/${encodeURIComponent(bookId)}`

export function fetchBook(bookId: string) {
  return apiClient<BookOut>(base(bookId))
}

export function fetchBookHistory(bookId: string) {
  return apiClient<HistoryItem[]>(`${base(bookId)}/history`)
}

export function fetchRecommended(bookId: string) {
  return apiClient<BookCard[]>(`${base(bookId)}/recommended`)
}

export function fetchReviews(bookId: string, offset: number, limit = REVIEWS_PAGE_SIZE) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  return apiClient<ReviewPage>(`${base(bookId)}/reviews?${params}`)
}

export function saveMyReview(bookId: string, body: ReviewInput) {
  return apiClient<ReviewOut>(`${base(bookId)}/reviews/me`, { method: 'PUT', body })
}

export function deleteMyReview(bookId: string) {
  return apiClient<void>(`${base(bookId)}/reviews/me`, { method: 'DELETE' })
}

export function rereadBook(bookId: string) {
  return apiClient<Story>(`${base(bookId)}/reread`, { method: 'POST' })
}

type FieldItem = { loc?: unknown[]; msg?: string }

/**
 * Error del campo `text` de una reseña. Vale tanto para la lista de campos (esquema o filtro
 * de contenido) como para un `detail` en texto, que solo puede venir del texto.
 */
export function reviewTextError(error: unknown): string | null {
  if (!(error instanceof ApiError) || error.status !== 422) return null
  const detail = (error.data as { detail?: unknown } | null)?.detail
  if (typeof detail === 'string') return detail
  if (!Array.isArray(detail)) return null
  const item = (detail as FieldItem[]).find((d) => d.loc?.includes('text'))
  return item ? (item.msg ?? 'Texto no válido.').replace(/^Value error, /, '') : null
}
