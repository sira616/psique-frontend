/**
 * Fondo de portada cuando una historia no tiene imagen.
 *
 * Determinista a partir del id: la misma historia se ve siempre igual, en claro y en oscuro,
 * en cualquier pantalla y sin guardar nada. Los colores salen siempre de los tokens de
 * `src/styles/tokens.css` (nunca valores sueltos), así que el degradado se remapea solo al
 * cambiar de tema y no se sale de la paleta.
 */

/** Parejas de tokens que se ven bien juntas en los dos temas. */
export const COVER_STOPS = [
  ['--ps-primary-deep', '--ps-primary'],
  ['--ps-primary', '--ps-gold'],
  ['--ps-surf-3', '--ps-primary-deep'],
  ['--ps-primary-deep', '--ps-surf-3'],
  ['--ps-gold', '--ps-primary-deep'],
  ['--ps-primary', '--ps-surf-3'],
] as const satisfies readonly (readonly [string, string])[]

/** Diagonales; nada de degradados rectos, que aplanan la tarjeta. */
export const COVER_ANGLES = [115, 135, 155, 200, 225, 245, 295, 335] as const

export type CoverFallback = {
  /** Token del primer punto del degradado, p. ej. `--ps-primary-deep`. */
  from: string
  /** Token del último punto. */
  to: string
  angle: number
  /** Valor listo para `style={{ background }}`. */
  background: string
}

/** FNV-1a de 32 bits: barato, estable y reparte bien ids en hexadecimal. */
function hashOf(id: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < id.length; i += 1) {
    hash ^= id.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

export function coverFallback(id: string): CoverFallback {
  const hash = hashOf(id)
  const [from, to] = COVER_STOPS[hash % COVER_STOPS.length]!
  // Otro tramo del hash para el ángulo: si no, color y ángulo irían siempre de la mano.
  const angle = COVER_ANGLES[(hash >>> 8) % COVER_ANGLES.length]!
  return { from, to, angle, background: `linear-gradient(${angle}deg, var(${from}), var(${to}))` }
}

/** Inicial que se dibuja sobre el degradado. Decorativa: el título va al lado, en texto. */
export function coverInitial(title: string): string {
  return Array.from(title.trim())[0]?.toUpperCase() ?? '?'
}
