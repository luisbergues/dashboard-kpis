# Diseño — Generador de ESS (Engineering Shop Sheet)

**Fecha:** 2026-08-06
**Estado:** Aprobado, listo para implementation plan

## Objetivo

Módulo nuevo, visible solo para el súper admin (`isSuperAdminRole`), que automatiza el armado del borrador de la **ESS (Engineering Shop Sheet)** — la orden técnica de corte y producción para el taller/CNC — a partir de tres PDFs que ya existen por proyecto: **Contract**, **Quote** y **Drawings**.

Sin API de IA: los PDFs son generados digitalmente (texto seleccionable, confirmado por el usuario), así que toda la extracción es determinística por reglas (regex + posición del texto en la página), no OCR ni LLM.

## Terminología del dominio (JL Closets)

| Doc | Qué es | Qué aporta a la ESS |
|---|---|---|
| **Contract** | Acuerdo comercial firmado | Depósito %, si tearout/baseboards están contratados |
| **Quote** | Desglose de productos/accesorios cotizados por el diseñador | Por área: accesorios con product code y cantidad, material/puerta, descuento — es el "check de inventario": todo lo cobrado DEBE estar en el plano |
| **Drawings** | Plano CAD del proyecto | Medidas por opening (ancho/alto/profundidad), asociadas a cada área |
| **IP** (ya existe, no forma parte de este diseño) | Instrucciones para instaladores | — |
| **ESS** (lo que este módulo genera) | Orden de taller/CNC | Job Name, colores traducidos a código interno, medidas ya calculadas con las fórmulas de corte, herrajes, misceláneos |

## Alcance de esta v1

Genera un **borrador editable** de ESS — no un documento final automático sin revisión. El súper admin siempre corrige antes de exportar. Fuera de alcance para v1:

- OCR / PDFs escaneados (no aplica: confirmado que todos tienen texto digital).
- UI para editar la tabla de colores o las fórmulas de corte — quedan hardcodeadas en código (`essRules.js`), versionadas por git.
- Multi-usuario / edición concurrente del borrador (un solo actor: el súper admin).

## Acceso y navegación

- Tab nuevo **"ESS"** en el Navbar, gateado igual que el tab `admin` en [App.jsx:644-645](../../../src/App.jsx#L644-L645): `isSuperAdminRole(userProfile?.role) ? <EssView ... /> : <DashboardView ... />`.
- `EssView.jsx`: lista de proyectos (reusa `mergedData.priorityAnalysis`, mismo patrón que `MyProjectsView`), con estado por proyecto: `Sin PDFs` / `PDFs cargados` / `ESS generada` / `ESS revisada`.
- Click en un proyecto → `EssProjectDetail.jsx`, con 3 slots de carga (Contract / Quote / Drawings).

No tiene relación con el generador de PDF existente en My Projects (`PDFGeneratorModal`/`IPGeneratorModal`, que genera el IP a partir de un formulario) — son features independientes.

## Arquitectura

Todo client-side, siguiendo el mismo patrón que ya usa el repo para datos externos (`sheetParser.js`, `masterSchedule.js`): fetch/parseo en el navegador, sin backend nuevo.

**Por qué client-side y no una función serverless nueva:** el parseo de Drawings necesita no solo el texto sino la **posición (x/y)** de cada texto en la página, para inferir a qué símbolo de gabinete pertenece cada número. `pdfjs-dist` da esa posición vía `page.getTextContent()` y corre nativamente en el navegador; en Node/serverless requiere workarounds (canvas, fuentes) sin beneficio real, porque el parseo no toca secretos ni datos privilegiados.

```
Upload (Storage) ──┐
                    ├─→ pdfjs-dist (browser) → texto + posición
                    │
        parseContract(text) → { deposit, tearout, baseboards }
        parseQuote(text)    → { areas: [{ name, items: [{code, qty, ...}] }] }
        parseDrawings(items)→ { areas: [{ name, openings: [{width, height, depth}] }] }
                    │
                    ▼
        essRules.js (matching + fórmulas + color map)
                    │
                    ▼
        Borrador ESS (editable) ──→ guardar (RTDB) / exportar (PDF)
```

### Componentes nuevos

- `src/views/EssView.jsx` — lista de proyectos.
- `src/views/EssProjectDetail.jsx` — carga de PDFs + botón "Generar ESS" + los dos paneles de resultado.
- `src/utils/essPdfExtract.js` — wrapper sobre `pdfjs-dist` que da texto + posición por página.
- `src/utils/essParsers/parseContract.js`, `parseQuote.js`, `parseDrawings.js` — un parser por tipo de doc.
- `src/utils/essRules.js` — tabla de colores, fórmulas de corte, matching Quote↔Drawings. Funciones puras, fácil de testear.
- `src/utils/essData.js` — `saveEssDraft`/`loadEssDraft`, mismo patrón que `ipData.js`.
- `src/components/ESSPrintLayout.jsx` — layout de impresión, mismo patrón que `IPPrintLayout` (`react-to-print`, ya usado en `IPGeneratorModal`).

### Storage

- **Firebase Storage** (no usado hoy en el repo — hay que agregar el bucket y `storage.rules.json`, gateado igual que RTDB: solo `role === 'engineer-admin'` lee/escribe). PDFs originales en `ess/{so}/{contract|quote|drawings}.pdf`, quedan como respaldo/auditoría.
- **RTDB** `ess_data/{so}`: borrador editable (mismo patrón que `ipData.js`/`saveIPData`).
- **RTDB** `ess_corrections/{so}/{campo}`: casos reportados para ajustar reglas (ver "Corrección de errores").

## Motor de reglas (`essRules.js`)

Datos fijos, provistos por el usuario, hardcodeados y versionados en git:

- **Mapeo de color:** comercial → código interno de melamina/HPL (ej. "Snow White" → "White Classic 300").
- **Fórmulas de corte:** PRFV = opening − 1", Dovetail = opening − 3/8", recorte de tubo de colgar = vano − 1/4", descuento de profundidad por backing = − 3/4".
- **Misceláneos:** boring pattern 32mm, scar cleats, tapas decorativas, edge banding 4S front & back — reglas fijas, no derivadas de los PDFs.

El motor cruza cada accesorio/ítem de la Quote con su opening correspondiente en el Drawing (por área + posición), aplica la fórmula según tipo de frente, y arma una fila de borrador por módulo.

## Manejo de errores y casos límite

- **Falta algún PDF:** "Generar ESS" deshabilitado, indica cuáles slots faltan. No se genera nada parcial.
- **PDF en el slot equivocado:** validación liviana no bloqueante — busca palabras clave esperadas por tipo de doc (ej. "DEPOSIT"/"CANCELLATION" en Contract) y avisa si no aparecen, sin impedir continuar.
- **PDF sin texto extraíble** (protegido o, contra lo esperado, escaneado): si `pdfjs-dist` devuelve texto vacío/mínimo, corta con error explícito en vez de generar una ESS vacía.
- **PDF corrupto/inválido:** parseo en try/catch, usando el `ErrorBoundary` ya existente en el repo — un archivo roto no debe tirar abajo la vista.
- **Parseo parcial** (ej. ningún opening matcheado): no bloquea — muestra el borrador con lo que sí se armó, más un banner de advertencia con la cantidad de ítems sin matchear.
- **Reemplazo de un PDF ya cargado:** si había un borrador generado, queda marcado como desactualizado ("generado con un Drawings anterior — regenerar") en vez de mezclarse silenciosamente.
- **Performance:** Drawings puede tener varias páginas — parseo con spinner, procesado por página para no congelar la UI.

## Corrección de errores (ciclo de mejora sin IA)

Como no hay aprendizaje automático, cada mejora del parser es un cambio de código deliberado. Dos niveles:

1. **Corrección puntual:** editar la celda mal calculada directamente en el borrador — arregla ese proyecto, no el parser.
2. **Corrección de la regla:** cada celda tiene un ícono de inspección que muestra el texto crudo extraído, su posición en el PDF, y qué regla decidió su clasificación. Botón "Reportar error" guarda el caso en `ess_corrections/{so}/{campo}` (valor del parser vs. valor correcto + referencia al PDF). Esos reportes son la lista de casos a revisar y convertir en ajustes de `essRules.js`/los parsers.

## Testing

- **Fixtures reales:** 3-4 PDFs representativos (Contract/Quote/Drawings de proyectos reales, con distintos estilos de plano si varían) guardados como fixtures de test, mismo patrón que `redFlags.test.ts`/`chatbotLocalMatch.test.js`. Cada ajuste de parser corre contra este set antes de darse por bueno, para no arreglar un caso rompiendo otro.
- **`essRules.js`:** tests unitarios directos sobre las fórmulas conocidas (PRFV, Dovetail, etc.) — son funciones puras, no dependen de PDFs.

## Salida final

- **Guardar:** persiste el borrador editado en `ess_data/{so}`.
- **Exportar:** `react-to-print` sobre `ESSPrintLayout.jsx` → PDF final para el taller, mismo patrón que `IPGeneratorModal`/`PDFGeneratorModal`.
