# Blueprint — Workflow n8n: App → Google Sheets (Switch por eventType)

Flujo **App → n8n → Google Sheets** (escritura). El sentido inverso (Sheet → App) **no usa n8n**: la app lee la Sheet directo por CSV en `sheetParser.js`.

Archivo importable: **`n8n-workflow-app-to-sheet.json`** → en n8n: *⋮ → Import from File*.

> **Diseño de pestaña espejo:** n8n escribe en pestañas **con header en la fila 1** (`App_Sync` y `Log`), NO en la tabla del dashboard que empieza en la fila 27. Esto evita el problema de `headerRow` y no toca tu dashboard KPI. La app sigue leyendo la hoja principal como siempre.

---

## Arquitectura (wiring corregido — un solo Respond por evento)

```
[App] --POST--> [Webhook /jlclosets-changes]
                        │
                 [Switch: eventType]
        ┌───────────────┬────────────────────┬──────────────┐
     ON_HOLD        STAGE_UPDATE           (fallback)
        │               │                      │
   [Upsert App_Sync] [IF sheetStatus≠'']      │
        │            ┌──┴──┐                   │
        │        finished  started            │
        │            │      │                  │
        │      [Upsert]     │                  │
        │            │      │                  │
        └────────────┴──────┴──────────────────┤
                                               ▼
                                     [Append to Log]  ◄── TODOS los eventos
                                               │
                                        [Respond 200]
```

**Punto clave del wiring:** con `responseMode: responseNode`, el webhook responde UNA sola vez. Por eso **todas las ramas convergen primero en `Append to Log`** (el nodo común a todo evento) y solo Log conecta a Respond. Si Upsert y Log conectaran ambos a Respond, se dispararía dos veces → error "Respond already called". Corregido: cada evento tiene un camino único.

**Regla central (respeta tu `n8nService.js`):** `sheetStatus` vacío (`''`) → **no** se toca STATUS; con valor → se actualiza. STAGE_UPDATE pasa por un IF (solo `action:'finished'` trae `sheetStatus`).

---

## Nodos

| Nodo | Tipo (typeVersion) | Qué hace |
|------|------|----------|
| **Webhook** | `webhook` v2 (POST `/jlclosets-changes`) | Recibe el evento. `responseMode: responseNode`. |
| **Switch by eventType** | `switch` v3 | Enruta por `{{ $json.body.eventType }}`: ON_HOLD / STAGE_UPDATE / fallback (`fallbackOutput: extra`). |
| **IF sheetStatus not empty** | `if` v2 | Solo deja pasar STAGE_UPDATE al Upsert cuando `sheetStatus ≠ ''`. |
| **Upsert App_Sync (STATUS)** | `googleSheets` v4.5 `appendOrUpdate` | Busca por `SO` en pestaña `App_Sync` y escribe Status/Engineer/InstallDate/Reason/UpdatedBy/Timestamp. |
| **Append to Log** | `googleSheets` v4.5 `append` | Registra TODO evento en pestaña `Log`. |
| **Respond 200** | `respondToWebhook` v1 | Devuelve `{ ok, eventType, so }`. |

---

## Pestañas a crear en tu Google Sheet

### Pestaña `App_Sync` (header en fila 1)
Espejo de estado que escribe la app. NO es tu tabla del dashboard.

| A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|
| SO | Status | Engineer | InstallDate | Reason | UpdatedBy | Timestamp |

El nodo hace `appendOrUpdate` con match por `SO`: si el SO ya existe, actualiza esa fila; si no, agrega una nueva.

### Pestaña `Log` (header en fila 1)
Historial de todo evento, auditable.

| A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|
| Timestamp | SO | Event Type | Stage/Status | Changed By | Detail | Source |

---

## ⚠️ Qué hacer tras importar

1. **Crear las 2 pestañas** `App_Sync` y `Log` con los headers de arriba (fila 1).
2. **Credencial Google Sheets** — conecta tu cuenta de Google (OAuth2) en los 2 nodos googleSheets. Funciona en n8n Cloud plan gratis (es OAuth normal, no API key).
3. **Activar el workflow** (toggle arriba a la derecha) y copiar la **Production URL** del Webhook.
4. En la app: `VITE_N8N_WEBHOOK_URL` = esa Production URL (hoy `n8nService.js:10` apunta a una URL `webhook-test/...`, solo de test).

---

## Cómo importar (n8n Cloud plan gratis — sin API key)

El plan gratis **no tiene API pública**, así que se importa a mano (funciona igual):

1. Abre `https://jl-kpi-dashboard.app.n8n.cloud`
2. **Create Workflow** (nuevo canvas)
3. Menú **⋮** (arriba dcha) → **Import from File...** → elige `n8n-workflow-app-to-sheet.json`
4. Alternativa: abre el JSON, copia todo, y `Ctrl+V` en el canvas vacío — n8n pega los nodos.

---

## Mapeo evento → columnas

### Upsert App_Sync (solo ON_HOLD y STAGE finished)
| Columna | Expresión |
|---|---|
| SO (match) | `{{ $json.body.so }}` |
| Status | `{{ $json.body.sheetStatus }}` |
| Engineer | `{{ $json.body.engineer \|\| '' }}` |
| InstallDate | `{{ $json.body.installDate \|\| '' }}` |
| Reason | `{{ $json.body.onHoldReason \|\| '' }}` |
| UpdatedBy | `{{ $json.body.changedBy \|\| $json.body.engineer \|\| '' }}` |
| Timestamp | `{{ $json.body.timestamp }}` |

### Append Log (todo evento)
| Columna | Expresión |
|---|---|
| Timestamp | `{{ $json.body.timestamp }}` |
| SO | `{{ $json.body.so }}` |
| Event Type | `{{ $json.body.eventType }}` |
| Stage/Status | `{{ $json.body.stage \|\| $json.body.sheetStatus \|\| '' }}` |
| Changed By | `{{ $json.body.changedBy \|\| $json.body.engineer \|\| $json.body.createdBy \|\| '' }}` |
| Detail | `{{ $json.body.onHoldReason \|\| $json.body.noteText \|\| $json.body.checklistType \|\| '' }}` |
| Source | `{{ $json.body.source }}` |

---

## Validación pendiente con n8n-mcp

Cuando el MCP `n8n-mcp` conecte (`/mcp reconnect all` en la terminal), puedo:
- `validate_workflow` sobre este JSON contra el esquema real de tu versión de n8n
- Confirmar/corregir `typeVersion` de cada nodo (Switch v3, IF v2, googleSheets v4.5) por si tu instancia trae otra
- Confirmar la forma exacta de `appendOrUpdate` / `matchingColumns` en googleSheets v4.5

Estas versiones se escribieron según el esquema conocido; el MCP es para verificarlas contra tu instancia exacta y evitar un import degradado.
