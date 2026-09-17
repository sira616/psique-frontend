import { Route, Routes } from 'react-router-dom'
import { RequireAuth } from '@/router/RequireAuth'
import { routes } from '@/router/paths'
import { AppShell } from '@/shared/layout/AppShell'
import { LoginPage } from '@/pages/Login'
import { RegisterPage } from '@/pages/Register'
import { CharactersPage } from '@/pages/Characters'
import { StoryPage } from '@/pages/Story'
import { StoryArchivePage } from '@/pages/StoryArchive'
import { BookPage } from '@/pages/Book'
import { CreateStoryPage } from '@/pages/CreateStory'
import { NotFoundPage } from '@/pages/NotFound'
import { ExplorePage } from '@/pages/Explore'
import { ProfilePage } from '@/pages/Profile'
import { SettingsPage } from '@/pages/Settings'
import { ScratchGamePage } from '@/pages/ScratchGame'

export function AppRoutes() {
  return (
    <Routes>
      <Route path={routes.login} element={<LoginPage />} />
      <Route path={routes.registro} element={<RegisterPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path={routes.characters} element={<CharactersPage />} />
          <Route path={routes.nuevaHistoria} element={<CreateStoryPage />} />
          <Route path="/historia/:storyId" element={<StoryPage />} />
          <Route path="/historia/:storyId/archivo" element={<StoryArchivePage />} />
          <Route path="/libro/:bookId" element={<BookPage />} />
          <Route path={routes.explorar} element={<ExplorePage />} />
          <Route path="/u/:handle" element={<ProfilePage />} />
          <Route path={routes.configuracion} element={<SettingsPage />} />
          <Route path={routes.rascaYGana} element={<ScratchGamePage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
