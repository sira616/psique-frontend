import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { LogOut, Menu, Settings, X } from 'lucide-react'
import { NavLink, Outlet, useLocation, useMatch, useNavigate } from 'react-router-dom'
import { logout } from '@/api/auth'
import { WalletBadge } from '@/features/economy/WalletBadge'
import { fetchMyProfile, myProfileQueryKey } from '@/api/profile'
import { ThemeToggle } from '@/shared/layout/ThemeToggle'
import { Wordmark } from '@/shared/layout/Wordmark'
import { cn } from '@/shared/lib/utils'
import { Avatar } from '@/shared/ui/Avatar'
import { IconButton } from '@/shared/ui/IconButton'
import { routes } from '@/router/paths'
import { useAuthStore } from '@/stores/authStore'

/** Contenedor común a cabecera y contenido: así ambos alinean sus bordes a cualquier ancho. */
export const pageContainerClassName = 'mx-auto w-full max-w-screen-2xl px-md sm:px-6 lg:px-10'

type NavItem = { to: string; label: string; end?: boolean }

const NAV_ITEMS: NavItem[] = [
  { to: routes.characters, label: 'Historias', end: true },
  { to: routes.explorar, label: 'Explorar' },
  { to: routes.nuevaHistoria, label: 'Crear historia' },
  { to: routes.rascaYGana, label: 'Rasca y gana' },
]

function navLinkClassName({ isActive }: { isActive: boolean }) {
  return cn(
    'inline-flex min-h-touch items-center rounded-lg px-3 text-body-sm font-semibold hover:bg-surf-2',
    isActive
      ? 'text-ink underline decoration-[color:var(--ps-primary)] decoration-2 underline-offset-8'
      : 'text-ink-dim hover:text-ink',
  )
}

/** La entrada Dev solo existe para cuentas dev; el backend cierra igualmente sus rutas. */
function useNavItems(): NavItem[] {
  const isDev = useAuthStore((s) => Boolean(s.user?.isDev))
  return isDev ? [...NAV_ITEMS, { to: routes.dev, label: 'Dev' }] : NAV_ITEMS
}

function MainNav() {
  const navItems = useNavItems()
  return (
    // En móvil no cabe junto a la marca: allí va dentro del menú desplegable.
    <nav aria-label="Principal" className="min-w-0 max-sm:hidden">
      <ul className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none]">
        {navItems.map((item) => (
          <li key={item.to} className="shrink-0">
            <NavLink to={item.to} end={item.end} className={navLinkClassName}>
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function MobileMenu({ profileTo }: { profileTo: string | null }) {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const navItems = useNavItems()

  // Al navegar se cierra: el menú ya ha cumplido.
  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  const items: NavItem[] = [
    ...navItems,
    ...(profileTo ? [{ to: profileTo, label: 'Tu perfil' }] : []),
    { to: routes.configuracion, label: 'Configuración' },
  ]

  return (
    <div
      className="sm:hidden"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          setOpen(false)
          buttonRef.current?.focus()
        }
      }}
    >
      <IconButton
        ref={buttonRef}
        label="Menú"
        aria-expanded={open}
        aria-controls="menu-movil"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X size={18} aria-hidden /> : <Menu size={18} aria-hidden />}
      </IconButton>
      {open ? (
        <nav
          id="menu-movil"
          aria-label="Principal"
          className="absolute inset-x-0 top-full border-b px-md py-2"
          style={{ background: 'var(--ps-surf-1)', borderColor: 'var(--ps-line)', boxShadow: 'var(--ps-shadow-md)' }}
        >
          <ul className="flex flex-col">
            {items.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end} className={(state) => cn(navLinkClassName(state), 'w-full')}>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  )
}

export function AppShell() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  // La pantalla de historia gestiona su propio scroll (chat con composer fijo abajo).
  const isStory = Boolean(useMatch('/historia/:storyId'))
  // El avatar no viaja en la sesión (AuthUserOut no lo trae): sale del perfil propio.
  const myProfile = useQuery({ queryKey: myProfileQueryKey, queryFn: fetchMyProfile, enabled: Boolean(user) })
  const handle = user?.handle || myProfile.data?.handle
  const profileTo = handle ? routes.profile(handle) : null
  const displayName = myProfile.data?.displayName ?? user?.displayName ?? ''

  async function onLogout() {
    await logout()
    navigate(routes.login, { replace: true })
  }

  return (
    <div
      className="flex h-dvh flex-col overflow-hidden text-ink"
      style={{ background: 'var(--ps-canvas-radial)' }}
    >
      <header
        className="relative z-10 shrink-0 border-b"
        style={{ background: 'var(--ps-surf-1)', borderColor: 'var(--ps-line)' }}
      >
        <div className={cn(pageContainerClassName, 'flex min-h-touch items-center gap-md py-2 lg:gap-8')}>
          <NavLink to={routes.characters} className="shrink-0 rounded-md" aria-label="Psique, inicio">
            <Wordmark />
          </NavLink>
          <MainNav />
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <WalletBadge />
            {profileTo ? (
              <NavLink
                to={profileTo}
                className={({ isActive }) =>
                  cn(
                    'inline-flex min-h-touch items-center gap-2 rounded-full px-1 text-body-sm font-semibold hover:bg-surf-2 md:pr-3',
                    isActive ? 'text-ink' : 'text-ink-dim hover:text-ink',
                  )
                }
              >
                <Avatar name={displayName} url={myProfile.data?.avatarUrl} />
                {/* El nombre accesible es siempre "Tu perfil"; el texto solo se ve desde tablet. */}
                <span className="sr-only md:not-sr-only">Tu perfil</span>
              </NavLink>
            ) : null}
            <NavLink
              to={routes.configuracion}
              aria-label="Configuración"
              className={({ isActive }) =>
                cn(
                  'grid h-[38px] w-[38px] place-items-center rounded-[11px] border border-[color:var(--ps-line)] max-sm:hidden',
                  isActive ? 'text-accent-text' : 'text-ink-dim hover:text-ink',
                )
              }
              style={{ background: 'var(--ps-surf-1)' }}
            >
              <Settings size={18} aria-hidden />
            </NavLink>
            <ThemeToggle />
            <IconButton label="Cerrar sesión" onClick={onLogout}>
              <LogOut size={18} aria-hidden />
            </IconButton>
            <MobileMenu profileTo={profileTo} />
          </div>
        </div>
      </header>

      {isStory ? (
        <main className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
          <Outlet />
        </main>
      ) : (
        <main className="min-h-0 w-full flex-1 overflow-y-auto">
          <div className={cn(pageContainerClassName, 'pt-lg pb-16 lg:pt-10')}>
            <Outlet />
          </div>
        </main>
      )}
    </div>
  )
}
