/**
 * Pares de color resueltos que replican `src/styles/tokens.css`.
 * Mantener sincronizado: los tests unitarios exigen WCAG AA.
 */

export type ContrastPair = {
  id: string
  foreground: string
  background: string
  size?: 'normal' | 'large'
  usage: string
}

/** Tema oscuro (`:root`). */
export const DARK_AA_PAIRS: ContrastPair[] = [
  { id: 'dark-ink-on-canvas', foreground: '#f3e9ec', background: '#120d12', usage: 'Texto sobre fondo' },
  { id: 'dark-ink-on-surf', foreground: '#f3e9ec', background: '#241a20', usage: 'Texto en tarjetas y burbujas' },
  { id: 'dark-ink-dim-on-surf', foreground: '#c3b1b8', background: '#241a20', usage: 'Texto secundario' },
  { id: 'dark-ink-faint-on-canvas', foreground: '#a08e96', background: '#120d12', usage: 'Etiquetas sobre fondo' },
  { id: 'dark-ink-faint-on-surf', foreground: '#a08e96', background: '#1c1419', usage: 'Etiquetas en tarjetas' },
  { id: 'dark-on-primary', foreground: '#ffffff', background: '#b8395c', usage: 'Botones y burbuja del usuario' },
  { id: 'dark-on-primary-deep', foreground: '#ffffff', background: '#8e2845', usage: 'Final del degradado primario' },
  { id: 'dark-accent-on-canvas', foreground: '#ee9ab0', background: '#120d12', usage: 'Enlaces sobre fondo' },
  { id: 'dark-accent-on-surf', foreground: '#ee9ab0', background: '#241a20', usage: 'Acentos en tarjetas' },
  { id: 'dark-gold-on-surf', foreground: '#e0b27a', background: '#1c1419', usage: 'Fase actual' },
  { id: 'dark-on-gold', foreground: '#2a1a0a', background: '#e0b27a', usage: 'Chip dorado' },
  { id: 'dark-error-on-canvas', foreground: '#ff9a91', background: '#120d12', usage: 'Errores' },
  { id: 'dark-ink-faint-on-surf-2', foreground: '#a08e96', background: '#241a20', usage: 'Etiqueta "Tono" y pistas en tarjetas' },
  { id: 'dark-error-on-surf', foreground: '#ff9a91', background: '#241a20', usage: 'Errores de campo en tarjetas' },
  { id: 'dark-gold-on-surf-2', foreground: '#e0b27a', background: '#241a20', usage: 'Aviso "Oculta para otros" y fase en "Leyendo"' },
  { id: 'dark-on-primary-avatar', foreground: '#ffffff', background: '#8e2845', usage: 'Iniciales del avatar' },
]

/** Tema claro (`.light`). */
export const LIGHT_AA_PAIRS: ContrastPair[] = [
  { id: 'light-ink-on-canvas', foreground: '#2a1a22', background: '#faf5f2', usage: 'Texto sobre fondo' },
  { id: 'light-ink-on-surf', foreground: '#2a1a22', background: '#f6eeea', usage: 'Texto en burbujas' },
  { id: 'light-ink-dim-on-surf', foreground: '#5c4450', background: '#ffffff', usage: 'Texto secundario' },
  { id: 'light-ink-faint-on-surf', foreground: '#76606b', background: '#f6eeea', usage: 'Etiquetas' },
  { id: 'light-on-primary', foreground: '#ffffff', background: '#a3324f', usage: 'Botones y burbuja del usuario' },
  { id: 'light-accent-on-canvas', foreground: '#962b48', background: '#faf5f2', usage: 'Enlaces' },
  { id: 'light-gold-on-surf', foreground: '#8a5a1c', background: '#ffffff', usage: 'Fase actual' },
  { id: 'light-on-gold', foreground: '#ffffff', background: '#8a5a1c', usage: 'Chip dorado' },
  { id: 'light-error-on-surf', foreground: '#b3261e', background: '#ffffff', usage: 'Errores' },
  { id: 'light-error-on-surf-2', foreground: '#b3261e', background: '#f6eeea', usage: 'Errores de campo en tarjetas' },
  { id: 'light-ink-dim-on-surf-2', foreground: '#5c4450', background: '#f6eeea', usage: 'Gancho y @handle en tarjetas' },
  { id: 'light-accent-on-surf-2', foreground: '#962b48', background: '#f6eeea', usage: 'Enlaces en tarjetas' },
  { id: 'light-gold-on-surf-2', foreground: '#8a5a1c', background: '#f6eeea', usage: 'Aviso "Oculta para otros" y fase en "Leyendo"' },
  { id: 'light-on-primary-deep-avatar', foreground: '#ffffff', background: '#7f2440', usage: 'Iniciales del avatar' },
]

/** Componentes de interfaz y texto grande: ≥ 3:1. */
export const UI_COMPONENT_PAIRS: ContrastPair[] = [
  { id: 'dark-primary-on-canvas', foreground: '#b8395c', background: '#120d12', size: 'large', usage: 'Barra de afinidad' },
  { id: 'light-primary-on-canvas', foreground: '#a3324f', background: '#faf5f2', size: 'large', usage: 'Barra de afinidad' },
  { id: 'dark-switch-on-surf-1', foreground: '#b8395c', background: '#1c1419', size: 'large', usage: 'Interruptor encendido' },
  { id: 'dark-switch-on-surf-2', foreground: '#b8395c', background: '#241a20', size: 'large', usage: 'Interruptor encendido' },
  { id: 'dark-switch-off-surf-2', foreground: '#a08e96', background: '#241a20', size: 'large', usage: 'Interruptor apagado (borde y pomo)' },
  { id: 'light-switch-on-surf-1', foreground: '#a3324f', background: '#ffffff', size: 'large', usage: 'Interruptor encendido' },
  { id: 'light-switch-on-surf-2', foreground: '#a3324f', background: '#f6eeea', size: 'large', usage: 'Interruptor encendido' },
  { id: 'light-switch-off-surf-2', foreground: '#76606b', background: '#f6eeea', size: 'large', usage: 'Interruptor apagado (borde y pomo)' },
  { id: 'dark-switch-knob-on', foreground: '#ffffff', background: '#b8395c', size: 'large', usage: 'Pomo del interruptor encendido' },
]
