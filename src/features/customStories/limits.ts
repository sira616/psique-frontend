import { IMAGE_TYPES } from '@/features/profile/limits'
import type { CustomStoryMode } from '@/shared/lib/events'

// Mismos límites que el backend (se mide tras recortar espacios). Aquí solo sirven para
// avisar antes de enviar; quien decide es el servidor.
export type TextLimit = { min: number; max: number; optional?: boolean }

export const DEFINIDA_LIMITS = {
  title: { min: 3, max: 80 },
  name: { min: 2, max: 60 },
  personality: { min: 3, max: 300 },
  speakingStyle: { min: 10, max: 300 },
  setting: { min: 20, max: 590 },
  tone: { min: 3, max: 60 },
  backstory: { min: 40, max: 1200 },
  hook: { min: 10, max: 140, optional: true },
} satisfies Record<string, TextLimit>

export const CONCEPTO_LIMITS = {
  premise: { min: 20, max: 600 },
  tone: { min: 3, max: 60, optional: true },
} satisfies Record<string, TextLimit>

/**
 * Límites del PATCH de edición. Casi todos coinciden con los de creación, pero no todos: al
 * editar, el gancho ya existe y es obligatorio (al crear se puede dejar vacío y se deduce del
 * escenario), y la descripción solo se puede escribir aquí porque el POST no la acepta.
 * `description` y `tone` admiten quedarse en blanco: eso los borra.
 */
export const EDIT_LIMITS = {
  title: DEFINIDA_LIMITS.title,
  hook: { min: 10, max: 140 },
  description: { min: 0, max: 1000, optional: true },
  tone: { min: 3, max: 60, optional: true },
  name: DEFINIDA_LIMITS.name,
  personality: DEFINIDA_LIMITS.personality,
  speakingStyle: DEFINIDA_LIMITS.speakingStyle,
  setting: DEFINIDA_LIMITS.setting,
  backstory: DEFINIDA_LIMITS.backstory,
} satisfies Record<string, TextLimit>

export type EditField = keyof typeof EDIT_LIMITS | 'age'

/** Campos del personaje: solo existen en modo definida y tocan las partidas en curso. */
export const EDIT_CHARACTER_FIELDS = [
  'name',
  'age',
  'personality',
  'speakingStyle',
  'setting',
  'backstory',
] as const satisfies readonly EditField[]

export const AGE_MIN = 18
export const AGE_MAX = 90
export const NAME_PATTERN = /^[\p{L} '.-]+$/u

export type DefinidaField = keyof typeof DEFINIDA_LIMITS | 'age'
export type ConceptoField = keyof typeof CONCEPTO_LIMITS

export type FieldErrors = Partial<Record<string, string>>

export function textProblem(value: string, limit: TextLimit): string | null {
  const length = value.trim().length
  if (length === 0) return limit.optional ? null : 'Este campo es obligatorio.'
  if (length < limit.min) return `Al menos ${limit.min} caracteres.`
  if (length > limit.max) return `Como mucho ${limit.max} caracteres.`
  return null
}

export function ageProblem(raw: string): string | null {
  if (!raw.trim()) return 'Este campo es obligatorio.'
  const age = Number(raw)
  if (!Number.isInteger(age) || age < AGE_MIN || age > AGE_MAX) {
    return `Los personajes tienen que ser adultos (entre ${AGE_MIN} y ${AGE_MAX} años).`
  }
  return null
}

export function validateDefinida(values: Record<DefinidaField, string>): FieldErrors {
  const errors: FieldErrors = {}
  for (const [field, limit] of Object.entries(DEFINIDA_LIMITS)) {
    const problem = textProblem(values[field as DefinidaField], limit)
    if (problem) errors[field] = problem
  }
  if (!errors.name && !NAME_PATTERN.test(values.name.trim())) {
    errors.name = 'Solo letras, espacios, apóstrofos, puntos y guiones.'
  }
  const age = ageProblem(values.age)
  if (age) errors.age = age
  return errors
}

export function validateConcepto(values: Record<ConceptoField, string>): FieldErrors {
  const errors: FieldErrors = {}
  for (const [field, limit] of Object.entries(CONCEPTO_LIMITS)) {
    const problem = textProblem(values[field as ConceptoField], limit)
    if (problem) errors[field] = problem
  }
  return errors
}

/** Portada: mismo límite que el backend (4 MB). Los tipos son los del resto de imágenes del repo. */
export const COVER_MAX_BYTES = 4 * 1024 * 1024
export const COVER_MAX_MB = COVER_MAX_BYTES / (1024 * 1024)

/** Aviso antes de subir; el servidor mira el contenido real y tiene la última palabra. */
export function coverProblem(file: File): string | null {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) return 'Elige una imagen JPEG, PNG o WebP.'
  if (file.size > COVER_MAX_BYTES) return `La imagen pesa demasiado: como mucho ${COVER_MAX_MB} MB.`
  return null
}

export const MODE_LABELS: Record<CustomStoryMode, string> = {
  definida: 'Definida',
  concepto: 'Concepto',
}
