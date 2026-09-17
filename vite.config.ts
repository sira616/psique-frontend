import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import type { Server } from 'node:http'
import { createServer } from '@mswjs/http-middleware'

// MOCK_API_PORT deja al e2e levantar su propio mock sin compartir estado con un dev:mock abierto.
const MOCK_PORT = Number(process.env.MOCK_API_PORT ?? 8787)
const MOCK_HOST = '127.0.0.1'

let mockServer: Server | null = null

async function stopMockServer(): Promise<void> {
  const current = mockServer
  mockServer = null
  if (!current) return
  await new Promise<void>((resolve) => {
    current.close(() => resolve())
  })
}

async function ensureMockServer(
  server: ViteDevServer,
  { force = false }: { force?: boolean } = {},
): Promise<void> {
  if (!force && mockServer?.listening) return
  await stopMockServer()
  const mod = (await server.ssrLoadModule('/src/mocks/handlers.ts')) as {
    handlers: Parameters<typeof createServer>
  }
  const app = createServer(...mod.handlers)
  await new Promise<void>((resolve, reject) => {
    const httpServer = app.listen(MOCK_PORT, MOCK_HOST, () => {
      mockServer = httpServer
      resolve()
    })
    httpServer.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        mockServer = null
        resolve()
        return
      }
      reject(err)
    })
  })
}

function mswDevPlugin(): Plugin {
  return {
    name: 'msw-dev-server',
    configureServer(server) {
      const handlersFile = path.resolve(__dirname, 'src/mocks/handlers.ts')
      server.watcher.add(handlersFile)
      server.watcher.on('change', (file) => {
        if (path.resolve(file) === handlersFile) {
          void ensureMockServer(server, { force: true })
        }
      })
      server.httpServer?.once('close', () => {
        void stopMockServer()
      })
      return async () => {
        await ensureMockServer(server)
      }
    },
    async closeBundle() {
      await stopMockServer()
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  // `npm run dev:mock` (modo mock) o VITE_USE_MOCK_API=true: API simulada con MSW en Node.
  const useMockApi = mode === 'mock' || env.VITE_USE_MOCK_API === 'true'

  const apiTarget = useMockApi
    ? `http://${MOCK_HOST}:${MOCK_PORT}`
    : (env.VITE_API_TARGET ?? 'http://127.0.0.1:8010')

  return {
    plugins: [react(), tailwindcss(), ...(useMockApi ? [mswDevPlugin()] : [])],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            // Vendors que cambian poco, en chunks propios: siguen en la caché del navegador
            // entre despliegues de la app. El markdown solo lo usa la partida y va aparte para
            // no entrar en la carga inicial (sus dependencias las arrastra el propio grupo).
            groups: [
              {
                name: 'react-vendor',
                test: /node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom|@tanstack[\\/][^\\/]+)[\\/]/,
                priority: 20,
              },
              {
                name: 'markdown',
                test: /node_modules[\\/](react-markdown|rehype-sanitize)[\\/]/,
                priority: 10,
              },
            ],
          },
        },
      },
    },
    server: {
      // Puertos por .env: en esta máquina el 8000 y el 5173 pueden estar cogidos por otros proyectos.
      port: Number(env.VITE_PORT ?? 5180),
      strictPort: true,
      // /media: el backend sirve avatares y banners con URLs relativas al mismo origen que /api.
      proxy: Object.fromEntries(
        ['/api', '/media'].map((prefix) => [prefix, { target: apiTarget, changeOrigin: true }]),
      ),
    },
  }
})
