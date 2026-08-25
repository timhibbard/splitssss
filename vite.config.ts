import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * GitHub Pages serves this from a subpath, so `base` has to be set and every
 * asset path, the service worker scope, and the manifest start_url/scope all
 * have to agree with it. A custom domain would move this to '/' and remove the
 * whole class of bug. See DESIGN.md.
 */
const BASE = '/splitssss/'

export default defineConfig({
  base: BASE,
  define: {
    // Shown in the UI so a stale build on race day is diagnosable.
    __BUILD__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')),
  },
  plugins: [
    react(),
    VitePWA({
      // Take the new version immediately. A volunteer must never open a stale
      // build at the starting line, and all state lives in localStorage so an
      // update-triggered reload loses nothing.
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Splitssss',
        short_name: 'Splitssss',
        description: 'Hand timed cross country splits. Tap now, add names later.',
        id: BASE,
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#fafafa',
        theme_color: '#1d507b',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // `dat` is the team list that ships with the build and `enc` the encrypted
        // roster. Both are precached like everything else, so a phone loads its
        // names with no signal at the two mile mark.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,enc,dat}'],
        // Everything is precached and there are no network calls, so the app is
        // fully functional with no signal at the two mile mark.
        navigateFallback: `${BASE}index.html`,
      },
    }),
  ],
})
