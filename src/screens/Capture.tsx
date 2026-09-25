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
import { currentLeg, gridOrder, namedInOrder, splitRows, stationsOf, stillOut, tapsAt } from '../lib/splits'
import type { Athlete, Race, Stamp, Station, Tap } from '../lib/types'
import { Lineup } from './Lineup'
import { movePresets, resolveStation, type StationChoice } from '../lib/stations'
import { StationPicker } from './StationPicker'

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
 * Ahead of the PR, behind it, or level with it. Level is its own case rather
 * than a rounding artefact of behind: a runner dead on their PR pace has not
 * lost anything, and colouring that as behind would say they had.
 */
function vsPrClass(ms: number | undefined): string {
  if (ms == null) return 'split-vs'
  if (Math.round(ms / 1000) === 0) return 'split-vs even'
  return ms < 0 ? 'split-vs ahead' : 'split-vs behind'
}

function crossings(n: number): string {
  return n === 0 ? 'nothing yet' : `${n} crossing${n === 1 ? '' : 's'}`
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
  /** Moves the phone to another marker, keeping the gun and every crossing so far. */
  onMove: (station: Station) => void
  /** Undoes a move, allowed only while nothing has been tapped at the new spot. */
  onMoveBack: () => void
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
  onMove,
  onMoveBack,
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
  /** The marker picked in the move sheet, while it is open. Null when it is closed. */
  const [moving, setMoving] = useState<StationChoice | null>(null)
  /**
   * The runners whose chip has moved to the back of the grid. Held as state, and
   * not derived from the crossings, because lagging the crossings is the whole
   * point of it.
   *
   * Seeded from the taps rather than starting empty, so a race that already has
   * names opens with them at the back instead of shuffling three seconds after a
   * coach looks at it.
   */
  const [moved, setMoved] = useState<string[]>(() => namedInOrder(tapsAt(taps, currentLeg(race))))
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
   * Where the phone is standing now, and what has been tapped here. The grid, the
   * big button's count, Undo and the struck through names are all about this spot:
   * a runner who passed Mile 1 is still to come at Mile 2. The list keeps every
   * spot, so nothing recorded earlier leaves the screen.
   */
  const stations = stationsOf(race)
  const leg = currentLeg(race)
  const here = tapsAt(taps, leg)
  const hasMoved = stations.length > 1
  /**
   * The runners the lineup picker can draw from: this race's team only. Twenty
   * eight girls under the boys who are about to run is a list nobody can find a
   * name in.
   */
  const pool = forTeam(team, race.team)
  const assigned = new Set(here.map((t) => t.athleteId).filter((id): id is string => !!id))
  /** Anyone with a crossing at any spot, who the lineup cannot take out. */
  const anywhere = new Set(taps.map((t) => t.athleteId).filter((id): id is string => !!id))
  /**
   * Waiting for a name here, and once the race is stopped anywhere at all. While
   * runners are still coming a count from the last spot is not what this spot
   * needs; those rows stay in the list and can be named from there.
   */
  const unnamed = (stopped ? taps : here).filter((t) => !t.athleteId).length
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
   * The runner's PR under their name on the button.
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
    const settle = namedInOrder(tapsAt(taps, leg))
    moveTimer.current = window.setTimeout(() => {
      // Same runners in the same order is not worth a render: an unnamed crossing
      // restarts the wait without moving anybody.
      setMoved((prev) =>
        prev.length === settle.length && prev.every((id, i) => id === settle[i]) ? prev : settle,
      )
    }, REORDER_AFTER_MS)
    return () => window.clearTimeout(moveTimer.current)
  }, [taps, leg])

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

  /** Newest first. Spots only move forward, so this also keeps each spot's rows together. */
  const listed = rows.slice().reverse()

  const namingRow = namingId ? rows.find((r) => r.tap.id === namingId) : undefined
  const namingAt =
    namingRow &&
    (namingRow.elapsed == null
      ? formatWallClock(namingRow.tap.wallMs)
      : formatElapsed(namingRow.elapsed))
  /** Who this crossing could be: everyone without one at its spot yet, in roster order. */
  const choices = namingRow ? stillOut(race.athletes, tapsAt(taps, namingRow.leg)) : []

  const moveTo = moving ? resolveStation(moving) : null
  /** Only while nothing has been tapped here, so no crossing changes where it was taken. */
  const canMoveBack = hasMoved && here.length === 0
  const lastSpot = hasMoved ? stations[stations.length - 2] : undefined

  function openMove() {
    const presets = movePresets(race.station)
    setMoving({ pick: presets[0]?.label ?? 'custom', value: '', unit: 'm' })
    click()
  }

  function confirmMove() {
    if (!moveTo || moveTo.label === race.station.label) return
    onMove(moveTo)
    setMoving(null)
    confirmFeedback()
  }

  function moveBack() {
    onMoveBack()
    setMoving(null)
    click()
  }

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
    if (here.length === 0) return
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
        {/*
          The way home, in the top left corner where every other screen in the
          app keeps it. This screen had one already, at the very bottom under the
          race actions, which is below the fold on a phone and under the last
          place a volunteer looks: a screen you cannot see your way off of is a
          screen you are stuck on, whatever the markup says.

          It says "Home" and not "Back" because "back" from a running race
          sounds like it might end it, and nothing here does. Leaving costs
          nothing: the crossings are already on disk, the race stays the active
          one, and the first screen opens with a button that comes straight back
          to this one. Safe to hit by accident, which is what earns it a place
          next to a clock somebody is tapping under.
        */}
        <button type="button" className="back" onClick={onSetup}>
          Home
        </button>
        {/*
          Where the phone is standing, and the way to say it moved. A split taker
          who walks from Mile 1 to Mile 2 mid race keeps the gun, the clock and
          every crossing so far; only new ones are taken at the new spot. Behind
          a sheet with its own confirm, since a thumb lands here by accident.
        */}
        <button
          type="button"
          className="bar-where"
          onClick={openMove}
          disabled={stopped}
          aria-label={`At ${race.station.label}, ${race.race}. Tap to move to another marker.`}
        >
          <strong>
            {race.station.label}
            {!stopped && <span className="bar-caret" aria-hidden="true"> ⌄</span>}
          </strong>
          <span>{race.race}</span>
        </button>
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
        aria-label={`Record an unnamed crossing. ${here.length} recorded here so far.`}
      >
        <span className="tap-count">{here.length}</span>
        <span className="tap-word">{stopped ? 'STOPPED' : 'TAP'}</span>
      </button>

      <p className="pending" aria-live="polite">
        {unnamed > 0
          ? `${unnamed} ${unnamed === 1 ? 'crossing needs' : 'crossings need'} a name. Tap it in the list.`
          : hasMoved && here.length === 0 && !stopped
            ? `Now at ${race.station.label}.${hasRoster ? ' Every name is tappable again.' : ''} The gun and your ${lastSpot?.label} splits are kept.`
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
                  `${a.name}${a.pr == null ? '' : `, PR ${formatPr(a.pr)}`}` +
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
          {hasMoved && here.length === 0 && (
            // Just moved: the new spot's header, over nothing yet, so the list
            // says where the next crossing will land.
            <div className="splits-leg">
              {race.station.label} · {crossings(0)}
            </div>
          )}
          {rows.length === 0 ? (
            <p className="splits-empty">
              Nothing recorded yet. {hasRoster
                ? 'Tap a name as that runner passes, or the big button when you cannot tell who it is.'
                : 'Tap the big button as each runner passes.'}
              {race.gun ? '' : ' A gun time is optional: every tap keeps the time of day.'}
            </p>
          ) : (
            listed.map((row, i) => {
                const name = row.athlete ? labelOf(row.athlete) : undefined
                const at = row.elapsed == null ? formatWallClock(row.tap.wallMs) : formatElapsed(row.elapsed)
                // A header over each spot's crossings, once the phone has stood at
                // more than one. The places under it count from 1 at that spot.
                const heading =
                  hasMoved && (i === 0 || listed[i - 1].leg !== row.leg) ? (
                    <div key={`leg-${row.leg}`} className="splits-leg">
                      {row.station.label} · {crossings(tapsAt(taps, row.leg).length)}
                    </div>
                  ) : null
                return [
                  heading,
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
                      `${hasMoved ? `${row.station.label}, crossing` : 'Crossing'} ${row.place} at ${at}, ` +
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
                      Against that runner's own PR, which is the comparison a
                      coach makes out loud. Behind the PR is the plus, since the
                      projection is the bigger of the two numbers.
                    */}
                    <span className={vsPrClass(row.vsPr)}>
                      {row.vsPr == null ? '' : formatDelta(row.vsPr)}
                    </span>
                  </button>,
                ]
              })
          )}
        </div>
      </section>

      <footer className="actions">
        <button type="button" onClick={handleUndo} disabled={here.length === 0}>
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
        The lineup, for a runner who turned up or dropped at the starting line.
        Plain and small rather than styled like the race actions above, because
        opening it costs nothing: taps are already on disk and the race stays the
        active one, so it is safe to hit by accident.

        Setup used to sit here too. It moved to the header, where the rest of the
        app keeps the way home and where somebody looking for it will find it.
        One route out of a screen, in the corner it is expected in, beats two in
        places nobody looks.
      */}
      <nav className="nav-row">
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
              {hasMoved && <span className="sheet-now">{namingRow.station.label}</span>}
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
                    aria-label={a.name + (a.pr == null ? '' : `, PR ${formatPr(a.pr)}`)}
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
                  ? `Everyone on the list already has a crossing at ${namingRow.station.label}. Type a name instead.`
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
        Moving to another marker. Same sheet as naming, anchored where the thumb
        is. The markers further along come first, and nothing moves until the
        confirm, which says where to.
      */}
      {moving && (
        <div className="sheet-wrap">
          <button
            type="button"
            className="sheet-back"
            aria-label="Cancel moving"
            onClick={() => setMoving(null)}
          />
          <div className="sheet" role="dialog" aria-modal="true" aria-label="Move to another marker">
            <div className="sheet-head">
              <strong>Move from {race.station.label}</strong>
            </div>
            <p className="hint">
              The gun and the clock keep running, and your {race.station.label} splits stay in the
              list. Crossings from here on are at the new marker.
            </p>
            <StationPicker choice={moving} onChange={setMoving} presets={movePresets(race.station)} />
            <button
              type="button"
              className="primary"
              onClick={confirmMove}
              disabled={!moveTo || moveTo.label === race.station.label}
            >
              {moveTo ? `Move to ${moveTo.label}` : 'Move'}
            </button>
            <div className="sheet-actions">
              {canMoveBack && lastSpot && (
                <button type="button" className="dismiss" onClick={moveBack}>
                  Back to {lastSpot.label}
                </button>
              )}
              <button type="button" className="dismiss" onClick={() => setMoving(null)}>
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
          locked={anywhere}
          varsity={varsitySize(pool, race.team)}
        />
      )}
    </div>
  )
}
