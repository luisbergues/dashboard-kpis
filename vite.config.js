import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      workbox: {
        // Default is 2 MiB. The ESS tab is now lazy-loaded (see the
        // React.lazy(() => import('./views/EssView')) in App.jsx), so
        // pdfjs-dist lives in its own chunk and no longer inflates the main
        // bundle every user downloads. This raised ceiling stays as headroom
        // so a single large chunk doesn't fail the build outright — it is a
        // safety margin now, not the fix.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      manifest: {
        name: 'JL Closets Engineering',
        short_name: 'JL Closets Eng.',
        description: 'JL Closets Engineering Weekly KPI Dashboard',
        theme_color: '#0B1520',
        background_color: '#0B1520',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  build: {
    chunkSizeWarningLimit: 2000,
    // Tirar los console.* y los debugger del build de produccion.
    //
    // OJO: la receta habitual `esbuild: { drop: [...] }` NO hace nada en este
    // proyecto. Vite 8 dejo de transformar con esbuild (la opcion figura como
    // @deprecated en sus propios tipos) y ahora bundlea con Rolldown/Oxc, asi
    // que esa clave se ignora en silencio: probado, el bundle salia byte por
    // byte igual con y sin ella. El equivalente real es la opcion `minify` del
    // output de Rolldown.
    //
    // `mangle` y `codegen` van explicitos porque pasar un objeto reemplaza los
    // defaults: sin ellos se pierde el renombrado de identificadores y el
    // bundle crece.
    rollupOptions: {
      output: {
        minify: command === 'build'
          ? {
              module: true,
              compress: { dropConsole: true, dropDebugger: true },
              mangle: true,
              codegen: true,
            }
          : undefined,
      },
    },
  },
}))
