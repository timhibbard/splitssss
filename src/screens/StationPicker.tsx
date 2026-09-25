import { distanceLabel, toMeters } from '../lib/distance'
import { STATIONS, type StationChoice, UNITS } from '../lib/stations'
import type { Station } from '../lib/types'

type Props = {
  choice: StationChoice
  onChange: (next: StationChoice) => void
  /** The presets to offer and in what order. All four, first to last, unless said. */
  presets?: Station[]
}

/** The marker chips and the custom distance. Setup and the move sheet both ask this. */
export function StationPicker({ choice, onChange, presets = STATIONS }: Props) {
  const customActive = choice.pick === 'custom'
  const n = Number.parseFloat(choice.value)
  const valid = Number.isFinite(n) && n > 0
  return (
    <>
      <div className="chips">
        {presets.map((s) => (
          <button
            key={s.label}
            type="button"
            className={s.label === choice.pick ? 'chip on' : 'chip'}
            onClick={() => onChange({ ...choice, pick: s.label })}
          >
            {s.label}
          </button>
        ))}
        <button
          type="button"
          className={customActive ? 'chip on' : 'chip'}
          onClick={() => onChange({ ...choice, pick: 'custom' })}
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
            value={choice.value}
            onChange={(e) => onChange({ ...choice, value: e.target.value })}
            placeholder="1200"
            aria-label="Distance from the start"
          />
          <div className="chips">
            {UNITS.map((u) => (
              <button
                key={u}
                type="button"
                className={u === choice.unit ? 'chip on' : 'chip'}
                onClick={() => onChange({ ...choice, unit: u })}
              >
                {u}
              </button>
            ))}
          </div>
          <p className="hint">
            {valid
              ? `Recorded as ${distanceLabel(n, choice.unit)}, ${toMeters(n, choice.unit)}m from the start.`
              : 'Distance from the start line. Needed to compute pace.'}
          </p>
        </div>
      )}
    </>
  )
}
