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
import { oldestUnnamed, splitRows } from '../lib/splits'
import type { Race, Tap } from '../lib/types'

type Props = {
  race: Race
  taps: Tap[]
  onTap: () => void
  /** Names a chosen crossing, or the oldest unnamed one when none is chosen. */
  onName: (athleteId: string, tapId?: string) => void
  onNameFree: (name: string, tapId: string) => void
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
  onNameFree,
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
  /**
   * The crossing a name tap will land on, when the volunteer picked one out of
   * the list. Held as an id rather than a tap so an undo cannot leave a stale
   * copy on screen: the row is looked up again every render, and a selection
   * pointing at nothing quietly falls back to the oldest unnamed crossing.
   */
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [typing, setTyping] = useState(false)
  const [typed, setTyped] = useState('')
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

  const clockAt = race.stoppedAt ?? now
  const running = race.gun ? elapsedMs(race.gun, clockAt, gunSameSession && !race.stoppedAt) : undefined
  const projected = projectedFinish(race.station.meters, race.raceMeters, running ?? 0)

  const rows = splitRows(race, taps, SESSION_ID)
  const assigned = new Set(taps.map((t) => t.athleteId).filter(Boolean))
  const selected = selectedId ? taps.find((t) => t.id === selectedId) : undefined
  /** Where the next name goes. A chosen row wins, otherwise oldest unnamed. */
  const target = selected ?? oldestUnnamed(taps)
  const targetRow = rows.find((r) => r.tap.id === target?.id)
  const unnamed = taps.filter((t) => !t.athleteId).length
  const hasRoster = race.athletes.length > 0
  const paceLabel = race.raceMeters === 5000 ? '5K' : `${race.raceMeters}m`

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
    onName(athleteId, target?.id)
    // Back to oldest-first, so the next name tap does not overwrite this row.
    setSelectedId(null)
    setTyping(false)
    confirmFeedback()
  }

  /** Aiming the next name at one row. Tapping the same row again lets it go. */
  function chooseRow(tap: Tap) {
    setSelectedId(tap.id === selectedId ? null : tap.id)
    setTyping(false)
    click()
  }

  function saveTyped() {
    if (!target || typed.trim() === '') return
    onNameFree(typed, target.id)
    setTyped('')
    setTyping(false)
    setSelectedId(null)
    confirmFeedback()
  }

  function cancelTyping() {
    setTyped('')
    setTyping(false)
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
                {paceLabel} pace <strong>{formatMinSec(projected)}</strong>
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

      <div className="naming">
        <p className="pending" aria-live="polite">
          {target ? (
            <>
              {target.athleteId ? 'Changing' : 'Naming'} <strong>#{target.seq}</strong>
              {targetRow?.elapsed != null ? ` at ${formatElapsed(targetRow.elapsed)}` : ''}
              {target.athleteId
                ? `, now ${race.athletes.find((a) => a.id === target.athleteId)?.name ?? 'unnamed'}`
                : unnamed > 1
                  ? ` · ${unnamed - 1} more waiting`
                  : ''}
            </>
          ) : stopped ? (
            'Every crossing has a name.'
          ) : hasRoster ? (
            'Tap a name as she passes to record and name in one tap.'
          ) : (
            'Tap as each runner passes. Names can wait until after the race.'
          )}
        </p>
        {target && !typing && (
          <button type="button" className="free-open" onClick={() => setTyping(true)}>
            Type a name
          </button>
        )}
      </div>

      {/* For a runner nobody has a button for. Opened on purpose, never sitting
          focused, so the keyboard cannot cover the course mid race. */}
      {typing && target && (
        <div className="free-row">
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveTyped()
              if (e.key === 'Escape') cancelTyping()
            }}
            placeholder={`Who was #${target.seq}?`}
            aria-label={`Name for crossing ${target.seq}`}
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <button type="button" className="primary" onClick={saveTyped} disabled={typed.trim() === ''}>
            Save
          </button>
          <button type="button" className="dismiss" onClick={cancelTyping}>
            Cancel
          </button>
        </div>
      )}

      {hasRoster && (
        <div className="names">
          {race.athletes.map((a) => {
            const done = assigned.has(a.id)
            return (
              <button
                key={a.id}
                type="button"
                className={done ? 'name-chip done' : 'name-chip'}
                onPointerDown={() => handleName(a.id)}
                // A chosen row can be given to anyone, including a girl already
                // down for another crossing, because that is how a swapped pair
                // of names gets fixed. Naming her here frees the other row.
                disabled={selected ? false : done || (stopped && !target)}
              >
                {a.name}
              </button>
            )
          })}
        </div>
      )}

      {/*
        The running list. Newest first, so the crossing just recorded is always
        the one in view and nobody has to scroll during a race. Named and unnamed
        rows sit together in crossing order, because they happened together and
        the unnamed ones are the ones that need a thumb.
      */}
      <section className="splits">
        <div className="splits-head" aria-hidden="true">
          <span>#</span>
          <span>{race.gun ? 'Split' : 'Clock'}</span>
          <span>Runner</span>
          <span>{paceLabel}</span>
        </div>
        <div className="splits-rows">
          {rows.length === 0 ? (
            <p className="splits-empty">
              Nothing recorded yet. {hasRoster
                ? 'Tap a name as she passes, or the big button when you cannot tell who it is.'
                : 'Tap the big button as each runner passes.'}
              {race.gun ? '' : ' A gun time is optional: every tap keeps the time of day.'}
            </p>
          ) : (
            rows
              .slice()
              .reverse()
              .map((row) => {
                const name = row.athlete?.name
                const at = row.elapsed == null ? formatWallClock(row.tap.wallMs) : formatElapsed(row.elapsed)
                return (
                  <button
                    key={row.tap.id}
                    type="button"
                    className={[
                      'split-row',
                      name ? '' : 'unnamed',
                      row.tap.id === target?.id ? 'target' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => chooseRow(row.tap)}
                    aria-label={
                      `Crossing ${row.place} at ${at}, ` +
                      `${name ? name : 'not named yet'}. ` +
                      `${row.projected != null ? `On pace for ${formatMinSec(row.projected)}. ` : ''}` +
                      `${name ? 'Tap to change the name.' : 'Tap to name it.'}`
                    }
                  >
                    <span className="split-place">{row.place}</span>
                    <span className="split-time">{at}</span>
                    <span className={name ? 'split-name' : 'split-name none'}>
                      {name ?? 'Tap to name'}
                    </span>
                    <span className="split-proj">
                      {row.projected == null ? '' : formatMinSec(row.projected)}
                    </span>
                  </button>
                )
              })
          )}
        </div>
      </section>

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
