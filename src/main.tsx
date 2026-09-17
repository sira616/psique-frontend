import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useUiStore } from '@/stores/uiStore'
import { refreshSession } from '@/shared/lib/apiClient'

useUiStore.getState().setTheme(useUiStore.getState().theme)

async function bootstrap() {
  // MSW en el navegador solo en un build con API simulada (`dev:mock` la sirve desde Node).
  // Con import dinámico, msw no entra en el bundle normal.
  if (import.meta.env.PROD && import.meta.env.VITE_USE_MOCK_API === 'true') {
    const { startMockWorker } = await import('@/mocks/browser')
    await startMockWorker()
  }

  // Antes de pintar: si hay cookie de refresh, la recarga no manda al login.
  await refreshSession()

  const rootElement = document.getElementById('root')
  if (!rootElement) throw new Error('No existe #root')

  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void bootstrap()
