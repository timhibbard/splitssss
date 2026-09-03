import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import { SESSION_ID, stamp, todayIsoDate } from './lib/clock'
import { rosterFromHash } from './lib/link'
import { forTeam } from './lib/lineup'
import { mergeLineup } from './lib/roster'
import { assignAthlete, clearName } from './lib/splits'
import * as store from './lib/storage'
import { fetchTeam, TEAM_FILE, teamText } from './lib/teamfile'
import type { Athlete, Race, RaceDraft, Stamp, Tap } from './lib/types'
import { Capture } from './screens/Capture'
import { ExportScreen } from './screens/ExportScreen'
import { Roster } from './screens/Roster'
import { Setup } from './screens/Setup'

type Screen = 'setup' | 'roster' | 'capture' | 'export'

/**
 * Read whatever was being timed back out of storage. Done during the first
 * render rather than in an effect so a volunteer whose page was discarded or
 * refreshed mid race never sees a flash of the setup screen before their taps
 * come back.
 *
 * Only a race from today. A volunteer who never tapped Stop leaves a race active
 * forever, so opening the app at the next meet landed on the last one, with an
 * hour on its clock and this morning's crossings going into it. The race is not
 * touched, and it is still there to export under earlier meets. It just stops
 * being the race this phone is timing.
 *
 * Clearing the pointer here rather than leaving it is deliberate: nothing else
 * would clear it, and a stale pointer would keep the setup screen offering to go
 * back to a race from last Saturday.
 */
function restore(): { race: Race | null; taps: Tap[]; roster: Athlete[] } {
  const activeId = store.getActiveRaceId()
  const found = activeId ? store.loadRace(activeId) : null
  const stale = found !== null && found.date !== todayIsoDate()
  if (stale) store.setActiveRaceId(null)
  const race = stale ? null : found
  return {
    race,
    taps: race ? store.loadTaps(race.id) : [],
    roster: store.loadRoster(),
  }
}

const EMPTY_COUNTS = { races: 0, taps: 0, roster: 0 }

/**
 * A roster shared by link, read once at module load, before anything renders.
 *
 * The fragment is stripped from the address bar immediately: a refresh should not
 * re-prompt, and a list of minors' names should not sit in a visible URL or in
 * whatever the browser decides to keep. Nothing is imported without the user
 * choosing, so this only stages the names.
 */
function takeLinkedRoster(): Athlete[] | null {
  if (typeof window === 'undefined') return null
  const found = rosterFromHash(window.location.hash)
  if (found.length === 0) return null
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
  return found
}

const LINKED_ROSTER = takeLinkedRoster()

function lastSeq(taps: Tap[]): number {
  return taps.length > 0 ? taps[taps.length - 1].seq : 0
}

export default function App() {
  const [restored] = useState(restore)
  const [race, setRace] = useState<Race | null>(restored.race)
  const [taps, setTaps] = useState<Tap[]>(restored.taps)
  const [roster, setRoster] = useState<Athlete[]>(restored.roster)
  const [incoming, setIncoming] = useState<Athlete[] | null>(LINKED_ROSTER)
  /** Which channel the pending list arrived through, so the prompt can say so. */
  const [incomingSource, setIncomingSource] = useState<'link' | 'shipped'>('link')
  /** The team list that came with this build, if it has one. */
  const [shipped, setShipped] = useState<Athlete[] | null>(null)
  // A shared link opens on the roster, because deciding about it comes first.
  const [screen, setScreen] = useState<Screen>(
    LINKED_ROSTER ? 'roster' : restored.race ? 'capture' : 'setup',
  )
  /** Where Back goes from the roster, so it returns you where you came from. */
  const [rosterReturn, setRosterReturn] = useState<Screen>(restored.race ? 'capture' : 'setup')
  /**
   * Forces a render after a wipe. Clearing an empty session changes no other
   * state, so without this the setup screen could keep showing counts for data
   * that is already gone. The value itself is never read.
   */
  const [, setWiped] = useState(0)

  const editRoster = useCallback((from: Screen) => {
    setRosterReturn(from)
    setScreen('roster')
  }, [])

  /**
   * Crossing counter, held outside React state so the storage write can happen
   * exactly once per tap. Deriving the next seq inside a setState updater would
   * put a side effect in a place React is allowed to call twice.
   */
  const seqRef = useRef(lastSeq(restored.taps))

  /**
   * The team list lives on the device, and a race holds the lineup that ran it,
   * so a list edited weeks later cannot rewrite a race already run. The race
   * being timed right now is the exception: a runner added at the starting line
   * has to appear on the grid without restarting anything.
   *
   * The lineup is respected, so an edit to the team list cannot put back somebody
   * left out of this race. See mergeLineup for the rest of the rules.
   *
   * Both lists are narrowed to this race's team first. A new runner joins the
   * race being timed, which is the rule that makes a late entry work, and it
   * would otherwise put a whole other team on the grid the moment a phone took
   * up the two team list mid race.
   */
  const saveRoster = useCallback(
    (next: Athlete[]) => {
      store.saveRoster(next)
      setRoster(next)
      if (!race) return
      const named = new Set(taps.map((t) => t.athleteId).filter((id): id is string => !!id))
      const updated: Race = {
        ...race,
        athletes: mergeLineup(
          race.athletes,
          forTeam(roster, race.team),
          forTeam(next, race.team),
          named,
        ),
      }
      store.saveRace(updated)
      setRace(updated)
      // Kept in step with the race, so what is remembered under this race name is
      // who actually ran it, including anyone added at the starting line.
      store.saveLineup(race.race, updated.athletes.map((a) => a.id))
    },
    [race, roster, taps],
  )

  /**
   * The team list that ships with the build, looked for once at startup. One
   * request to a precached file, so it resolves with no signal at the course, and
   * absent is normal: a fresh clone of this repo has no team file.
   *
   * It is taken up without asking when there is nothing to lose: an empty phone,
   * or one still holding exactly the list this build replaces. Automatic is the
   * whole point. A parent handed the phone ten minutes before the gun should find
   * the names already on it, with nothing to open and nothing to type.
   *
   * Anything else is not the app's decision to make, so a hand edited list, or the
   * coach's phone holding full names, gets the same prompt a shared link gets.
   * Either way this build's list is recorded as seen, so a rebuild that changes
   * nothing never asks twice, and the roster screen can ask for it by hand.
   *
   * The decision happens here rather than in an effect on the result because it
   * runs exactly once, against the state the page was restored with, and adopting
   * has to go through saveRoster to reach a race already in progress.
   */
  useEffect(() => {
    let live = true
    void fetchTeam(`${import.meta.env.BASE_URL}${TEAM_FILE}`).then((found) => {
      if (!live || !found) return
      setShipped(found)
      // A shared link is a decision already in progress, so leave it alone. The
      // quiet button on the roster screen offers this list afterwards.
      if (LINKED_ROSTER) return
      const text = teamText(found)
      const seen = store.loadShippedSeen()
      if (seen === text) return
      const current = store.loadRoster()
      store.saveShippedSeen(text)
      if (current.length === 0 || teamText(current) === seen) {
        saveRoster(found)
        return
      }
      setIncomingSource('shipped')
      setIncoming(found)
      // Nothing else on screen would mention a pending list, so go where the
      // question is. Never mid race: a volunteer watching the course must not be
      // pulled off the clock by a roster that can wait.
      if (!store.getActiveRaceId()) setScreen('roster')
    })
    return () => {
      live = false
    }
    // Once, at startup, against the restored state. saveRoster is stable enough
    // for that: what it closes over here is what a fresh page has.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Asking for the shipped list by hand, from the roster screen. */
  const loadShipped = useCallback(() => {
    if (!shipped) return
    setIncomingSource('shipped')
    setIncoming(shipped)
  }, [shipped])

  /**
   * Who is running the race in progress. Saved under the race's name as well as
   * on the race, so next Saturday's varsity race opens with the seven chosen for
   * this one rather than with the top of the list again.
   *
   * Anyone already holding a crossing stays, whatever the picker said, because a
   * recorded time must never lose its name.
   */
  const setLineup = useCallback(
    (ids: string[]) => {
      if (!race) return
      const named = new Set(taps.map((t) => t.athleteId).filter((id): id is string => !!id))
      const keep = new Set([...ids, ...named])
      // Team order first, then names this race has of its own: typed in during
      // the race, or taken off the team list since it started.
      const onTeam = new Set(roster.map((a) => a.id))
      const pool = [...roster, ...race.athletes.filter((a) => !onTeam.has(a.id))]
      const updated: Race = { ...race, athletes: pool.filter((a) => keep.has(a.id)) }
      store.saveRace(updated)
      setRace(updated)
      store.saveLineup(race.race, updated.athletes.map((a) => a.id))
    },
    [race, roster, taps],
  )

  /**
   * Accepting a shared list. Replace is the common case, since the coach's list
   * is the authority, but a volunteer who already added a few names by hand
   * should not lose them.
   */
  const importRoster = useCallback(
    (mode: 'replace' | 'add') => {
      if (!incoming) return
      saveRoster(mode === 'replace' ? incoming : [...roster, ...incoming])
      setIncoming(null)
    },
    [incoming, roster, saveRoster],
  )

  const startRace = useCallback((draft: RaceDraft) => {
    const next: Race = {
      ...draft,
      id: store.newId(),
      date: todayIsoDate(),
      createdWallMs: Date.now(),
      // draft.athletes is the lineup, a snapshot of who was picked. See
      // saveRoster for how the race being timed is kept in step with edits.
    }
    store.saveRace(next)
    store.setActiveRaceId(next.id)
    // Remembered by race name, so the next meet opens with this lineup.
    store.saveLineup(next.race, next.athletes.map((a) => a.id))
    seqRef.current = 0
    setRace(next)
    setTaps([])
    setScreen('capture')
  }, [])

  /**
   * Opens a race from earlier today. Looking is not timing: a race that was
   * stopped stays stopped, with its clock frozen where it stopped, so opening the
   * first race of the morning to fix a name or send the CSV again cannot set a
   * finished race running.
   *
   * This used to clear the stop, on the reasoning that a mis-tapped stop should
   * not end the day's timing. That reason is still good and it now has its own
   * button, because it is a decision and not a side effect of tapping a race in a
   * list.
   */
  const openRace = useCallback((raceId: string) => {
    const loaded = store.loadRace(raceId)
    if (!loaded) return
    const loadedTaps = store.loadTaps(raceId)
    store.setActiveRaceId(raceId)
    seqRef.current = lastSeq(loadedTaps)
    setRace(loaded)
    setTaps(loadedTaps)
    setScreen('capture')
  }, [])

  /** Undoes a stop, for the mis-tap and for a race that turned out not to be over. */
  const reopenRace = useCallback(() => {
    if (!race?.stoppedAt) return
    const next: Race = { ...race, stoppedAt: undefined }
    store.saveRace(next)
    setRace(next)
  }, [race])

  /**
   * The hot path. The stamp is taken first and the write is synchronous, so the
   * tap is durable before React is asked to render anything.
   *
   * A caller that already holds a stamp passes it: the name buttons take the
   * time when the finger lands and only commit when it lifts, so the recorded
   * moment is the landing and not the release.
   */
  const addTap = useCallback(
    (athleteId?: string, held?: Stamp) => {
      if (!race || race.stoppedAt) return
      const at = held ?? stamp()
      const tap: Tap = {
        id: store.newId(),
        seq: seqRef.current + 1,
        wallMs: at.wallMs,
        monoMs: at.monoMs,
        sessionId: SESSION_ID,
        ...(athleteId ? { athleteId } : {}),
      }
      store.saveTap(race.id, tap)
      seqRef.current = tap.seq
      setTaps((prev) => [...prev, tap])
    },
    [race],
  )

  /**
   * Writes the crossings a naming changed and reflects them on screen. Both
   * naming paths end here, and both go through storage first.
   */
  const applyChanged = useCallback((raceId: string, changed: Tap[]) => {
    if (changed.length === 0) return
    for (const tap of changed) store.saveTap(raceId, tap)
    const byId = new Map(changed.map((t) => [t.id, t]))
    setTaps((prev) => prev.map((t) => byId.get(t.id) ?? t))
  }, [])

  /**
   * Names a crossing that is already recorded, which is what tapping a row in
   * the running list does.
   *
   * Tapping a name in the grid is the other gesture and it goes to addTap: it
   * records a crossing at that moment. It never fills in a crossing recorded
   * earlier, because a name tapped as a runner passes means that runner is going
   * by now, and quietly attaching an older time to it would put a wrong split
   * on a real runner.
   */
  const nameTap = useCallback(
    (athleteId: string, tapId: string) => {
      if (!race) return
      applyChanged(race.id, assignAthlete(taps, tapId, athleteId))
    },
    [race, taps, applyChanged],
  )

  /** Takes a name back off a crossing, keeping the time. */
  const clearTapName = useCallback(
    (tapId: string) => {
      if (!race) return
      applyChanged(race.id, clearName(taps, tapId))
    },
    [race, taps, applyChanged],
  )

  /**
   * Naming a crossing by typing, for a runner nobody has a button for: another
   * school's runner, or one whose name never made the list.
   *
   * The name joins this race only, not the team list, because that list is the
   * coach's list and a course is not where it gets edited. A name that matches
   * someone already here reuses that runner rather than making a twin on the grid.
   */
  const nameTapFree = useCallback(
    (name: string, tapId: string) => {
      if (!race) return
      const trimmed = name.trim()
      if (trimmed === '') return
      const existing = race.athletes.find((a) => a.name.toLowerCase() === trimmed.toLowerCase())
      let athleteId = existing?.id
      if (!athleteId) {
        const athlete: Athlete = { id: store.newId(), name: trimmed }
        athleteId = athlete.id
        const updated: Race = { ...race, athletes: [...race.athletes, athlete] }
        store.saveRace(updated)
        setRace(updated)
      }
      applyChanged(race.id, assignAthlete(taps, tapId, athleteId))
    },
    [race, taps, applyChanged],
  )

  const undoTap = useCallback(() => {
    if (!race || seqRef.current === 0) return
    store.deleteTap(race.id, seqRef.current)
    seqRef.current -= 1
    setTaps((prev) => prev.slice(0, -1))
  }, [race])

  const setGun = useCallback(() => {
    if (!race) return
    const next: Race = { ...race, gun: stamp(), gunSessionId: SESSION_ID }
    store.saveRace(next)
    setRace(next)
  }, [race])

  const stopRace = useCallback(() => {
    if (!race) return
    const next: Race = { ...race, stoppedAt: stamp() }
    store.saveRace(next)
    setRace(next)
    setScreen('export')
  }, [race])

  /**
   * Erases the races and their crossings, and leaves the team list alone. Times
   * are unrecoverable, since nothing is ever sent anywhere, so the button that
   * calls this asks twice. The names have a copy in the build and a runner leaves
   * the list from the roster screen, one at a time, which is where a change to the
   * team belongs.
   *
   * Bumping wiped re-reads the counts that the setup screen shows.
   */
  const clearRaces = useCallback(() => {
    store.clearRaces()
    setRace(null)
    setTaps([])
    seqRef.current = 0
    setWiped((n) => n + 1)
    setScreen('setup')
  }, [])

  const newRace = useCallback(() => {
    store.setActiveRaceId(null)
    setRace(null)
    setTaps([])
    seqRef.current = 0
    setScreen('setup')
  }, [])

  const showSetup = !race || screen === 'setup'
  // The race in progress gets its own button at the top, so it is not also
  // listed as something to resume.
  const others = showSetup ? store.loadAllRaces().filter((r) => r.id !== race?.id) : []
  const todaysRaces = others.filter((r) => r.date === todayIsoDate())
  /**
   * Races from before today. Listed rather than filtered away, because a race
   * nobody exported is the one thing on this phone with no copy anywhere else,
   * and it used to be unreachable the moment the date changed: the only way it
   * ever left was Clear all races.
   */
  const earlierRaces = others.filter((r) => r.date !== todayIsoDate())

  /**
   * What a wipe would destroy, read straight from storage so it cannot drift
   * from what is actually on the phone. Not memoized: the read is a handful of
   * key comparisons, and every input that would invalidate it lives on disk
   * rather than in the dependency array.
   */
  const stored = showSetup ? store.storedCounts() : EMPTY_COUNTS

  if (screen === 'roster') {
    return (
      <Roster
        athletes={roster}
        onSave={saveRoster}
        onBack={() => setScreen(rosterReturn)}
        incoming={incoming}
        incomingSource={incomingSource}
        onImport={importRoster}
        onDismissImport={() => setIncoming(null)}
        canLoadShipped={shipped !== null && teamText(roster) !== teamText(shipped)}
        onLoadShipped={loadShipped}
      />
    )
  }

  if (showSetup) {
    return (
      <Setup
        onStart={startRace}
        onOpen={openRace}
        existing={todaysRaces}
        earlier={earlierRaces}
        team={roster}
        rememberedLineup={store.loadLineup}
        onEditRoster={() => editRoster('setup')}
        active={race}
        onBackToTiming={() => setScreen('capture')}
        stored={stored}
        onClearRaces={clearRaces}
      />
    )
  }

  if (screen === 'export') {
    return (
      <ExportScreen
        race={race}
        taps={taps}
        onBack={() => setScreen('capture')}
        onNewRace={newRace}
      />
    )
  }

  return (
    <Capture
      race={race}
      taps={taps}
      team={roster}
      onLineup={setLineup}
      onTap={addTap}
      onName={nameTap}
      onNameFree={nameTapFree}
      onClearName={clearTapName}
      onUndo={undoTap}
      onSetGun={setGun}
      onStop={stopRace}
      onReopen={reopenRace}
      onExport={() => setScreen('export')}
      onSetup={() => setScreen('setup')}
      onEditRoster={() => editRoster('capture')}
    />
  )
}
