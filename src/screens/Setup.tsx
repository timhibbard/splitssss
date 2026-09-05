import { useEffect, useRef, useState } from 'react'
import { formatIsoDate } from '../lib/clock'
import { distanceLabel, toMeters, type Unit } from '../lib/distance'
import { defaultLineup, forTeam, lineupOf, sniffTeam, varsitySize } from '../lib/lineup'
import { displayNames, summarize } from '../lib/names'
import type { Athlete, Race, RaceDraft, Station, Team } from '../lib/types'
import { Lineup } from './Lineup'

type Props = {
  /** Emits form values only. Identity and timestamps belong to whoever persists them. */
  onStart: (draft: RaceDraft) => void
  existing: Race[]
  /** Races from before today, still on the phone and still exportable. */
  earlier: Race[]
  /** Opens a stored race. Looking at one does not restart it. */
  onOpen: (raceId: string) => void
  /** Everyone on the phone, both teams. A race takes its lineup out of this. */
  team: Athlete[]
  /** Who ran the last race by this name, if anyone did. */
  rememberedLineup: (raceName: string) => string[] | null
  onEditRoster: () => void
  /** The workflow and the questions, for a volunteer holding this for the first time. */
  onHelp: () => void
  /** The race being timed right now, if this screen was opened mid race. */
  active: Race | null
  onBackToTiming: () => void
  stored: { races: number; taps: number; roster: number }
  onClearRaces: () => void
}

const TEAMS: Team[] = ['girls', 'boys']
const TEAM_LABEL: Record<Team, string> = { girls: 'Girls', boys: 'Boys' }

/**
 * The two races each team runs, as a kind rather than a name, so the team chips
 * and the race chips cannot drift into saying "Varsity Girls" for the boys.
 */
const KINDS = ['Varsity', 'JV'] as const
type Kind = (typeof KINDS)[number] | 'other'

/**
 * Every race either team runs is a 5K, so there is no picker. It stays in the
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

/**
 * Says what a clear would destroy, so it is a decision and not a surprise. Races
 * and crossings only: the team list is not something this button touches.
 */
function describe(stored: { races: number; taps: number }): string {
  const parts: string[] = []
  if (stored.races > 0) parts.push(`${stored.races} race${stored.races === 1 ? '' : 's'}`)
  if (stored.taps > 0) parts.push(`${stored.taps} crossing${stored.taps === 1 ? '' : 's'}`)
  if (parts.length === 0) return 'nothing'
  return parts.join(' and ')
}

export function Setup({
  onStart,
  existing,
  earlier,
  onOpen,
  team,
  rememberedLineup,
  onEditRoster,
  onHelp,
  active,
  onBackToTiming,
  stored,
  onClearRaces,
}: Props) {
  /**
   * The meet this season opens with, typed once here rather than by every
   * volunteer at every marker. It is the first field on the screen and it stays
   * editable, which is what the next meet needs.
   */
  const [meet, setMeet] = useState('Eye Opener')
  /**
   * Earlier meets, folded away. Reaching last Saturday's race is a real need and
   * a rare one, and by November the list is long enough to bury the race being
   * set up now.
   */
  const [showEarlier, setShowEarlier] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const clearTimer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(clearTimer.current), [])

  /**
   * Varsity, which with the girls default below is the pair every phone opens on:
   * the race splits are most wanted for, and the team whose list is the whole team.
   *
   * A fixed default and not the last thing timed, so twelve phones handed out at a
   * meet all say the same thing and the briefing is the same for all of them. One
   * tap changes it.
   */
  const [raceKind, setRaceKind] = useState<Kind>('Varsity')
  const [raceOther, setRaceOther] = useState('')
  /**
   * Which team, once somebody has said. Null follows the race name, which is
   * what a typed name like "Boys Open" is for. A tap fixes it and keeps it
   * fixed: showing a volunteer the wrong twenty eight names at the gun is the
   * failure worth spending a control on.
   */
  const [teamPick, setTeamPick] = useState<Team | null>(null)
  /**
   * The lineup, once it has been touched for this race. Null means follow the
   * race: what ran last time under this name, or what the team list says this week
   * if this is the first time. Picking a different race or a different team clears it, since
   * the answer for the JV race is not the answer for the varsity race and the
   * answer for the girls is not a boy.
   */
  const [chosen, setChosen] = useState<string[] | null>(null)
  const [showLineup, setShowLineup] = useState(false)

  function pickRace(kind: Kind) {
    setRaceKind(kind)
    setChosen(null)
  }

  function pickTeam(next: Team) {
    setTeamPick(next)
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

  /**
   * A typed race name is the only place the team is not already spelled out, so
   * it is the only place worth sniffing. A preset carries the team in its own
   * label, so there is nothing to guess.
   *
   * Girls when nothing has been said and nothing can be read off a name, which is
   * what a phone opens on, so the first chips a volunteer sees read Girls and
   * Varsity Girls.
   */
  const which: Team = teamPick ?? (raceKind === 'other' ? sniffTeam(raceOther) : undefined) ?? 'girls'
  const raceName = raceKind === 'other' ? raceOther.trim() : `${raceKind} ${TEAM_LABEL[which]}`
  const canStart = raceName.length > 0 && (!customActive || customValid)

  /**
   * The runners this race can draw from: one team's, since the two never run at
   * once. A phone still holding an untagged list offers all of them, because
   * that is the best it has.
   */
  const pool = forTeam(team, which)

  /**
   * Who is running, as it stands. An untouched lineup follows the race name, so
   * switching from JV to varsity swaps the seven without a trip to the picker.
   * Ids that have since left the team list are dropped rather than trusted.
   */
  const inPool = new Set(pool.map((a) => a.id))
  const remembered = rememberedLineup(raceName)?.filter((id) => inPool.has(id))
  /**
   * Where varsity ends for a team whose list does not say which race each runner
   * is in. The boys on the phone are the varsity squad and nothing else, so their
   * varsity race starts with all of them rather than with the seven fastest of
   * nine. Unused for a list that does say: that one is read, not sized.
   */
  const varsity = varsitySize(pool, which)
  const selected =
    chosen ??
    (remembered && remembered.length > 0 ? remembered : defaultLineup(pool, raceName, varsity))
  const labels = displayNames(pool)
  const running = lineupOf(pool, selected)

  function start() {
    if (!canStart) return
    onStart({
      meet: meet.trim() || 'Meet',
      race: raceName,
      station: resolvedStation(),
      timer: timer.trim(),
      raceMeters: RACE_METERS,
      team: which,
      athletes: running,
    })
  }

  const hasData = stored.races > 0 || stored.taps > 0

  /**
   * Two taps, like Stop, and for the same reason: the times have no copy
   * anywhere. The armed state expires so a stray tap cannot leave the button
   * loaded for whoever picks up the phone next.
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
    onClearRaces()
  }

  return (
    <div className="screen setup">
      <header className="brand">
        <p className="school">J.L. Mann Patriots</p>
        <h1>Splitssss</h1>
        <p className="tagline">Splits, saved, sorted, sent.</p>
      </header>

      {/*
        Opened mid race, so getting back to the clock comes before anything else.
        It says when a race is stopped, because opening one from the lists below
        makes it the race this button points at, and "back to timing" would be a
        lie about a clock that is frozen.
      */}
      {active && (
        <button type="button" className="primary" onClick={onBackToTiming}>
          {active.stoppedAt
            ? `Back to ${active.race} at ${active.station.label}, stopped`
            : `Back to timing ${active.race} at ${active.station.label}`}
        </button>
      )}

      <p className="instructions">
        Tap a name as each runner passes you, or tap the big button and add names
        after. You do not need to know when the race started.
      </p>

      {/*
        Right under the one line version of it, because that is where somebody
        reading "what do I do with this" is already looking, and quiet enough that
        it is not competing with the race being set up below. This is the page a
        coach points a new volunteer at.
      */}
      <p className="setup-link">
        <button type="button" className="link" onClick={onHelp}>
          How this works, and the questions people ask
        </button>
      </p>

      {/*
        Only when there is nobody on the phone, which is now the rare case: the
        team ships with the app. An empty phone means a wipe, a fresh clone with
        no team file, or a browser that dropped its storage, and then this is the
        only thing worth doing on this screen. Once names are here this screen
        offers nothing about the team list at all, because the way the list changes
        is a new build of the app.
      */}
      {team.length === 0 && (
        <section className="team">
          <div className="team-count">
            <strong>No runners yet</strong>
            <span>Add them once and tap names instead of just times.</span>
          </div>
          <button type="button" className="team-edit" onClick={onEditRoster}>
            Add runners
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

      {/*
        Both coaches record with this app, so which team is racing is the first
        thing a volunteer settles: it decides every name on the grid. Explicit
        rather than inferred, even though the presets below already say it, on
        the reasoning that the wrong twenty eight names at the gun is the failure
        worth one tap to rule out.
      */}
      <fieldset>
        <legend>Which team?</legend>
        <div className="chips">
          {TEAMS.map((t) => (
            <button
              key={t}
              type="button"
              className={t === which ? 'chip on' : 'chip'}
              onClick={() => pickTeam(t)}
            >
              {TEAM_LABEL[t]}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Which race?</legend>
        <div className="chips">
          {KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              className={kind === raceKind ? 'chip on' : 'chip'}
              onClick={() => pickRace(kind)}
            >
              {kind} {TEAM_LABEL[which]}
            </button>
          ))}
          <button
            type="button"
            className={raceKind === 'other' ? 'chip on' : 'chip'}
            onClick={() => pickRace('other')}
          >
            Other
          </button>
        </div>
        {raceKind === 'other' && (
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
        The lineup, right under the race it belongs to. The team list says which
        race each runner is in, so this fills itself in without being asked and a
        change at the course costs one tap.
      */}
      {team.length > 0 && (
        <section className="team lineup-panel">
          <div className="team-count">
            <strong>
              {pool.length === 0
                ? `No ${TEAM_LABEL[which].toLowerCase()} on this phone yet`
                : selected.length === 0
                  ? 'Nobody in this race yet'
                  : `${selected.length} of ${pool.length} in this race`}
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
          {/*
            The label says which one this is, because a stopped race opens frozen
            for a look and an unstopped one opens still running. Tapping either is
            safe: neither restarts a clock.
          */}
          {existing.map((r) => (
            <button key={r.id} type="button" className="prior-race" onClick={() => onOpen(r.id)}>
              <strong>{r.race}</strong> at {r.station.label}
              <span className="prior-meta">
                {r.meet}
                {r.stoppedAt ? ', stopped' : ', still timing'}
              </span>
            </button>
          ))}
        </section>
      )}

      {/*
        Before today. A meet nobody exported before the date changed used to be
        unreachable: the app only ever listed today's races, so the times were on
        the phone with no way to open them and no way to send them.
      */}
      {earlier.length > 0 && (
        <section className="prior">
          {showEarlier ? (
            <>
              <h2>Earlier meets</h2>
              {earlier.map((r) => (
                <button key={r.id} type="button" className="prior-race" onClick={() => onOpen(r.id)}>
                  <strong>{r.race}</strong> at {r.station.label}
                  <span className="prior-meta">
                    {formatIsoDate(r.date)}, {r.meet}
                    {r.stoppedAt ? '' : ', never stopped'}
                  </span>
                </button>
              ))}
            </>
          ) : (
            <p className="setup-link">
              <button type="button" className="link" onClick={() => setShowEarlier(true)}>
                Show {earlier.length} race{earlier.length === 1 ? '' : 's'} from before today
              </button>
            </p>
          )}
        </section>
      )}

      {/*
        No link to the team list from here. The roster is changed by rebuilding the
        app, which is one person's job and not something anybody does on a phone at
        a course, so on a phone that has names this was a door onto a screen with
        nothing to do on it.

        Two ways in remain, both further from the race day path: the panel above,
        which only appears when the list is missing entirely and typing names is
        the only way to time anything, and the quiet link inside the lineup picker,
        which is how a phone that dismissed the "use the list that came with the
        app" prompt can still ask for it.
      */}

      <section className="danger">
        <h2>Clear the races</h2>
        <p className="hint">
          {hasData
            ? `Erases ${describe(stored)} from this phone. Export anything you still need first: nothing is sent anywhere, so there is no copy to get the times back from.`
            : 'No races on this phone yet.'}
        </p>
        {/*
          Said plainly, because the button used to take the names too and a coach
          who learned that behavior should not have to test it to find out it
          changed.
        */}
        {stored.roster > 0 && (
          <p className="hint">
            The {stored.roster} runner{stored.roster === 1 ? '' : 's'} on this phone
            stay{stored.roster === 1 ? 's' : ''}. Take someone off the team list from
            the roster screen instead.
          </p>
        )}
        <button
          type="button"
          className={confirmClear ? 'clear confirming' : 'clear'}
          onClick={clear}
          disabled={!hasData}
        >
          {confirmClear ? 'Tap again to erase the races' : 'Clear all races'}
        </button>
      </section>

      <p className="build">Build {__BUILD__}</p>

      {showLineup && (
        <Lineup
          team={pool}
          selected={selected}
          onChange={setChosen}
          onDone={() => setShowLineup(false)}
          onEditTeam={onEditRoster}
          raceName={raceName || 'this race'}
          varsity={varsity}
        />
      )}
    </div>
  )
}
