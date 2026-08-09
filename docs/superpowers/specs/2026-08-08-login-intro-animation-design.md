# Diseño — Animación de introducción (video JL Engineering)

**Fecha:** 2026-08-08
**Estado:** Aprobado, listo para implementation plan

## Objetivo

Reemplazar la animación de fondo del login actual (canvas SVG con estrellas/túnel/partículas/emblema, en `LoginIntroBackground.jsx`) por el video `JL Engineering Intro.mp4` provisto por el usuario, y mostrar esa misma intro como splash de pantalla completa en **cada apertura de la app** (abrir Chrome, o Ctrl+R) — incluso para usuarios ya logueados en medio del trabajo — sin forzar un nuevo login ni cerrar sesión.

## Contexto / video fuente

- `public/JL Engineering Intro.mp4`: 1920×1080, H.264, **6.000s exactos**, sin pista de audio, fast-start (`moov` antes de `mdat`), 815KB (~1.09 Mbps).
- Confirmado por análisis del contenedor MP4 (duración exacta, mismo nombre) que es el render de video-export de la escena "IntroCloud" (liquid cloud + logo JL + wordmark "JL ENGINEERING / for JL Closets") diseñada en Claude Design — mismo activo que el bundle `public/JL Engineering Intro.html` (929KB), pero ya renderizado a video.
- Se descarta portar el JSX/SVG de esa escena a React (usa filtros `feTurbulence`/`feDisplacementMap`, costosos de recalcular en tiempo real, más aún si corre dos veces a la vez — splash + fondo del login). El `.mp4` ya es el resultado final, pesa menos y es más confiable.

## Alcance

- Reemplaza el contenido de `LoginIntroBackground.jsx` (fondo persistente del login).
- Agrega un splash nuevo de pantalla completa, montado en `App.jsx`, en cada carga/refresh completo de la página — para logueados y no logueados.
- Click/tap en cualquier lugar del splash, o tecla `Escape`, lo saltea.
- Fuera de alcance: cambiar el flujo de autenticación; deduplicar entre refrescos vía `sessionStorage` (pedido explícito del usuario: debe aparecer siempre); `prefers-reduced-motion` (no pedido).

## Componentes

### 1. `IntroSplash.jsx` + `.css` (nuevo) — `src/components/`

Overlay `position: fixed; inset: 0`, `z-index: 10000` (por encima de `.login-view`, que usa 9999), `background: #020617` (mismo navy del video) para que no haya flash de otro color mientras decodifica el primer frame.

```jsx
<div className="intro-splash" onClick={skip}>
  <video
    ref={videoRef}
    src="/jl-engineering-intro.mp4"
    autoPlay muted playsInline preload="auto"
    onEnded={skip}
  />
</div>
```

- `onEnded` del video, click/tap en cualquier parte del overlay, o `Escape` (listener global mientras está montado) → misma función `skip`, que dispara el fade-out.
- Fade-out: transición CSS `opacity 1→0` en ~450ms; al terminar (`onTransitionEnd`) se llama `onDone()` (prop) para que `App` desmonte el componente.
- Prop: `onDone: () => void`.

### 2. `LoginIntroBackground.jsx` (reescrito) — `src/views/`

Mismo rol que hoy: fondo persistente detrás de la card de login. Se simplifica a un `<video>` sin loop — al terminar, el elemento se queda mostrando el último frame (logo + wordmark ya asentados) por comportamiento nativo del navegador, sin lógica de tiempo/canvas propia:

```jsx
<div className="login-intro-bg">
  <video src="/jl-engineering-intro.mp4" autoPlay muted playsInline preload="auto" />
</div>
```

### 3. `App.jsx` (editado)

```jsx
const [showSplash, setShowSplash] = useState(true);
...
return (
  <div className="app-container">
    {showSplash && <IntroSplash onDone={() => setShowSplash(false)} />}
    {/* resto del árbol igual que hoy */}
```

`showSplash` arranca en `true` en cada montaje de `App`. Como React remonta `App` desde cero en cada apertura de pestaña/Chrome y en cada Ctrl+R, esto cubre ambos casos pedidos sin tocar el estado de Firebase Auth ni usar `sessionStorage`. La carga de datos (`useQuery`, `onAuthStateChanged`, listeners de RTDB) sigue corriendo en paralelo detrás del splash, así que al terminar o saltear, el contenido ya puede estar listo.

## Limpieza de archivos

- Renombrar `public/JL Engineering Intro.mp4` → `public/jl-engineering-intro.mp4` (sin espacios: evita problemas de encoding en `<video src>` y en el build).
- Borrar `public/JL Engineering Intro.html` (929KB, bundle de desarrollo/export de Claude Design — no se usa en producción; si se deja, Vite lo copia tal cual al build final).

## Testing / verificación

- `npm run dev`: refrescar con Ctrl+R logueado y deslogueado → el splash aparece en ambos casos, por encima de todo.
- Click y `Escape` durante el splash → saltea y revela el contenido inmediatamente.
- Dejar que el video termine solo (6s) → fade-out automático, sin intervención.
- El login sigue mostrando el video de fondo (congelado en el último frame) detrás de la card, igual que la versión anterior.
- El `.mp4` se sirve como asset estático de `public/` (815KB) — no entra al bundle de JS ni afecta el code-splitting existente.
