# Blueprint — Workflow n8n: App → pestaña `copy testing` (por columna)

Flujo **App → n8n → Google Sheets** (escritura por columna, match por `SO#`). El sentido inverso (Sheet → App) no usa n8n.

- **Sheet:** `APP JL Project Status for app` (ID `1rzZn9J2p6Plz7Xxy9-JwgdijFkqGg7WC2rFpNnxUreY`)
- **Pestaña:** `copy testing` (header en fila 1, datos desde fila 2)
- **Archivo importable:** `n8n-workflow-app-to-sheet.json`

> **Clave — match por SO#:** todos los nodos usan `appendOrUpdate` con match por columna `SO#`. n8n encuentra la fila por el VALOR de SO#, no por número de fila. Si reordenás/filtrás la hoja, los datos siguen al proyecto correcto.

---

## Columnas de `copy testing` y comportamiento

| Col | Header | Se modifica desde |
|-----|--------|-------------------|
| B | SO# | 🔑 referencia (match) — no se escribe, se usa para ubicar |
| C | NAME | ❌ no se toca |
| D | INSTALL | ❌ no se toca |
| E | MATERIAL | ❌ no se toca |
| F | MEETING | ❌ no se toca |
| G | SIGN | ❌ no se toca |
| H | SENT BY | ❌ no se toca |
| I | ENG | ✏️ `ENGINEER_ASSIGNED` (assign eng en Pipeline) |
| J | START DATE | ✏️ `STAGE_UPDATE` con `startDate` (sacar de review→engineering) |
| K | Check Date 1 | ✏️ `STAGE_UPDATE` con `checkDate1` (start check 1er ing.) |
| L | Check Date 2 | ✏️ `STAGE_UPDATE` con `checkDate2` (start check 2do ing.) |
| M | COMPLETION DATE | ✏️ `STAGE_UPDATE` con `completionDate` (paperwork check) |
| N | STATUS | ✏️ `STAGE_UPDATE`(finished) y `ON_HOLD` (cambio de status en My Projects) |
| O | OBS / ACCESSORIES / NOTES | ✏️ `NOTE_ADDED` con `noteType='obs'` — **append con ` - `**, no borra lo previo |

---

## Arquitectura

```
Webhook(/jl-sync) → Switch(eventType)
   ├─0 ENGINEER_ASSIGNED → Set ENG (upsert col I)
   ├─1 STAGE_UPDATE ─────→ Set Stage Dates+Status (upsert J,K,L,M,N — solo las que traen valor)
   ├─2 ON_HOLD ──────────→ Set STATUS (upsert N)
   ├─3 NOTE_ADDED+obs ───→ Get row for OBS (read) → Append OBS note (concat + upsert O)
   └─4 fallback ─────────→ Respond (ignora)
                              → Respond 200
```

- **Un evento → un camino → un Respond.** (evita el bug "Respond already called").
- Cada rama toca **solo sus columnas**; `appendOrUpdate` deja intactas las demás (NAME, INSTALL, etc.).
- **OBS**: el nodo Read trae el valor actual de la columna; el Append concatena `previo + ' - ' + nuevo`. Si estaba vacío, escribe solo la nota nueva.

### Detalle STAGE_UPDATE
El payload ya trae `startDate`/`checkDate1`/`checkDate2`/`completionDate` calculados por la app (`n8nService.js`), y solo uno tiene valor por evento. Los vacíos (`''`) sobrescriben con vacío — ⚠️ ver nota abajo.

> **⚠️ Posible ajuste STAGE_UPDATE:** como el nodo mapea las 5 columnas y las que no aplican van `''`, un `STAGE_UPDATE` de "check 1" escribiría `''` en START DATE / Completion, borrándolas. Si eso molesta, hay que separar en sub-ramas por stage o usar expresiones que solo escriban cuando hay valor. Se decide tras la primera prueba real.

---

## Cómo importar (n8n Cloud plan free — sin API)

1. En n8n → **Create Workflow** → **⋮ → Import from File** → `n8n-workflow-app-to-sheet.json`
2. En **cada** nodo Google Sheets (6 nodos): re-seleccioná de la lista:
   - **Document** = "APP JL Project Status for app"
   - **Sheet** = "copy testing"
   - Verificá "Column to match on" = **SO#** en los que hacen upsert
3. Seleccioná la **credencial** Google Sheets en cada nodo
4. **Guardá** y **activá**

### Webhook
- Path: `/jl-sync` → Production URL: `https://jl-kpi-dashboard.app.n8n.cloud/webhook/jl-sync`
- Esa URL va en `VITE_N8N_WEBHOOK_URL` (`.env.local` + Vercel) tras activar.

---

## Estado de validación (MCP)
`validate_workflow` → **valid: true**, 8 nodos, 11 conexiones, 19 expresiones, 0 errores. typeVersions confirmadas: webhook v2, switch v3, googleSheets v4.7, respondToWebhook v1.

## Pendiente conocido: registro webhook de producción
En pruebas anteriores, la instancia n8n Cloud no registraba la Production URL (404) aunque el workflow funcionaba por Test URL. Este workflow es NUEVO (path `/jl-sync`, IDs UUID nuevos) → debería registrar limpio. Si vuelve a dar 404 en prod, es bug de la instancia; usar Test URL o abrir ticket con soporte n8n.
