import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.{test,spec}.{ts,tsx}'],
    css: true,
    // Cada fichero monta jsdom y renderiza páginas enteras: es CPU pura. Con un worker por
    // núcleo lógico (lo de por defecto) en un i3 o en un runner de CI se pisan entre ellos y
    // los tiempos se disparan; dos workers van casi igual de rápido y sin saturar.
    maxWorkers: 2,
    // Margen para máquinas lentas; un test colgado de verdad sigue fallando.
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
})
