import { useState } from 'react'
import { csvFilename, stationNames, toCsv, toTextSummary } from '../lib/csv'
import { COACH_PHONE, smsLink } from '../lib/sms'
import type { Race, Tap } from '../lib/types'

type Props = {
  race: Race
  taps: Tap[]
  onBack: () => void
  onNewRace: () => void
}

export function ExportScreen({ race, taps, onBack, onNewRace }: Props) {
  const [status, setStatus] = useState('')
  const csv = toCsv(race, taps)
  const summary = toTextSummary(race, taps)
  const unassigned = taps.filter((t) => !t.athleteId).length

  /**
   * The text to the coach: the summary to read and the CSV rows under it, since
   * a text link cannot attach the file. A link and not a button, so it opens
   * Messages the way any link to a number does.
   */
  const text = smsLink(COACH_PHONE, `${summary}\n\n${csv}`)

  /**
   * The .csv file itself, through the share sheet, which is where a phone offers
   * Save to Files as well as sending it. The file alone and no text, so saving it
   * saves a CSV and not a CSV and a note. A phone that cannot share a file
   * downloads it instead.
   */
  async function saveCsv() {
    const file = new File([csv], csvFilename(race, taps), { type: 'text/csv' })
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] })
        return
      } catch (e) {
        // A cancel is an answer. Anything else falls through to a download.
        if (e instanceof DOMException && e.name === 'AbortError') return
      }
    }
    download()
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${summary}\n\n${csv}`)
      setStatus('Copied. Paste it into a text message.')
    } catch {
      setStatus('Could not copy. Select the text below and copy it manually.')
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = csvFilename(race, taps)
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="screen export">
      <header className="bar">
        <button type="button" className="back" onClick={onBack}>
          Back
        </button>
        <div className="bar-where">
          <strong>Send to coach</strong>
          <span>
            {race.race} at {stationNames(race, taps)}
          </span>
        </div>
      </header>

      {unassigned > 0 && (
        <p className="warn">
          {unassigned} of {taps.length} crossings have no name yet. Sending is
          still fine, the times are what matter. Go Back and tap names to fill
          them in, oldest first.
        </p>
      )}

      <a className="primary text-coach" href={text}>
        Text Coach Tim
      </a>

      <div className="export-actions">
        <button type="button" onClick={copy}>
          Copy
        </button>
        <button type="button" onClick={saveCsv}>
          Save CSV
        </button>
      </div>

      {status && <p className="status">{status}</p>}

      <h2>What gets sent</h2>
      <pre className="preview">{summary}</pre>

      <h2>CSV</h2>
      <pre className="preview small">{csv}</pre>

      <button type="button" className="new-race" onClick={onNewRace}>
        Time another race
      </button>
      <p className="hint">
        This one stays on the phone under "Earlier today" if you need it again.
      </p>
    </div>
  )
}
