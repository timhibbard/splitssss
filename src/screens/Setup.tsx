import { useState } from 'react'
import { todayIsoDate } from '../lib/clock'
import { newId } from '../lib/storage'
import type { Race } from '../lib/types'

type Props = {
  onStart: (race: Race) => void
  existing: Race[]
  onResume: (raceId: string) => void
}

const STATIONS = ['Mile 1', 'Mile 2', 'Mile 3', 'Finish']

export function Setup({ onStart, existing, onResume }: Props) {
  const [meet, setMeet] = useState('')
  const [raceName, setRaceName] = useState('')
  const [station, setStation] = useState('Mile 2')
  const [timer, setTimer] = useState('')

  function start() {
    onStart({
      id: newId(),
      meet: meet.trim() || 'Meet',
      race: raceName.trim() || 'Race',
      station,
      timer: timer.trim(),
      date: todayIsoDate(),
      createdWallMs: Date.now(),
      athletes: [],
    })
  }

  return (
    <div className="screen setup">
      <header className="brand">
        <h1>Splitssss</h1>
        <p className="tagline">Splits, saved, sorted, sent.</p>
      </header>

      <p className="instructions">
        Tap the big button as each of our runners passes you. Add names
        afterward. You do not need to know when the race started.
      </p>

      <label>
        Meet
        <input
          value={meet}
          onChange={(e) => setMeet(e.target.value)}
          placeholder="GVSU Invite"
          autoComplete="off"
        />
      </label>

      <label>
        Race
        <input
          value={raceName}
          onChange={(e) => setRaceName(e.target.value)}
          placeholder="JV Boys"
          autoComplete="off"
        />
      </label>

      <fieldset>
        <legend>Where are you standing?</legend>
        <div className="chips">
          {STATIONS.map((s) => (
            <button
              key={s}
              type="button"
              className={s === station ? 'chip on' : 'chip'}
              onClick={() => setStation(s)}
            >
              {s}
            </button>
          ))}
        </div>
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

      <button type="button" className="primary" onClick={start}>
        Start timing
      </button>

      {existing.length > 0 && (
        <section className="prior">
          <h2>Earlier today</h2>
          {existing.map((r) => (
            <button key={r.id} type="button" className="prior-race" onClick={() => onResume(r.id)}>
              <strong>{r.race}</strong> at {r.station}
              <span className="prior-meta">{r.meet}</span>
            </button>
          ))}
        </section>
      )}

      <p className="build">Build {__BUILD__}</p>
    </div>
  )
}
