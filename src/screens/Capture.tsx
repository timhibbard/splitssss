import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
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
import { becameScroll, type Point } from '../lib/gesture'
import { splitRows, stillOut } from '../lib/splits'
import type { Race, Stamp, Tap } from '../lib/types'

type Props = {
  race: Race
  taps: Tap[]
  /** Records a crossing, named when an athlete is given, at `at` if one is held. */
  onTap: (athleteId?: string, at?: Stamp) => void
  /** Names a crossing that is already recorded. */
  onName: (athleteId: string, tapId: string) => void
  onNameFree: (name: string, tapId: string) => void
  onClearName: (tapId: string) => void
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
  onClearName,
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
   * The crossing being named, if the picker is open. Held as an id rather than a
   * tap so an undo cannot leave a stale copy on screen: the row is looked up
   * again every render, and an id pointing at nothing closes the picker.
   */
  const [namingId, setNamingId] = useState<string | null>(null)
  const [typed, setTyped] = useState('')
  const flashTimer = useRef<number | undefined>(undefined)
  const confirmTimer = useRef<number | undefined>(undefined)
  /**
   * A press in progress on a name button, with the moment the finger landed. The
   * name grid scrolls, so pointerdown on its own cannot tell a tap from the
   * first instant of a scroll: it recorded a crossing for whichever girl the
   * thumb happened to touch on the way past. The time is taken on the way down
   * and used only if the finger lifts without dragging, so a tap keeps the
   * accuracy of pointerdown and a scroll records nothing.
   */
  const press = useRef<{ pointerId: number; athleteId: string; at: Stamp; from: Point } | null>(
    null,
  )
  /** Set when a press recorded, so the click behind it does not record again. */
  const pressRecorded = useRef(false)

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
  const unnamed = taps.filter((t) => !t.athleteId).length
  const hasRoster = race.athletes.length > 0
  const paceLabel = race.raceMeters === 5000 ? '5K' : `${race.raceMeters}m`

  const namingRow = namingId ? rows.find((r) => r.tap.id === namingId) : undefined
  const namingAt =
    namingRow &&
    (namingRow.elapsed == null
      ? formatWallClock(namingRow.tap.wallMs)
      : formatElapsed(namingRow.elapsed))
  /** Who this crossing could be: everyone without one here yet, in roster order. */
  const choices = namingRow ? stillOut(race.athletes, taps) : []

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

  /** A name in the grid means she is passing now, so this records her crossing. */
  function recordName(athleteId: string, at: Stamp) {
    if (stopped) return
    onTap(athleteId, at)
    confirmFeedback()
  }

  function nameDown(e: ReactPointerEvent<HTMLButtonElement>, athleteId: string) {
    pressRecorded.current = false
    press.current = {
      pointerId: e.pointerId,
      athleteId,
      at: stamp(),
      from: { x: e.clientX, y: e.clientY },
    }
  }

  function nameUp(e: ReactPointerEvent<HTMLButtonElement>, athleteId: string) {
    const held = press.current
    press.current = null
    if (!held || held.pointerId !== e.pointerId || held.athleteId !== athleteId) return
    pressRecorded.current = true
    // The moment her finger landed, not the moment it lifted.
    recordName(athleteId, held.at)
  }

  /** The finger is dragging the grid, so this press is not a tap on a name. */
  function namesMove(e: ReactPointerEvent<HTMLDivElement>) {
    const held = press.current
    if (!held || held.pointerId !== e.pointerId) return
    if (becameScroll(held.from, { x: e.clientX, y: e.clientY })) press.current = null
  }

  /** The browser took the gesture over to scroll with, which settles it. */
  function namesCancel() {
    press.current = null
  }

  /**
   * Keyboard and assistive activation, which arrive as a click with no pointer
   * events behind them. A click that follows a press is ignored, since the press
   * already recorded her, and so is a mouse drag, whose click has a detail count.
   */
  function nameClick(e: ReactMouseEvent<HTMLButtonElement>, athleteId: string) {
    if (pressRecorded.current) {
      pressRecorded.current = false
      return
    }
    if (e.detail !== 0) return
    recordName(athleteId, stamp())
  }

  function openNaming(tap: Tap) {
    setNamingId(tap.id)
    setTyped('')
    click()
  }

  function closeNaming() {
    setNamingId(null)
    setTyped('')
  }

  function pick(athleteId: string) {
    if (!namingRow) return
    onName(athleteId, namingRow.tap.id)
    closeNaming()
    confirmFeedback()
  }

  function saveTyped() {
    if (!namingRow || typed.trim() === '') return
    onNameFree(typed, namingRow.tap.id)
    closeNaming()
    confirmFeedback()
  }

  function removeName() {
    if (!namingRow) return
    onClearName(namingRow.tap.id)
    closeNaming()
    click()
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
        real latency to a tap whose whole purpose is recording a moment. Nothing
        scrolls under this button, so unlike the name grid below it there is no
        gesture to tell apart: a finger landing here means record, and the
        crossing is on disk before the finger is off the glass.
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

      <p className="pending" aria-live="polite">
        {unnamed > 0
          ? `${unnamed} ${unnamed === 1 ? 'crossing needs' : 'crossings need'} a name. Tap it in the list.`
          : stopped
            ? 'Every crossing has a name.'
            : hasRoster
              ? 'Tap her name as she passes. The big button is for anyone you cannot name.'
              : 'Tap as each runner passes. Names can wait until after the race.'}
      </p>

      {/*
        Move and cancel are on the pane rather than on every button: a touch
        keeps sending its events to the button it started on, and both bubble to
        here, so one pair of handlers covers all twenty eight names.
      */}
      {hasRoster && (
        <div className="names" onPointerMove={namesMove} onPointerCancel={namesCancel}>
          {race.athletes.map((a) => {
            const done = assigned.has(a.id)
            return (
              <button
                key={a.id}
                type="button"
                className={done ? 'name-chip done' : 'name-chip'}
                onPointerDown={(e) => nameDown(e, a.id)}
                onPointerUp={(e) => nameUp(e, a.id)}
                onClick={(e) => nameClick(e, a.id)}
                // Struck through once she has a crossing here, and not tappable,
                // because a runner passes one point once.
                disabled={done || stopped}
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
                ? 'Tap her name as she passes, or the big button when you cannot tell who it is.'
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
                      row.tap.id === namingId ? 'target' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => openNaming(row.tap)}
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

      {/*
        Naming one crossing. Over the screen rather than beside it, because the
        question is about that row and nothing else on the screen matters until
        it is answered. The list offers only runners without a crossing here, so
        it shrinks as the race goes on and the last few are easy to hit.
      */}
      {namingRow && (
        <div className="sheet-wrap">
          <button
            type="button"
            className="sheet-back"
            aria-label="Cancel naming"
            onClick={closeNaming}
          />
          <div className="sheet" role="dialog" aria-modal="true" aria-label={`Name crossing ${namingRow.place}`}>
            <div className="sheet-head">
              <strong>#{namingRow.place}</strong>
              <span className="sheet-time">{namingAt}</span>
              {namingRow.athlete && (
                <span className="sheet-now">Now {namingRow.athlete.name}</span>
              )}
            </div>

            {choices.length > 0 ? (
              <div className="names sheet-names">
                {choices.map((a) => (
                  <button key={a.id} type="button" className="name-chip" onClick={() => pick(a.id)}>
                    {a.name}
                  </button>
                ))}
              </div>
            ) : (
              <p className="hint">
                {hasRoster
                  ? 'Everyone on the list already has a crossing here. Type a name instead.'
                  : 'No names loaded on this phone. Type who it was.'}
              </p>
            )}

            <div className="free-row">
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveTyped()
                  if (e.key === 'Escape') closeNaming()
                }}
                placeholder="Someone else"
                aria-label={`Type a name for crossing ${namingRow.place}`}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
              <button
                type="button"
                className="primary"
                onClick={saveTyped}
                disabled={typed.trim() === ''}
              >
                Save
              </button>
            </div>

            <div className="sheet-actions">
              {namingRow.athlete && (
                <button type="button" className="dismiss" onClick={removeName}>
                  Remove the name
                </button>
              )}
              <button type="button" className="dismiss" onClick={closeNaming}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
