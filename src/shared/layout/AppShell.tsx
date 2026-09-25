import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { NavLink, Outlet, useLocation, useMatch, useNavigate } from 'react-router-dom'
import { logout } from '@/api/auth'
import { WalletBadge } from '@/features/economy/WalletBadge'
import { LegalFooter } from '@/features/legal/LegalLinks'
import { TermsGate } from '@/features/legal/TermsGate'
import { fetchMyProfile, myProfileQueryKey } from '@/api/profile'
import { ThemeToggle } from '@/shared/layout/ThemeToggle'
import { Wordmark } from '@/shared/layout/Wordmark'
import { cn } from '@/shared/lib/utils'
import { Avatar } from '@/shared/ui/Avatar'
import { IconButton } from '@/shared/ui/IconButton'
import {
  Icon,
  IconCerrar,
  IconCerrarSesion,
  IconConfiguracion,
  IconCrearHistoria,
  IconExplorar,
  IconHistorias,
  IconMenu,
  IconMisHistorias,
  IconPerfil,
  IconRascaYGana,
  IconDev,
  type IconComponent,
} from '@/shared/ui/icons'
import { routes } from '@/router/paths'
import { useAuthStore } from '@/stores/authStore'

/** Contenedor común a cabecera y contenido: así ambos alinean sus bordes a cualquier ancho. */
export const pageContainerClassName = 'mx-auto w-full max-w-screen-2xl px-md sm:px-6 lg:px-10'

type NavItem = {
  to: string
  label: string
  icon: IconComponent
  end?: boolean
  /** En la barra de escritorio va solo con icono; en el menú móvil siempre lleva texto. */
  iconOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: routes.characters, label: 'Historias', icon: IconHistorias, end: true },
  { to: routes.explorar, label: 'Explorar', icon: IconExplorar },
  { to: routes.nuevaHistoria, label: 'Crear historia', icon: IconCrearHistoria },
  { to: routes.misHistorias, label: 'Mis historias', icon: IconMisHistorias },
  { to: routes.rascaYGana, label: 'Rasca y gana', icon: IconRascaYGana, iconOnly: true },
]

function navLinkClassName({ isActive }: { isActive: boolean }) {
  return cn(
    'inline-flex min-h-touch items-center gap-2 rounded-lg px-3 text-body-sm font-semibold hover:bg-surf-2',
    isActive
      ? 'text-ink underline decoration-[color:var(--ps-primary)] decoration-2 underline-offset-8'
      : 'text-ink-dim hover:text-ink',
  )
}

/** La entrada Dev solo existe para cuentas dev; el backend cierra igualmente sus rutas. */
function useNavItems(): NavItem[] {
  const isDev = useAuthStore((s) => Boolean(s.user?.isDev))
  return isDev ? [...NAV_ITEMS, { to: routes.dev, label: 'Dev', icon: IconDev }] : NAV_ITEMS
}

function MainNav() {
  const navItems = useNavItems()
  return (
    // En móvil no cabe junto a la marca: allí va dentro del menú desplegable.
    <nav aria-label="Principal" className="min-w-0 max-md:hidden">
      <ul className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none]">
        {navItems.map((item) => (
          <li key={item.to} className="shrink-0">
            <NavLink
              to={item.to}
              end={item.end}
              // Por debajo de xl la barra va solo con iconos, así que el nombre accesible no
              // puede depender del texto: lo pone siempre aria-label, y title lo enseña como
              // tooltip mientras ese texto está oculto.
              aria-label={item.label}
              title={item.label}
              // px-3 deja el objetivo en 40px; sin texto al lado hace falta llegar a 44.
              className={(state) => cn(navLinkClassName(state), item.iconOnly ? 'px-[14px]' : 'px-[14px] xl:px-3')}
            >
              <Icon icon={item.icon} size={18} />
              {/* Con los seis items y su texto la barra pide ~1060px: por debajo de xl se
                  recortaba en silencio (scroll horizontal sin barra) y "Mis historias" no se
                  veía. Solo icono hasta xl entra de sobra ya desde 768. */}
              {item.iconOnly ? null : <span className="max-xl:hidden">{item.label}</span>}
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

  // En el menú desplegable sí cabe el texto: aquí ninguna entrada va solo con icono.
  const items: NavItem[] = [
    ...navItems.map((item) => ({ ...item, iconOnly: false })),
    ...(profileTo ? [{ to: profileTo, label: 'Tu perfil', icon: IconPerfil }] : []),
    { to: routes.configuracion, label: 'Configuración', icon: IconConfiguracion },
  ]

  return (
    <div
      className="md:hidden"
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
        {open ? <Icon icon={IconCerrar} size={18} /> : <Icon icon={IconMenu} size={18} />}
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
                  <Icon icon={item.icon} size={18} />
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
                  'grid h-[38px] w-[38px] place-items-center rounded-[11px] border border-[color:var(--ps-line)] max-md:hidden',
                  isActive ? 'text-accent-text' : 'text-ink-dim hover:text-ink',
                )
              }
              style={{ background: 'var(--ps-surf-1)' }}
            >
              <Icon icon={IconConfiguracion} size={18} />
            </NavLink>
            <ThemeToggle />
            <IconButton label="Cerrar sesión" onClick={onLogout}>
              <Icon icon={IconCerrarSesion} size={18} />
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
          <footer className={cn(pageContainerClassName, 'border-t border-[color:var(--ps-line)] py-2')}>
            <LegalFooter />
          </footer>
        </main>
      )}
      <TermsGate />
    </div>
  )
}
