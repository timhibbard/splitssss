/**
 * Run by the service worker (workbox imports it), not by the page.
 *
 * When a new build's worker takes over from an older one, every open results or
 * help page is reloaded onto the new build. The page cannot do this for itself if
 * it is old enough: a phone that opened the Yellow Jacket link before season pages
 * existed answers /meets/2026/girls/ with its own saved copy of the app, which has
 * never heard of that address and shows the home screen. Nothing in that copy knows
 * to reload. The worker that replaces it does, so the fix lives here, where it
 * reaches every page whatever build it is running.
 *
 * Only on an update. On a first visit there was no worker before this one, and the
 * page came off the network already current.
 *
 * Only addressed pages. The timing screens sit at the app's root and are never
 * reloaded from under somebody standing at a marker; the Refresh button is theirs.
 */

let replacing = false

self.addEventListener('install', () => {
  // Read before this worker activates, while the one it replaces is still active.
  replacing = self.registration.active != null
})

/** A results, coach or help page, by its path under the app's scope. */
function addressed(url) {
  const scope = self.registration.scope
  if (!url.startsWith(scope)) return false
  const rest = url.slice(scope.length).split(/[?#]/)[0]
  return rest.startsWith('meets/') || rest.startsWith('help/') || rest === 'help'
}

self.addEventListener('activate', (event) => {
  if (!replacing) return
  // A page has to be this worker's before this worker can navigate it.
  const claimed = self.clients.claim()
  event.waitUntil(claimed)
  // Not inside waitUntil. The reload is a request this worker answers, and it
  // answers nothing until it has finished activating, so waiting on the reload to
  // activate would wait forever.
  claimed
    .then(() => self.clients.matchAll({ type: 'window' }))
    .then((pages) => {
      for (const page of pages) if (addressed(page.url)) page.navigate(page.url).catch(() => {})
    })
})
