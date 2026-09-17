import { apiClient } from '@/shared/lib/apiClient'
import type { StateEventData, StoryState } from '@/shared/lib/events'

/** Contrato de la economía. Todo lo económico lo decide el servidor: aquí solo se pinta. */

export type MovementReason = 'bienvenida' | 'rasca' | 'capitulo' | 'lectura' | 'ajuste_dev'

export type WalletMovement = {
  id: string | number
  amount: number
  reason: MovementReason
  reference: string | null
  created_at: string
}

export type Wallet = { balance: number; movements: WalletMovement[] }

export type ScratchToday = {
  remaining: number
  daily_limit: number
  prize: number
  winning_number: number
  pending_card: { id: number; created_at: string } | null
}

export type ScratchCardCreated = { id: number; created_at: string; remaining: number }

export type ScratchReveal = {
  id: number
  number: number
  won: boolean
  prize: number
  balance: number
  remaining: number
}

export type UnlockChapterResult = StoryState & Partial<Pick<StateEventData, 'transition' | 'signals'>> & {
  balance: number
}

export function fetchWallet() {
  return apiClient<Wallet>('/api/me/wallet')
}

export function fetchScratchToday() {
  return apiClient<ScratchToday>('/api/scratch-cards/today')
}

export function drawScratchCard() {
  return apiClient<ScratchCardCreated>('/api/scratch-cards', { method: 'POST' })
}

export function revealScratchCard(id: number) {
  return apiClient<ScratchReveal>(`/api/scratch-cards/${encodeURIComponent(id)}/reveal`, { method: 'POST' })
}

export function unlockChapter(storyId: string) {
  return apiClient<UnlockChapterResult>(`/api/stories/${encodeURIComponent(storyId)}/unlock-chapter`, {
    method: 'POST',
  })
}
