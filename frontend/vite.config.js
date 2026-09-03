import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt': la app avisa "hay una versión nueva" y el usuario decide
      // cuándo recargar. Se toman pedidos en esta pantalla: una recarga
      // automática a mitad de carga perdería datos del formulario.
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'Chaco Living - Pedidos',
        short_name: 'Chaco Living',
        description: 'Tomar y consultar pedidos de sillones',
        lang: 'es',
        dir: 'ltr',
        theme_color: '#14171a',
        background_color: '#f5f6f6',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'portrait',
        scope: '/',
        start_url: '/?fuente=pwa',
        categories: ['business', 'productivity'],
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        // Al refrescar dentro de una ruta (ej. /pedidos/12) sin conexión, servir
        // el shell cacheado. La API nunca se cachea (online-simple, ver CLAUDE.md).
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api/],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
})
