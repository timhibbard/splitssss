import { formatPr } from '../lib/clock'
import { hasSquads, inSquad, restOfList, toggle, topOfList, VARSITY_SIZE } from '../lib/lineup'
import { displayNames } from '../lib/names'
import type { Athlete, Squad } from '../lib/types'

/** How a race reads on a row, and to a screen reader. */
const SQUAD_WORD: Record<Squad, string> = { varsity: 'Varsity', jv: 'JV' }

type Props = {
  /**
   * The runners this race can draw from: one team's, filtered by whoever opened
   * this, so the seeding under the seventh name is that team's seeding.
   */
  team: Athlete[]
  /** Ids in this race. */
  selected: string[]
  onChange: (ids: string[]) => void
  onDone: () => void
  onEditTeam: () => void
  /** Named in the header, since a lineup only means something next to a race. */
  raceName: string
  /** Runners already holding a crossing here, who cannot be taken out of it. */
  locked?: Set<string>
  /**
   * This team's varsity number, used only for a list that does not say which race
   * each runner is in. It is the whole list for a team whose list is the varsity
   * squad, and then there is no line to draw and no "Top 7" worth offering next to
   * "Everyone".
   */
  varsity?: number
}

/**
 * Who is running this race.
 *
 * When the team list says which race each runner is in, the two quick buttons are
 * that: Varsity and JV, as the coach set them for this meet. When it does not,
 * they fall back to the top of the list and the rest of it. Either way the rows
 * do the exceptions, which is what a screen opened at the starting line is for.
 *
 * It covers whatever screen opened it rather than being a route of its own, so
 * the race being set up, or timed, is still there underneath when it closes.
 */
export function Lineup({
  team,
  selected,
  onChange,
  onDone,
  onEditTeam,
  raceName,
  locked,
  varsity = VARSITY_SIZE,
}: Props) {
  const labels = displayNames(team)
  const chosen = new Set(selected)

  /** A crossing is already recorded, so this name cannot leave the race. */
  const isLocked = (id: string) => locked?.has(id) === true

  /** Quick buttons never drop somebody who already has a time. */
  function set(ids: string[]) {
    const keep = new Set(ids)
    for (const id of locked ?? []) keep.add(id)
    onChange(team.filter((a) => keep.has(a.id)).map((a) => a.id))
  }

  const everyone = team.map((a) => a.id)

  /**
   * The two races, as the list itself says who is in them. A list that says
   * nothing falls back to the coach's order, which is the boys' list and any phone
   * holding one from before roster lines carried a race.
   */
  const said = hasSquads(team)
  const first = said ? inSquad(team, 'varsity') : topOfList(team, varsity)
  const rest = said ? inSquad(team, 'jv') : restOfList(team, varsity)
  /**
   * Where the rule under the names falls, on a list that only has an order to go
   * by. A list that says which race each runner is in gets no rule and says it on
   * each row instead: a runner moved down for one meet sits in PR order, so a
   * single line drawn across the list would be a line in the wrong place.
   */
  const line = said ? -1 : varsity
  /** Nothing to offer when one race is the whole list, or when it is nobody. */
  const showFirst = first.length > 0 && first.length < team.length

  return (
    <div className="screen lineup">
      <header className="bar">
        <button type="button" className="back" onClick={onDone}>
          Done
        </button>
        <div className="bar-where">
          <strong>Who is running</strong>
          <span>{raceName}</span>
        </div>
        <div className="lineup-tally" aria-label={`${selected.length} of ${team.length} running`}>
          <strong>{selected.length}</strong>
          <span>of {team.length}</span>
        </div>
      </header>

      {team.length === 0 ? (
        <>
          <p className="hint">
            No names on this phone yet. The team list comes first, then a race
            takes its lineup out of it.
          </p>
          <button type="button" className="primary" onClick={onEditTeam}>
            Add the team list
          </button>
        </>
      ) : (
        <>
          <div className="chips lineup-quick">
            {showFirst && (
              <button type="button" className="chip" onClick={() => set(first)}>
                {said ? `Varsity ${first.length}` : `Top ${varsity}`}
              </button>
            )}
            {rest.length > 0 && (
              <button type="button" className="chip" onClick={() => set(rest)}>
                {said ? `JV ${rest.length}` : 'Everyone else'}
              </button>
            )}
            <button type="button" className="chip" onClick={() => set(everyone)}>
              Everyone
            </button>
            <button type="button" className="chip" onClick={() => set([])}>
              Nobody
            </button>
          </div>

          <p className="hint">
            Tap a name to put that runner in this race or take them out.
            {said && ' Varsity and JV are what the team list came with, so the two buttons above are already this week\'s.'}{' '}
            During the race the buttons show a first name and an initial, so tap
            targets stay big enough to hit while watching the course.
          </p>

          <div className="lineup-rows">
            {team.map((a, i) => {
              const inRace = chosen.has(a.id)
              const held = isLocked(a.id)
              return (
                <button
                  key={a.id}
                  type="button"
                  className={[
                    'lineup-row',
                    inRace ? 'in' : '',
                    held ? 'held' : '',
                    i === line ? 'after-varsity' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => !held && onChange(toggle(selected, a.id))}
                  aria-pressed={inRace}
                  aria-label={`${a.name}, ${a.squad == null ? '' : `${SQUAD_WORD[a.squad]}, `}${
                    a.pr == null ? '' : `best ${formatPr(a.pr)}, `
                  }${inRace ? 'in this race' : 'not in this race'}${
                    held ? ', already has a time here' : ''
                  }`}
                >
                  <span className="lineup-mark" aria-hidden="true">
                    {inRace ? '✓' : ''}
                  </span>
                  <span className="lineup-place" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className="lineup-name">
                    {a.name}
                    {/*
                      The label the button will say, and the best time it will
                      say under it, so neither is a surprise mid meet. The race the
                      team list puts this runner in comes first, because on this
                      screen that is the thing being checked, and a runner moved
                      down for one meet still sits in PR order.
                    */}
                    <span className="lineup-label">
                      {a.squad != null && (
                        <span className="lineup-squad">{SQUAD_WORD[a.squad]}</span>
                      )}
                      {labels.get(a.id)}
                      {a.pr != null && ` · PR ${formatPr(a.pr)}`}
                    </span>
                  </span>
                  {held && <span className="lineup-held">has a time</span>}
                </button>
              )
            })}
          </div>

          <footer className="actions">
            <button type="button" className="primary" onClick={onDone}>
              Done
            </button>
          </footer>
          <nav className="nav-row">
            <button type="button" className="nav" onClick={onEditTeam}>
              Add or edit the team list
            </button>
          </nav>
        </>
      )}
    </div>
  )
}
