import type { CustomStoryDefinition } from '@/api/customStories'
import { apiClient } from '@/shared/lib/apiClient'
import type { CustomStoryMode } from '@/shared/lib/events'

export type StoryAuthor = {
  displayName: string
  handle: string
  avatarUrl: string | null
}

/**
 * Tarjeta pública (Explorar y estantería "Publicadas"). En concepto `definition` es siempre
 * null y `tone` puede serlo: el perfil lo inventa el LLM y se descubre jugando.
 */
export type StoryCard = {
  id: string
  characterId: string
  mode: CustomStoryMode
  title: string
  hook: string
  tone: string | null
  definition: CustomStoryDefinition | null
  author: StoryAuthor
  isMine: boolean
  adult: boolean
  publishedAt: string | null
}

export type ExplorePage = {
  items: StoryCard[]
  limit: number
  offset: number
  nextOffset: number | null
}

export const EXPLORE_PAGE_SIZE = 12

export function fetchExplore({
  offset,
  mode,
  limit = EXPLORE_PAGE_SIZE,
}: {
  offset: number
  mode: CustomStoryMode | null
  limit?: number
}) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  if (mode) params.set('mode', mode)
  return apiClient<ExplorePage>(`/api/explore?${params}`)
}

/** Al paginar mientras alguien publica, una tarjeta puede llegar dos veces. */
export function dedupeCards(pages: ExplorePage[]): StoryCard[] {
  const seen = new Set<string>()
  const cards: StoryCard[] = []
  for (const page of pages) {
    for (const card of page.items) {
      if (seen.has(card.id)) continue
      seen.add(card.id)
      cards.push(card)
    }
  }
  return cards
}
