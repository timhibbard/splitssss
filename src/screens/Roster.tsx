import { useState } from 'react'
import { formatPr } from '../lib/clock'
import { rosterLink } from '../lib/link'
import { byTeam, parseRoster } from '../lib/roster'
import type { Athlete, Squad, Team } from '../lib/types'

const TEAM_LABEL: Record<Team, string> = { girls: 'Girls', boys: 'Boys' }
const SQUAD_LABEL: Record<Squad, string> = { varsity: 'Varsity', jv: 'JV' }

/**
 * Both counts, because a phone holding one team and not the other is the thing
 * this screen has to make obvious before a meet rather than at the gun. A list
 * with no teams on it, which is what a phone that predates the boys holds, reads
 * the way it always did.
 */
function tally(athletes: Athlete[]): string {
  const counts = byTeam(athletes).map((group) =>
    group.team == null
      ? `${group.athletes.length} unassigned`
      : `${group.athletes.length} ${group.team}`,
  )
  if (counts.length === 0) return 'nobody yet'
  if (counts.length === 1 && !athletes.some((a) => a.team != null)) {
    return `${athletes.length} on the team`
  }
  return counts.join(', ')
}

/**
 * How one team's count reads: the number, and how it divides between the two races
 * when the list says. "25, 8 varsity, 17 JV" is the check a coach came here to
 * make, and a wrong number is easier to see than a wrong name.
 */
function split(athletes: Athlete[]): string {
  const varsity = athletes.filter((a) => a.squad === 'varsity').length
  const jv = athletes.filter((a) => a.squad === 'jv').length
  if (varsity === 0 && jv === 0) return `${athletes.length}`
  const parts = [`${athletes.length}`]
  if (varsity > 0) parts.push(`${varsity} varsity`)
  if (jv > 0) parts.push(`${jv} JV`)
  // Anyone the list puts in neither race. Named, because a runner nobody meant to
  // leave out should not go missing quietly.
  const neither = athletes.length - varsity - jv
  if (neither > 0) parts.push(`${neither} in neither`)
  return parts.join(', ')
}

type Props = {
  athletes: Athlete[]
  onSave: (athletes: Athlete[]) => void
  onBack: () => void
  /** Runners waiting on a decision, from a shared link or from the build. */
  incoming: Athlete[] | null
  incomingSource: 'link' | 'shipped'
  onImport: (mode: 'replace' | 'add') => void
  onDismissImport: () => void
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
  canLoadShipped,
  onLoadShipped,
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
          <span>{tally(athletes)}</span>
        </div>
      </header>

      {incoming && incoming.length > 0 && (
        <section className="incoming">
          <p>
            {incomingSource === 'link'
              ? 'This link has '
              : 'The list that came with the app has '}
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
        <button type="button" className="quiet-offer" onClick={onLoadShipped}>
          Load the team list that came with the app
        </button>
      )}

      <p className="hint">
        These names become the buttons you tap during a race. The list stays on
        this phone for the whole season. A 5K best after the name is optional: it
        goes on the button and every split gets compared to it. "Varsity" or "JV"
        after that puts the runner in that race, so the race opens with the right
        names already picked. A line reading "# Boys" or "# Girls" puts the runners
        under it on that team, and a race only ever shows one team's names.
      </p>

      <label>
        Paste a list, one runner per line, best time and race optional
        <textarea
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          rows={5}
          placeholder={
            '# Girls\nMarlowe Holloway  21:34.60  Varsity\nRowan Hayes  22:29.15  JV\n\n# Boys\nJordan Blake  17:12.40'
          }
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
          placeholder="Runner's name, and a best time if there is one"
          autoComplete="off"
        />
      </label>
      <button type="button" onClick={addSingle} disabled={single.trim() === ''}>
        Add
      </button>

      {athletes.length > 0 && (
        <>
          {/*
            One section per team, in the order the list itself groups them, so
            what is on screen matches what a paste or a shared link carries. A
            list with no teams on it gets the one heading it always had.
          */}
          {byTeam(athletes).map((group) => (
            <section key={group.team ?? 'all'} className="roster-list">
              <h2>
                {group.team == null ? 'On the team' : TEAM_LABEL[group.team]}
                {group.team != null && (
                  <span className="roster-count"> {split(group.athletes)}</span>
                )}
              </h2>
              {group.athletes.map((a) => (
                <div key={a.id} className="roster-row">
                  <span className="roster-name">
                    {a.name}
                    {/*
                      The best time and the race this runner is in, which together
                      are everything the line carried. This is the screen where
                      somebody checks that what came in is what was meant.
                    */}
                    {(a.pr != null || a.squad != null) && (
                      <span className="roster-pr">
                        {a.pr != null && formatPr(a.pr)}
                        {a.pr != null && a.squad != null && ' · '}
                        {a.squad != null && SQUAD_LABEL[a.squad]}
                      </span>
                    )}
                  </span>
                  <button type="button" className="remove" onClick={() => remove(a.id)}>
                    Remove
                  </button>
                </div>
              ))}
            </section>
          ))}

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
