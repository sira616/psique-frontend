import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest'
import { __resetMockState } from '@/mocks/handlers'
import { server } from '@/mocks/server'
import { useAuthStore } from '@/stores/authStore'

// El 1 s por defecto de findBy/waitFor mide la CPU de la máquina, no la app: con varios
// workers de jsdom a la vez, el primer render de una página (AppShell + react-query + MSW)
// pasa de 1 s y el test falla al azar. Las aserciones no cambian, solo cuánto se espera.
configure({ asyncUtilTimeout: 5000 })

// Peticiones al mock aún sin responder. Un componente desmontado puede dejar una en vuelo
// (p. ej. las que llevan `delay(150)`) que, al resolverse, tocaría el estado del test siguiente.
const inFlight = new Set<string>()
server.events.on('request:start', ({ requestId }) => inFlight.add(requestId))
server.events.on('request:end', ({ requestId }) => inFlight.delete(requestId))

async function drainInFlight(maxMs = 3000) {
  const until = Date.now() + maxMs
  while (inFlight.size && Date.now() < until) {
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  inFlight.clear()
}

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'bypass' })
})

beforeEach(() => {
  // Cada test arranca con el mock y la sesión como recién cargados, sin depender del orden.
  __resetMockState()
  useAuthStore.getState().clearSession()
})

afterEach(async () => {
  // Primero relojes reales: con timers falsos la espera de abajo no avanzaría nunca.
  vi.useRealTimers()
  cleanup()
  await drainInFlight()
  server.resetHandlers()
})

afterAll(() => {
  server.close()
})
