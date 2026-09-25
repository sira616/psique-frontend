/**
 * Registro de iconos **semánticos**: se nombran por lo que significan (IconBorrar), no por su
 * forma (Trash2). Así cambiar el dibujo de una acción es una línea aquí y no un repaso de
 * toda la interfaz.
 *
 * Los dibujos son de `lucide-react`, que ya usa el repo. **Las importaciones nuevas de iconos
 * van por este módulo**, no por `lucide-react` directamente. Los ficheros antiguos se irán
 * migrando cuando se toquen; no hace falta hacerlo de golpe.
 *
 * Un `export { X as IconY } from 'lucide-react'` sigue siendo tree-shakeable: lucide-react
 * declara `sideEffects: false` y cada icono vive en su propio módulo.
 */
import type { LucideProps } from 'lucide-react'
import type { ComponentType } from 'react'

/** Firma de cualquier icono de este módulo. */
export type IconComponent = ComponentType<LucideProps>

// Navegación
export { BookHeart as IconHistorias } from 'lucide-react'
export { Library as IconMisHistorias } from 'lucide-react'
export { Plus as IconCrearHistoria } from 'lucide-react'
export { Compass as IconExplorar } from 'lucide-react'
export { Ticket as IconRascaYGana } from 'lucide-react'
export { UserRound as IconPerfil } from 'lucide-react'
export { Settings as IconConfiguracion } from 'lucide-react'
export { Wrench as IconDev } from 'lucide-react'
export { Menu as IconMenu } from 'lucide-react'
export { X as IconCerrar } from 'lucide-react'
export { LogOut as IconCerrarSesion } from 'lucide-react'
export { ArrowLeft as IconVolver } from 'lucide-react'

// Economía
export { Coins as IconObolos } from 'lucide-react'

// Acciones sobre una historia propia
export { Pencil as IconEditar } from 'lucide-react'
export { ImageUp as IconPortada } from 'lucide-react'
export { Globe as IconPublicar } from 'lucide-react'
export { EyeOff as IconDespublicar } from 'lucide-react'
export { Trash2 as IconBorrar } from 'lucide-react'
export { Eye as IconVerComoLector } from 'lucide-react'
export { BookOpen as IconLeer } from 'lucide-react'

// Estados de una historia
export { ShieldAlert as IconAdulto } from 'lucide-react'
export { Sparkles as IconModoConcepto } from 'lucide-react'
export { UserRoundCheck as IconModoDefinida } from 'lucide-react'
export { CircleSlash as IconPartidaCerrada } from 'lucide-react'
export { LockKeyhole as IconCapituloBloqueado } from 'lucide-react'
export { Gift as IconPrimeraLecturaGratis } from 'lucide-react'
export { Globe as IconPublica } from 'lucide-react'
export { Lock as IconPrivada } from 'lucide-react'
/** Historia propia que no existe o no es de esta cuenta (el backend responde 404). */
export { BookX as IconNoEncontrada } from 'lucide-react'
/** Aviso serio: lo que se cambia alcanza a las partidas que ya están en marcha. */
export { TriangleAlert as IconAviso } from 'lucide-react'
export { CalendarDays as IconFecha } from 'lucide-react'

// Lectura de un libro
export { Archive as IconLecturasAnteriores } from 'lucide-react'
/** Dato que solo ve su dueño; nadie más lo tiene delante. */
export { EyeOff as IconSoloTuLoVes } from 'lucide-react'
export { RotateCcw as IconReleer } from 'lucide-react'
/** Remate del botón que confirma y sigue adelante. */
export { ArrowRight as IconAvanzar } from 'lucide-react'

// Chat de una partida
export { Send as IconEnviar } from 'lucide-react'
export { Sparkles as IconSugerencia } from 'lucide-react'

// Secciones de Configuración
export { Eye as IconPrivacidad } from 'lucide-react'
/** Credenciales con las que se entra, no el perfil público. */
export { KeyRound as IconCuenta } from 'lucide-react'
export { Database as IconTusDatos } from 'lucide-react'

// Métricas
export { Users as IconLectores } from 'lucide-react'
export { Star as IconNota } from 'lucide-react'
export { MessageSquareText as IconResenas } from 'lucide-react'
export { BookOpenText as IconPartidasActivas } from 'lucide-react'

/** Trazo común: los iconos de lucide vienen a 2 y a este tamaño se ven pesados. */
export const ICON_STROKE = 1.75

export type IconProps = Omit<LucideProps, 'ref'> & {
  /** El icono que se dibuja, tomado de este mismo módulo. */
  icon: IconComponent
}

/**
 * Icono decorativo: tamaño y trazo unificados y `aria-hidden` puesto. El nombre accesible lo
 * pone quien lo envuelve (texto al lado, `aria-label` del botón…).
 */
export function Icon({ icon: Glyph, size = 16, strokeWidth = ICON_STROKE, ...props }: IconProps) {
  return <Glyph size={size} strokeWidth={strokeWidth} aria-hidden {...props} />
}
