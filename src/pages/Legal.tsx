import { type ComponentProps } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'
import { FileWarning } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import privacidad from '@/content/legal/privacidad.md?raw'
import terminos from '@/content/legal/terminos.md?raw'
import { LEGAL_VERSION } from '@/content/legal/version'
import { formatBookDate } from '@/features/book/format'
import { routes } from '@/router/paths'
import { ThemeToggle } from '@/shared/layout/ThemeToggle'
import { Wordmark } from '@/shared/layout/Wordmark'
import { cn } from '@/shared/lib/utils'
import { useAuthStore } from '@/stores/authStore'

const DOCUMENTS = {
  terminos: { source: terminos, title: 'Términos de uso' },
  privacidad: { source: privacidad, title: 'Política de privacidad' },
} as const

type LegalDocument = keyof typeof DOCUMENTS

/** Los enlaces internos del markdown navegan sin recargar; los externos abren aparte. */
function MarkdownLink({ href = '', children, node: _node, ...rest }: ComponentProps<'a'> & { node?: unknown }) {
  if (href.startsWith('/')) {
    return (
      <Link to={href} className="font-semibold text-accent-text underline">
        {children}
      </Link>
    )
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent-text underline" {...rest}>
      {children}
    </a>
  )
}

const components: Components = {
  a: MarkdownLink,
  h1: ({ children }) => <h1 className="font-serif text-display break-words text-ink">{children}</h1>,
  h2: ({ children }) => <h2 className="mt-8 font-serif text-headline-md text-ink">{children}</h2>,
  h3: ({ children }) => <h3 className="mt-6 font-serif text-[17px] font-semibold text-ink">{children}</h3>,
}

const tabClassName = ({ isActive }: { isActive: boolean }) =>
  cn(
    'inline-flex min-h-touch items-center rounded-lg px-3 text-body-sm font-semibold hover:bg-surf-2',
    isActive ? 'text-ink underline decoration-[color:var(--ps-primary)] decoration-2 underline-offset-8' : 'text-ink-dim hover:text-ink',
  )

/** Páginas públicas, sin sesión: /terminos y /privacidad. */
export default function LegalPage({ kind }: { kind: LegalDocument }) {
  const hasSession = useAuthStore((s) => Boolean(s.accessToken))
  const { source } = DOCUMENTS[kind]
  const versionDate = formatBookDate(`${LEGAL_VERSION}T12:00:00`)

  return (
    <div className="min-h-dvh text-ink" style={{ background: 'var(--ps-canvas-radial)' }}>
      <header className="border-b" style={{ background: 'var(--ps-surf-1)', borderColor: 'var(--ps-line)' }}>
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-x-4 gap-y-1 px-md py-2 sm:px-6">
          <Link to={hasSession ? routes.characters : routes.login} className="shrink-0 rounded-md" aria-label={hasSession ? 'Psique, inicio' : 'Psique, entrar'}>
            <Wordmark />
          </Link>
          <nav aria-label="Textos legales" className="min-w-0">
            <ul className="flex flex-wrap items-center gap-1">
              {(Object.keys(DOCUMENTS) as LegalDocument[]).map((key) => (
                <li key={key}>
                  <NavLink to={routes[key]} className={tabClassName}>
                    {DOCUMENTS[key].title}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-md pt-lg pb-10 sm:px-6">
        <div
          role="note"
          className="mb-6 flex items-start gap-2 rounded-xl px-3.5 py-3 text-body-sm"
          style={{ background: 'var(--ps-surf-2)', border: '1px solid var(--ps-line-strong)' }}
        >
          <FileWarning size={18} aria-hidden className="mt-0.5 shrink-0 text-gold" />
          <p>
            <strong className="text-ink">Borrador pendiente de revisión legal.</strong>{' '}
            <span className="text-ink-dim">Este texto todavía no es definitivo; los datos entre corchetes están por completar.</span>
          </p>
        </div>

        <article className="space-y-3 text-[15px] leading-relaxed text-ink-dim [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_strong]:text-ink [&_ul]:space-y-1.5 [&_code]:rounded [&_code]:bg-surf-2 [&_code]:px-1 [&_code]:text-ink">
          <ReactMarkdown rehypePlugins={[rehypeSanitize]} components={components}>
            {source}
          </ReactMarkdown>
        </article>

        <p className="mt-10 text-body-sm text-ink-faint">
          Versión {LEGAL_VERSION}
          {versionDate ? ` · en vigor desde el ${versionDate}` : ''}
        </p>
      </main>

    </div>
  )
}
