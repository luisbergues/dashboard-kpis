// Modo demo: la app real corriendo contra una base en memoria.
//
// Sirve para recorrer el producto sin Firebase, sin login y sin reglas
// publicadas — util para mostrar el flujo de tags mientras engineer_directory
// todavia no esta poblado en produccion.
//
// La puerta tiene DOS condiciones y las dos importan:
//
//   import.meta.env.DEV  Vite lo reemplaza literalmente por `false` al
//                        compilar, asi que en el build de produccion esta
//                        expresion queda en `false && ...` y el bundler borra
//                        el modo demo entero. No es una convencion: es
//                        imposible activarlo en el deploy de Vercel.
//
//   ?demo en la URL      Para que `npm run dev` normal siga hablando con el
//                        Firebase de verdad. El modo demo hay que pedirlo.
//
// Uso: npm run dev  ->  http://localhost:5173/?demo
export const IS_DEMO = Boolean(
  import.meta.env.DEV &&
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).has('demo')
);
