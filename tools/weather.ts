/**
 * Looks up a meet's conditions and prints the lines for its meet file.
 *
 *   npm run weather -- KGSP 2026-09-12 08:28:51 09:41:36
 *
 * The station, the date, and each race's gun in local time. Prints a `# station`
 * line, a `# gun` line per race to put in its event block, and the station's
 * readings either side of every gun: the last one at or before it and the first
 * one after, which between them cover a 5K. Paste them into the meet file and run
 * meet-file as usual.
 *
 * From the Iowa Environmental Mesonet's archive of airport (ASOS) reports, which
 * is what a weather site shows for that airport afterwards. Fetched here and not
 * by meet-file, so building a meet file never needs the network, and the archive's
 * rate limit only matters when somebody asks it something.
 *
 * The station's name comes from the same archive. Add how far it is from the
 * course to the end of the `# station` line when it is not close.
 */
import { minutesOf, type Reading, readingCells } from '../src/lib/weather.ts'

const [station, date, ...guns] = process.argv.slice(2)
const state = process.env.STATE ?? 'SC'
if (!station || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? '') || guns.length === 0 || guns.some((g) => minutesOf(g) == null)) {
  console.error('Usage: npm run weather -- KGSP 2026-09-12 08:28:51 [09:41:36 ...]')
  console.error('Local gun times, one per race. STATE=NC for a station outside South Carolina.')
  process.exit(1)
}
const id = station.toUpperCase().replace(/^K(?=[A-Z0-9]{3}$)/, '')

const COVER = ['CLR', 'SKC', 'FEW', 'SCT', 'BKN', 'OVC']
const at = guns.map((g) => minutesOf(g)!)
const from = Math.max(0, Math.min(...at) - 90)
const to = Math.min(24 * 60 - 1, Math.max(...at) + 90)
const [y, m, d] = date.split('-')
const hm = (min: number) => ({ h: Math.floor(min / 60), m: Math.floor(min % 60) })

const q = new URLSearchParams({
  station: id,
  tz: 'America/New_York',
  format: 'onlycomma',
  latlon: 'no',
  missing: 'M',
  year1: y,
  month1: m,
  day1: d,
  hour1: String(hm(from).h),
  minute1: String(hm(from).m),
  year2: y,
  month2: m,
  day2: d,
  hour2: String(hm(to).h),
  minute2: String(hm(to).m),
})
for (const v of ['tmpf', 'dwpf', 'relh', 'feel', 'drct', 'sknt', 'skyc1', 'skyc2', 'skyc3']) q.append('data', v)
q.append('report_type', '3')
q.append('report_type', '4')

const res = await fetch(`https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py?${q}`)
if (!res.ok) {
  console.error(`The archive said ${res.status}. It limits how often it answers; wait a minute and try again.`)
  process.exit(1)
}
const rows = (await res.text()).trim().split('\n').slice(1).map((l) => l.split(','))
const num = (v: string, places: number) => (v === 'M' || v === '' ? undefined : Number(Number(v).toFixed(places)))
const all: Reading[] = rows.flatMap((c): Reading[] => {
  const tempF = num(c[2], 1)
  if (tempF == null) return []
  const layers = c.slice(8, 11).filter((s) => COVER.includes(s))
  const r: Reading = { time: c[1].slice(11, 16), tempF }
  const [dewF, humidity, feelsF, windDeg, windKt] = [num(c[3], 1), num(c[4], 0), num(c[5], 1), num(c[6], 0), num(c[7], 0)]
  if (dewF != null) r.dewF = dewF
  if (humidity != null) r.humidity = humidity
  if (feelsF != null) r.feelsF = feelsF
  if (windDeg != null) r.windDeg = windDeg
  if (windKt != null) r.windKt = windKt
  if (layers.length) r.sky = layers.reduce((a, b) => (COVER.indexOf(b) > COVER.indexOf(a) ? b : a))
  return [r]
})
if (all.length === 0) {
  console.error(`No readings from ${station} on ${date} around those guns.`)
  process.exit(1)
}

const keep = new Set<Reading>()
for (const g of at) {
  const before = all.filter((r) => minutesOf(r.time)! <= g).at(-1)
  const after = all.find((r) => minutesOf(r.time)! > g)
  if (before) keep.add(before)
  if (after) keep.add(after)
}

let name = station.toUpperCase()
try {
  const net = await fetch(`https://mesonet.agron.iastate.edu/geojson/network/${state}_ASOS.geojson`)
  const found = ((await net.json()) as { features: { id?: string; properties: { sid?: string; sname?: string } }[] }).features.find(
    (f) => (f.properties.sid ?? f.id) === id,
  )
  if (found?.properties.sname) name = found.properties.sname
} catch {
  // The name is a nicety. The readings are what was asked for.
}

const icao = id.length === 3 ? `K${id}` : id
console.log(`# station ${icao}\t${name}`)
for (const r of all.filter((r) => keep.has(r))) console.log(`# reading ${readingCells(r).join('\t')}`)
console.log('')
console.log('In each event block, its gun:')
for (const g of guns) console.log(`# gun ${g.padStart(8, '0')}`)
