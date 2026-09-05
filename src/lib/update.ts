/**
 * Reloading the app by hand, and taking a newer build while we are at it.
 *
 * Added to the home screen the app runs standalone, and standalone has no pull to
 * refresh. That is the whole reason this exists: the one gesture everybody knows
 * for "try that again" is gone precisely on the phones that use the app most.
 *
 * A plain `location.reload()` would not be enough on its own. Everything is
 * precached, so a reload is served out of the service worker's cache and can hand
 * back the same build it just had, which is the opposite of what somebody tapping
 * refresh means. So this asks the browser to look for a new worker first, waits
 * for it to take over if one is there, and only then reloads.
 *
 * The registration is left to `registerSW.js`, which runs on load and does nothing
 * afterwards. The worker itself claims clients and skips waiting, so a new one
 * that installs is in charge immediately with nothing to confirm; what is missing
 * is anybody asking it to look. An app kept in the switcher for a week may never
 * navigate again, so it may never check again.
 *
 * A reload mid race costs nothing. Every race, crossing and name is in
 * localStorage, and a tap's time is a stored stamp rather than something the page
 * is holding. The one thing that does not survive is the page session, so a race
 * whose gun was captured before the reload has its running clock derived from wall
 * time instead of the monotonic reading. That is the fallback the two stamps were
 * built for, and it is why this is safe to offer to a volunteer.
 *
 * No test: there is no service worker in node, and what is left after mocking one
 * away is the mock. What this file must not do is throw, since the reload at the
 * end is the part somebody actually asked for, and every branch below reaches it.
 */

/**
 * How long to wait for a new build to install before reloading anyway.
 *
 * Somebody is standing at a marker with a thumb on a small button, so this is a
 * ceiling on that wait and not a deadline for the download. A worker still
 * installing when this runs out keeps installing, and the next open takes it.
 */
const WAIT_MS = 4000

/**
 * Resolves when this worker is in charge, or when it has failed and been
 * discarded, or when the wait above runs out. All three mean the same thing here:
 * reload now, with whatever is current.
 */
function settled(worker: ServiceWorker): Promise<void> {
  if (worker.state === 'activated') return Promise.resolve()
  return new Promise((resolve) => {
    const timer = window.setTimeout(finish, WAIT_MS)
    function finish() {
      worker.removeEventListener('statechange', onChange)
      window.clearTimeout(timer)
      resolve()
    }
    function onChange() {
      if (worker.state === 'activated' || worker.state === 'redundant') finish()
    }
    worker.addEventListener('statechange', onChange)
  })
}

/** Looks for a newer build and gives it the chance to take over. */
async function takeNewBuild(): Promise<void> {
  const sw = navigator.serviceWorker
  if (!sw) return
  const reg = await sw.getRegistration()
  if (!reg) return
  try {
    // The one network call the app makes on purpose. No signal at the two mile
    // mark is the normal case, and then this throws and the reload below serves
    // the copy already on the phone, which is a working app.
    await reg.update()
  } catch {
    return
  }
  const next = reg.installing ?? reg.waiting
  if (next) await settled(next)
}

/**
 * What the refresh button does. Always reloads, because that is what the gesture
 * it stands in for did, and a tap that appears to do nothing is worse than a
 * reload that was not strictly needed.
 */
export async function refreshApp(): Promise<void> {
  await takeNewBuild()
  window.location.reload()
}
