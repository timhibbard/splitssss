import { useEffect, useState } from 'react'

/**
 * Keeps the screen on while a race is being timed.
 *
 * A phone that locks between packs is worse than a dark screen. iOS stops the
 * page's monotonic clock while it is locked, so every split taken after the
 * phone wakes reads short by however long it slept: at Wendy's one phone's
 * splits came back 14 s short. The volunteer did nothing wrong, the phone
 * just did what phones do in a pocket. So the screen stays on for as long as the
 * race is open, from before the gun until it is stopped.
 *
 * The browser drops the lock whenever the page is hidden, an app switch or the
 * side button, and does not give it back, so it is asked for again each time the
 * page comes back.
 *
 * What it says back: `held` while the screen is being kept on, `refused` when the
 * browser said no (Low Power Mode, an older iPhone, a desktop), `unsupported`
 * where there is no such thing to ask for, and `off` when nothing is being asked.
 * Only the two failures are worth a word on screen.
 */
export type WakeState = 'off' | 'held' | 'refused' | 'unsupported'

type Sentinel = { released: boolean; release: () => Promise<void>; addEventListener: (t: 'release', f: () => void) => void }
type WakeLockApi = { request: (type: 'screen') => Promise<Sentinel> }

function wakeLockApi(): WakeLockApi | undefined {
  return (navigator as Navigator & { wakeLock?: WakeLockApi }).wakeLock
}

export function useWakeLock(active: boolean): WakeState {
  // Only what the browser answered. Off and unsupported are known without asking.
  const [answer, setState] = useState<'held' | 'refused' | null>(null)

  useEffect(() => {
    const api = wakeLockApi()
    if (!active || !api) return
    let sentinel: Sentinel | null = null
    let done = false

    const ask = async () => {
      if (done || document.visibilityState !== 'visible') return
      if (sentinel && !sentinel.released) return
      try {
        const got = await api.request('screen')
        if (done) {
          void got.release()
          return
        }
        sentinel = got
        setState('held')
        got.addEventListener('release', () => {
          // Released by the browser, not by us: say so until it is back.
          if (!done && document.visibilityState === 'visible') setState('refused')
        })
      } catch {
        if (!done) setState('refused')
      }
    }

    const onVisible = () => void ask()
    document.addEventListener('visibilitychange', onVisible)
    void ask()
    return () => {
      done = true
      document.removeEventListener('visibilitychange', onVisible)
      if (sentinel && !sentinel.released) void sentinel.release()
      sentinel = null
      setState(null)
    }
  }, [active])

  if (!active) return 'off'
  if (!wakeLockApi()) return 'unsupported'
  return answer ?? 'held'
}
