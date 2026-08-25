import { useEffect, useRef, useState } from 'react'
import { distanceLabel, toMeters, type Unit } from '../lib/distance'
import { defaultLineup, lineupOf } from '../lib/lineup'
import { displayNames, summarize } from '../lib/names'
import type { Athlete, Race, RaceDraft, Station } from '../lib/types'
import { Lineup } from './Lineup'

type Props = {
  /** Emits form values only. Identity and timestamps belong to whoever persists them. */
  onStart: (draft: RaceDraft) => void
  existing: Race[]
  onResume: (raceId: string) => void
  /** Everyone on the phone. A race takes its lineup out of this. */
  team: Athlete[]
  /** Who ran the last race by this name, if anyone did. */
  rememberedLineup: (raceName: string) => string[] | null
  /** This build ships an encrypted roster, so loading it takes a passphrase. */
  hasPublished: boolean
  /** This build ships a team list, so a wipe does not keep the names off. */
  hasShipped: boolean
  onEditRoster: () => void
  /** The race being timed right now, if this screen was opened mid race. */
  active: Race | null
  onBackToTiming: () => void
  stored: { races: number; taps: number; roster: number }
  onClearAll: () => void
}

const RACES = ['Varsity Girls', 'JV Girls']

/**
 * Every race this team runs is a 5K, so there is no picker. It stays in the
 * stored race and in the CSV rather than being assumed downstream, so an export
 * still says what it was measured against and a future non 5K would not
 * silently reinterpret old data.
 */
const RACE_METERS = 5000

/**
 * Ordered by distance. No finish line: the meet's own timing provides that, so
 * putting a volunteer there would duplicate work we already get for free.
 */
const STATIONS: Station[] = [
  { label: '800m', meters: 800 },
  { label: 'Mile 1', meters: 1609 },
  { label: '2K', meters: 2000 },
  { label: '3K', meters: 3000 },
  { label: 'Mile 2', meters: 3219 },
  { label: '4K', meters: 4000 },
]

const UNITS: Unit[] = ['m', 'km', 'mi']

/** Says what a wipe would destroy, so it is a decision and not a surprise. */
function describe(stored: { races: number; taps: number; roster: number }): string {
  const parts: string[] = []
  if (stored.races > 0) parts.push(`${stored.races} race${stored.races === 1 ? '' : 's'}`)
  if (stored.taps > 0) parts.push(`${stored.taps} crossing${stored.taps === 1 ? '' : 's'}`)
  if (stored.roster > 0) parts.push(`${stored.roster} runner${stored.roster === 1 ? '' : 's'}`)
  if (parts.length === 0) return 'nothing'
  if (parts.length === 1) return parts[0]
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

export function Setup({
  onStart,
  existing,
  onResume,
  team,
  rememberedLineup,
  hasPublished,
  hasShipped,
  onEditRoster,
  active,
  onBackToTiming,
  stored,
  onClearAll,
}: Props) {
  const [meet, setMeet] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)
  const clearTimer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(clearTimer.current), [])

  const [racePreset, setRacePreset] = useState<string>(RACES[1])
  const [raceOther, setRaceOther] = useState('')
  /**
   * The lineup, once it has been touched for this race. Null means follow the
   * race: what ran last time under this name, or the usual split if this is the
   * first time. Picking a different race clears it, since the answer for the JV
   * race is not the answer for the varsity race.
   */
  const [chosen, setChosen] = useState<string[] | null>(null)
  const [showLineup, setShowLineup] = useState(false)

  function pickRace(name: string) {
    setRacePreset(name)
    setChosen(null)
  }

  const [stationLabel, setStationLabel] = useState<string>('Mile 1')
  const [customValue, setCustomValue] = useState('')
  const [customUnit, setCustomUnit] = useState<Unit>('m')

  const [timer, setTimer] = useState('')

  const customActive = stationLabel === 'custom'
  const customNumber = Number.parseFloat(customValue)
  const customValid = Number.isFinite(customNumber) && customNumber > 0

  function resolvedStation(): Station {
    if (!customActive) {
      return STATIONS.find((s) => s.label === stationLabel) ?? STATIONS[1]
    }
    return {
      label: distanceLabel(customNumber, customUnit),
      meters: toMeters(customNumber, customUnit),
    }
  }

  const raceName = racePreset === 'other' ? raceOther.trim() : racePreset
  const canStart = raceName.length > 0 && (!customActive || customValid)

  /**
   * Who is running, as it stands. An untouched lineup follows the race name, so
   * switching from JV to varsity swaps the seven without a trip to the picker.
   * Ids that have since left the team list are dropped rather than trusted.
   */
  const onTeam = new Set(team.map((a) => a.id))
  const remembered = rememberedLineup(raceName)?.filter((id) => onTeam.has(id))
  const selected =
    chosen ??
    (remembered && remembered.length > 0 ? remembered : defaultLineup(team, raceName))
  const labels = displayNames(team)
  const running = lineupOf(team, selected)

  function start() {
    if (!canStart) return
    onStart({
      meet: meet.trim() || 'Meet',
      race: raceName,
      station: resolvedStation(),
      timer: timer.trim(),
      raceMeters: RACE_METERS,
      athletes: running,
    })
  }

  const hasData = stored.races > 0 || stored.taps > 0 || stored.roster > 0

  /**
   * Two taps, like Stop, and for the same reason: this one is unrecoverable.
   * The armed state expires so a stray tap cannot leave the button loaded for
   * whoever picks up the phone next.
   */
  function clear() {
    if (!confirmClear) {
      setConfirmClear(true)
      window.clearTimeout(clearTimer.current)
      clearTimer.current = window.setTimeout(() => setConfirmClear(false), 4000)
      return
    }
    window.clearTimeout(clearTimer.current)
    setConfirmClear(false)
    onClearAll()
  }

  return (
    <div className="screen setup">
      <header className="brand">
        <p className="school">J.L. Mann Patriots</p>
        <h1>Splitssss</h1>
        <p className="tagline">Splits, saved, sorted, sent.</p>
      </header>

      {/* Opened mid race, so getting back to the clock comes before anything else. */}
      {active && (
        <button type="button" className="primary" onClick={onBackToTiming}>
          Back to timing {active.race} at {active.station.label}
        </button>
      )}

      <p className="instructions">
        Tap a name as each runner passes you, or tap the big button and add names
        after. You do not need to know when the race started.
      </p>

      {/*
        Only when there is nobody on the phone, which is now the rare case: the
        team ships with the app. An empty phone means a wipe, a fresh clone with
        no team file, or a browser that dropped its storage, and then this is the
        only thing worth doing on this screen. Once names are here the entry point
        moves to a quiet link at the bottom, because the list is set up once a
        season and everything else here is set up per race.
      */}
      {team.length === 0 && (
        <section className="team">
          <div className="team-count">
            <strong>No runners yet</strong>
            <span>
              {hasPublished
                ? 'The team roster is published with this app. Loading it takes the season passphrase.'
                : 'Add them once and tap names instead of just times.'}
            </span>
          </div>
          <button type="button" className="team-edit" onClick={onEditRoster}>
            {hasPublished ? 'Load them' : 'Add runners'}
          </button>
        </section>
      )}

      <label>
        Meet
        <input
          value={meet}
          onChange={(e) => setMeet(e.target.value)}
          placeholder="Eye Opener Invitational"
          autoComplete="off"
        />
      </label>

      <fieldset>
        <legend>Which race?</legend>
        <div className="chips">
          {RACES.map((r) => (
            <button
              key={r}
              type="button"
              className={r === racePreset ? 'chip on' : 'chip'}
              onClick={() => pickRace(r)}
            >
              {r}
            </button>
          ))}
          <button
            type="button"
            className={racePreset === 'other' ? 'chip on' : 'chip'}
            onClick={() => pickRace('other')}
          >
            Other
          </button>
        </div>
        {racePreset === 'other' && (
          <input
            className="reveal"
            value={raceOther}
            onChange={(e) => {
              setRaceOther(e.target.value)
              setChosen(null)
            }}
            placeholder="Race name"
            autoComplete="off"
            aria-label="Race name"
          />
        )}
      </fieldset>

      {/*
        The lineup, right under the race it belongs to. Varsity is the top seven
        of the team list and JV is the rest, which this fills in without being
        asked, so the common case needs no taps and the exception needs one.
      */}
      {team.length > 0 && (
        <section className="team lineup-panel">
          <div className="team-count">
            <strong>
              {selected.length === 0
                ? 'Nobody in this race yet'
                : `${selected.length} of ${team.length} in this race`}
            </strong>
            <span>{summarize(running.map((a) => labels.get(a.id) ?? a.name))}</span>
          </div>
          <button type="button" className="team-edit" onClick={() => setShowLineup(true)}>
            Choose
          </button>
        </section>
      )}

      <fieldset>
        <legend>How far into the 5K are you?</legend>
        <div className="chips">
          {STATIONS.map((s) => (
            <button
              key={s.label}
              type="button"
              className={s.label === stationLabel ? 'chip on' : 'chip'}
              onClick={() => setStationLabel(s.label)}
            >
              {s.label}
            </button>
          ))}
          <button
            type="button"
            className={customActive ? 'chip on' : 'chip'}
            onClick={() => setStationLabel('custom')}
          >
            Custom
          </button>
        </div>

        {customActive && (
          <div className="custom-distance">
            <input
              className="reveal"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              placeholder="1200"
              aria-label="Distance from the start"
            />
            <div className="chips">
              {UNITS.map((u) => (
                <button
                  key={u}
                  type="button"
                  className={u === customUnit ? 'chip on' : 'chip'}
                  onClick={() => setCustomUnit(u)}
                >
                  {u}
                </button>
              ))}
            </div>
            <p className="hint">
              {customValid
                ? `Recorded as ${distanceLabel(customNumber, customUnit)}, ${toMeters(customNumber, customUnit)}m from the start.`
                : 'Distance from the start line. Needed to compute pace.'}
            </p>
          </div>
        )}
      </fieldset>

      <label>
        Your name
        <input
          value={timer}
          onChange={(e) => setTimer(e.target.value)}
          placeholder="So coach knows whose times these are"
          autoComplete="off"
        />
      </label>

      <button type="button" className="primary" onClick={start} disabled={!canStart}>
        {active ? 'Start a second race' : 'Start timing'}
      </button>

      {existing.length > 0 && (
        <section className="prior">
          <h2>Earlier today</h2>
          {existing.map((r) => (
            <button key={r.id} type="button" className="prior-race" onClick={() => onResume(r.id)}>
              <strong>{r.race}</strong> at {r.station.label}
              <span className="prior-meta">{r.meet}</span>
            </button>
          ))}
        </section>
      )}

      {/*
        Down here on purpose. Editing the team list is a once a season job now
        that the names arrive with the app, so it gets a link at the bottom rather
        than a panel at the top. The count is in the label so the link doubles as
        the answer to "are the names on this phone?".
      */}
      {team.length > 0 && (
        <p className="setup-link">
          <button type="button" className="link" onClick={onEditRoster}>
            Edit the {team.length} runner{team.length === 1 ? '' : 's'} on this phone
          </button>
        </p>
      )}

      <section className="danger">
        <h2>Start over</h2>
        <p className="hint">
          {hasData
            ? `Erases ${describe(stored)} from this phone. The times are gone for good, since nothing is sent anywhere and there is no copy to get them back from.`
            : 'Nothing is stored on this phone yet.'}
        </p>
        {/*
          The names are the one thing a wipe does not keep off, now that they
          ship with the app, and a coach handing a phone back deserves to know
          that before tapping rather than after.
        */}
        {hasData && hasShipped && stored.roster > 0 && (
          <p className="hint">
            The team list comes back the next time you open the app, as first names
            and an initial, because it ships with the app. Only the races and times
            are gone for good. A phone that should hold no names at all is one that
            takes the app off the home screen.
          </p>
        )}
        <button
          type="button"
          className={confirmClear ? 'clear confirming' : 'clear'}
          onClick={clear}
          disabled={!hasData}
        >
          {confirmClear ? 'Tap again to erase everything' : 'Clear everything'}
        </button>
      </section>

      <p className="build">Build {__BUILD__}</p>

      {showLineup && (
        <Lineup
          team={team}
          selected={selected}
          onChange={setChosen}
          onDone={() => setShowLineup(false)}
          onEditTeam={onEditRoster}
          raceName={raceName || 'this race'}
        />
      )}
    </div>
  )
}
