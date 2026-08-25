import { useState } from 'react'
import { distanceLabel, toMeters, type Unit } from '../lib/distance'
import type { Race, RaceDraft, Station } from '../lib/types'

type Props = {
  /** Emits form values only. Identity and timestamps belong to whoever persists them. */
  onStart: (draft: RaceDraft) => void
  existing: Race[]
  onResume: (raceId: string) => void
  rosterCount: number
  onEditRoster: () => void
  /** The race being timed right now, if this screen was opened mid race. */
  active: Race | null
  onBackToTiming: () => void
}

const RACES = ['Varsity Girls', 'JV Girls']

/** Full race distance, used to project a finish time from a split. */
const RACE_DISTANCES = [
  { label: '5K', meters: 5000 },
  { label: '4K', meters: 4000 },
  { label: '3 mi', meters: 4828 },
  { label: '2 mi', meters: 3219 },
]

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

export function Setup({
  onStart,
  existing,
  onResume,
  rosterCount,
  onEditRoster,
  active,
  onBackToTiming,
}: Props) {
  const [meet, setMeet] = useState('')
  const [raceMeters, setRaceMeters] = useState(5000)

  const [racePreset, setRacePreset] = useState<string>(RACES[1])
  const [raceOther, setRaceOther] = useState('')

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

  function start() {
    if (!canStart) return
    onStart({
      meet: meet.trim() || 'Meet',
      race: raceName,
      station: resolvedStation(),
      timer: timer.trim(),
      raceMeters,
    })
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
        Tap a runner's name as she passes you, or tap the big button and add
        names after. You do not need to know when the race started.
      </p>

      {/*
        The roster is the one thing a new user has to find, and it used to be a
        plain button below the fold. It sits above the race details now, because
        it is set up once and everything below it is set up per race.
      */}
      <section className="team">
        <div className="team-count">
          <strong>
            {rosterCount === 0 ? 'No runners yet' : `${rosterCount} runners on this phone`}
          </strong>
          <span>
            {rosterCount === 0
              ? 'Add them once and tap names instead of just times.'
              : 'Paste or edit the list any time, even mid race.'}
          </span>
        </div>
        <button type="button" className="team-edit" onClick={onEditRoster}>
          {rosterCount === 0 ? 'Add runners' : 'Edit'}
        </button>
      </section>

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
              onClick={() => setRacePreset(r)}
            >
              {r}
            </button>
          ))}
          <button
            type="button"
            className={racePreset === 'other' ? 'chip on' : 'chip'}
            onClick={() => setRacePreset('other')}
          >
            Other
          </button>
        </div>
        {racePreset === 'other' && (
          <input
            className="reveal"
            value={raceOther}
            onChange={(e) => setRaceOther(e.target.value)}
            placeholder="Race name"
            autoComplete="off"
            aria-label="Race name"
          />
        )}
      </fieldset>

      <fieldset>
        <legend>Race distance</legend>
        <div className="chips">
          {RACE_DISTANCES.map((d) => (
            <button
              key={d.label}
              type="button"
              className={d.meters === raceMeters ? 'chip on' : 'chip'}
              onClick={() => setRaceMeters(d.meters)}
            >
              {d.label}
            </button>
          ))}
        </div>
        <p className="hint">Used to project a finish time from your split.</p>
      </fieldset>

      <fieldset>
        <legend>How far into the course are you?</legend>
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

      <p className="build">Build {__BUILD__}</p>
    </div>
  )
}
