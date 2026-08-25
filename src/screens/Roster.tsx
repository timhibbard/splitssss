import { useState } from 'react'
import { rosterLink } from '../lib/link'
import { parseRoster } from '../lib/roster'
import type { Athlete } from '../lib/types'

type Props = {
  athletes: Athlete[]
  onSave: (athletes: Athlete[]) => void
  onBack: () => void
  /** Runners found in the link this app was opened with, awaiting a decision. */
  incoming: Athlete[] | null
  onImport: (mode: 'replace' | 'add') => void
  onDismissImport: () => void
}

export function Roster({
  athletes,
  onSave,
  onBack,
  incoming,
  onImport,
  onDismissImport,
}: Props) {
  const [paste, setPaste] = useState('')
  const [single, setSingle] = useState('')
  const [status, setStatus] = useState('')

  function addPasted() {
    const parsed = parseRoster(paste)
    if (parsed.length === 0) return
    onSave([...athletes, ...parsed])
    setPaste('')
  }

  function addSingle() {
    const parsed = parseRoster(single)
    if (parsed.length === 0) return
    onSave([...athletes, ...parsed])
    setSingle('')
  }

  function remove(id: string) {
    onSave(athletes.filter((a) => a.id !== id))
  }

  /**
   * Hands the list to whoever is timing, as a link. The names ride in the
   * fragment, so they are never sent to a server, and the recipient gets a
   * prompt rather than a silent overwrite.
   */
  async function share() {
    const link = rosterLink(athletes, window.location.origin, window.location.pathname)
    const text = `Splitssss roster, ${athletes.length} runners. Open this on your phone to load them: ${link}`
    if (navigator.share) {
      try {
        await navigator.share({ text })
        return
      } catch {
        // Cancelled or unsupported. Fall through to the clipboard.
      }
    }
    try {
      await navigator.clipboard.writeText(text)
      setStatus('Link copied. Paste it into a text message.')
    } catch {
      setStatus('Could not copy the link. Try Share instead.')
    }
  }

  return (
    <div className="screen roster">
      <header className="bar">
        <button type="button" className="back" onClick={onBack}>
          Back
        </button>
        <div className="bar-where">
          <strong>Runners</strong>
          <span>{athletes.length} on the team</span>
        </div>
      </header>

      {incoming && incoming.length > 0 && (
        <section className="incoming">
          <p>
            This link has <strong>{incoming.length} runners</strong>.
            {athletes.length > 0 ? ` You already have ${athletes.length} on this phone.` : ''}
          </p>
          <div className="incoming-actions">
            <button type="button" className="primary" onClick={() => onImport('replace')}>
              {athletes.length > 0 ? 'Use this list instead' : 'Load them'}
            </button>
            {athletes.length > 0 && (
              <button type="button" onClick={() => onImport('add')}>
                Add to mine
              </button>
            )}
          </div>
          <button type="button" className="dismiss" onClick={onDismissImport}>
            Ignore this link
          </button>
        </section>
      )}

      <p className="hint">
        These names become the buttons you tap during a race. The list stays on
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
        <>
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

          <button type="button" onClick={share}>
            Send this list to a volunteer
          </button>
          {status && <p className="status">{status}</p>}
          <p className="hint">
            Texts a link that loads all {athletes.length} names in one tap. The
            names ride in the part of the link browsers never send to a server.
            Open it in the same place you time, since an app added to the home
            screen keeps its own copy.
          </p>
        </>
      )}
    </div>
  )
}
