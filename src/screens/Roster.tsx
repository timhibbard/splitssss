import { useState } from 'react'
import { newId } from '../lib/storage'
import type { Athlete } from '../lib/types'

type Props = {
  athletes: Athlete[]
  onSave: (athletes: Athlete[]) => void
  onBack: () => void
}

/**
 * Parses pasted lines. Accepts "Name", "12 Name", "Name, 12" and "Name 12", so a
 * coach can paste whatever the meet entry list gave them without reformatting.
 */
function parseLines(text: string): Athlete[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const leadingBib = /^(\d{1,4})\s+(.*)$/.exec(line)
      if (leadingBib) return { id: newId(), name: leadingBib[2].trim(), bib: leadingBib[1] }

      const trailingBib = /^(.*?)[,\s]+(\d{1,4})$/.exec(line)
      if (trailingBib) return { id: newId(), name: trailingBib[1].trim(), bib: trailingBib[2] }

      return { id: newId(), name: line }
    })
    .filter((a) => a.name.length > 0)
}

export function Roster({ athletes, onSave, onBack }: Props) {
  const [paste, setPaste] = useState('')
  const [single, setSingle] = useState('')

  function addPasted() {
    const parsed = parseLines(paste)
    if (parsed.length === 0) return
    onSave([...athletes, ...parsed])
    setPaste('')
  }

  function addSingle() {
    const parsed = parseLines(single)
    if (parsed.length === 0) return
    onSave([...athletes, ...parsed])
    setSingle('')
  }

  function remove(id: string) {
    onSave(athletes.filter((a) => a.id !== id))
  }

  return (
    <div className="screen roster">
      <header className="bar">
        <button type="button" className="back" onClick={onBack}>
          Back
        </button>
        <div className="bar-where">
          <strong>Roster</strong>
          <span>{athletes.length} on the team</span>
        </div>
      </header>

      <p className="hint">
        These names become the buttons you tap during a race. The roster stays on
        this phone for the whole season.
      </p>

      <label>
        Paste a list, one runner per line
        <textarea
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          rows={5}
          placeholder={'Avery Collins\n14 Rowan Hayes\nJordan Blake, 22'}
          autoComplete="off"
        />
      </label>
      <button type="button" className="primary" onClick={addPasted} disabled={paste.trim() === ''}>
        Add pasted names
      </button>

      <label>
        Or add one
        <input
          value={single}
          onChange={(e) => setSingle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') addSingle()
          }}
          placeholder="Name, or bib and name"
          autoComplete="off"
        />
      </label>
      <button type="button" onClick={addSingle} disabled={single.trim() === ''}>
        Add
      </button>

      {athletes.length > 0 && (
        <section className="roster-list">
          <h2>On the team</h2>
          {athletes.map((a) => (
            <div key={a.id} className="roster-row">
              <span className="roster-name">
                {a.bib && <span className="roster-bib">{a.bib}</span>}
                {a.name}
              </span>
              <button type="button" className="remove" onClick={() => remove(a.id)}>
                Remove
              </button>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
