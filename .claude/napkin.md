# Napkin — psique-frontend

## Tests (vitest)
- Fallos al azar en la suite completa = CPU, no lógica: no subir workers por encima de `maxWorkers: 2` ni bajar `asyncUtilTimeout`.
- El estado del mock se resetea en `tests/setup.ts` (`__resetMockState`); un estado nuevo en `src/mocks/handlers.ts` debe entrar ahí.
- Node 26: el `localStorage` global es el de Node (vacío/undefined), no el de jsdom. No usarlo en setup.

## E2E (Playwright)
- `npm run e2e` levanta `dev:mock` en 5195 con mock en 8795 (`MOCK_API_PORT`). No usar 5180/8787/8000/5173.
- El mock sin cookie canjea el último refresh emitido: un contexto nuevo puede entrar ya logueado (`loginDemo` lo contempla).
- El mock vive en memoria toda la ejecución: tests en serie, un worker.
- `e2e/legal-y-moderacion.spec.ts` depende del orden: apela el incidente #1 (story-cerrada) y luego dev lo acepta, lo que reabre esa partida.

## Mock (MSW)
- `POST /api/me/:kind` (avatar/banner) captura cualquier `/api/me/<x>`: los handlers nuevos de `/api/me/*` van antes en el array (p. ej. `incidentHandlers` al principio).
- Términos pendientes en tests: `__setTermsAccepted(userId, false)` antes del login; restricción: `__restrictAccount(userId, días)`.
