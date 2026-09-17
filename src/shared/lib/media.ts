const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

/**
 * El backend devuelve `/media/...` relativo cuando no tiene MEDIA_BASE_URL: se sirve desde el
 * mismo origen que la API (proxy de Vite en desarrollo).
 */
export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null
  return path.startsWith('/') ? `${API_BASE_URL}${path}` : path
}

/** Fechas del backend: ISO sin zona, en UTC. */
export function parseApiDate(value: string): Date {
  return new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`)
}
