import { useEffect, useRef, useState } from 'react'
import { elapsedMs, formatElapsed, formatWallClock, stamp } from '../lib/clock'
import { buzz, click, undoClick } from '../lib/feedback'
import { SESSION_ID } from '../lib/clock'
import type { Race, Tap } from '../lib/types'

type Props = {
  race: Race
  taps: Tap[]
  onTap: () => void
  onUndo: () => void
  onSetGun: () => void
  onExport: () => void
}

export function Capture({ race, taps, onTap, onUndo, onSetGun, onExport }: Props) {
  const [flash, setFlash] = useState(false)
  const [now, setNow] = useState(() => stamp())
  const flashTimer = useRef<number | undefined>(undefined)

  // Tenths display. The interval only triggers a fresh clock read. Elapsed is
  // always recomputed from the gun stamp, never accumulated from ticks, so a
  // throttled or suspended timer cannot make the clock drift.
  useEffect(() => {
    if (!race.gun) return
    const id = window.setInterval(() => setNow(stamp()), 100)
    return () => window.clearInterval(id)
  }, [race.gun])

  useEffect(() => () => window.clearTimeout(flashTimer.current), [])

  // The gun's monotonic reading only shares a reference frame with taps from the
  // same page session. Across a reload, fall back to wall clock.
  const gunSameSession = race.gunSessionId === SESSION_ID

  function handleTap() {
    // Record first. Feedback and rendering come after the data is durable.
    onTap()
    click()
    buzz()
    setFlash(true)
    window.clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => setFlash(false), 130)
  }

  function handleUndo() {
    if (taps.length === 0) return
    onUndo()
    undoClick()
    buzz(30)
  }

  const running = race.gun ? elapsedMs(race.gun, now, gunSameSession) : undefined
  const recent = taps.slice(-4).reverse()

  return (
    <div className={flash ? 'screen capture flash' : 'screen capture'}>
      <header className="bar">
        <div className="bar-where">
          <strong>{race.station.label}</strong>
          <span>{race.race}</span>
        </div>
        {race.gun ? (
          <div className="bar-clock" aria-label="elapsed since gun">
            {formatElapsed(running ?? 0)}
          </div>
        ) : (
          <button type="button" className="gun" onClick={onSetGun}>
            Gun
          </button>
        )}
      </header>

      {/*
        pointerdown, not click. click waits for the pointer to lift, which adds
        real latency to a tap whose whole purpose is recording a moment.
      */}
      <button
        type="button"
        className="tap"
        onPointerDown={handleTap}
        aria-label={`Record crossing. ${taps.length} recorded so far.`}
      >
        <span className="tap-count">{taps.length}</span>
        <span className="tap-word">TAP</span>
      </button>

      <div className="recent" aria-live="polite">
        {recent.length === 0 ? (
          <p className="recent-empty">
            No crossings yet.
            {race.gun ? '' : ' You can start tapping without setting a gun time.'}
          </p>
        ) : (
          recent.map((tap) => {
            const ms = race.gun
              ? elapsedMs(race.gun, tap, gunSameSession && tap.sessionId === SESSION_ID)
              : undefined
            return (
              <div key={tap.id} className="recent-row">
                <span className="recent-place">{tap.seq}</span>
                <span className="recent-time">
                  {ms == null ? formatWallClock(tap.wallMs) : formatElapsed(ms)}
                </span>
              </div>
            )
          })
        )}
      </div>

      <footer className="actions">
        <button type="button" onClick={handleUndo} disabled={taps.length === 0}>
          Undo last
        </button>
        <button type="button" onClick={onExport} disabled={taps.length === 0}>
          Export
        </button>
      </footer>
    </div>
  )
}
