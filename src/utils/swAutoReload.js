/**
 * Recarga la pestaña cuando una versión nueva del service worker toma el
 * control.
 *
 * El problema que resuelve: la PWA precachea TODO el bundle. El `registerSW.js`
 * que genera vite-plugin-pwa se limita a `navigator.serviceWorker.register(...)`
 * — no avisa ni recarga cuando hay una versión nueva. Y como el SW también
 * sirve el index.html desde caché, un F5 normal devuelve el HTML viejo, que
 * apunta al chunk viejo. Resultado: la pestaña sigue ejecutando un bundle que
 * el servidor ya borró (devuelve 404), y cualquier arreglo desplegado no se ve
 * hasta que alguien limpia la caché a mano.
 *
 * `sw.js` ya se genera con skipWaiting + clientsClaim, así que la versión nueva
 * se activa y reclama la página sola. Lo único que faltaba era volver a
 * ejecutar la página con el bundle nuevo: eso es esta recarga.
 */
export function enableServiceWorkerAutoReload() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  // En la primera visita no hay controlador: el SW se instala, reclama la
  // página y dispararía una recarga inútil. Solo interesa el CAMBIO de
  // controlador, que es cuando una versión nueva desplazó a la anterior.
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloading = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    window.location.reload();
  });

  // Pedir explícitamente la comprobación de versión. Sin esto el navegador
  // decide cuándo mirar si hay un sw.js nuevo, y puede tardar varias sesiones.
  navigator.serviceWorker.ready
    .then(registration => registration.update())
    .catch(() => { /* sin red o SW no soportado: se reintenta en la próxima carga */ });
}
