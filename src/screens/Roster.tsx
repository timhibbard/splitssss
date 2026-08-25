import { useState } from 'react'
import { rosterLink } from '../lib/link'
import { parseRoster } from '../lib/roster'
import type { Athlete } from '../lib/types'

type Props = {
  athletes: Athlete[]
  onSave: (athletes: Athlete[]) => void
  onBack: () => void
  /** Runners waiting on a decision, from a link, the published roster, or the build. */
  incoming: Athlete[] | null
  incomingSource: 'link' | 'published' | 'shipped'
  onImport: (mode: 'replace' | 'add') => void
  onDismissImport: () => void
  /** This build ships an encrypted roster, so a passphrase can load it. */
  hasPublished: boolean
  onUnlock: (passphrase: string) => Promise<boolean>
  /** The build came with a team list and this phone is not using it. */
  canLoadShipped: boolean
  onLoadShipped: () => void
}

export function Roster({
  athletes,
  onSave,
  onBack,
  incoming,
  incomingSource,
  onImport,
  onDismissImport,
  hasPublished,
  onUnlock,
  canLoadShipped,
  onLoadShipped,
}: Props) {
  const [paste, setPaste] = useState('')
  const [single, setSingle] = useState('')
  const [status, setStatus] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [unlocking, setUnlocking] = useState(false)
  const [unlockError, setUnlockError] = useState('')
  const [showUnlock, setShowUnlock] = useState(false)

  /**
   * An empty phone is the case the published roster exists for, so the prompt is
   * open. Once there are names on the list it folds down to one quiet line: still
   * reachable when the coach adds a runner and re-publishes, not in the way.
   */
  const unlockOpen = hasPublished && !incoming && (athletes.length === 0 || showUnlock)

  /**
   * Key derivation takes a moment on purpose, so the button has to say what is
   * happening. A failure is a wrong passphrase far more often than a bad file,
   * and the message leads with that.
   */
  async function unlock() {
    if (passphrase.trim() === '' || unlocking) return
    setUnlocking(true)
    setUnlockError('')
    const ok = await onUnlock(passphrase)
    setUnlocking(false)
    if (ok) {
      setPassphrase('')
      setShowUnlock(false)
      return
    }
    setUnlockError(
      'That passphrase did not work. Check for a capital letter, and mind autocorrect.',
    )
  }

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
            {incomingSource === 'link'
              ? 'This link has '
              : incomingSource === 'shipped'
                ? 'The list that came with the app has '
                : 'The team roster has '}
            <strong>{incoming.length} runners</strong>.
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
            {incomingSource === 'link' ? 'Ignore this link' : 'Not now'}
          </button>
        </section>
      )}

      {/*
        Normally the shipped list is already loaded, silently, at startup. This is
        here for the phone that dismissed it, edited the list by hand, or is
        holding full names and wants the short ones back.
      */}
      {canLoadShipped && !incoming && (
        <button type="button" className="vault-toggle" onClick={onLoadShipped}>
          Load the team list that came with the app
        </button>
      )}

      {hasPublished && !incoming && !unlockOpen && (
        <button type="button" className="vault-toggle" onClick={() => setShowUnlock(true)}>
          Load the published team roster, with full names
        </button>
      )}

      {unlockOpen && (
        <section className="vault">
          <p>
            <strong>The team roster is published with this app.</strong> It is
            encrypted, so it takes the season passphrase once on this phone. Ask
            the coach for it.
          </p>
          <label>
            Season passphrase
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void unlock()
              }}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </label>
          <button
            type="button"
            className="primary"
            onClick={() => void unlock()}
            disabled={unlocking || passphrase.trim() === ''}
          >
            {unlocking ? 'Unlocking...' : 'Load the team'}
          </button>
          {unlockError && <p className="warn">{unlockError}</p>}
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
          placeholder={'Marlowe Holloway\nRowan Hayes\nJordan Blake'}
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
          placeholder="Runner's name"
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
