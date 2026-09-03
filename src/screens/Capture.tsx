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
  formatDelta,
  formatElapsed,
  formatMinSec,
  formatPr,
  formatPrShort,
  formatWallClock,
  stamp,
} from '../lib/clock'
import { projectedFinish } from '../lib/distance'
import { buzz, click, undoClick } from '../lib/feedback'
import { becameScroll, type Point } from '../lib/gesture'
import { forTeam, varsitySize } from '../lib/lineup'
import { displayNames } from '../lib/names'
import { gridOrder, namedInOrder, splitRows, stillOut } from '../lib/splits'
import type { Athlete, Race, Stamp, Tap } from '../lib/types'
import { Lineup } from './Lineup'

/**
 * How long the name grid waits before moving a recorded runner to the back.
 *
 * Runners arrive in packs, so names get tapped in bursts, and the grid must hold
 * still through all of it: the second thumb of a burst is already on its way to a
 * name it can see. The wait restarts on every crossing, so the grid only
 * rearranges once the runners have stopped coming. While they are still coming,
 * this behaves exactly as it did before, which is the safe direction to fail in.
 */
const REORDER_AFTER_MS = 3000

/**
 * Ahead of the best, behind it, or level with it. Level is its own case rather
 * than a rounding artefact of behind: a runner dead on their best pace has not
 * lost anything, and colouring that as behind would say they had.
 */
function vsPrClass(ms: number | undefined): string {
  if (ms == null) return 'split-vs'
  if (Math.round(ms / 1000) === 0) return 'split-vs even'
  return ms < 0 ? 'split-vs ahead' : 'split-vs behind'
}

/** The same gap in words, since a screen reader gets "+0:12" as "zero twelve". */
function prSpoken(ms: number): string {
  if (Math.round(ms / 1000) === 0) return 'Level with the PR'
  const gap = formatDelta(ms).replace(/^[+-]/, '')
  return `${gap} ${ms < 0 ? 'ahead of' : 'behind'} PR pace`
}

type Props = {
  race: Race
  taps: Tap[]
  /**
   * Everyone on the phone, both teams, so the lineup can be changed at the
   * starting line. Narrowed to this race's team before it reaches the picker.
   */
  team: Athlete[]
  onLineup: (ids: string[]) => void
  /** Records a crossing, named when an athlete is given, at `at` if one is held. */
  onTap: (athleteId?: string, at?: Stamp) => void
  /** Names a crossing that is already recorded. */
  onName: (athleteId: string, tapId: string) => void
  onNameFree: (name: string, tapId: string) => void
  onClearName: (tapId: string) => void
  onUndo: () => void
  onSetGun: () => void
  onStop: () => void
  /** Undoes a stop. Never automatic: opening a stopped race must not restart it. */
  onReopen: () => void
  onExport: () => void
  onSetup: () => void
  onEditRoster: () => void
}

export function Capture({
  race,
  taps,
  team,
  onLineup,
  onTap,
  onName,
  onNameFree,
  onClearName,
  onUndo,
  onSetGun,
  onStop,
  onReopen,
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
  const [showLineup, setShowLineup] = useState(false)
  /**
   * The runners whose chip has moved to the back of the grid. Held as state, and
   * not derived from the crossings, because lagging the crossings is the whole
   * point of it.
   *
   * Seeded from the taps rather than starting empty, so a race that already has
   * names opens with them at the back instead of shuffling three seconds after a
   * coach looks at it.
   */
  const [moved, setMoved] = useState<string[]>(() => namedInOrder(taps))
  const flashTimer = useRef<number | undefined>(undefined)
  const confirmTimer = useRef<number | undefined>(undefined)
  const moveTimer = useRef<number | undefined>(undefined)
  /**
   * A press in progress on a name button, with the moment the finger landed. The
   * name grid scrolls, so pointerdown on its own cannot tell a tap from the
   * first instant of a scroll: it recorded a crossing for whichever runner the
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
  /**
   * The runners the lineup picker can draw from: this race's team only. Twenty
   * eight girls under the boys who are about to run is a list nobody can find a
   * name in.
   */
  const pool = forTeam(team, race.team)
  const assigned = new Set(taps.map((t) => t.athleteId).filter((id): id is string => !!id))
  const unnamed = taps.filter((t) => !t.athleteId).length
  const hasRoster = race.athletes.length > 0
  const paceLabel = race.raceMeters === 5000 ? '5K' : `${race.raceMeters}m`
  /**
   * First name and an initial. A button has room for "Rowan H." and a volunteer
   * does not read a surname to know who is coming. Full names are what the export
   * carries, and what a screen reader is given here.
   */
  const labels = displayNames(race.athletes)
  const labelOf = (a: Athlete) => labels.get(a.id) ?? a.name
  /**
   * The runner's best under their name on the button.
   *
   * The number a volunteer wants at the moment a runner comes into view is what
   * that runner is capable of, and it is the same number the coach and the runner
   * both know by heart. A derived "through here at 13:05" would be more
   * arithmetic and a fourth number on a button 112 pixels wide. The comparison
   * belongs in the list, where the split already is.
   */
  const prOf = (a: Athlete) => (a.pr == null ? '' : formatPrShort(a.pr))

  /**
   * The wait before the grid rearranges, restarted by any crossing at all rather
   * than only a named one: the big button gets hit in the middle of a burst of
   * names, and the grid should be as still for that thumb as for the others.
   *
   * Keyed on the taps themselves, which only become a new array when something
   * was actually recorded. The clock ticking ten times a second re-renders this
   * screen and must not keep pushing the wait back forever.
   */
  useEffect(() => {
    const settle = namedInOrder(taps)
    moveTimer.current = window.setTimeout(() => {
      // Same runners in the same order is not worth a render: an unnamed crossing
      // restarts the wait without moving anybody.
      setMoved((prev) =>
        prev.length === settle.length && prev.every((id, i) => id === settle[i]) ? prev : settle,
      )
    }, REORDER_AFTER_MS)
    return () => window.clearTimeout(moveTimer.current)
  }, [taps])

  /**
   * Still running first, already recorded behind them.
   *
   * A name that came off is dropped here rather than waiting for the next settle,
   * so an undo puts that chip back at once: the runner is out on the course again
   * and their button has to be tappable where a volunteer will look for it.
   */
  const grid = gridOrder(
    race.athletes,
    moved.filter((id) => assigned.has(id)),
  )

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

  /** A name in the grid means that runner is passing now, so this records it. */
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
    // The moment the finger landed, not the moment it lifted.
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
   * already recorded it, and so is a mouse drag, whose click has a detail count.
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
              ? 'Tap a name as that runner passes. The big button is for anyone you cannot name.'
              : 'Tap as each runner passes. Names can wait until after the race.'}
      </p>

      {/*
        Move and cancel are on the pane rather than on every button: a touch
        keeps sending its events to the button it started on, and both bubble to
        here, so one pair of handlers covers all twenty eight names.

        The runners still out on the course are first, so the buttons worth
        tapping are the ones under the thumb rather than scattered among names
        already struck through. Recorded runners fall to the back, but not until
        three seconds after the last crossing.
      */}
      {hasRoster && (
        <div className="names names-pane" onPointerMove={namesMove} onPointerCancel={namesCancel}>
          {grid.map((a) => {
            const done = assigned.has(a.id)
            return (
              <button
                key={a.id}
                type="button"
                className={done ? 'name-chip done' : 'name-chip'}
                onPointerDown={(e) => nameDown(e, a.id)}
                onPointerUp={(e) => nameUp(e, a.id)}
                onClick={(e) => nameClick(e, a.id)}
                // Struck through once this runner has a crossing here, and not
                // tappable, because a runner passes one point once.
                disabled={done || stopped}
                aria-label={
                  `${a.name}${a.pr == null ? '' : `, best ${formatPr(a.pr)}`}` +
                  `${done ? ', already recorded' : ''}`
                }
              >
                <span className="chip-name">{labelOf(a)}</span>
                {a.pr != null && (
                  <span className="chip-pr" aria-hidden="true">
                    {prOf(a)}
                  </span>
                )}
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
          <span>vs PR</span>
        </div>
        <div className="splits-rows">
          {rows.length === 0 ? (
            <p className="splits-empty">
              Nothing recorded yet. {hasRoster
                ? 'Tap a name as that runner passes, or the big button when you cannot tell who it is.'
                : 'Tap the big button as each runner passes.'}
              {race.gun ? '' : ' A gun time is optional: every tap keeps the time of day.'}
            </p>
          ) : (
            rows
              .slice()
              .reverse()
              .map((row) => {
                const name = row.athlete ? labelOf(row.athlete) : undefined
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
                      `${row.athlete ? row.athlete.name : 'not named yet'}. ` +
                      `${row.projected != null ? `On pace for ${formatMinSec(row.projected)}. ` : ''}` +
                      `${row.vsPr != null ? `${prSpoken(row.vsPr)}. ` : ''}` +
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
                    {/*
                      Against that runner's own best, which is the comparison a
                      coach makes out loud. Behind the best is the plus, since the
                      projection is the bigger of the two numbers.
                    */}
                    <span className={vsPrClass(row.vsPr)}>
                      {row.vsPr == null ? '' : formatDelta(row.vsPr)}
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
        {stopped ? (
          /*
            One tap, no confirm, unlike Stop. Starting the clock again is
            recoverable: the crossings are untouched and Stop is right here. It
            reads "Keep timing" rather than "Resume" because it is the answer to a
            stop that was a mis-tap or a race that turned out not to be over.
          */
          <button type="button" className="reopen" onClick={onReopen}>
            Keep timing
          </button>
        ) : (
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
        <button type="button" className="nav" onClick={() => setShowLineup(true)}>
          {hasRoster ? `Who is running: ${race.athletes.length}` : 'Add names'}
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
                <span className="sheet-now">Now {labelOf(namingRow.athlete)}</span>
              )}
            </div>

            {choices.length > 0 ? (
              <div className="names sheet-names">
                {choices.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className="name-chip"
                    onClick={() => pick(a.id)}
                    aria-label={a.name + (a.pr == null ? '' : `, best ${formatPr(a.pr)}`)}
                  >
                    <span className="chip-name">{labelOf(a)}</span>
                    {a.pr != null && (
                      <span className="chip-pr" aria-hidden="true">
                        {prOf(a)}
                      </span>
                    )}
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

      {/*
        The lineup, changeable at the starting line. A late scratch or a runner
        moved up to varsity is a fact of a meet morning, and it should not cost a
        restart. Anyone already holding a crossing cannot be taken out, since the
        time would lose its name.
      */}
      {showLineup && (
        <Lineup
          team={pool}
          selected={race.athletes.map((a) => a.id)}
          onChange={onLineup}
          onDone={() => setShowLineup(false)}
          onEditTeam={onEditRoster}
          raceName={race.race}
          locked={assigned}
          varsity={varsitySize(pool, race.team)}
        />
      )}
    </div>
  )
}
