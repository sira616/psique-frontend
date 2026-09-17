import { useState } from 'react'
import { mediaUrl } from '@/shared/lib/media'
import { cn } from '@/shared/lib/utils'

const SIZES = {
  xs: 'h-7 w-7 text-[11px]',
  sm: 'h-9 w-9 text-[13px]',
  lg: 'h-24 w-24 text-[32px] sm:h-28 sm:w-28',
} as const

export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const letters = words.length > 1 ? [words[0]!, words[words.length - 1]!] : words
  return letters.map((w) => Array.from(w)[0]!.toUpperCase()).join('') || '?'
}

type AvatarProps = {
  name: string
  url: string | null | undefined
  size?: keyof typeof SIZES
  /** Vacío cuando el nombre ya está escrito al lado: así el lector de pantalla no lo repite. */
  alt?: string
  className?: string
}

/** Foto de perfil con iniciales de respaldo (sin foto o si la imagen falla al cargar). */
export function Avatar({ name, url, size = 'sm', alt = '', className }: AvatarProps) {
  const src = mediaUrl(url)
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const showImage = src && failedSrc !== src

  return (
    <span
      className={cn(
        'relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-bold select-none',
        SIZES[size],
        className,
      )}
      style={{
        color: 'var(--ps-on-primary)',
        background: 'linear-gradient(145deg, var(--ps-primary), var(--ps-primary-deep))',
      }}
      role={showImage || !alt ? undefined : 'img'}
      aria-label={showImage || !alt ? undefined : alt}
    >
      {showImage ? (
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <span aria-hidden>{initialsOf(name)}</span>
      )}
    </span>
  )
}
