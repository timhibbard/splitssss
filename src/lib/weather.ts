/**
 * The conditions at a meet, as the nearest weather station read them.
 *
 * Observations, the same as the splits, so they travel in the meet file and not
 * beside it: one station for the meet, and its routine readings around the guns,
 * each one exactly as the station logged it. Nothing is interpolated to the gun.
 * A page that wants "at the gun" takes the reading nearest it and says which
 * reading that was by its time.
 *
 * Figures only. What the heat did to anyone's race is the coach's to say, and
 * nothing here adjusts a time for it.
 *
 * In the meet source, at the top with the meet's own headings:
 *
 *   # station KGSP	Greenville-Spartanburg International Airport
 *   # reading 08:53	71.0	69.0	93	71.0	0	0	OVC
 *
 * A reading is the local time, temperature, dew point, relative humidity,
 * feels-like (all °F and %), wind direction in degrees and speed in knots, and
 * the sky as the station codes it. Tab separated like every other row, and `-`
 * for anything the station did not report. `npm run weather` prints these lines.
 */

export type Reading = {
  /** Local time at the course, 24-hour `HH:MM`, as the station logged it. */
  time: string
  tempF: number
  dewF?: number
  humidity?: number
  feelsF?: number
  /** Degrees the wind came from. Zero with zero knots is calm. */
  windDeg?: number
  windKt?: number
  /** CLR, FEW, SCT, BKN or OVC: the most-covered layer. */
  sky?: string
}

export type Weather = {
  /** The station's identifier, KGSP. */
  station: string
  /** What the station is called, and how far from the course if it is not close. */
  name: string
  readings: Reading[]
}

const SKY: Record<string, string> = {
  CLR: 'clear',
  SKC: 'clear',
  FEW: 'a few clouds',
  SCT: 'scattered clouds',
  BKN: 'mostly cloudy',
  OVC: 'overcast',
}

/** `HH:MM` or `HH:MM:SS`, as minutes past midnight. Undefined for anything else. */
export function minutesOf(time: string): number | undefined {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(time.trim())
  if (!m) return undefined
  const [h, min, s] = [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)]
  if (h > 23 || min > 59 || s > 59) return undefined
  return h * 60 + min + s / 60
}

/**
 * A reading out of its cells, the time first, or a sentence saying which cell is
 * wrong. The caller adds the line number.
 */
export function parseReading(cells: string[]): Reading | string {
  if (cells.length !== 8)
    return (
      `a reading has ${cells.length} cells and needs 8: the time, temperature, dew point, ` +
      'humidity, feels-like, wind direction, wind speed and sky.'
    )
  const [time, ...rest] = cells
  if (minutesOf(time) == null || time.split(':').length !== 2)
    return `"${time}" is not a reading time. Like 17:15.`
  const num = (cell: string, what: string): number | undefined | string => {
    if (cell === '' || cell === '-') return undefined
    const n = Number(cell)
    if (!/^-?\d+(\.\d+)?$/.test(cell) || !Number.isFinite(n)) return `the ${what} is "${cell}", which is not a number.`
    return n
  }
  const names = ['temperature', 'dew point', 'humidity', 'feels-like', 'wind direction', 'wind speed']
  const values: (number | undefined)[] = []
  for (let i = 0; i < names.length; i++) {
    const v = num(rest[i], names[i])
    if (typeof v === 'string') return v
    values.push(v)
  }
  const [tempF, dewF, humidity, feelsF, windDeg, windKt] = values
  if (tempF == null) return 'a reading with no temperature.'
  const sky = rest[6] === '' || rest[6] === '-' ? undefined : rest[6].toUpperCase()
  if (sky != null && !(sky in SKY)) return `the sky is "${rest[6]}". CLR, FEW, SCT, BKN or OVC.`
  const reading: Reading = { time: time.padStart(5, '0'), tempF }
  if (dewF != null) reading.dewF = dewF
  if (humidity != null) reading.humidity = humidity
  if (feelsF != null) reading.feelsF = feelsF
  if (windDeg != null) reading.windDeg = windDeg
  if (windKt != null) reading.windKt = windKt
  if (sky != null) reading.sky = sky
  return reading
}

/** Back to the cells parseReading reads, for the round trip. */
export function readingCells(r: Reading): string[] {
  const n = (v: number | undefined) => (v == null ? '-' : String(v))
  return [r.time, n(r.tempF), n(r.dewF), n(r.humidity), n(r.feelsF), n(r.windDeg), n(r.windKt), r.sky ?? '-']
}

/** The reading nearest a gun, `HH:MM:SS`. The earlier one on a tie. */
export function readingAt(weather: Weather | undefined, gun: string | undefined): Reading | undefined {
  const at = gun == null ? undefined : minutesOf(gun)
  if (!weather || at == null) return undefined
  let best: Reading | undefined
  let gap = Infinity
  for (const r of weather.readings) {
    const d = Math.abs(minutesOf(r.time)! - at)
    if (d < gap) {
      best = r
      gap = d
    }
  }
  return best
}

/* ---------- how they read ---------- */

/** `17:15` or `17:23:46` as `5:15 pm`. Seconds are not this page's precision. */
export function clockTime(time: string): string {
  const total = Math.floor(minutesOf(time) ?? 0)
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`
}

export function degrees(f: number): string {
  return `${Math.round(f)}°F`
}

/**
 * Heat index, only where it is a different number from the temperature. Below
 * 80°F the formula is not defined, and a station's feels-like there is the
 * temperature again, or a wind chill nobody running a 5K is asking about.
 */
export function feelsLike(r: Reading): string | undefined {
  if (r.feelsF == null || r.tempF < 80 || Math.round(r.feelsF) === Math.round(r.tempF)) return undefined
  return `feels like ${degrees(r.feelsF)}`
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

/** Statute miles per hour in a knot. Stations report knots; nobody at a meet thinks in them. */
const MPH_PER_KNOT = 1.15078

export function wind(r: Reading): string | undefined {
  if (r.windKt == null) return undefined
  const mph = Math.round(r.windKt * MPH_PER_KNOT)
  if (mph === 0) return 'calm'
  const from = r.windDeg == null ? '' : `${COMPASS[Math.round(r.windDeg / 45) % 8]} `
  return `wind ${from}${mph} mph`
}

export function sky(r: Reading): string | undefined {
  return r.sky == null ? undefined : SKY[r.sky]
}
