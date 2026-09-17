import type { ReactNode } from 'react'
import { Feather, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { BookAuthor, BookOut } from '@/api/books'
import { modeLabel } from '@/features/book/format'
import { routes } from '@/router/paths'
import { Avatar } from '@/shared/ui/Avatar'
import { Badge } from '@/shared/ui/badge'
import { Card } from '@/shared/ui/card'

/** Portada de relleno: aún no hay portadas, así que se usa la inicial del título sobre la marca. */
export function BookCover({ title, className = '' }: { title: string; className?: string }) {
  return (
    <div
      aria-hidden
      className={`grid place-items-center overflow-hidden rounded-2xl font-serif text-on-primary ${className}`}
      style={{
        background: 'linear-gradient(150deg, var(--ps-primary-deep), var(--ps-primary) 55%, var(--ps-gold))',
        boxShadow: 'var(--ps-shadow-md), inset 0 1px 0 var(--ps-inset-shine)',
      }}
    >
      <span className="text-[56px] leading-none opacity-90">{Array.from(title.trim())[0]?.toUpperCase() ?? '?'}</span>
    </div>
  )
}

export function AuthorLine({ author }: { author: BookAuthor | null }) {
  if (!author) {
    return (
      <p className="inline-flex min-h-touch items-center gap-2 text-body-sm text-ink-dim">
        <span
          className="grid h-9 w-9 place-items-center rounded-full text-on-primary"
          style={{ background: 'linear-gradient(145deg, var(--ps-primary), var(--ps-primary-deep))' }}
          aria-hidden
        >
          <Feather size={16} />
        </span>
        <span>
          De <span className="font-semibold text-ink">Psique</span>
        </span>
      </p>
    )
  }
  return (
    <Link
      to={routes.profile(author.handle)}
      className="-mx-2 inline-flex min-h-touch items-center gap-2.5 rounded-xl px-2 hover:bg-surf-2"
    >
      <Avatar name={author.displayName} url={author.avatarUrl} />
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-body-sm font-semibold text-ink">{author.displayName}</span>
        <span className="block truncate text-[13px] text-ink-dim">@{author.handle}</span>
      </span>
    </Link>
  )
}

export function BookHeader({ book, actions }: { book: BookOut; actions: ReactNode }) {
  return (
    <Card className="p-5 sm:p-6 lg:p-8">
      <div className="grid gap-5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-6 lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-8">
        <BookCover title={book.title} className="aspect-[3/4] w-28 sm:w-full" />
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className={book.mode === 'concepto' ? 'gap-1 text-accent-text' : undefined}>
              {book.mode === 'concepto' ? <Sparkles size={12} aria-hidden /> : null}
              {modeLabel(book.mode)}
            </Badge>
            {book.isMine ? <Badge variant="outline">Tuya</Badge> : null}
            {book.isMine && !book.isPublic ? <Badge variant="outline">Privada</Badge> : null}
            {book.viewer.status === 'leido' ? <Badge variant="outline" className="text-gold">Leído</Badge> : null}
          </div>
          <div>
            <h1 className="font-serif text-display break-words text-ink">{book.title}</h1>
            {book.characterName && book.characterName !== book.title ? (
              <p className="mt-1 text-body-sm font-semibold text-ink">con {book.characterName}</p>
            ) : null}
          </div>
          <p className="max-w-[65ch] text-ink-dim">{book.hook}</p>
          <AuthorLine author={book.author} />
          <div className="pt-1">{actions}</div>
        </div>
      </div>
    </Card>
  )
}
