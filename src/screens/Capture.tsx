import { useEffect, useRef, useState } from 'react'
import {
  SESSION_ID,
  elapsedMs,
  formatElapsed,
  formatMinSec,
  formatWallClock,
  stamp,
} from '../lib/clock'
import { projectedFinish } from '../lib/distance'
import { buzz, click, undoClick } from '../lib/feedback'
import type { Race, Tap } from '../lib/types'

type Props = {
  race: Race
  taps: Tap[]
  onTap: () => void
  onName: (athleteId: string) => void
  onUndo: () => void
  onSetGun: () => void
  onStop: () => void
  onExport: () => void
  onSetup: () => void
  onEditRoster: () => void
}

export function Capture({
  race,
  taps,
  onTap,
  onName,
  onUndo,
  onSetGun,
  onStop,
  onExport,
  onSetup,
  onEditRoster,
}: Props) {
  const [flash, setFlash] = useState(false)
  const [now, setNow] = useState(() => stamp())
  const [confirmStop, setConfirmStop] = useState(false)
  const flashTimer = useRef<number | undefined>(undefined)
  const confirmTimer = useRef<number | undefined>(undefined)

  const stopped = race.stoppedAt != null

  // Tenths display. The interval only triggers a fresh clock read. Elapsed is
  // always recomputed from the gun stamp, never accumulated from ticks, so a
  // throttled or suspended timer cannot make the clock drift.
  useEffect(() => {
    if (!race.gun || stopped) return
    const id = window.setInterval(() => setNow(stamp()), 100)
    return () => window.clearInterval(id)
  }, [race.gun, stopped])

  useEffect(
    () => () => {
      window.clearTimeout(flashTimer.current)
      window.clearTimeout(confirmTimer.current)
    },
    [],
  )

  // The gun's monotonic reading only shares a reference frame with taps from the
  // same page session. Across a reload, fall back to wall clock.
  const gunSameSession = race.gunSessionId === SESSION_ID

  function confirmFeedback() {
    click()
    buzz()
    setFlash(true)
    window.clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => setFlash(false), 130)
  }

  function handleTap() {
    if (stopped) return
    // Record first. Feedback and rendering come after the data is durable.
    onTap()
    confirmFeedback()
  }

  function handleName(athleteId: string) {
    onName(athleteId)
    confirmFeedback()
  }

  function handleUndo() {
    if (taps.length === 0) return
    onUndo()
    undoClick()
    buzz(30)
  }

  /**
   * Two taps to stop. The stop button sits inches from a target being hit
   * repeatedly under pressure, and an accidental stop mid race is the worst
   * thing this app could do to a volunteer.
   */
  function handleStop() {
    if (!confirmStop) {
      setConfirmStop(true)
      window.clearTimeout(confirmTimer.current)
      confirmTimer.current = window.setTimeout(() => setConfirmStop(false), 4000)
      return
    }
    window.clearTimeout(confirmTimer.current)
    setConfirmStop(false)
    onStop()
  }

  const clockAt = race.stoppedAt ?? now
  const running = race.gun ? elapsedMs(race.gun, clockAt, gunSameSession && !race.stoppedAt) : undefined
  const projected = projectedFinish(race.station.meters, race.raceMeters, running ?? 0)

  const assigned = new Set(taps.map((t) => t.athleteId).filter(Boolean))
  const pending = taps.find((t) => !t.athleteId)
  const pendingElapsed =
    pending && race.gun
      ? elapsedMs(race.gun, pending, gunSameSession && pending.sessionId === SESSION_ID)
      : undefined
  const unnamed = taps.filter((t) => !t.athleteId).length
  const hasRoster = race.athletes.length > 0

  const recent = taps.slice(-3).reverse()

  return (
    <div
      className={[
        'screen capture',
        flash ? 'flash' : '',
        hasRoster ? 'has-names' : '',
        stopped ? 'stopped' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <header className="bar">
        <div className="bar-where">
          <strong>{race.station.label}</strong>
          <span>{race.race}</span>
        </div>
        {race.gun ? (
          <div className="bar-clocks">
            <div className="bar-clock" aria-label="elapsed since gun">
              {formatElapsed(running ?? 0)}
            </div>
            {projected != null && (
              <div className="proj" aria-label="projected finish at this pace">
                {race.raceMeters === 5000 ? '5K' : `${race.raceMeters}m`} pace{' '}
                <strong>{formatMinSec(projected)}</strong>
              </div>
            )}
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
        disabled={stopped}
        aria-label={`Record an unnamed crossing. ${taps.length} recorded so far.`}
      >
        <span className="tap-count">{taps.length}</span>
        <span className="tap-word">{stopped ? 'STOPPED' : 'TAP'}</span>
      </button>

      {hasRoster ? (
        <>
          <p className="pending" aria-live="polite">
            {pending ? (
              <>
                Naming <strong>#{pending.seq}</strong>
                {pendingElapsed != null ? ` at ${formatElapsed(pendingElapsed)}` : ''}
                {unnamed > 1 ? ` · ${unnamed - 1} more waiting` : ''}
              </>
            ) : stopped ? (
              'All crossings named.'
            ) : (
              'Tap a name as she passes to record and name in one tap.'
            )}
          </p>
          <div className="names">
            {race.athletes.map((a) => {
              const done = assigned.has(a.id)
              return (
                <button
                  key={a.id}
                  type="button"
                  className={done ? 'name-chip done' : 'name-chip'}
                  onPointerDown={() => handleName(a.id)}
                  disabled={done || (stopped && !pending)}
                >
                  {a.name}
                </button>
              )
            })}
          </div>
        </>
      ) : (
        <div className="recent" aria-live="polite">
          {recent.length === 0 ? (
            <p className="recent-empty">
              No names loaded, so this records times only. Add names below at any
              time, including mid race.
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
      )}

      <footer className="actions">
        <button type="button" onClick={handleUndo} disabled={taps.length === 0}>
          Undo
        </button>
        {!stopped && (
          <button
            type="button"
            className={confirmStop ? 'stop confirming' : 'stop'}
            onClick={handleStop}
          >
            {confirmStop ? 'Tap again to stop' : 'Stop'}
          </button>
        )}
        <button type="button" onClick={onExport} disabled={taps.length === 0}>
          Export
        </button>
      </footer>

      {/*
        Escape hatches. Leaving this screen never costs anything: taps are
        already on disk and the race stays the active one, so both of these are
        safe to hit by accident, which is why they are plain and small rather
        than styled like the buttons above.
      */}
      <nav className="nav-row">
        <button type="button" className="nav" onClick={onSetup}>
          Setup
        </button>
        <button type="button" className="nav" onClick={onEditRoster}>
          {hasRoster ? 'Edit names' : 'Add names'}
        </button>
      </nav>
    </div>
  )
}
