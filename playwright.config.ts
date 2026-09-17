import { defineConfig, devices } from '@playwright/test'

// Puertos propios del e2e: el 5180 y el 8787 son del desarrollo diario y el mock guarda estado
// en memoria, así que compartir servidor haría que los tests dependieran de lo que haya tocado otro.
const PORT = 5195
const MOCK_API_PORT = 8795
const isCI = Boolean(process.env.CI)

export default defineConfig({
  testDir: './e2e',
  // El mock es uno para toda la ejecución y los flujos cambian su estado (saldo, capítulos):
  // en serie y con un solo worker cada test sabe de qué partida arranca.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: isCI,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'es-ES',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run dev:mock -- --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    env: { VITE_PORT: String(PORT), MOCK_API_PORT: String(MOCK_API_PORT) },
    // Siempre un servidor nuevo: uno reutilizado arrastraría el estado del mock de otra ejecución.
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
