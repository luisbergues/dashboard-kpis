# Production Review Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir los 9 problemas encontrados en la revisión funcional de producción del dashboard KPIs: theming claro/oscuro incompleto, i18n incompleta, nombres de proyecto duplicados, Designer Perf. en cero, tablas cortadas, fechas inconsistentes, truncamiento sin tooltip, header faltante en Pipeline y eventos de calendario truncados.

**Architecture:** La app es una SPA **React 19 + Vite** desplegada en Vercel (NO es Next.js, pese a lo que dice el reporte original). El tema se maneja con la clase `light-theme` en `<html>` (`src/utils/ThemeContext.jsx`) + variables CSS en `src/index.css`. i18n vive en `src/utils/translations.js` consumido vía `useLanguage()` → `t('clave.anidada')` (lookup simple, **sin interpolación de parámetros**). Los datos vienen de un Google Sheet parseado por `src/utils/sheetParser.js`; la columna Name llega con formato `"Cliente:[SO#] NombreProyecto"` (verificado contra el CSV real: `Chris Jaensch:[12112] Chris Jaensch`).

**Tech Stack:** React 19, Vite 8, Vitest 4 (tests colocados en `__tests__/`), date-fns + locales es/enUS, Firebase RTDB, ESLint.

## Contexto crítico: producción está atrasada

Producción corre una versión ~14 commits detrás de `main` local. Dos de los 9 problemas **ya están resueltos en main** y solo necesitan deploy:

- **#9 (calendario con eventos truncados):** RESUELTO. Al hacer click en un día se abre un modal con la lista completa de instalaciones y notas (`src/views/CalendarView.jsx:506-574`, vista `dayModalView === 'list'`).
- **#5 (tablas cortadas):** MAYORMENTE RESUELTO. `MaterialsView.css` ya tiene `overflow-x: auto` + `min-width: 800px` + sombra indicadora de scroll (solo móvil); el Projects Directory ya tiene wrapper con `overflow: auto` + `minWidth: 720` (`src/designer-performance/views/ProjectsView.tsx:176-177`). Solo falta el indicador visual en desktop (Task 8).

El resto sí requiere trabajo. La Task 9 hace el deploy que activa todo.

## Global Constraints

- Comandos de verificación: `npx vitest run` (210 tests actuales, todos verdes), `npm run build`, `npm run lint` (la paridad de warnings contra main debe mantenerse).
- Todo texto visible al usuario debe existir en **inglés Y español** en `src/utils/translations.js`. `t()` NO soporta interpolación `{param}` — dividir frases si hace falta.
- Los VALORES de estado (`'Pending'`, `'Unassigned'`, `'Completed'`…) son claves de datos en Firebase/filtros — **traducir solo la etiqueta mostrada, nunca el valor**.
- Celdas del sheet pueden llegar como `number` (PapaParse) — todo helper que reciba datos del sheet usa `String(x ?? '')` antes de métodos de string (lección del bug `isPlaceholderName`).
- Los CSS de impresión (`PDFGeneratorModal.css`, `PDFPrintLayout.css`, `IPPrintLayout.css`) NO se migran a variables de tema: los PDFs deben verse igual en ambos temas.
- Rama de trabajo: `fix/production-review`, merge a `main` al final (Task 9).

## File Structure

| Archivo | Rol |
|---|---|
| `src/utils/projectName.js` (crear) | Util `shortProjectName()` — nombre corto desde `"Cliente:[SO] Nombre"` |
| `src/utils/dateFormat.js` (crear) | Util `formatDisplayDate()` — formato único de fechas, locale-aware |
| `src/utils/__tests__/projectName.test.js` (crear) | Tests del util de nombres |
| `src/utils/__tests__/dateFormat.test.js` (crear) | Tests del util de fechas |
| `src/utils/__tests__/translationsParity.test.js` (crear) | Test: en/es tienen las mismas claves |
| `src/utils/translations.js` | + `pipeline.subtitle`, + sección `designerPerf` |
| `src/index.css` | + variables `--overlay-*` (dark y light), + clase `.h-scroll-shadow` |
| CSS de vistas/componentes | Migrar `rgba(255,255,255,x)` y hexes de texto claro a variables |
| `src/designer-performance/*` | i18n + nombre corto + estado vacío honesto |
| `src/views/MaterialsView.jsx` | Nombre corto + fecha formateada + tooltip |
| `src/views/PipelineView.jsx` | Subtítulo de header + fechas + tooltips |

---

### Task 1: Util `shortProjectName` + fix de nombres duplicados

El sheet entrega Name como `"Chris Jaensch:[12112] Chris Jaensch"`. La app principal ya recorta con el idioma `String(p.name || '').split(':')[0].trim()` (en ~20 sitios), pero dos tablas renderizan el string crudo: **Materials Requirements** (`src/views/MaterialsView.jsx:42`) y **Projects Directory** (vía `src/designer-performance/context/KpiContext.tsx:85`). Se crea un util compartido y se usa en los sitios rotos + se migran los sitios existentes al util (DRY).

**Files:**
- Create: `src/utils/projectName.js`
- Test: `src/utils/__tests__/projectName.test.js`
- Modify: `src/designer-performance/context/KpiContext.tsx:85`, `src/views/MaterialsView.jsx:42`, y migración mecánica de los call sites listados en Step 6.

**Interfaces:**
- Produces: `shortProjectName(name: unknown): string` — recorta en el primer `:`, trimea, nunca lanza (acepta `undefined`/`null`/`number`).

- [ ] **Step 1: Escribir el test que falla**

```js
// src/utils/__tests__/projectName.test.js
import { describe, it, expect } from 'vitest';
import { shortProjectName } from '../projectName';

describe('shortProjectName', () => {
  it('recorta el sufijo ":[SO] ..." que trae la columna Name del sheet', () => {
    expect(shortProjectName('Chris Jaensch:[12112] Chris Jaensch')).toBe('Chris Jaensch');
    expect(shortProjectName('Brian Wille:[12389] Wille Residence')).toBe('Brian Wille');
  });

  it('deja intacto un nombre sin dos puntos', () => {
    expect(shortProjectName('Perez Residence')).toBe('Perez Residence');
  });

  it('trimea espacios alrededor', () => {
    expect(shortProjectName('  Perez : Master Closet')).toBe('Perez');
  });

  // PapaParse devuelve number para celdas puramente numéricas.
  it('nunca lanza con undefined, null o number', () => {
    expect(shortProjectName(undefined)).toBe('');
    expect(shortProjectName(null)).toBe('');
    expect(shortProjectName(12480)).toBe('12480');
    expect(shortProjectName(0)).toBe('0');
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `npx vitest run src/utils/__tests__/projectName.test.js`
Expected: FAIL — `Failed to resolve import "../projectName"`.

- [ ] **Step 3: Implementación mínima**

```js
// src/utils/projectName.js
// Sheet Name cells arrive as "Cliente:[SO#] Nombre" (e.g. "Chris
// Jaensch:[12112] Chris Jaensch"); views show only the client part.
// PapaParse hands back a number for purely-numeric cells, hence String(?? '').
export const shortProjectName = (name) => String(name ?? '').split(':')[0].trim();
```

- [ ] **Step 4: Verificar que pasa**

Run: `npx vitest run src/utils/__tests__/projectName.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Usar el util en los dos sitios rotos**

En `src/designer-performance/context/KpiContext.tsx` (import arriba del archivo, cambio en línea 85):

```tsx
import { shortProjectName } from '../../utils/projectName';
// ...
        projectName:  shortProjectName(p.name) || `SO #${so}`,
```

En `src/views/MaterialsView.jsx` (import + línea 42; el `title` con el nombre completo también aporta al Task 3):

```jsx
import { shortProjectName } from '../utils/projectName';
// ...
                <td className="name-cell" title={item.name}>{shortProjectName(item.name)}</td>
```

- [ ] **Step 6: Migrar los call sites existentes del idioma `split(':')[0]` al util**

Reemplazo mecánico — en cada sitio, `String(X.name || '').split(':')[0].trim()`, `X.name.split(':')[0].trim()` o `X.name.split(':')[0]` pasa a `shortProjectName(X.name)` (agregar el import en cada archivo). Sitios (verificados por grep):

- `src/App.jsx:363,411,452`
- `src/views/CalendarView.jsx:133,445,545`
- `src/views/CostAnalysisView.jsx:37`
- `src/views/DashboardView.jsx:343,377,673`
- `src/views/MyProjectsView.jsx:1173,1258,1331`
- `src/views/PipelineView.jsx:697,756`
- `src/views/ProjectDetailView.jsx:70` (⚠️ la línea 72 usa `.split(':').slice(1)` para el subtítulo — NO tocarla)
- `src/components/IPGeneratorModal.jsx:100`
- `src/components/PDFGeneratorModal.jsx:23,108`
- `src/services/kpiCalculator.js:194,208,209` (estos hoy lanzarían con `name` undefined — el util arregla ese bug latente de paso)

- [ ] **Step 7: Verificación completa y commit**

Run: `npx vitest run && npm run build`
Expected: 214 tests PASS, build OK.

```bash
git add -A
git commit -m "fix: dedupe project names via shared shortProjectName util

Sheet Name cells arrive as 'Cliente:[SO#] Nombre'; Materials Requirements
and Projects Directory rendered the raw string, showing the client name
twice. Consolidates the ~20 inline split(':')[0] call sites too."
```

---

### Task 2: Util `formatDisplayDate` + unificación de formato de fechas

Hoy conviven `7/30/2026` (crudo del sheet), `2026-07-27` (ISO de notas/archivo) y varios `toLocaleDateString()`. Se centraliza en un util que parsea los tres orígenes y formatea `MMM dd, yyyy` con locale (mismo formato que ya usa CalendarView para notas).

**Files:**
- Create: `src/utils/dateFormat.js`
- Test: `src/utils/__tests__/dateFormat.test.js`
- Modify: `src/views/MaterialsView.jsx:43`, `src/views/PipelineView.jsx:699,761`, `src/views/DashboardView.jsx:567,600`, `src/components/CompletedProjectsModal.jsx:65-67`, `src/views/MyProjectsView.jsx:1724`, `src/designer-performance/components/ProjectDetailsModal.tsx:44,127,131`, `src/designer-performance/views/Phase1Form.tsx:228`

**Interfaces:**
- Produces: `formatDisplayDate(raw: unknown, language?: 'en' | 'es'): string` — acepta `'M/D/YYYY'`, `'YYYY-MM-DD'`, `Date`, timestamp numérico; devuelve `'MMM dd, yyyy'` localizado; si no puede parsear devuelve el texto original (`String(raw ?? '')`), **nunca lanza**.

- [ ] **Step 1: Escribir el test que falla**

```js
// src/utils/__tests__/dateFormat.test.js
import { describe, it, expect } from 'vitest';
import { formatDisplayDate } from '../dateFormat';

describe('formatDisplayDate', () => {
  it('formatea M/D/YYYY (formato del sheet)', () => {
    expect(formatDisplayDate('7/30/2026')).toBe('Jul 30, 2026');
    expect(formatDisplayDate('12/5/2026')).toBe('Dec 05, 2026');
  });

  it('formatea YYYY-MM-DD (notas/archivo)', () => {
    expect(formatDisplayDate('2026-07-27')).toBe('Jul 27, 2026');
  });

  it('respeta el idioma español', () => {
    expect(formatDisplayDate('7/30/2026', 'es').toLowerCase()).toContain('jul');
  });

  it('acepta Date y timestamp numérico', () => {
    expect(formatDisplayDate(new Date(2026, 6, 30))).toBe('Jul 30, 2026');
    expect(formatDisplayDate(new Date(2026, 6, 30).getTime())).toBe('Jul 30, 2026');
  });

  it('devuelve el texto original cuando no puede parsear — nunca lanza', () => {
    expect(formatDisplayDate('TBD')).toBe('TBD');
    expect(formatDisplayDate('N/A')).toBe('N/A');
    expect(formatDisplayDate(undefined)).toBe('');
    expect(formatDisplayDate(null)).toBe('');
    expect(formatDisplayDate('')).toBe('');
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `npx vitest run src/utils/__tests__/dateFormat.test.js`
Expected: FAIL — import no resuelto.

- [ ] **Step 3: Implementación**

```js
// src/utils/dateFormat.js
// Single display format for dates app-wide. Sources are heterogeneous:
// sheet cells ('7/30/2026'), RTDB notes ('2026-07-27'), Date objects and
// epoch-ms timestamps. Unparseable input falls back to the original text so
// a weird cell never crashes a view (see calendarNoteDate.test.js history).
import { format, parse, isValid } from 'date-fns';
import { es, enUS } from 'date-fns/locale';

const toDate = (raw) => {
  if (raw instanceof Date) return isValid(raw) ? raw : null;
  if (typeof raw === 'number') {
    const d = new Date(raw);
    return isValid(d) ? d : null;
  }
  const str = String(raw ?? '').trim();
  if (!str) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const d = parse(str, 'yyyy-MM-dd', new Date());
    return isValid(d) ? d : null;
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
    const d = parse(str, 'M/d/yyyy', new Date());
    return isValid(d) ? d : null;
  }
  return null;
};

export const formatDisplayDate = (raw, language = 'en') => {
  const d = toDate(raw);
  if (!d) return String(raw ?? '');
  return format(d, 'MMM dd, yyyy', { locale: language === 'es' ? es : enUS });
};
```

- [ ] **Step 4: Verificar que pasa**

Run: `npx vitest run src/utils/__tests__/dateFormat.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Aplicar en los sitios de display**

Cada archivo agrega `import { formatDisplayDate } from '<ruta relativa>/utils/dateFormat';`. En los `.jsx` que ya tienen `const { t, language } = useLanguage()` (o `language`), pasar `language`; en los `.tsx` de designer-performance usar el default `'en'` por ahora (el Task 6 les cablea `useLanguage`).

- `src/views/MaterialsView.jsx:43` → `<td className="date-cell">{formatDisplayDate(item.installDate, language)}</td>`
- `src/views/PipelineView.jsx:699` → `<Calendar size={13}/> {formatDisplayDate(project.install, language)}`
- `src/views/PipelineView.jsx:761` → `{formatDisplayDate(project.install, language)}`
- `src/views/DashboardView.jsx:567,600` → `<span className="details-value">{formatDisplayDate(project.install, language)}</span>`
- `src/components/CompletedProjectsModal.jsx:65-67` → conservar la conversión de timestamp Firestore a `Date` y pasar el resultado: `archivedDate = formatDisplayDate(p.archivedAt.toDate(), language)` / `formatDisplayDate(new Date(p.archivedAt.seconds * 1000), language)`
- `src/views/MyProjectsView.jsx:1724` → `{formatDisplayDate(new Date(note.createdAt), language)}` (reemplaza el `toLocaleDateString` con options)
- `src/designer-performance/components/ProjectDetailsModal.tsx:44,127,131` → `{formatDisplayDate(new Date(date))}` / `Registered: {formatDisplayDate(new Date(project.createdAt))}` / `Approved: {formatDisplayDate(new Date(project.approvedAt))}`
- `src/designer-performance/views/Phase1Form.tsx:228` → el helper `fmtDate` pasa a `ts ? formatDisplayDate(new Date(ts)) : null`

NO tocar: `src/views/CalendarView.jsx` (su `formatNoteDate` ya produce exactamente este formato y devuelve `''` — no el texto crudo — a propósito para el sidebar); los textos de chat de `ProjectChatbot.jsx` y mensajes de `kpiCalculator.js` (no son celdas de tabla).

- [ ] **Step 6: Verificación y commit**

Run: `npx vitest run && npm run build`
Expected: 219 tests PASS, build OK.

```bash
git add -A
git commit -m "feat: unify date display via formatDisplayDate util"
```

---

### Task 3: Tooltips en textos truncados

La mayoría de los truncamientos ya tienen `title` (ProjectsView.tsx:238/243, DashboardView.jsx:564/570/597/603, eventos del calendario). Faltan 5 sitios; el peor es el botón de diseñador en My Projects — el "Russell Re..." del reporte — cuyo `title` actual dice "Designer in Charge" sin el nombre.

**Files:**
- Modify: `src/views/MyProjectsView.jsx:1380,1567,1707`, `src/views/PipelineView.jsx:948,1066`

**Interfaces:** ninguna nueva.

- [ ] **Step 1: Botón de diseñador en My Projects**

En `src/views/MyProjectsView.jsx:1380`, el `title` del botón debe incluir el nombre completo:

```jsx
title={`${language === 'es' ? 'Diseñador a Cargo' : 'Designer in Charge'}: ${projectDesigners[project.so] || (language === 'es' ? 'Ninguno' : 'None')}`}
```

- [ ] **Step 2: Nombres de archivo truncados**

Agregar `title` al `<span>` con ellipsis en cada sitio:

- `src/views/MyProjectsView.jsx:1567` → `<span title={file.name} style={{...igual...}}>`
- `src/views/MyProjectsView.jsx:1707` → `<span title={att.name || 'Document'} style={{...igual...}}>`
- `src/views/PipelineView.jsx:948` → `<span title={file.name} style={{...igual...}}>`
- `src/views/PipelineView.jsx:1066` → `<span title={att.name || 'Document'} style={{...igual...}}>` (el span renderiza `{att.name || 'Document'}`)

- [ ] **Step 3: Verificación y commit**

Run: `npx vitest run && npm run build` — Expected: PASS.
Verificación manual: en la app, hover sobre un diseñador truncado en My Projects muestra el nombre completo.

```bash
git add -A
git commit -m "fix: show full text on hover for truncated names and filenames"
```

---

### Task 4: Header de la sección Pipeline

Pipeline tiene `<h1>` pero es la única vista sin línea de descripción. Se agrega el subtítulo con el mismo patrón/clases que CalendarView (`view-header-title`).

**Files:**
- Modify: `src/utils/translations.js` (secciones `en.pipeline` línea ~266 y `es.pipeline` línea ~579), `src/views/PipelineView.jsx:555-556`

- [ ] **Step 1: Agregar las claves de traducción**

En `en.pipeline` (junto a `title`/`searchPlaceholder`):

```js
      subtitle: "Track every active project across engineering, nesting and production stages",
```

En `es.pipeline`:

```js
      subtitle: "Seguimiento de cada proyecto activo a través de las etapas de ingeniería, nesting y producción",
```

- [ ] **Step 2: Renderizar el subtítulo**

En `src/views/PipelineView.jsx`, reemplazar la línea 556:

```jsx
      <header className="view-header">
        <div className="view-header-title">
          <h1 className="page-title">{t('pipeline.title')}</h1>
          <p className="text-muted">{t('pipeline.subtitle')}</p>
        </div>
        <div className="controls">
```

(`view-header-title` ya existe y lo usa CalendarView.jsx:370 con las mismas clases.)

- [ ] **Step 3: Verificación y commit**

Run: `npm run build` + abrir la vista Pipeline en ambos idiomas y en modo kanban/lista — el header no debe romper el layout de los controles.

```bash
git add -A
git commit -m "feat: add descriptive subtitle to Pipeline view header"
```

---

### Task 5: Theming — migrar colores hardcodeados a variables de tema

`ThemeContext` pone `light-theme` en `<html>` y `index.css` redefine las variables, pero ~90 declaraciones en los CSS de vistas usan `rgba(255,255,255,x)` (superficies/bordes) y hexes de texto claro (`#f1f5f9`, `#e2e8f0`, `#94a3b8`, `#cbd5e1`) que quedan "en oscuro" al activar modo claro. Se introducen variables `--overlay-*` y se migra por script.

**Files:**
- Modify: `src/index.css` (bloque `:root` línea ~5 y bloque light-theme línea ~144)
- Modify (por sed): `src/views/PipelineView.css`, `src/views/DashboardView.css`, `src/views/CalendarView.css`, `src/views/MyProjectsView.css`, `src/views/MaterialsView.css`, `src/views/LoginView.css`, `src/views/LogbookView.css`, `src/components/Navbar.css`, `src/components/NotificationBubble.css`, `src/components/ProjectChatbot.css`, `src/components/GlobalFilterBar.css`, `src/components/SkeletonLoader.css`, `src/components/ToastNotifications.css`
- **Excluidos a propósito:** `PDFGeneratorModal.css`, `PDFPrintLayout.css`, `IPPrintLayout.css` (salida de impresión, no debe seguir al tema), `src/designer-performance/*` (ya es theme-aware vía `T`/`C` por-tema).

**Interfaces:**
- Produces: variables CSS `--overlay-01` a `--overlay-20` (blanco translúcido en dark, negro translúcido en light) disponibles globalmente.

- [ ] **Step 1: Definir las variables en `src/index.css`**

En el bloque `:root` (junto a `--card-bg` etc.):

```css
  /* Superficies translúcidas que siguen al tema (reemplazan rgba(255,255,255,x) hardcodeado) */
  --overlay-01: rgba(255, 255, 255, 0.01);
  --overlay-02: rgba(255, 255, 255, 0.02);
  --overlay-03: rgba(255, 255, 255, 0.03);
  --overlay-04: rgba(255, 255, 255, 0.04);
  --overlay-05: rgba(255, 255, 255, 0.05);
  --overlay-06: rgba(255, 255, 255, 0.06);
  --overlay-08: rgba(255, 255, 255, 0.08);
  --overlay-10: rgba(255, 255, 255, 0.1);
  --overlay-12: rgba(255, 255, 255, 0.12);
  --overlay-15: rgba(255, 255, 255, 0.15);
  --overlay-18: rgba(255, 255, 255, 0.18);
  --overlay-20: rgba(255, 255, 255, 0.2);
```

En el bloque de overrides light (donde está `--bg-deep: #FFFFFF`, ~línea 144):

```css
  --overlay-01: rgba(0, 0, 0, 0.015);
  --overlay-02: rgba(0, 0, 0, 0.02);
  --overlay-03: rgba(0, 0, 0, 0.03);
  --overlay-04: rgba(0, 0, 0, 0.04);
  --overlay-05: rgba(0, 0, 0, 0.05);
  --overlay-06: rgba(0, 0, 0, 0.06);
  --overlay-08: rgba(0, 0, 0, 0.08);
  --overlay-10: rgba(0, 0, 0, 0.1);
  --overlay-12: rgba(0, 0, 0, 0.12);
  --overlay-15: rgba(0, 0, 0, 0.15);
  --overlay-18: rgba(0, 0, 0, 0.18);
  --overlay-20: rgba(0, 0, 0, 0.2);
```

- [ ] **Step 2: Reemplazo por script de las superficies blancas**

Desde la raíz del repo (Git Bash):

```bash
FILES="src/views/PipelineView.css src/views/DashboardView.css src/views/CalendarView.css src/views/MyProjectsView.css src/views/MaterialsView.css src/views/LoginView.css src/views/LogbookView.css src/components/Navbar.css src/components/NotificationBubble.css src/components/ProjectChatbot.css src/components/GlobalFilterBar.css src/components/SkeletonLoader.css src/components/ToastNotifications.css"
for f in $FILES; do
  sed -i -E \
    -e 's/rgba\(255, ?255, ?255, ?0\.01\)/var(--overlay-01)/g' \
    -e 's/rgba\(255, ?255, ?255, ?0\.02\)/var(--overlay-02)/g' \
    -e 's/rgba\(255, ?255, ?255, ?0\.03\)/var(--overlay-03)/g' \
    -e 's/rgba\(255, ?255, ?255, ?0\.04\)/var(--overlay-04)/g' \
    -e 's/rgba\(255, ?255, ?255, ?0\.05\)/var(--overlay-05)/g' \
    -e 's/rgba\(255, ?255, ?255, ?0\.06\)/var(--overlay-06)/g' \
    -e 's/rgba\(255, ?255, ?255, ?0\.07\)/var(--overlay-08)/g' \
    -e 's/rgba\(255, ?255, ?255, ?0\.08\)/var(--overlay-08)/g' \
    -e 's/rgba\(255, ?255, ?255, ?0\.1\)/var(--overlay-10)/g' \
    -e 's/rgba\(255, ?255, ?255, ?0\.10\)/var(--overlay-10)/g' \
    -e 's/rgba\(255, ?255, ?255, ?0\.12\)/var(--overlay-12)/g' \
    -e 's/rgba\(255, ?255, ?255, ?0\.15\)/var(--overlay-15)/g' \
    -e 's/rgba\(255, ?255, ?255, ?0\.18\)/var(--overlay-18)/g' \
    -e 's/rgba\(255, ?255, ?255, ?0\.2\)/var(--overlay-20)/g' \
    -e 's/rgba\(255, ?255, ?255, ?0\.20\)/var(--overlay-20)/g' \
    "$f"
done
grep -rn 'rgba(255, \?255' $FILES || echo "OK: sin restos"
```

El grep final lista alphas no cubiertas (p.ej. `0.4` usado como color de texto en `MyProjectsView.css:311` → reemplazar a mano por `var(--text-muted)`). Resolver cada resto a mano con la variable más cercana.

- [ ] **Step 3: Migrar hexes de texto claro en esos mismos CSS**

```bash
for f in $FILES; do
  sed -i -E \
    -e 's/#f1f5f9/var(--text-primary)/gI' \
    -e 's/#f8fafc/var(--text-primary)/gI' \
    -e 's/#e2e8f0/var(--text-primary)/gI' \
    -e 's/#cbd5e1/var(--text-secondary)/gI' \
    -e 's/#94a3b8/var(--text-muted)/gI' \
    "$f"
done
```

Después: `git diff` y revisar CADA reemplazo — si algún hex estaba usado como `background` (no como `color`/`border`), revertir esa línea a mano (un fondo gris claro convertido en "texto primario" quedaría negro en dark).

- [ ] **Step 4: Colores inline en JSX de las vistas principales**

```bash
grep -rn "'#94A3B8'\|'#94a3b8'\|'#64748B'\|'#CBD5E1'" src/views/*.jsx src/components/*.jsx
```

Para cada resultado que sea un `color:` de texto sobre superficie de tarjeta (p.ej. `src/views/PipelineView.jsx:946`, `src/views/MyProjectsView.jsx:1388`), reemplazar por `'var(--text-muted)'` (o `'var(--text-secondary)'` para `#CBD5E1`). Excluir: colores dentro de los modales de PDF/print y colores de estado semánticos.

- [ ] **Step 5: Verificación visual en ambos temas y commit**

Run: `npx vitest run && npm run build` — Expected: PASS.
Con `npm run dev`: alternar a modo claro y recorrer Dashboard, Pipeline (lista y kanban), Calendar, My Projects, Materials, Logbook, Cost Analysis, Admin y el chatbot. Criterio: ningún panel queda oscuro, ningún texto invisible. Volver a dark: debe verse idéntico a antes (las variables valen lo mismo que los literales que reemplazan).

```bash
git add -A
git commit -m "fix: make main views follow light/dark theme via --overlay-* variables

Light mode only restyled the sidebar because view CSS hardcoded white
rgba surfaces and light text hexes; those now resolve through theme
variables flipped under .light-theme."
```

---

### Task 6: i18n del módulo Designer Perf.

Todo `src/designer-performance/` está hardcodeado en inglés y no consume `useLanguage`. Se traducen las superficies que ve el usuario final: Sidebar, Leaderboard (DashboardView.tsx), Projects Directory (ProjectsView.tsx) y ProjectDetailsModal. **Fuera de alcance explícito:** `Phase1Form.tsx` y `Phase2Form.tsx` (formularios internos de carga; se pueden traducir después reutilizando esta misma sección de claves).

**Files:**
- Modify: `src/utils/translations.js` (agregar `designerPerf` en `en` y `es`)
- Modify: `src/designer-performance/components/Sidebar.tsx`, `src/designer-performance/views/DashboardView.tsx`, `src/designer-performance/views/ProjectsView.tsx`, `src/designer-performance/components/ProjectDetailsModal.tsx`
- Test: `src/utils/__tests__/translationsParity.test.js`

**Interfaces:**
- Consumes: `useLanguage()` de `src/utils/LanguageContext.jsx` → `{ t, language }`. El módulo se monta dentro del `LanguageProvider` de la app principal (verificar en Step 3 que el árbol lo incluye; si no, envolver el mount del módulo).
- Produces: claves `designerPerf.*` en ambos idiomas.

- [ ] **Step 1: Test de paridad de claves (falla si en/es divergen — protege esta task y las futuras)**

```js
// src/utils/__tests__/translationsParity.test.js
import { describe, it, expect } from 'vitest';
import { translations } from '../translations';

const keysOf = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    v !== null && typeof v === 'object' ? keysOf(v, `${prefix}${k}.`) : [`${prefix}${k}`]
  );

describe('translations', () => {
  it('en y es exponen exactamente las mismas claves', () => {
    expect(keysOf(translations.es).sort()).toEqual(keysOf(translations.en).sort());
  });
});
```

Run: `npx vitest run src/utils/__tests__/translationsParity.test.js` — si ya pasa, sirve de red de seguridad; si falla, arreglar la divergencia existente ANTES de seguir (es un bug real preexistente).

- [ ] **Step 2: Agregar la sección `designerPerf` a `translations.js`**

En `en` (después de la sección `pipeline`):

```js
    designerPerf: {
      sidebar: {
        title: "Designer Perf.",
        subtitle: "Performance Tracker",
        overview: "Overview",
        workflow: "Workflow",
        leaderboard: "Leaderboard",
        projects: "Projects Directory",
        phase1: "Phase 1: Intake",
        phase2: "Phase 2: Closure"
      },
      dashboard: {
        title: "Leaderboard",
        subtitle: "Designer performance overview and KPIs.",
        totalProjects: "Total Projects",
        completed: "Completed",
        activeDesigners: "Active Designers",
        rankings: "Designer Rankings",
        rank: "Rank",
        designer: "Designer",
        projects: "Projects",
        avgP1: "Avg P1 (ICE)",
        avgP2: "Avg P2 (IFR)",
        globalKpi: "Global KPI",
        performance: "Performance",
        noData: "No data yet",
        emptyExplainer: "KPIs appear once a designer is assigned and the project is evaluated in Phase 1 / Phase 2. Assign designers from My Projects, or register evaluations in the Workflow section."
      },
      projects: {
        title: "Projects Directory",
        of: "of",
        projectsWord: "projects",
        statusNote: "Status reflects the Phase 1/2 design-review checklist, not the manufacturing pipeline stage",
        searchPlaceholder: "Search SO, name, designer…",
        so: "SO #",
        name: "Project Name",
        designer: "Designer",
        rooms: "Rooms",
        phase1: "Phase 1",
        phase2: "Phase 2",
        designReview: "Design Review",
        empty: "No projects match the current filter.",
        statusTooltip: "Phase 1 design-review checklist status (not the manufacturing stage)",
        unassigned: "Unassigned",
        statusAll: "All",
        statusPending: "Pending",
        statusToReview: "To review",
        statusApproved: "Approved",
        statusRejected: "Rejected",
        statusCompleted: "Completed"
      },
      modal: {
        registered: "Registered",
        approved: "Approved",
        rooms: "Rooms",
        checklistProgress: "Checklist Progress"
      }
    },
```

En `es` (misma estructura, después de `es.pipeline`):

```js
    designerPerf: {
      sidebar: {
        title: "Designer Perf.",
        subtitle: "Seguimiento de Desempeño",
        overview: "Resumen",
        workflow: "Flujo de Trabajo",
        leaderboard: "Ranking",
        projects: "Directorio de Proyectos",
        phase1: "Fase 1: Ingreso",
        phase2: "Fase 2: Cierre"
      },
      dashboard: {
        title: "Ranking de Diseñadores",
        subtitle: "Resumen de desempeño y KPIs por diseñador.",
        totalProjects: "Proyectos Totales",
        completed: "Completados",
        activeDesigners: "Diseñadores Activos",
        rankings: "Ranking de Diseñadores",
        rank: "Puesto",
        designer: "Diseñador",
        projects: "Proyectos",
        avgP1: "Prom. F1 (ICE)",
        avgP2: "Prom. F2 (IFR)",
        globalKpi: "KPI Global",
        performance: "Desempeño",
        noData: "Sin datos aún",
        emptyExplainer: "Los KPIs aparecen cuando el proyecto tiene diseñador asignado y fue evaluado en Fase 1 / Fase 2. Asigná diseñadores desde Mis Proyectos o registrá evaluaciones en la sección Flujo de Trabajo."
      },
      projects: {
        title: "Directorio de Proyectos",
        of: "de",
        projectsWord: "proyectos",
        statusNote: "El estado refleja el checklist de revisión de diseño (Fase 1/2), no la etapa del pipeline de fabricación",
        searchPlaceholder: "Buscar SO, nombre, diseñador…",
        so: "SO #",
        name: "Nombre del Proyecto",
        designer: "Diseñador",
        rooms: "Ambientes",
        phase1: "Fase 1",
        phase2: "Fase 2",
        designReview: "Revisión de Diseño",
        empty: "Ningún proyecto coincide con el filtro actual.",
        statusTooltip: "Estado del checklist de revisión de diseño de Fase 1 (no la etapa de fabricación)",
        unassigned: "Sin asignar",
        statusAll: "Todos",
        statusPending: "Pendiente",
        statusToReview: "A revisar",
        statusApproved: "Aprobado",
        statusRejected: "Rechazado",
        statusCompleted: "Completado"
      },
      modal: {
        registered: "Registrado",
        approved: "Aprobado",
        rooms: "Ambientes",
        checklistProgress: "Progreso del Checklist"
      }
    },
```

Run: `npx vitest run src/utils/__tests__/translationsParity.test.js` — Expected: PASS.

- [ ] **Step 3: Cablear `useLanguage` en los 4 componentes**

En cada archivo: `import { useLanguage } from '../../utils/LanguageContext';` y `const { t } = useLanguage();` dentro del componente. Antes de editar, confirmar que el módulo se monta bajo el provider: buscar dónde `App.jsx` renderiza el tab `designer-performance` y verificar que está dentro de `<LanguageProvider>` (toda la app principal lo está; si el módulo montara su propio root en `designer-performance/main.tsx`, envolver ahí).

**`Sidebar.tsx`:** los literales pasan a claves — `'Overview'` → `t('designerPerf.sidebar.overview')`, `'Workflow'` → `t('designerPerf.sidebar.workflow')`, `'Leaderboard'` → `t('designerPerf.sidebar.leaderboard')`, `'Projects Directory'` → `t('designerPerf.sidebar.projects')`, `'Phase 1: Intake'` → `t('designerPerf.sidebar.phase1')`, `'Phase 2: Closure'` → `t('designerPerf.sidebar.phase2')`, `'Designer Perf.'` → `t('designerPerf.sidebar.title')`, `'Performance Tracker'` → `t('designerPerf.sidebar.subtitle')`. ⚠️ `navGroups` está definido dentro del componente, así que puede usar `t` directamente; los `id` NO cambian.

**`DashboardView.tsx`:** `'Leaderboard'` (h2, línea 45) → `t('designerPerf.dashboard.title')`; subtítulo línea 46 → `t('designerPerf.dashboard.subtitle')`; `statCards` labels (líneas 36-38) → `t('designerPerf.dashboard.totalProjects')` / `.completed` / `.activeDesigners`; `'Designer Rankings'` (línea 97) → `t('designerPerf.dashboard.rankings')`; el array de headers (línea 104) pasa a `[t('designerPerf.dashboard.rank'), t('designerPerf.dashboard.designer'), t('designerPerf.dashboard.projects'), t('designerPerf.dashboard.avgP1'), t('designerPerf.dashboard.avgP2'), t('designerPerf.dashboard.globalKpi'), t('designerPerf.dashboard.performance')]`; `'No data yet'` (línea 146) → `t('designerPerf.dashboard.noData')`.

**`ProjectsView.tsx`:** título (línea 90) → `t('designerPerf.projects.title')`; subtítulo (línea 92) → `` {filtered.length} {t('designerPerf.projects.of')} {projects.length} {t('designerPerf.projects.projectsWord')} · {t('designerPerf.projects.statusNote')} ``; placeholder (línea 104) → `t('designerPerf.projects.searchPlaceholder')`; headers de tabla (líneas 187-193) → claves `so`/`name`/`designer`/`rooms`/`phase1`/`phase2`/`designReview`; vacío (línea 205) → `t('designerPerf.projects.empty')`; tooltip de estado (línea 263) → `t('designerPerf.projects.statusTooltip')`. Para los tabs de filtro (línea 154 renderiza `{status}`): agregar un helper dentro del componente que mapea el VALOR al label traducido, dejando el valor como clave de filtro:

```tsx
const STATUS_LABEL_KEYS: Record<string, string> = {
  All: 'statusAll', Pending: 'statusPending', 'To review': 'statusToReview',
  Approved: 'statusApproved', Rejected: 'statusRejected', Completed: 'statusCompleted',
};
const statusLabel = (s: string) => t(`designerPerf.projects.${STATUS_LABEL_KEYS[s] || 'statusAll'}`);
```

y renderizar `{statusLabel(status)}` en el tab y `{statusLabel(project.status)}` en la píldora de estado de cada fila (línea 271). ⚠️ `filterStatus`, `p.status` y `STATUS_STYLES` siguen usando los valores en inglés.

**`ProjectDetailsModal.tsx`:** `'Registered:'` (línea 127) → `{t('designerPerf.modal.registered')}:`; `'Approved:'` (línea 131) → `{t('designerPerf.modal.approved')}:`; `` `${project.totalRooms} Rooms` `` (línea 109) → `` `${project.totalRooms} ${t('designerPerf.modal.rooms')}` ``; `'Checklist Progress'` (línea 140) → `t('designerPerf.modal.checklistProgress')`.

- [ ] **Step 4: Verificación y commit**

Run: `npx vitest run && npm run build && npm run lint` — Expected: PASS, paridad de lint contra main.
Manual: cambiar a español y recorrer las 2 vistas + modal del módulo Designer Perf. — todo el copy visible cambia; volver a inglés — idéntico a antes.

```bash
git add -A
git commit -m "feat: translate Designer Perf. module (sidebar, leaderboard, projects directory, detail modal)"
```

---

### Task 7: Designer Perf. — estado vacío honesto en lugar de ceros

Los ceros son "correctos" por diseño: `totalProjects` cuenta solo proyectos **evaluados** (status ≠ 'Pending' en `scoreCalculator.ts:58-62`) y el diseñador viene de `project_designers/{so}` en RTDB (asignado desde My Projects o Phase 1) — si nadie asignó/evaluó, todo da 0/"Unassigned". No hay fuente de datos rota que conectar; el fix es de presentación: distinguir "sin evaluar" de un cero real y explicar de dónde salen los datos. **Depende de Task 6** (usa `t()`).

**Files:**
- Modify: `src/designer-performance/views/DashboardView.tsx` (celda Projects línea 136, banner tras stat cards línea ~81), `src/designer-performance/views/ProjectsView.tsx` (celda Designer líneas 243-245)

- [ ] **Step 1: Leaderboard — mostrar «—» en vez de 0 para no evaluados**

En `DashboardView.tsx` línea 136:

```tsx
<td style={{ padding: '12px 20px', color: C.body, fontSize: '0.85rem' }}>{designer.totalProjects || '—'}</td>
```

- [ ] **Step 2: Banner explicativo cuando no hay ningún evaluado**

Después del grid de stat cards (tras la línea 81), agregar:

```tsx
{projects.length > 0 && designers.every(d => d.totalProjects === 0) && (
  <div style={{
    marginBottom: 28, padding: '14px 18px', borderRadius: 12,
    background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)',
    color: C.body, fontSize: '0.85rem', lineHeight: 1.5,
  }}>
    {t('designerPerf.dashboard.emptyExplainer')}
  </div>
)}
```

(la clave se agregó en Task 6; el tinte azul semántico es válido en ambos temas.)

- [ ] **Step 3: Projects Directory — «Sin asignar» diferenciado**

En `ProjectsView.tsx`, celda Designer (líneas 243-245):

```tsx
<div title={project.designerName} style={{
  color: project.designerName === 'Unassigned' ? C.faint : C.body,
  fontStyle: project.designerName === 'Unassigned' ? 'italic' : 'normal',
  fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8,
}}>
  {project.designerName === 'Unassigned' ? t('designerPerf.projects.unassigned') : project.designerName}
</div>
```

⚠️ El valor `'Unassigned'` en datos/filtros no cambia — solo la etiqueta renderizada.

- [ ] **Step 4: Verificación y commit**

Run: `npx vitest run && npm run build` — Expected: PASS.
Manual: con la base actual (sin evaluaciones), el leaderboard muestra «—» + banner; el resumen sigue mostrando los 25 proyectos totales.

```bash
git add -A
git commit -m "feat: honest empty state for Designer Perf. (em-dash, explainer banner, Sin asignar)"
```

---

### Task 8: Indicador visual de scroll horizontal en tablas

Ambas tablas ya scrollean; falta que se note. `MaterialsView.css` ya tiene la técnica de sombra con `background-attachment: local, scroll` pero solo bajo `@media (max-width: 767px)`. Se extrae a una clase utilitaria global y se aplica a ambas tablas en todas las resoluciones.

**Files:**
- Modify: `src/index.css` (agregar `.h-scroll-shadow`), `src/views/MaterialsView.css` (quitar el bloque duplicado del media query), `src/views/MaterialsView.jsx:25` (agregar la clase), `src/designer-performance/views/ProjectsView.tsx:176` (agregar la clase)

- [ ] **Step 1: Clase utilitaria en `src/index.css`**

```css
/* Sombra lateral que indica contenido con scroll horizontal. La capa
   'local' viaja con el contenido y tapa la sombra en los extremos. */
.h-scroll-shadow {
  -webkit-overflow-scrolling: touch;
  background:
    linear-gradient(to right, var(--card-bg) 0%, transparent 2%) 0 0,
    linear-gradient(to left, var(--card-bg) 0%, transparent 8%) 100% 0;
  background-size: 24px 100%;
  background-repeat: no-repeat;
  background-attachment: local, scroll;
}
```

- [ ] **Step 2: Aplicar en Materials Requirements**

En `src/views/MaterialsView.jsx:25`: `<div className="table-container glass-card h-scroll-shadow">`.
En `src/views/MaterialsView.css`: borrar del media query el bloque de `background` (líneas 14-21, dejando el ajuste de padding/font de th/td).

- [ ] **Step 3: Aplicar en Projects Directory**

En `src/designer-performance/views/ProjectsView.tsx:176`, el wrapper de scroll gana la clase:

```tsx
<div className="h-scroll-shadow" style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
```

- [ ] **Step 4: Verificación y commit**

Run: `npm run build` — Expected: OK.
Manual: en una ventana angosta, ambas tablas muestran la sombra derecha cuando hay columnas ocultas ("Element", "Phase 2") y la sombra desaparece al llegar al final del scroll. Verificar en ambos temas.

```bash
git add -A
git commit -m "feat: horizontal-scroll shadow indicator on Materials and Projects Directory tables"
```

---

### Task 9: Verificación integral, merge y deploy a producción

Nada de lo anterior (ni los fixes previos de main: modal del calendario, overflow de tablas, tooltips existentes, seguridad de /api/sync) llega al usuario sin este paso. El deploy es lo que también cierra los ítems #9 y #5 del reporte.

**Files:** ninguno nuevo.

- [ ] **Step 1: Suite completa en la rama**

Run: `npx vitest run && npm run build && npm run lint`
Expected: todos los tests PASS (≥220), build OK, lint con paridad de warnings contra main.

- [ ] **Step 2: Merge a main**

```bash
git checkout main
git merge --no-ff fix/production-review -m "Merge fix/production-review: 9 production review fixes"
git branch -d fix/production-review
```

- [ ] **Step 3: Push (dispara el deploy de Vercel via integración Git)**

```bash
git push origin main
```

⚠️ main viene con ~14 commits previos sin pushear — este push los publica todos juntos (incluye el gate de `/api/sync`, que requiere que las reglas de `database.rules.json` actualizadas estén publicadas en Firebase Console; el usuario debe confirmar que republicó las reglas ANTES de este push — pendiente de la sesión anterior).

- [ ] **Step 4: Checklist de verificación en producción (dashboard-kpis-jl)**

Recorrer en la URL de producción, en ambos idiomas y ambos temas:

1. Modo claro: todas las secciones (no solo sidebar) cambian de fondo/texto.
2. Selector ES: sidebar Y contenido (títulos, headers de tabla, placeholder de búsqueda, módulo Designer Perf.) traducidos.
3. Materials Requirements y Projects Directory: nombres sin duplicar (`Chris Jaensch`, no `Chris Jaensch:[12112] Chris Jaensch`).
4. Designer Perf.: «—» y banner explicativo en vez de ceros; Projects Directory muestra «Sin asignar» en cursiva.
5. Tablas angostas: sombra de scroll visible; columnas alcanzables scrolleando.
6. Fechas en formato único `Jul 30, 2026` en Materials, Pipeline, Dashboard, Completed Projects y Designer Perf.
7. Hover sobre nombres truncados muestra el texto completo.
8. Pipeline tiene título + descripción.
9. Click en un día del calendario con varias instalaciones abre el modal con la lista completa.

- [ ] **Step 5: Cierre**

Reportar al usuario el resultado del checklist, ítem por ítem, señalando cualquier desviación encontrada en producción.

---

## Notas finales

- El ítem #4 no era un bug de datos: el pipeline de asignación (`project_designers` ← My Projects / Phase 1 Form) y el de evaluación (Phase 1/2 → `designer_performance_projects`) funcionan; simplemente nadie cargó evaluaciones aún. Si el usuario esperaba que las métricas se derivaran automáticamente del sheet, eso es una feature nueva a conversar, no parte de este plan.
- `Phase1Form.tsx`/`Phase2Form.tsx` quedan en inglés a propósito (formularios internos); traducirlos después es mecánico reutilizando `designerPerf.*`.
- Pendientes previos que NO cubre este plan: republicar `database.rules.json` (bloquea la aprobación de usuarios en admin), borrar la cuenta huérfana de Adrienne en Firebase Auth, habilitar billing para la cuota de Gemini, y ocultar las etiquetas "Current Week"/"Previous Week" del gráfico del dashboard (pedido aún no accionado).
