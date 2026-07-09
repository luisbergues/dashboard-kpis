# Diseño — Sincronización App → Google Sheets nativa (reemplazo de n8n)

**Fecha:** 2026-07-09
**Estado:** Aprobado, listo para implementation plan

## Objetivo

Reemplazar el workflow externo de n8n (App → n8n webhook → Google Sheets) por una función serverless nativa en Vercel (App → `/api/sync` → Google Sheets). Elimina la dependencia de n8n y su problema de registro de webhooks de producción.

## Contexto

- App React + Vite, desplegada en Vercel. Ya usa Vercel Functions (`api/chat.js`, `api/translate.js`) con el patrón `export default async function handler(req, res)` y secretos server-side vía `process.env`.
- Hoy `src/utils/n8nService.js` expone 9 helpers tipados que hacen `fetch` a un webhook de n8n. Los llaman `MyProjectsView.jsx`, `PipelineView.jsx`, `CalendarView.jsx`.
- La app **lee** el Sheet por CSV público (`sheetParser.js`) — eso NO cambia.
- Sheet destino: `APP JL Project Status for app`, ID `1rzZn9J2p6Plz7Xxy9-JwgdijFkqGg7WC2rFpNnxUreY`, pestaña `copy testing` (header fila 1, datos desde fila 2).

## Arquitectura

```
[React app]                       [Vercel serverless]              [Google Sheets]
sheetSync.js  ──POST /api/sync──→   api/sync.js  ──googleapis──→   'copy testing'
(9 helpers)      {eventType,...}    (service account auth)          (match por SO#)
```

Same-origin (sin CORS, sin URL externa). Fire-and-forget: la app no bloquea ni rompe si el sync falla.

## Estructura de la pestaña `copy testing`

| Col | Header | Se escribe? |
|-----|--------|-------------|
| B | SO# | referencia (match) — nunca se reescribe |
| C | NAME | no |
| D | INSTALL | no |
| E | MATERIAL | no |
| F | MEETING | no |
| G | SIGN | no |
| H | SENT BY | no |
| I | ENG | sí (ENGINEER_ASSIGNED) |
| J | START DATE | sí (STAGE_UPDATE / ingeniería) |
| K | Check Date 1 | sí (STAGE_UPDATE / check1) |
| L | Check Date 2 | sí (STAGE_UPDATE / check2) |
| M | COMPLETION DATE | sí (STAGE_UPDATE / paperwork) |
| N | STATUS | sí (STAGE_UPDATE, ON_HOLD) |
| O | OBS / ACCESSORIES / NOTES | sí (NOTE_ADDED obs — append) |

Valores válidos del dropdown STATUS (col N): `Review`, `Engineering`, `Check`, `Paperwork`, `Nesting`, `ON HOLD`, `✓`.

## Endpoint `api/sync.js`

Flujo del handler:

1. Validar método POST; validar que venga `so`. Sin `so` → 400.
2. Autenticar con `googleapis` usando la service account (`GOOGLE_SERVICE_ACCOUNT_KEY` parseada de env).
3. Leer columna B (`copy testing!B:B`) → encontrar el índice de fila cuyo SO# coincide con `body.so`.
   - Si no existe → responder `200 { skipped: 'SO not found' }` (no rompe la app).
4. `switch(eventType)` → escribir la(s) celda(s) exacta(s) con `values.update` (rango puntual tipo `copy testing!J{fila}`, nunca la fila entera):

   - **ENGINEER_ASSIGNED** → col I = `engineer`
   - **STAGE_UPDATE** → escribe la fecha que venga con valor Y el STATUS juntos:
     - `startDate` no vacío → col J
     - `checkDate1` no vacío → col K
     - `checkDate2` no vacío → col L
     - `completionDate` no vacío → col M
     - col N (STATUS) = `sheetStatus` del payload (siempre que venga con valor).
     - **Fuente de verdad del status: el cliente.** El mapeo stage→STATUS vive en `sheetSync.js` (ver abajo), que manda el `sheetStatus` ya resuelto. El endpoint NO remapea: escribe lo que recibe. Así hay una sola fuente de verdad y el endpoint queda tonto/simple.
   - **ON_HOLD** → col N = `ON HOLD` (usa `sheetStatus`)
   - **NOTE_ADDED** con `noteType==='obs'` → leer col O actual, escribir `previo ? previo + ' - ' + noteText : noteText`. Si `noteType` ≠ 'obs' → skip.
   - **default** (RELEASE_HOLD, QA_CHECKLIST, CALENDAR_NOTE_*, INSTALL_DATE_CHANGED, WEBHOOK_TEST) → `200 { skipped }`, no escribe.
5. Responder `200 { ok: true, so, eventType }`. En error de Sheets → `502`, pero la app lo ignora.

### Mapeo stage → STATUS (col N) — vive en `sheetSync.js` (cliente)

| Stage / acción | Fecha | sheetStatus que manda el cliente |
|---|---|---|
| ingeniería (started) | J | `Engineering` |
| check_eng / check1 (started) | K | `Check` |
| check_eng2 / check2 (started) | L | `Check` |
| paperwork (finished) | M | `Paperwork` |
| nesting (started/finished) | — | `Nesting` |

Los dos checks comparten STATUS `Check`; se distinguen por la fecha (K vs L). El endpoint solo escribe el `sheetStatus` recibido en col N.

### Optimización de escritura

Cuando un evento toca fecha + status (STAGE_UPDATE), usar `values.batchUpdate` con los 2 rangos en una sola llamada, para no hacer 2 round-trips.

## Cliente `src/utils/sheetSync.js` (reemplaza `n8nService.js`)

- Mantiene las **mismas 9 firmas** de helpers (`sendOnHoldEvent`, `sendReleaseHoldEvent`, `sendStageEvent`, `sendQAChecklistEvent`, `sendNoteEvent`, `sendEngineerAssignEvent`, `sendCalendarNoteEvent`, `sendInstallDateChangeEvent`, `testWebhook`→`testSync`) para no reescribir las vistas.
- `fetch('/api/sync', { method:'POST', ... })` — relativo, same-origin.
- Fire-and-forget; sin reintentos con backoff (innecesarios same-origin). Mantiene "fail silently" con `console.debug/warn`.
- **Cambio de lógica:** `sendStageEvent` calcula y manda `sheetStatus` también en `action==='started'` (hoy solo en `finished`), según el mapeo stage→STATUS. Conserva el cálculo de fechas ya existente.
- Conserva `APP_STATUS_TO_SHEET` / `toSheetStatus` (siguen siendo útiles).

## Cambios en las vistas

Solo el import (3 archivos), de `'../utils/n8nService'` a `'../utils/sheetSync'`:
- `src/views/MyProjectsView.jsx`
- `src/views/PipelineView.jsx`
- `src/views/CalendarView.jsx`

Ningún cambio en las llamadas (las firmas se conservan).

## Variables de entorno

Nuevas (Vercel + `.env.local`), ambas **server-only** (sin prefijo `VITE_`):
- `GOOGLE_SERVICE_ACCOUNT_KEY` — JSON completo de la service account (string). Se parsea con `JSON.parse` en el endpoint.
- `SYNC_SHEET_ID` — `1rzZn9J2p6Plz7Xxy9-JwgdijFkqGg7WC2rFpNnxUreY`.

Se elimina: `VITE_N8N_WEBHOOK_URL` (ya no se usa).

## Dependencia nueva

- `googleapis` (npm). Solo se importa en `api/sync.js` (server), no entra al bundle del cliente.

## Setup manual (una vez, lo hace el usuario)

1. Crear Service Account en Google Cloud Console → generar clave JSON.
2. Compartir la hoja `copy testing` (el spreadsheet) con el email de la service account, permiso **Editor**.
3. Pegar el JSON en `GOOGLE_SERVICE_ACCOUNT_KEY` (local + Vercel) y `SYNC_SHEET_ID`.
4. Redeploy en Vercel.

## Manejo de errores

- Sin `so` → 400.
- SO no encontrado en la hoja → 200 `{ skipped }` (no error; el proyecto puede no estar en `copy testing` aún).
- Falla de Google Sheets API → 502, logueado server-side. La app ignora (fire-and-forget).
- Sin credenciales configuradas → 500 con mensaje claro; la app ignora.
- `noteType` ≠ 'obs' en NOTE_ADDED → skip silencioso.

## Testing

- Unit (vitest, ya configurado): helpers de `sheetSync.js` construyen el payload correcto por evento; el mapeo stage→STATUS es correcto.
- Endpoint: test de la función de mapeo eventType→columnas (pura, extraíble). La escritura real a Sheets se valida manualmente contra `copy testing` con SO# de prueba (11088).
- Verificación end-to-end: disparar cada evento y confirmar en el Sheet que cada columna se escribe y que ninguna fecha borra otra.

## Fuera de alcance (YAGNI)

- No se toca la lectura CSV (`sheetParser.js`).
- No se migran los eventos que hoy no escriben en `copy testing` (RELEASE_HOLD, QA, calendar) — quedan como skip.
- No se borra el workflow de n8n en este cambio (queda obsoleto; el usuario lo elimina cuando quiera).
