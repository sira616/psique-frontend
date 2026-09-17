import { apiClient } from '@/shared/lib/apiClient'
import type { Character, Story, StorySummary } from '@/shared/lib/events'

export function fetchCharacters() {
  return apiClient<Character[]>('/api/characters')
}

export function fetchStories() {
  return apiClient<StorySummary[]>('/api/stories')
}

export function fetchStory(id: string) {
  return apiClient<Story>(`/api/stories/${encodeURIComponent(id)}`)
}

export function createStory(characterId: string) {
  return apiClient<Story>('/api/stories', { method: 'POST', body: { characterId } })
}
