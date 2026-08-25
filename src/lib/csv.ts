import { elapsedMs, formatElapsed, formatMinSec, formatWallClock, isoStamp } from './clock'
import { pacePerMile, projectedFinish } from './distance'
import type { Race, Tap } from './types'

function cell(value: string | number | undefined): string {
  const s = value == null ? '' : String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const COLUMNS = [
  'date',
  'meet',
  'race',
  'station',
  'station_meters',
  'race_meters',
  'timer',
  'place',
  'athlete',
  'bib',
  'note',
  'clock_time',
  'iso_time',
  'elapsed_from_gun',
  'elapsed_seconds',
  'pace_per_mile',
  'projected_finish',
  'gun_iso',
  'session',
]

/**
 * Long format, one row per crossing. Self describing on purpose: the coach is
 * reassembling files from several volunteers, so every row has to carry its own
 * meet, race, station and timer.
 */
export function toCsv(race: Race, taps: Tap[]): string {
  const byId = new Map(race.athletes.map((a) => [a.id, a]))
  const rows = taps.map((tap) => {
    const athlete = tap.athleteId ? byId.get(tap.athleteId) : undefined
    const ms = race.gun
      ? elapsedMs(race.gun, tap, tap.sessionId === race.gunSessionId)
      : undefined
    const proj = ms == null ? undefined : projectedFinish(race.station.meters, race.raceMeters, ms)
    return [
      race.date,
      race.meet,
      race.race,
      race.station.label,
      race.station.meters ?? '',
      race.raceMeters,
      race.timer,
      tap.seq,
      athlete?.name ?? '',
      athlete?.bib ?? '',
      tap.note ?? '',
      formatWallClock(tap.wallMs),
      isoStamp(tap.wallMs),
      ms == null ? '' : formatElapsed(ms),
      ms == null ? '' : (ms / 1000).toFixed(1),
      ms == null || !race.station.meters ? '' : pacePerMile(race.station.meters, ms),
      proj == null ? '' : formatMinSec(proj),
      race.gun ? isoStamp(race.gun.wallMs) : '',
      tap.sessionId,
    ]
      .map(cell)
      .join(',')
  })
  return [COLUMNS.join(','), ...rows].join('\n')
}

/**
 * Goes in the body of the text message. Has to stay legible after being pasted
 * into Messages, so no alignment tricks that depend on a monospace font.
 */
export function toTextSummary(race: Race, taps: Tap[]): string {
  const byId = new Map(race.athletes.map((a) => [a.id, a]))
  const lines = [
    `${race.meet} ${race.date}`,
    `${race.race} at ${race.station.label}`,
    race.timer ? `Timed by ${race.timer}` : '',
    race.gun ? `Gun ${formatWallClock(race.gun.wallMs)}` : 'No gun time recorded',
    `${taps.length} crossings`,
    '',
  ].filter(Boolean)

  for (const tap of taps) {
    const athlete = tap.athleteId ? byId.get(tap.athleteId) : undefined
    const who = athlete?.name ?? tap.note ?? 'unassigned'
    const ms = race.gun
      ? elapsedMs(race.gun, tap, tap.sessionId === race.gunSessionId)
      : undefined
    const time = ms == null ? formatWallClock(tap.wallMs) : formatElapsed(ms)
    lines.push(`${tap.seq}. ${time}  ${who}`)
  }

  return lines.join('\n')
}

export function csvFilename(race: Race): string {
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${race.date}-${slug(race.race)}-${slug(race.station.label)}.csv`
}
