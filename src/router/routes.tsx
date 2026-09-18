import { lazy, Suspense, type ReactNode } from 'react'
import { Route, Routes } from 'react-router-dom'
import { RequireAuth } from '@/router/RequireAuth'
import { routes } from '@/router/paths'
import { AppShell } from '@/shared/layout/AppShell'
import { LoginPage } from '@/pages/Login'

// Cada página va en su propio chunk y se descarga al visitarla. El login queda en el bundle
// principal porque es la primera pantalla sin sesión y así no hay parpadeo de carga.
const RegisterPage = lazy(() => import('@/pages/Register').then((m) => ({ default: m.RegisterPage })))
const CharactersPage = lazy(() => import('@/pages/Characters').then((m) => ({ default: m.CharactersPage })))
const StoryPage = lazy(() => import('@/pages/Story').then((m) => ({ default: m.StoryPage })))
const StoryArchivePage = lazy(() => import('@/pages/StoryArchive').then((m) => ({ default: m.StoryArchivePage })))
const BookPage = lazy(() => import('@/pages/Book').then((m) => ({ default: m.BookPage })))
const CreateStoryPage = lazy(() => import('@/pages/CreateStory').then((m) => ({ default: m.CreateStoryPage })))
const NotFoundPage = lazy(() => import('@/pages/NotFound').then((m) => ({ default: m.NotFoundPage })))
const ExplorePage = lazy(() => import('@/pages/Explore').then((m) => ({ default: m.ExplorePage })))
const ProfilePage = lazy(() => import('@/pages/Profile').then((m) => ({ default: m.ProfilePage })))
const SettingsPage = lazy(() => import('@/pages/Settings').then((m) => ({ default: m.SettingsPage })))
const ScratchGamePage = lazy(() => import('@/pages/ScratchGame').then((m) => ({ default: m.ScratchGamePage })))
// Solo para cuentas dev.
const DevPage = lazy(() => import('@/pages/Dev'))
const DevModerationPage = lazy(() => import('@/pages/DevModeration'))
// Públicas: se leen sin sesión (enlazadas desde el registro).
const LegalPage = lazy(() => import('@/pages/Legal'))

/**
 * Suspense por ruta y no uno global: dentro del AppShell la cabecera y la navegación siguen
 * visibles mientras llega el chunk. `role="status"` lo anuncia a lectores de pantalla.
 */
function page(element: ReactNode) {
  return (
    <Suspense
      fallback={
        <p role="status" aria-live="polite" className="text-ink-dim">
          Cargando…
        </p>
      }
    >
      {element}
    </Suspense>
  )
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path={routes.login} element={<LoginPage />} />
      <Route path={routes.registro} element={page(<RegisterPage />)} />
      <Route path={routes.terminos} element={page(<LegalPage kind="terminos" />)} />
      <Route path={routes.privacidad} element={page(<LegalPage kind="privacidad" />)} />

      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path={routes.characters} element={page(<CharactersPage />)} />
          <Route path={routes.nuevaHistoria} element={page(<CreateStoryPage />)} />
          <Route path="/historia/:storyId" element={page(<StoryPage />)} />
          <Route path="/historia/:storyId/archivo" element={page(<StoryArchivePage />)} />
          <Route path="/libro/:bookId" element={page(<BookPage />)} />
          <Route path={routes.explorar} element={page(<ExplorePage />)} />
          <Route path="/u/:handle" element={page(<ProfilePage />)} />
          <Route path={routes.configuracion} element={page(<SettingsPage />)} />
          <Route path={routes.rascaYGana} element={page(<ScratchGamePage />)} />
          <Route path={routes.dev} element={page(<DevPage />)} />
          <Route path={routes.moderacion} element={page(<DevModerationPage />)} />
        </Route>
      </Route>

      <Route path="*" element={page(<NotFoundPage />)} />
    </Routes>
  )
}
