import { useSyncExternalStore } from 'react'

/**
 * Se usa cuando el breakpoint cambia la estructura (no solo el estilo): renderizar
 * dos copias ocultas con CSS duplicaría controles, regiones live y ids.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {}
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false),
    () => false,
  )
}
