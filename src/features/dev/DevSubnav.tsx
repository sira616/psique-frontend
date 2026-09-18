import { NavLink } from 'react-router-dom'
import { routes } from '@/router/paths'
import { cn } from '@/shared/lib/utils'

const ITEMS = [
  { to: routes.dev, label: 'Herramientas', end: true },
  { to: routes.moderacion, label: 'Moderación', end: false },
]

/** Secciones de la página Dev. */
export function DevSubnav() {
  return (
    <nav aria-label="Secciones de Dev">
      <ul className="flex flex-wrap gap-2">
        {ITEMS.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'inline-flex min-h-touch items-center rounded-xl border px-4 text-body-sm font-semibold',
                  isActive
                    ? 'border-[color:var(--ps-primary)] text-ink'
                    : 'border-outline-variant text-ink-dim hover:bg-surf-2 hover:text-ink',
                )
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
