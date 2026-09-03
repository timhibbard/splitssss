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

/**
 * When this build was made, in Eastern time, shown on the setup screen so a
 * stale build on race day is diagnosable.
 *
 * Eastern and not UTC because the person reading it is standing on a course in
 * South Carolina with a phone clock to compare it against, while the build
 * happens on a GitHub runner set to UTC. A stamp four hours ahead of every clock
 * at the meet is one nobody can act on: it makes this morning's build look like
 * this afternoon's. The zone is named rather than taken from the machine so a
 * local build and a deployed one read the same way, and so daylight saving is
 * handled instead of hardcoded.
 *
 * h23 explicitly, because hour12: false has historically produced "24" for
 * midnight, and "2026-08-25 24:05" would be a puzzle at a starting line.
 */
function buildStamp(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'short',
  }).formatToParts(new Date())
  const at = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''
  // EDT or EST, whichever it was, rather than a season neutral guess.
  return `${at('year')}-${at('month')}-${at('day')} ${at('hour')}:${at('minute')} ${at('timeZoneName')}`
}

export default defineConfig({
  base: BASE,
  define: {
    __BUILD__: JSON.stringify(buildStamp()),
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
        // `dat` is the team list that ships with the build, precached like
        // everything else, so a phone loads its names with no signal at the two
        // mile mark.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,dat}'],
        // Everything is precached and there are no network calls, so the app is
        // fully functional with no signal at the two mile mark.
        navigateFallback: `${BASE}index.html`,
      },
    }),
  ],
})
