# Psique — frontend

[![CI](https://github.com/sira616/psique-frontend/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/sira616/psique-frontend/actions/workflows/ci.yml)

Vite + React 19 + TypeScript + Tailwind 4. Narrativa interactiva con IA y moderación:
historias con streaming, libros y historias propias, exploración pública, perfiles,
economía de monedas y apelación de incidentes.

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
npm run e2e        # Playwright + axe contra la API simulada (puerto 5195, solo Chromium)
```

La primera vez, para el e2e: `npx playwright install chromium`. En cada push y PR a `main`,
GitHub Actions (`.github/workflows/ci.yml`) pasa typecheck, vitest, build y el e2e.

## Estructura

```
src/
  api/                un módulo por dominio: auth, stories, books, customStories, explore,
                      profile, account, economy, incidents, policy, legal, dev
  features/           story (SSE, transcript, chat/*), book (ficha, reseñas, recomendados),
                      customStories (crear, editar, visibilidad, estadísticas),
                      publicStories (tarjetas de explorar), profile, account (tus datos),
                      economy (monedero, rasca y gana), policy (aviso y puerta +18),
                      incidents (restricciones y apelaciones), legal (términos y
                      privacidad), auth, dev (herramientas y moderación)
  pages/              17 páginas, cargadas por ruta:
                        acceso    Login, Register
                        jugar     Characters, Story, StoryArchive
                        libros    Book, Explore, Profile
                        propias   CreateStory, MyStories, MyStoryDetail
                        cuenta    Settings, ScratchGame, Legal
                        dev       Dev, DevModeration (cola de moderación)
                        otras     NotFound
  router/             paths.ts (rutas tipadas), routes.tsx y RequireAuth
  content/legal/      términos y privacidad en Markdown, con versión
  shared/lib/         apiClient (refresh compartido), events (contrato + parser SSE),
                      colorContrast + wcagPalette, errorBoundary, media
  shared/ui, layout/  componentes base, AppShell, ThemeToggle, Wordmark
  shared/economy/     formato de moneda
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
- La sesión no sobrevive a una recarga: valorar refresh en cookie `HttpOnly`.
