import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import { SESSION_ID, stamp, todayIsoDate } from './lib/clock'
import { isLegacyHelpHash, rosterFromHash } from './lib/link'
import { forTeam } from './lib/lineup'
import type { Meet } from './lib/meet'
import { fetchMeet } from './lib/meetfile'
import { HELP_PATH, meetFilePath, type Page, pageAt, type ResultsPage, seasonMeets } from './lib/pages'
import { type SeasonMeet, seasonFiles } from './lib/season'
import { mergeLineup } from './lib/roster'
import { assignAthlete, clearName, currentLeg, legOf, tapsAt } from './lib/splits'
import * as store from './lib/storage'
import { fetchTeam, TEAM_FILE, teamText } from './lib/teamfile'
import type { Athlete, Race, RaceDraft, Stamp, Station, Tap } from './lib/types'
import { AthleteResults } from './screens/AthleteResults'
import { Capture } from './screens/Capture'
import { CoachResults } from './screens/CoachResults'
import { ExportScreen } from './screens/ExportScreen'
import { Help } from './screens/Help'
import { Roster } from './screens/Roster'
import { Setup } from './screens/Setup'

type Screen = 'setup' | 'roster' | 'capture' | 'export' | 'help' | 'results' | 'coach'

/**
 * The screens that have an address of their own, so the phone's back gesture works
 * on them and so they can be texted. A Page's `kind` is one of these, which is why
 * the router can hand its answer straight to setScreen.
 */
const ADDRESSED: Screen[] = ['help', 'results', 'coach']

/** Where the app lives, which every address is relative to. */
const BASE = import.meta.env.BASE_URL

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

/**
 * `#help` turned into `/help/`, for the links that were texted to parents before
 * the help page had a path of its own. Rewritten in place rather than redirected,
 * so the address bar ends up showing the real one and a bookmark of it is current.
 */
function takeLegacyHelpHash(): Page | null {
  if (typeof window === 'undefined' || LINKED_ROSTER != null) return null
  if (!isLegacyHelpHash(window.location.hash)) return null
  window.history.replaceState(null, '', `${BASE}${HELP_PATH}`)
  return { kind: 'help', path: HELP_PATH }
}

/**
 * Which addressed page the app was opened on, read once before anything renders.
 *
 * After takeLinkedRoster, which leaves a fragment it does not recognize alone, so a
 * roster link still wins on the reading of its own hash and cannot also be read as
 * a request for one of these pages.
 */
const OPENED_ON =
  typeof window === 'undefined' || LINKED_ROSTER != null
    ? null
    : (takeLegacyHelpHash() ?? pageAt(window.location.pathname, BASE))

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
  /**
   * A shared link opens on the roster, because deciding about it comes first, and an
   * addressed link opens on the page it names: somebody who taps a link that was
   * sent to them meant to land where it pointed. A race in progress still gets its
   * way back, from the button at the top of the home screen.
   */
  const [screen, setScreen] = useState<Screen>(
    LINKED_ROSTER ? 'roster' : (OPENED_ON?.kind ?? (restored.race ? 'capture' : 'setup')),
  )
  /**
   * The addressed page now showing, which is what says *which* meet is being looked
   * at. The screen alone cannot: there will be more than one meet, and 2026's Yellow
   * Jacket and 2027's are two addresses that render the same two screens.
   */
  const [addressed, setAddressed] = useState<Page | null>(OPENED_ON)
  /**
   * The shipped meet results, keyed by file, each fetched the first time a results
   * page for its season is asked for rather than at startup. A file missing from
   * here is still being looked for. `undefined` is still looking and `null` is a build with
   * no results file in it, which is the normal case for a fresh clone — the two have
   * to read differently or somebody with a slow first load is told the results do
   * not exist.
   *
   * Not fetched up front because a volunteer setting up a race has no use for it and
   * the file is precached either way, so there is nothing to gain by paying for it
   * before somebody asks.
   */
  const [meetFiles, setMeetFiles] = useState<Record<string, Meet | null>>({})
  /** The results files already asked for, so the same one is not fetched twice. */
  const askedForMeet = useRef(new Set<string>())
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
   * Whether this page session is the one that opened the addressed page now showing,
   * as opposed to having been opened on it by a texted link. It decides what leaving
   * means: going back, or clearing an address with nothing behind it.
   */
  const pushedPage = useRef(false)

  /**
   * Opens one of the addressed pages. Each has an address of its own, so it can be
   * texted and so the phone's own back gesture works while it is open.
   *
   * pushState rather than assigning the hash, because an entry in history is what
   * makes Android's back button close the page instead of leaving the app.
   */
  const openPage = useCallback((page: Page) => {
    pushedPage.current = true
    window.history.pushState(null, '', `${BASE}${page.path}${window.location.search}`)
    setAddressed(page)
    setScreen(page.kind)
  }, [])

  /**
   * Leaving takes the address with it, so a phone does not sit on /help/ with the
   * home screen showing. Back through history when this session pushed the entry,
   * so nothing dead is left in it, and a replace to the app's own base when the app
   * was opened on that page from a link, where there is nothing behind it to go back
   * to — a texted results link lands you on a real path, and Back from there has to
   * put you at the app rather than leave the app's home screen showing under a URL
   * that says results.
   */
  const closePage = useCallback(() => {
    if (pushedPage.current) {
      pushedPage.current = false
      window.history.back()
      return
    }
    window.history.replaceState(null, '', `${BASE}${window.location.search}`)
    setAddressed(null)
    setScreen('setup')
  }, [])

  /**
   * The phone's own back and forward gestures. The address is what says which
   * addressed page is open, so this reads it rather than trying to remember: forward
   * into the entry openPage pushed brings the page back, and back out of it closes
   * it.
   */
  useEffect(() => {
    const onPop = () => {
      const asked = pageAt(window.location.pathname, BASE)
      if (asked) {
        pushedPage.current = true
        setAddressed(asked)
        setScreen(asked.kind)
        return
      }
      pushedPage.current = false
      setAddressed(null)
      setScreen((prev) => (ADDRESSED.includes(prev) ? 'setup' : prev))
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  /**
   * Every results file in the season the address names, looked for the first time
   * one of its pages is on screen. The whole season rather than one meet, because
   * the name picker lists everybody who raced any of them and the race picker
   * switches between them. A kilobyte or so each and all precached, so they resolve
   * with no signal at the course.
   *
   * Keyed on the file, so opening the athlete page and then the coach page for the
   * same season fetches nothing twice. A season with nothing published has no file
   * to look for, and the page says so from its own address.
   */
  useEffect(() => {
    if (addressed?.kind !== 'results' && addressed?.kind !== 'coach') return
    for (const published of seasonMeets(addressed.season)) {
      const file = `${BASE}${meetFilePath(published)}`
      if (askedForMeet.current.has(file)) continue
      askedForMeet.current.add(file)
      void fetchMeet(file).then((meet) => setMeetFiles((prev) => ({ ...prev, [file]: meet })))
    }
  }, [addressed])

  const seasonOf = (page: ResultsPage): SeasonMeet[] =>
    seasonFiles(page.season, (published) => meetFiles[`${BASE}${meetFilePath(published)}`])

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
      // A runner passes a spot once. The grid already refuses a name that has a
      // crossing here; this is the same rule where the data is written.
      const leg = currentLeg(race)
      if (athleteId && taps.some((t) => t.athleteId === athleteId && legOf(t) === leg)) return
      const at = held ?? stamp()
      const tap: Tap = {
        id: store.newId(),
        seq: seqRef.current + 1,
        // Only written once the phone has moved, so a race that never did stores
        // exactly what it always has.
        ...(leg > 0 ? { leg } : {}),
        wallMs: at.wallMs,
        monoMs: at.monoMs,
        sessionId: SESSION_ID,
        ...(athleteId ? { athleteId } : {}),
      }
      store.saveTap(race.id, tap)
      seqRef.current = tap.seq
      setTaps((prev) => [...prev, tap])
    },
    [race, taps],
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

  /**
   * Takes back the newest crossing, and only at the spot the phone is at now.
   * Spots only ever move forward, so the newest crossing is always here unless
   * nothing has been tapped here yet, and then there is nothing to undo: a
   * crossing from the last spot was confirmed by walking away from it.
   */
  const undoTap = useCallback(() => {
    if (!race || seqRef.current === 0) return
    const last = taps[taps.length - 1]
    if (!last || legOf(last) !== currentLeg(race)) return
    store.deleteTap(race.id, seqRef.current)
    seqRef.current -= 1
    setTaps((prev) => prev.slice(0, -1))
  }, [race, taps])

  /**
   * The split taker walked to another marker. Same race, same gun, same clock:
   * the spot they were at goes on the list of earlier ones, with its crossings
   * still saying they were taken there, and new ones are taken at this one.
   */
  const moveStation = useCallback(
    (station: Station) => {
      if (!race) return
      const next: Race = {
        ...race,
        earlierStations: [...(race.earlierStations ?? []), race.station],
        station,
      }
      store.saveRace(next)
      setRace(next)
    },
    [race],
  )

  /**
   * Undoes a move, for the wrong marker picked or a walk that did not happen.
   * Only while nothing has been tapped at the new spot, so no crossing ever ends
   * up saying it was taken somewhere it was not.
   */
  const moveBack = useCallback(() => {
    if (!race?.earlierStations?.length) return
    if (tapsAt(taps, currentLeg(race)).length > 0) return
    const earlier = race.earlierStations.slice(0, -1)
    const next: Race = { ...race, station: race.earlierStations[race.earlierStations.length - 1] }
    if (earlier.length > 0) next.earlierStations = earlier
    else delete next.earlierStations
    store.saveRace(next)
    setRace(next)
  }, [race, taps])

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

  /**
   * Reading, not doing, so it goes above the setup screen rather than being one
   * more thing on it. Above the showSetup check for the same reason the roster is:
   * with no race in progress that check is true, and it would render the home
   * screen over this one.
   *
   * Back is always the home screen, whether this was reached from the link there or
   * from a texted address. A volunteer mid race is not reading a help page, and if
   * that ever changes this needs the return-to state the roster has.
   */
  if (screen === 'help') {
    return <Help onBack={closePage} />
  }

  /**
   * The two results pages, above the showSetup check for the same reason help is.
   * They are reached by their own addresses only, never from a button on a timing
   * screen: the coach page is the whole team's numbers side by side, and the athlete
   * page is for the link that gets texted out afterwards. Neither has anything to
   * offer somebody standing at Mile 2 with a phone.
   */
  if (screen === 'results' && addressed?.kind === 'results') {
    return <AthleteResults meets={seasonOf(addressed)} page={addressed} onBack={closePage} />
  }

  if (screen === 'coach' && addressed?.kind === 'coach') {
    return <CoachResults meets={seasonOf(addressed)} page={addressed} onBack={closePage} />
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
        onHelp={() => openPage({ kind: 'help', path: HELP_PATH })}
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
      onMove={moveStation}
      onMoveBack={moveBack}
      onSetGun={setGun}
      onStop={stopRace}
      onReopen={reopenRace}
      onExport={() => setScreen('export')}
      onSetup={() => setScreen('setup')}
      onEditRoster={() => editRoster('capture')}
    />
  )
}
