import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      workbox: {
        // Default is 2 MiB. The ESS feature's PDF upload screen pulls
        // pdfjs-dist into the eagerly-loaded main bundle (App.jsx -> EssView.jsx
        // -> EssProjectDetail.jsx -> essPdfExtract.js are all static imports),
        // pushing the main chunk to ~2.14 MB, which trips the default precache
        // limit and fails the build. Raised comfortably above that so small
        // future growth doesn't immediately re-trip it. A future improvement
        // would be lazy-loading the ESS tab so non-admin users don't pay for
        // pdfjs-dist at all — out of scope here.
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
    chunkSizeWarningLimit: 2000
  }
})
