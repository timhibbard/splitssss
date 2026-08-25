import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import { SESSION_ID, stamp, todayIsoDate } from './lib/clock'
import { rosterFromHash } from './lib/link'
import { mergeRoster } from './lib/roster'
import * as store from './lib/storage'
import type { Athlete, Race, RaceDraft, Tap } from './lib/types'
import { fetchVault, openRoster, VAULT_FILE, type Vault } from './lib/vault'
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
 */
function restore(): { race: Race | null; taps: Tap[]; roster: Athlete[] } {
  const activeId = store.getActiveRaceId()
  const race = activeId ? store.loadRace(activeId) : null
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
  const [incomingSource, setIncomingSource] = useState<'link' | 'published'>('link')
  /** The published roster, if this build has one. Absent is normal. */
  const [vault, setVault] = useState<Vault | null>(null)
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

  /**
   * Looks for a roster published with this build. One request, at startup, to a
   * file that is precached, so it also resolves with no signal at the course.
   * Nothing is decrypted until somebody types the passphrase.
   */
  useEffect(() => {
    let live = true
    void fetchVault(`${import.meta.env.BASE_URL}${VAULT_FILE}`).then((found) => {
      if (live) setVault(found)
    })
    return () => {
      live = false
    }
  }, [])

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
   * The roster lives on the device, and the race holds a snapshot of it, so a
   * roster edited weeks later cannot rewrite a race already run. The race being
   * timed right now is the exception: a girl added at the starting line has to
   * appear on the grid without restarting anything.
   *
   * Anyone already holding a crossing stays on the race even if she is removed
   * from the roster, so a recorded time never loses its name.
   */
  const saveRoster = useCallback(
    (next: Athlete[]) => {
      store.saveRoster(next)
      setRoster(next)
      if (!race) return
      const named = new Set(taps.map((t) => t.athleteId).filter((id): id is string => !!id))
      const updated: Race = { ...race, athletes: mergeRoster(race.athletes, next, named) }
      store.saveRace(updated)
      setRace(updated)
    },
    [race, taps],
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

  /**
   * Unlocking the published roster. The decrypted names land in the same pending
   * state a shared link uses, so both channels ask the same question before
   * touching what is already on the phone.
   *
   * False covers a wrong passphrase and a corrupt file alike, which are the same
   * sentence to the person holding the phone. The passphrase is not kept: the
   * names persist instead, so this is once per phone rather than once per race.
   */
  const unlockRoster = useCallback(
    async (passphrase: string): Promise<boolean> => {
      if (!vault) return false
      let found = await openRoster(vault, passphrase)
      // A passphrase pasted out of a text message often brings a space or a
      // newline with it, which is not the volunteer's mistake to debug.
      if (!found && passphrase.trim() !== passphrase) {
        found = await openRoster(vault, passphrase.trim())
      }
      if (!found || found.length === 0) return false
      setIncomingSource('published')
      setIncoming(found)
      return true
    },
    [vault],
  )

  const startRace = useCallback(
    (draft: RaceDraft) => {
      const next: Race = {
        ...draft,
        id: store.newId(),
        date: todayIsoDate(),
        createdWallMs: Date.now(),
        // Snapshot. See saveRoster for how the active race is kept in step.
        athletes: roster,
      }
      store.saveRace(next)
      store.setActiveRaceId(next.id)
      seqRef.current = 0
      setRace(next)
      setTaps([])
      setScreen('capture')
    },
    [roster],
  )

  const resumeRace = useCallback((raceId: string) => {
    const loaded = store.loadRace(raceId)
    if (!loaded) return
    const loadedTaps = store.loadTaps(raceId)
    // Reopen it. A mis-tapped stop should not end the day's timing.
    const reopened: Race = { ...loaded, stoppedAt: undefined }
    store.saveRace(reopened)
    store.setActiveRaceId(raceId)
    seqRef.current = lastSeq(loadedTaps)
    setRace(reopened)
    setTaps(loadedTaps)
    setScreen('capture')
  }, [])

  /**
   * The hot path. The stamp is taken first and the write is synchronous, so the
   * tap is durable before React is asked to render anything.
   */
  const addTap = useCallback(
    (athleteId?: string) => {
      if (!race || race.stoppedAt) return
      const at = stamp()
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
   * Tapping a name does one of two things, and which one is shown on screen:
   *
   * - Crossings are waiting to be named, so this names the oldest one. That is
   *   correct without any extra bookkeeping because runners cross in order, so
   *   naming them in the order they were tapped matches the order they passed.
   * - Nothing is waiting, so this records a crossing and names it in one tap.
   *   For a coach who recognizes every girl, this is the whole interaction.
   */
  const nameTap = useCallback(
    (athleteId: string) => {
      if (!race) return
      const pending = taps.find((t) => !t.athleteId)
      if (!pending) {
        addTap(athleteId)
        return
      }
      const updated: Tap = { ...pending, athleteId }
      store.saveTap(race.id, updated)
      setTaps((prev) => prev.map((t) => (t.id === pending.id ? updated : t)))
    },
    [race, taps, addTap],
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
   * Erases everything this app has stored on the phone. Unrecoverable by design,
   * since nothing is ever sent anywhere, so the button that calls this asks
   * twice. Bumping wiped re-reads the counts that the setup screen shows.
   */
  const clearAll = useCallback(() => {
    store.clearAll()
    setRace(null)
    setTaps([])
    setRoster([])
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
  const todaysRaces = showSetup
    ? store.loadAllRaces().filter((r) => r.date === todayIsoDate() && r.id !== race?.id)
    : []

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
        hasPublished={vault !== null}
        onUnlock={unlockRoster}
      />
    )
  }

  if (showSetup) {
    return (
      <Setup
        onStart={startRace}
        onResume={resumeRace}
        existing={todaysRaces}
        rosterCount={roster.length}
        hasPublished={vault !== null}
        onEditRoster={() => editRoster('setup')}
        active={race}
        onBackToTiming={() => setScreen('capture')}
        stored={stored}
        onClearAll={clearAll}
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
      onTap={addTap}
      onName={nameTap}
      onUndo={undoTap}
      onSetGun={setGun}
      onStop={stopRace}
      onExport={() => setScreen('export')}
      onSetup={() => setScreen('setup')}
      onEditRoster={() => editRoster('capture')}
    />
  )
}
