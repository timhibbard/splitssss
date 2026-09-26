/**
 * One race drawn four ways, under the coach's table: the race replayed, each
 * runner's gap to the front of the team, the team's order at every mark, and the
 * pace of every stretch between marks.
 *
 * Nothing here is new data. Every figure is a timed mark, a finish, or arithmetic
 * on two of them, the same as the table above, so a chart can never disagree with
 * the table. What the charts add is the shape: who moved up between which marks,
 * and where the gaps opened, which a grid of times only gives up one subtraction at
 * a time.
 *
 * Like the table, no sentences about what anything meant. The labels say what a
 * line is and nothing else.
 *
 * A runner the volunteer missed at a mark has no point there, rather than one
 * drawn in between: a line bridging the gap would be a time nobody took. The
 * replay does interpolate, between every pair of known times, because a dot has to
 * be somewhere, and it says so.
 */

import { useEffect, useRef, useState } from 'react'
import { formatPr } from '../lib/clock'
import { METERS_PER_MILE } from '../lib/distance'
import type { Event, Observed } from '../lib/meet'

/** Minutes and whole seconds. Tenths on a chart axis are clutter. */
function clock(ms: number): string {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/**
 * A colour per runner, each dark enough to read as text on the page's white.
 * Picked by hand for the first ten, because evenly spaced hues put three greens
 * side by side; past ten, hues a golden angle apart. Fixed by the runner's place
 * in the list, which is finish order, so a colour is the same runner in all four
 * charts.
 */
const PALETTE = ['#c0392b', '#1f77b4', '#2e8b57', '#d35400', '#8e44ad', '#16a085', '#b8860b', '#c2185b', '#34495e', '#6d4c41']

function colorOf(i: number): string {
  return PALETTE[i] ?? `hsl(${Math.round((i * 137.5) % 360)} 65% 38%)`
}

/** A known time on the course: meters out, milliseconds from the gun. */
type Known = { meters: number; at: number; mark: number | 'start' | 'finish' }

function knownOf(event: Event, runner: Observed): Known[] {
  const known: Known[] = [{ meters: 0, at: 0, mark: 'start' }]
  event.markers.forEach((m, i) => {
    const at = runner.times[i]
    if (at != null) known.push({ meters: m.meters, at, mark: i })
  })
  if (runner.finish != null) known.push({ meters: event.distance, at: runner.finish, mark: 'finish' })
  return known
}

/** Where a runner was at `t`, by straight lines between their known times. */
function metersAt(known: Known[], t: number): number {
  for (let k = 1; k < known.length; k++) {
    const a = known[k - 1]
    const b = known[k]
    if (t <= b.at) return a.meters + ((t - a.at) / (b.at - a.at)) * (b.meters - a.meters)
  }
  return known[known.length - 1].meters
}

/** The places a chart has a column for: every mark and the finish. */
type Stop = { label: string; meters: number; at: (r: Observed) => number | null | undefined }

function stopsOf(event: Event): Stop[] {
  return [
    ...event.markers.map((m, i): Stop => ({ label: m.label, meters: m.meters, at: (r) => r.times[i] })),
    { label: 'Finish', meters: event.distance, at: (r) => r.finish },
  ]
}

/**
 * An SVG path through the points that exist, lifting the pen over the ones that do
 * not, so a missed mark is a gap in the line and not a guess.
 */
function pathThrough(points: ({ x: number; y: number } | null)[]): string {
  let d = ''
  let down = false
  for (const p of points) {
    if (!p) {
      down = false
      continue
    }
    d += `${down ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`
    down = true
  }
  return d
}

type Props = { event: Event; heading?: string }

export function RaceCharts({ event: given, heading }: Props) {
  const [focus, setFocus] = useState<string | null>(null)
  // Finish order, and a runner with no finish after everyone who has one, so the
  // lanes and the colours run from the front of the team to the back.
  const runners = [...given.runners].sort((a, b) => (a.finish ?? Infinity) - (b.finish ?? Infinity))
  const event = { ...given, runners }
  if (runners.length < 2) return null

  const pick = (label: string) => setFocus((f) => (f === label ? null : label))
  const dim = (label: string) => (focus != null && focus !== label ? 'is-dim' : '')
  const colors = new Map(runners.map((r, i) => [r.label, colorOf(i)]))

  return (
    <section className="race-charts">
      <h2>{heading ?? 'The race, drawn'}</h2>
      <p className="hint">Tap a name to pick out one runner in every chart. Tap it again to clear.</p>
      <Replay event={event} colors={colors} dim={dim} pick={pick} />
      <Gaps event={event} colors={colors} dim={dim} pick={pick} />
      <Order event={event} colors={colors} dim={dim} pick={pick} />
      <Stretches event={event} colors={colors} dim={dim} pick={pick} />
    </section>
  )
}

type Chart = {
  event: Event
  colors: Map<string, string>
  dim: (label: string) => string
  pick: (label: string) => void
}

/** The width every chart is drawn at. Phone-sized, so the type stays readable when it scales. */
const W = 360

/* ---------- replay ---------- */

const SPEEDS = [30, 60, 120]

function Replay({ event, colors, dim, pick }: Chart) {
  const runners = event.runners
  const known = runners.map((r) => knownOf(event, r))
  const end = Math.max(...known.map((k) => k[k.length - 1].at)) + 4000
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(60)
  // The clock the animation advances, kept outside state so each frame reads the
  // one before it rather than whatever React last rendered.
  const clockRef = useRef(0)

  useEffect(() => {
    if (!playing) return
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      clockRef.current = Math.min(end, clockRef.current + (now - last) * speed)
      last = now
      setT(clockRef.current)
      if (clockRef.current >= end) setPlaying(false)
      else frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, speed, end])

  const seek = (ms: number) => {
    clockRef.current = ms
    setT(ms)
  }

  const left = 70
  const right = 52
  const lane = 22
  const top = 20
  const h = top + runners.length * lane + 4
  const x = (m: number) => left + (m / event.distance) * (W - left - right)

  return (
    <figure className="chart">
      <figcaption>
        <strong>Replay</strong>
        <span>Each dot moves at the pace between its runner’s times either side.</span>
      </figcaption>
      <div className="replay-controls">
        <button
          type="button"
          onClick={() => {
            if (!playing && t >= end) seek(0)
            setPlaying(!playing)
          }}
        >
          {playing ? 'Pause' : t >= end ? 'Again' : 'Play'}
        </button>
        <input
          type="range"
          min={0}
          max={end}
          step={100}
          value={t}
          aria-label="Race clock"
          onChange={(e) => {
            setPlaying(false)
            seek(Number(e.target.value))
          }}
        />
        <span className="replay-clock">{clock(Math.min(t, end))}</span>
        <select value={speed} aria-label="Speed" onChange={(e) => setSpeed(Number(e.target.value))}>
          {SPEEDS.map((s) => (
            <option key={s} value={s}>
              {s}×
            </option>
          ))}
        </select>
      </div>
      <svg viewBox={`0 0 ${W} ${h}`} role="img" aria-label="Race replay">
        {[{ label: 'Start', meters: 0 }, ...stopsOf(event)].map((s) => (
          <g key={s.label}>
            <line className="chart-rule" x1={x(s.meters)} x2={x(s.meters)} y1={top - 6} y2={h} strokeDasharray="2 3" />
            <text className="chart-axis" x={x(s.meters)} y={top - 10} textAnchor="middle">
              {s.label.replace(/^0\.5 mi$/, '½ mi')}
            </text>
          </g>
        ))}
        {runners.map((r, i) => {
          const y = top + i * lane + lane / 2
          const k = known[i]
          const at = x(metersAt(k, t))
          const finish = r.finish
          const color = colors.get(r.label)
          return (
            <g key={r.label} className={`chart-who ${dim(r.label)}`} onClick={() => pick(r.label)}>
              <rect x={0} y={y - lane / 2} width={W} height={lane} fill="transparent" />
              <line className="replay-lane" x1={left} x2={W - right} y1={y} y2={y} />
              <line x1={left} x2={at} y1={y} y2={y} stroke={color} strokeWidth={4} strokeLinecap="round" opacity={0.3} />
              <text className="chart-name" x={left - 8} y={y + 3.5} textAnchor="end">
                {r.label}
              </text>
              <circle cx={at} cy={y} r={5.5} fill={color} />
              {finish != null && finish <= t && (
                <text className="chart-num" x={W - right + 8} y={y + 3.5} fill={color}>
                  {formatPr(finish)}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </figure>
  )
}

/* ---------- gap to the front ---------- */

function Gaps({ event, colors, dim, pick }: Chart) {
  const runners = event.runners
  const stops = stopsOf(event)
  const front = stops.map((s) => {
    const times = runners.map(s.at).filter((v): v is number => v != null)
    return times.length ? Math.min(...times) : null
  })
  const gap = (r: Observed, j: number) => {
    const v = stops[j].at(r)
    const f = front[j]
    return v == null || f == null ? null : v - f
  }
  const most = Math.max(30_000, ...runners.flatMap((r) => stops.map((_, j) => gap(r, j) ?? 0)))
  const tickEvery = most > 180_000 ? 60_000 : 30_000
  const top = Math.ceil(most / tickEvery) * tickEvery

  const left = 34
  const right = 98
  const up = 10
  const h = 240
  const down = 22
  const x = (m: number) => left + (m / event.distance) * (W - left - right)
  const y = (ms: number) => up + (ms / top) * (h - up - down)

  // Where each name sits at the right-hand end, pushed apart so none overlap.
  const ends = runners
    .map((r) => {
      let j = stops.length - 1
      while (j >= 0 && gap(r, j) == null) j--
      return { r, j, ms: j >= 0 ? gap(r, j)! : 0 }
    })
    .sort((a, b) => a.ms - b.ms)
  let prev = -Infinity
  const labelY = new Map<string, number>()
  for (const e of ends) {
    const at = Math.max(y(e.ms) + 3.5, prev + 10.5)
    labelY.set(e.r.label, at)
    prev = at
  }

  return (
    <figure className="chart">
      <figcaption>
        <strong>Gap to the front of the team</strong>
        <span>Time behind whichever teammate was first past each mark.</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${Math.max(h, prev + 4)}`} role="img" aria-label="Gap to the front of the team at each mark">
        {Array.from({ length: top / tickEvery + 1 }, (_, i) => i * tickEvery).map((ms) => (
          <g key={ms}>
            <line className="chart-rule" x1={left} x2={W - right} y1={y(ms)} y2={y(ms)} />
            <text className="chart-axis" x={left - 4} y={y(ms) + 3} textAnchor="end">
              {ms === 0 ? '0' : `+${clock(ms)}`}
            </text>
          </g>
        ))}
        {[{ label: 'Start', meters: 0 }, ...stops].map((s) => (
          <text key={s.label} className="chart-axis" x={x(s.meters)} y={h - 6} textAnchor="middle">
            {s.label.replace(/^0\.5 mi$/, '½')}
          </text>
        ))}
        {runners.map((r) => {
          const color = colors.get(r.label)
          const pts = [{ x: x(0), y: y(0) }, ...stops.map((s, j) => (gap(r, j) == null ? null : { x: x(s.meters), y: y(gap(r, j)!) }))]
          const end = ends.find((e) => e.r === r)!
          return (
            <g key={r.label} className={`chart-who ${dim(r.label)}`} onClick={() => pick(r.label)}>
              <path d={pathThrough(pts)} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
              {stops.map((s, j) =>
                gap(r, j) == null ? null : (
                  <circle key={s.label} cx={x(s.meters)} cy={y(gap(r, j)!)} r={2.5} fill={color} />
                ),
              )}
              <text className="chart-num" x={W - right + 6} y={labelY.get(r.label)} fill={color}>
                {r.label} {end.ms === 0 ? '' : `+${Math.round(end.ms / 1000)}s`}
              </text>
            </g>
          )
        })}
      </svg>
    </figure>
  )
}

/* ---------- team order ---------- */

function Order({ event, colors, dim, pick }: Chart) {
  const runners = event.runners
  const stops = stopsOf(event)
  // Place among the teammates timed at that mark. A runner the volunteer missed
  // has no place there rather than a guessed one.
  const places = stops.map((s) => {
    const timed = runners.filter((r) => s.at(r) != null).sort((a, b) => s.at(a)! - s.at(b)!)
    return new Map(timed.map((r, i) => [r.label, i + 1]))
  })

  const left = 66
  const right = 66
  const up = 12
  const row = 20
  const h = up + (runners.length - 1) * row + 30
  const x = (j: number) => left + (j / Math.max(1, stops.length - 1)) * (W - left - right)
  const y = (p: number) => up + (p - 1) * row

  return (
    <figure className="chart">
      <figcaption>
        <strong>Team order at each mark</strong>
        <span>Place among the {runners.length}, from the times taken there.</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${h}`} role="img" aria-label="Team order at each mark">
        {stops.map((s, j) => (
          <text key={s.label} className="chart-axis" x={x(j)} y={h - 6} textAnchor="middle">
            {s.label.replace(/^0\.5 mi$/, '½ mi')}
          </text>
        ))}
        {runners.map((r) => {
          const color = colors.get(r.label)
          const ps = places.map((p) => p.get(r.label))
          const first = ps.findIndex((p) => p != null)
          const lastAt = ps.length - 1 - [...ps].reverse().findIndex((p) => p != null)
          return (
            <g key={r.label} className={`chart-who ${dim(r.label)}`} onClick={() => pick(r.label)}>
              <path
                d={pathThrough(ps.map((p, j) => (p == null ? null : { x: x(j), y: y(p) })))}
                fill="none"
                stroke={color}
                strokeWidth={3}
                strokeLinejoin="round"
                opacity={0.8}
              />
              {ps.map((p, j) =>
                p == null ? null : (
                  <g key={j}>
                    <circle cx={x(j)} cy={y(p)} r={7} fill={color} />
                    <text className="order-place" x={x(j)} y={y(p) + 3} textAnchor="middle">
                      {p}
                    </text>
                  </g>
                ),
              )}
              {first >= 0 && (
                <>
                  <text className="chart-name" x={x(first) - 11} y={y(ps[first]!) + 3.5} textAnchor="end" fill={color}>
                    {r.label}
                  </text>
                  <text className="chart-name" x={x(lastAt) + 11} y={y(ps[lastAt]!) + 3.5} fill={color}>
                    {r.label}
                  </text>
                </>
              )}
            </g>
          )
        })}
      </svg>
    </figure>
  )
}

/* ---------- pace per stretch ---------- */

/**
 * How far from a runner's own race pace a stretch has to be to get the full shade.
 * Past this the colour stops getting stronger; the number in the cell still says
 * exactly how far.
 */
const FULL_SHADE_MS = 30_000

function Stretches({ event, colors, dim, pick }: Chart) {
  const runners = event.runners
  const bounds = [{ label: '0', meters: 0 }, ...stopsOf(event)]
  const names = bounds.slice(1).map((b, i) => {
    const from = bounds[i].label.replace(/ mi$/, '')
    return `${from}–${b.label === 'Finish' ? 'finish' : b.label}`
  })

  return (
    <figure className="chart">
      <figcaption>
        <strong>Pace for each stretch</strong>
        <span>
          Per mile, between one mark and the next. Green is quicker than the runner’s
          pace for the whole race and red slower, deeper the further off it is.
        </span>
      </figcaption>
      <div className="table-scroll">
        <table className="grid stretches">
          <thead>
            <tr>
              <th scope="col" className="who">
                Runner
              </th>
              {names.map((n) => (
                <th key={n} scope="col">
                  {n}
                </th>
              ))}
              <th scope="col">Race</th>
            </tr>
          </thead>
          <tbody>
            {runners.map((r) => {
              const race = r.finish == null ? null : (r.finish * METERS_PER_MILE) / event.distance
              const times = [0, ...event.markers.map((_, i) => r.times[i]), r.finish]
              return (
                <tr key={r.label} className={`chart-who ${dim(r.label)}`} onClick={() => pick(r.label)}>
                  <th scope="row" className="who">
                    <span style={{ color: colors.get(r.label) }}>●</span> {r.label}
                  </th>
                  {names.map((n, k) => {
                    const a = times[k]
                    const b = times[k + 1]
                    if (a == null || b == null) return <td key={n} />
                    const pace = ((b - a) * METERS_PER_MILE) / (bounds[k + 1].meters - bounds[k].meters)
                    const guessed = [k - 1, k].some((i) => i >= 0 && r.derived.includes(i))
                    const off = race == null ? 0 : Math.max(-1, Math.min(1, (pace - race) / FULL_SHADE_MS))
                    const shade =
                      off < 0 ? `rgb(23 102 58 / ${(-off * 0.45).toFixed(2)})` : `rgb(163 36 26 / ${(off * 0.4).toFixed(2)})`
                    return (
                      <td key={n} className={guessed ? 'is-soft' : ''} style={{ background: shade }}>
                        {clock(pace)}
                      </td>
                    )
                  })}
                  <td>{race == null ? '' : clock(race)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </figure>
  )
}
