import { useCallback, useMemo, useRef, useState } from 'react'
import './App.css'
import { SESSION_ID, stamp, todayIsoDate } from './lib/clock'
import { mergeRoster } from './lib/roster'
import * as store from './lib/storage'
import type { Athlete, Race, RaceDraft, Tap } from './lib/types'
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

function lastSeq(taps: Tap[]): number {
  return taps.length > 0 ? taps[taps.length - 1].seq : 0
}

export default function App() {
  const [restored] = useState(restore)
  const [race, setRace] = useState<Race | null>(restored.race)
  const [taps, setTaps] = useState<Tap[]>(restored.taps)
  const [roster, setRoster] = useState<Athlete[]>(restored.roster)
  const [screen, setScreen] = useState<Screen>(restored.race ? 'capture' : 'setup')
  /** Where Back goes from the roster, so it returns you where you came from. */
  const [rosterReturn, setRosterReturn] = useState<Screen>('setup')

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
  const todaysRaces = useMemo(() => {
    if (!showSetup) return []
    const today = todayIsoDate()
    return store.loadAllRaces().filter((r) => r.date === today && r.id !== race?.id)
  }, [showSetup, race?.id])

  if (screen === 'roster') {
    return (
      <Roster
        athletes={roster}
        onSave={saveRoster}
        onBack={() => setScreen(rosterReturn)}
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
        onEditRoster={() => editRoster('setup')}
        active={race}
        onBackToTiming={() => setScreen('capture')}
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
