import { apiClient, ApiError } from '@/shared/lib/apiClient'
import { parseApiDate } from '@/shared/lib/media'

/** Contrato de uso diario, exportación y borrado de la cuenta. */

export type Usage = {
  turnsUsed: number
  /** null con cupo ilimitado (cuentas dev). */
  turnsLimit: number | null
  turnsRemaining: number | null
  unlimited: boolean
  /** Medianoche de Madrid con su desfase, p. ej. "2026-09-18T00:00:00+02:00". */
  resetsAt: string
}

/** 429 de `POST /chat` al agotar el cupo del día. */
export type DailyTurnLimit = { code: 'daily_turn_limit'; detail: string; resetsAt: string; turnsLimit: number }

export const usageQueryKey = ['usage'] as const
/** A partir de aquí se avisa de los turnos que quedan. */
export const LOW_TURNS_THRESHOLD = 10
export const DELETE_CONFIRMATION = 'BORRAR'

export function fetchUsage() {
  return apiClient<Usage>('/api/me/usage')
}

export function dailyLimitFrom(data: unknown): DailyTurnLimit | null {
  if (!data || typeof data !== 'object') return null
  return (data as { code?: unknown }).code === 'daily_turn_limit' ? (data as DailyTurnLimit) : null
}

const weekdayFormat = new Intl.DateTimeFormat('es-ES', { weekday: 'long' })
const timeFormat = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' })

/** "el viernes a las 00:00", en la hora local de quien lee. */
export function formatResetsAt(value: string) {
  const date = parseApiDate(value)
  return `el ${weekdayFormat.format(date)} a las ${timeFormat.format(date)}`
}

export function exportFileName(handle: string, now = new Date()) {
  const day = now.toLocaleDateString('sv-SE')
  return `psique-datos-${handle}-${day}.json`
}

/** Pide el JSON con la sesión normal y lo guarda como fichero: un enlace no llevaría el Bearer. */
export async function downloadMyData(handle: string) {
  const data = await apiClient<unknown>('/api/me/export')
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = exportFileName(handle)
  document.body.append(link)
  link.click()
  link.remove()
  // Tras el clic: revocarlo antes cancelaría la descarga en algunos navegadores.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function deleteAccount(password: string, confirmation: string) {
  return apiClient<void>('/api/me', { method: 'DELETE', body: { password, confirmation } })
}

export function isInvalidPassword(error: unknown) {
  return error instanceof ApiError && (error.data as { code?: unknown } | null)?.code === 'invalid_password'
}
