# N8N_SETUP.md — Configuración del Webhook (App → Google Sheets)

## Arquitectura del Workflow

```
[App React] --POST--> [n8n Webhook] --> [Get row(s)] --> [Update row / Append row]
```

El workflow que ya tenés en n8n es el correcto:  
**Webhook → Get row(s) in sheet → Update row in sheet**

---

## Paso 1: Configurar el Webhook en n8n

### 1.1 Activar el nodo Webhook
- Método: **POST**
- Path: `jlclosets-changes` (o el que prefieras)
- Authentication: **None** (la URL ya es secreta por ser un UUID)
- Response Mode: **When last node finishes**

### 1.2 Copiar la Production URL
Una vez activado el workflow, copiar la **Production URL**. Ejemplo:
```
https://luisbergu.app.n8n.cloud/webhook/jlclosets-changes
```

### 1.3 Pegar en `.env.local`
```env
VITE_N8N_WEBHOOK_URL=https://luisbergu.app.n8n.cloud/webhook/jlclosets-changes
```

> Si la app está en Vercel, agregar esta variable también en **Vercel → Settings → Environment Variables** y hacer redeploy.

---

## Paso 2: Estructura del Payload que envía la App

### Evento ON_HOLD
```json
{
  "eventType": "ON_HOLD",
  "timestamp": "2026-07-01T20:15:00.000Z",
  "source": "jlclosets-dashboard",
  "so": "12345",
  "projectName": "Smith: Master Bedroom Closets",
  "engineer": "Luis",
  "installDate": "2026-07-20",
  "onHoldReason": "Falta aprobación de planos del cliente",
  "changedBy": "Luis"
}
```

### Evento RELEASE_HOLD
```json
{
  "eventType": "RELEASE_HOLD",
  "timestamp": "2026-07-02T10:30:00.000Z",
  "source": "jlclosets-dashboard",
  "so": "12345",
  "projectName": "Smith: Master Bedroom Closets",
  "engineer": "Luis",
  "changedBy": "Luis"
}
```

### Evento STAGE_UPDATE (Engineering Check o Nesting)
```json
{
  "eventType": "STAGE_UPDATE",
  "timestamp": "2026-07-01T18:45:00.000Z",
  "source": "jlclosets-dashboard",
  "so": "12345",
  "stage": "check_eng",
  "action": "finished",
  "engineer": "Luis"
}
```

### Evento QA_CHECKLIST
```json
{
  "eventType": "QA_CHECKLIST",
  "timestamp": "2026-07-01T19:00:00.000Z",
  "source": "jlclosets-dashboard",
  "so": "12345",
  "stage": "check1",
  "checklistType": "engineering",
  "checkedBy": "Luis"
}
```

---

## Paso 3: Configurar "Get row(s) in sheet"

| Campo | Valor |
|-------|-------|
| Spreadsheet | (tu Google Sheet mirror) |
| Sheet | nombre de tu hoja |
| Filters → Column | `SO` |
| Filters → Value | `{{ $json.body.so }}` |

---

## Paso 4: Mapeo de columnas para Update/Append

| Columna en Sheet | Expresión n8n |
|------------------|--------------|
| `SO` | `{{ $('Webhook').item.json.body.so }}` |
| `Project Name` | `{{ $('Webhook').item.json.body.projectName }}` |
| `Event Type` | `{{ $('Webhook').item.json.body.eventType }}` |
| `Status / Stage` | `{{ $('Webhook').item.json.body.stage || $('Webhook').item.json.body.eventType }}` |
| `Reason` | `{{ $('Webhook').item.json.body.onHoldReason || '' }}` |
| `Changed By` | `{{ $('Webhook').item.json.body.changedBy || $('Webhook').item.json.body.engineer }}` |
| `Timestamp` | `{{ $('Webhook').item.json.body.timestamp }}` |
| `Engineer` | `{{ $('Webhook').item.json.body.engineer || '' }}` |
| `Install Date` | `{{ $('Webhook').item.json.body.installDate || '' }}` |

---

## Paso 5: Probar con curl

```bash
curl -X POST https://TU_INSTANCIA.app.n8n.cloud/webhook/jlclosets-changes \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "TEST",
    "timestamp": "2026-07-01T12:00:00.000Z",
    "source": "jlclosets-dashboard",
    "so": "99999",
    "projectName": "Test Project",
    "engineer": "Luis",
    "changedBy": "Luis"
  }'
```

Si en n8n aparece la ejecución como exitosa → el webhook funciona ✅

---

## Variables de Entorno

| Variable | Donde |
|----------|-------|
| `VITE_N8N_WEBHOOK_URL` | `.env.local` (dev) + Vercel env vars (prod) |

> La app envía los eventos en background. Si la URL está vacía, los eventos se omiten silenciosamente sin romper nada. Reintentos: 3 intentos con backoff exponencial.
