import { useCallback, useMemo, useRef, useState } from 'react'
import './App.css'
import { SESSION_ID, stamp, todayIsoDate } from './lib/clock'
import * as store from './lib/storage'
import type { Race, RaceDraft, Tap } from './lib/types'
import { Capture } from './screens/Capture'
import { ExportScreen } from './screens/ExportScreen'
import { Setup } from './screens/Setup'

type Screen = 'setup' | 'capture' | 'export'

/**
 * Read whatever was being timed back out of storage. Done during the first
 * render rather than in an effect so a volunteer whose page was discarded mid
 * race never sees a flash of the setup screen before their taps come back.
 */
function restore(): { race: Race | null; taps: Tap[] } {
  const activeId = store.getActiveRaceId()
  const race = activeId ? store.loadRace(activeId) : null
  return { race, taps: race ? store.loadTaps(race.id) : [] }
}

function lastSeq(taps: Tap[]): number {
  return taps.length > 0 ? taps[taps.length - 1].seq : 0
}

export default function App() {
  const [restored] = useState(restore)
  const [race, setRace] = useState<Race | null>(restored.race)
  const [taps, setTaps] = useState<Tap[]>(restored.taps)
  const [screen, setScreen] = useState<Screen>(restored.race ? 'capture' : 'setup')

  /**
   * Crossing counter, held outside React state so the storage write can happen
   * exactly once per tap. Deriving the next seq inside a setState updater would
   * put a side effect in a place React is allowed to call twice.
   */
  const seqRef = useRef(lastSeq(restored.taps))

  const startRace = useCallback((draft: RaceDraft) => {
    const next: Race = {
      ...draft,
      id: store.newId(),
      date: todayIsoDate(),
      createdWallMs: Date.now(),
      athletes: [],
    }
    store.saveRace(next)
    store.setActiveRaceId(next.id)
    seqRef.current = 0
    setRace(next)
    setTaps([])
    setScreen('capture')
  }, [])

  const resumeRace = useCallback((raceId: string) => {
    const loaded = store.loadRace(raceId)
    if (!loaded) return
    const loadedTaps = store.loadTaps(raceId)
    store.setActiveRaceId(raceId)
    seqRef.current = lastSeq(loadedTaps)
    setRace(loaded)
    setTaps(loadedTaps)
    setScreen('capture')
  }, [])

  /**
   * The hot path. The stamp is taken first and the write is synchronous, so the
   * tap is durable before React is asked to render anything.
   */
  const addTap = useCallback(() => {
    if (!race) return
    const at = stamp()
    const tap: Tap = {
      id: store.newId(),
      seq: seqRef.current + 1,
      wallMs: at.wallMs,
      monoMs: at.monoMs,
      sessionId: SESSION_ID,
    }
    store.saveTap(race.id, tap)
    seqRef.current = tap.seq
    setTaps((prev) => [...prev, tap])
  }, [race])

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

  const showSetup = !race || screen === 'setup'
  const todaysRaces = useMemo(() => {
    if (!showSetup) return []
    const today = todayIsoDate()
    return store.loadAllRaces().filter((r) => r.date === today)
  }, [showSetup])

  if (showSetup) {
    return <Setup onStart={startRace} onResume={resumeRace} existing={todaysRaces} />
  }

  if (screen === 'export') {
    return <ExportScreen race={race} taps={taps} onBack={() => setScreen('capture')} />
  }

  return (
    <Capture
      race={race}
      taps={taps}
      onTap={addTap}
      onUndo={undoTap}
      onSetGun={setGun}
      onExport={() => setScreen('export')}
    />
  )
}
