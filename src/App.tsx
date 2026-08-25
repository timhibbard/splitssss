import { useCallback, useMemo, useState } from 'react'
import './App.css'
import { SESSION_ID, stamp, todayIsoDate } from './lib/clock'
import * as store from './lib/storage'
import type { Race, Tap } from './lib/types'
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

export default function App() {
  const [restored] = useState(restore)
  const [race, setRace] = useState<Race | null>(restored.race)
  const [taps, setTaps] = useState<Tap[]>(restored.taps)
  const [screen, setScreen] = useState<Screen>(restored.race ? 'capture' : 'setup')

  const startRace = useCallback((next: Race) => {
    store.saveRace(next)
    store.setActiveRaceId(next.id)
    setRace(next)
    setTaps([])
    setScreen('capture')
  }, [])

  const resumeRace = useCallback((raceId: string) => {
    const loaded = store.loadRace(raceId)
    if (!loaded) return
    store.setActiveRaceId(raceId)
    setRace(loaded)
    setTaps(store.loadTaps(raceId))
    setScreen('capture')
  }, [])

  /**
   * The hot path. The stamp is taken before anything else and the write is
   * synchronous, so the tap is durable before React is asked to render.
   */
  const addTap = useCallback(() => {
    if (!race) return
    const at = stamp()
    setTaps((prev) => {
      const tap: Tap = {
        id: store.newId(),
        seq: prev.length > 0 ? prev[prev.length - 1].seq + 1 : 1,
        wallMs: at.wallMs,
        monoMs: at.monoMs,
        sessionId: SESSION_ID,
      }
      store.saveTap(race.id, tap)
      return [...prev, tap]
    })
  }, [race])

  const undoTap = useCallback(() => {
    if (!race) return
    setTaps((prev) => {
      if (prev.length === 0) return prev
      store.deleteTap(race.id, prev[prev.length - 1].seq)
      return prev.slice(0, -1)
    })
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
