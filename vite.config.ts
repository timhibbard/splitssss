import { mkdirSync, copyFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { PAGES } from './src/lib/pages.ts'

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

/**
 * Writes a real index.html at every address in PAGES, so `/meets/2026/yellow-jacket/`
 * is a file GitHub Pages can serve rather than a path it has never heard of.
 *
 * This is what makes paths possible on a host with no routing at all. The
 * alternatives were both worse: serving the app as 404.html means every one of these
 * links really does return a 404 status, which is what iMessage checks before it
 * draws a preview, and a Vite multi-page build would give each address its own entry
 * chunk when what they all want is the one app.
 *
 * A copy of index.html and not a stub, because index.html is what Vite already
 * finished — the hashed script and style tags, the manifest link, the theme colour.
 * Every one of those paths is absolute under `base`, so the same bytes work at any
 * depth. The router in App.tsx reads the address and shows the right screen.
 *
 * In closeBundle and before VitePWA in the plugin list, so the files exist on disk
 * by the time workbox globs the output directory and are precached like everything
 * else. Workbox resolves a request for a directory to its index.html, so the phone
 * serves these from the cache with no signal. `npm run build` prints the list; if one
 * of these ever stops appearing in dist, the link for it is dead.
 */
function realPages(): Plugin {
  let outDir = 'dist'
  /** An SSR build produces no index.html to copy, so there is nothing to do. */
  let ssr = false
  return {
    name: 'splitssss-real-pages',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
      ssr = Boolean(config.build.ssr)
    },
    closeBundle() {
      if (ssr) return
      const from = join(outDir, 'index.html')
      for (const page of PAGES) {
        const to = join(outDir, page.path, 'index.html')
        mkdirSync(dirname(to), { recursive: true })
        copyFileSync(from, to)
        this.info(`wrote ${to}`)
      }
    },
  }
}

export default defineConfig({
  base: BASE,
  define: {
    __BUILD__: JSON.stringify(buildStamp()),
  },
  plugins: [
    react(),
    // Before VitePWA, so the pages it writes are on disk when workbox globs dist.
    realPages(),
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
        // `dat` is the team list and the meet results that ship with the build,
        // precached like everything else, so a phone loads its names with no signal
        // at the two mile mark and a runner opening a texted results link on the bus
        // home does not need a bar of service either.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,dat}'],
        // A request for meets/2026/yellow-jacket/ is served by the index.html
        // realPages wrote inside it. This is workbox's default, set out loud because
        // every addressed page depends on it: without it a phone with no signal would
        // fall through to the app's home screen instead of the page it asked for.
        directoryIndex: 'index.html',
        // Everything is precached and there are no network calls, so the app is
        // fully functional with no signal at the two mile mark. This is the last
        // resort, for an address with no file: the pages that have one are matched by
        // precache first and keep their own URL.
        navigateFallback: `${BASE}index.html`,
      },
    }),
  ],
})
