import type { ImageKind } from '@/api/profile'

// Mismas reglas que el backend, solo para avisar antes de enviar: quien decide es el servidor.
export const PROFILE_LIMITS = {
  displayName: 64,
  bio: 280,
  link: 200,
} as const

export const HANDLE_PATTERN = /^[a-z0-9_]{3,30}$/

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const IMAGE_ACCEPT = IMAGE_TYPES.join(',')
export const IMAGE_MAX_BYTES: Record<ImageKind, number> = {
  avatar: 2 * 1024 * 1024,
  banner: 4 * 1024 * 1024,
}

export type ProfileFormValues = {
  displayName: string
  handle: string
  bio: string
  link: string
}

export type ProfileFormField = keyof ProfileFormValues

/** Orden en pantalla: el primer error que se enfoca es el primero que se ve. */
export const PROFILE_FIELD_ORDER: ProfileFormField[] = ['displayName', 'handle', 'bio', 'link']

export function normalizeDisplayName(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

export function normalizeHandle(value: string) {
  return value.trim().replace(/^@/, '').toLowerCase()
}

export function linkProblem(raw: string): string | null {
  const value = raw.trim()
  if (!value) return null
  if (value.length > PROFILE_LIMITS.link) return `Como mucho ${PROFILE_LIMITS.link} caracteres.`
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return 'Escribe una dirección completa que empiece por http:// o https://.'
  }
  if (!/^https?:$/.test(url.protocol) || /\s/.test(value) || !url.hostname.includes('.')) {
    return 'Escribe una dirección completa que empiece por http:// o https://.'
  }
  if (url.username || url.password) return 'El enlace no puede llevar usuario ni contraseña.'
  return null
}

export function validateProfile(values: ProfileFormValues): Partial<Record<ProfileFormField, string>> {
  const errors: Partial<Record<ProfileFormField, string>> = {}
  const displayName = normalizeDisplayName(values.displayName)
  if (!displayName) errors.displayName = 'Este campo es obligatorio.'
  else if (displayName.length > PROFILE_LIMITS.displayName) {
    errors.displayName = `Como mucho ${PROFILE_LIMITS.displayName} caracteres.`
  }

  if (!HANDLE_PATTERN.test(normalizeHandle(values.handle))) {
    errors.handle = 'De 3 a 30 caracteres: letras minúsculas, números o guion bajo.'
  }

  if (values.bio.trim().length > PROFILE_LIMITS.bio) {
    errors.bio = `La bio admite como mucho ${PROFILE_LIMITS.bio} caracteres.`
  }

  const link = linkProblem(values.link)
  if (link) errors.link = link
  return errors
}

export function imageProblem(kind: ImageKind, file: File): string | null {
  // El servidor mira el contenido real; aquí basta con el tipo declarado para avisar pronto.
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return 'Elige una imagen JPEG, PNG o WebP.'
  }
  const max = IMAGE_MAX_BYTES[kind]
  if (file.size > max) return `La imagen pesa demasiado: como mucho ${max / (1024 * 1024)} MB.`
  return null
}
