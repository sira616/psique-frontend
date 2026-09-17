# Psique — frontend

Vite + React 19 + TypeScript + Tailwind 4. Chat de historias románticas con streaming,
indicador de fase y afinidad y sugerencias de acción.

El frontend **no decide nada** del estado de la historia: fase, afinidad y sugerencias
llegan del backend (`psique-backend`) en el evento `state` del SSE. Aquí solo se pintan.

## Arranque (Windows, PowerShell)

```powershell
npm install
npm run dev:mock   # sin backend: API simulada con MSW en Node (puerto 8787)
npm run dev        # con backend: Vite proxya /api a http://127.0.0.1:8000
```

Con la API simulada entra con `demo` / `DemoPsique2026` o regístrate (vive en memoria).
Para el backend real, ver `../psique-backend/README.md`.

```powershell
npm test           # vitest (unitarios + contraste WCAG AA de la paleta)
npm run build      # tsc -b + vite build
```

## Estructura

```
src/
  api/                auth.ts, stories.ts
  features/story/     useStoryStream (SSE), StoryStatus, MarkdownStream, chat/*
  features/auth/      AuthShell
  pages/              Login, Register, Characters, Story, NotFound
  router/             rutas y RequireAuth
  shared/lib/         apiClient (refresh compartido), events (contrato + parser SSE),
                      colorContrast + wcagPalette, errorBoundary
  shared/ui, layout/  componentes base, AppShell, ThemeToggle, Wordmark
  stores/             authStore (tokens en memoria), uiStore (tema)
  mocks/              handlers MSW, fixtures y generador SSE
  styles/tokens.css   paleta clara/oscura
```

## Decisiones

- **Tokens en memoria**, no en `localStorage`: recargar cierra la sesión, pero un script
  inyectado no encuentra nada que leer.
- Las *quick choices* se mandan por `choiceId`; el texto y el peso los pone el servidor.
- `wcagPalette.ts` replica los pares de `tokens.css` y un test exige AA. Si cambias un
  color, cambia los dos.

## Pendiente

- El bundle incluye MSW (~880 kB sin comprimir): cargarlo con `import()` solo en
  desarrollo/preview.
- Tras una *quick choice* la burbuja muestra la etiqueta; el texto real que guarda el
  servidor aparece al recargar la historia.
- Sin tests e2e (Playwright) ni auditoría axe todavía.
- La sesión no sobrevive a una recarga: valorar refresh en cookie `HttpOnly`.
