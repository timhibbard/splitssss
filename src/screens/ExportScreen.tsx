import { useState } from 'react'
import { csvFilename, toCsv, toTextSummary } from '../lib/csv'
import type { Race, Tap } from '../lib/types'

type Props = {
  race: Race
  taps: Tap[]
  onBack: () => void
}

export function ExportScreen({ race, taps, onBack }: Props) {
  const [status, setStatus] = useState('')
  const csv = toCsv(race, taps)
  const summary = toTextSummary(race, taps)
  const unassigned = taps.filter((t) => !t.athleteId).length

  /**
   * Share sheet first, since the whole point is texting this to the coach.
   * Falls back to clipboard, then to a download, because file sharing support
   * varies and a volunteer cannot troubleshoot.
   */
  async function share() {
    const file = new File([csv], csvFilename(race), { type: 'text/csv' })
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ text: summary, files: [file] })
        return
      } catch {
        // Cancelled or unsupported. Fall through to the next option.
      }
    }
    if (navigator.share) {
      try {
        await navigator.share({ text: summary })
        return
      } catch {
        // Fall through.
      }
    }
    await copy()
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
    a.download = csvFilename(race)
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
        </div>
      </header>

      {unassigned > 0 && (
        <p className="warn">
          {unassigned} of {taps.length} crossings have no name yet. Sending is
          still fine, the times are what matter.
        </p>
      )}

      <div className="export-actions">
        <button type="button" className="primary" onClick={share}>
          Share
        </button>
        <button type="button" onClick={copy}>
          Copy
        </button>
        <button type="button" onClick={download}>
          Save CSV
        </button>
      </div>

      {status && <p className="status">{status}</p>}

      <h2>What gets sent</h2>
      <pre className="preview">{summary}</pre>

      <h2>CSV</h2>
      <pre className="preview small">{csv}</pre>
    </div>
  )
}
