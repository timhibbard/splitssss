import { formatPr } from '../lib/clock'
import { restOfList, toggle, topOfList, VARSITY_SIZE } from '../lib/lineup'
import { displayNames } from '../lib/names'
import type { Athlete } from '../lib/types'

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
   * This team's varsity number, which is where the line under the list falls. It
   * is the whole list for a team whose list is the varsity squad, and then there
   * is no line to draw and no "Top 7" worth offering next to "Everyone".
   */
  varsity?: number
}

/**
 * Who is running this race.
 *
 * A varsity race is the top of the team's list and JV is the rest, and where that
 * line falls moves week to week and differs between the two teams, so this is a
 * screen the coach opens often and a volunteer opens rarely. The quick buttons do
 * the usual case in one tap and the rows do the exceptions.
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
  const rest = restOfList(team, varsity)
  /** Nothing to offer when the top of the list is the whole list. */
  const showTop = varsity < team.length

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
            {showTop && (
              <button type="button" className="chip" onClick={() => set(topOfList(team, varsity))}>
                Top {varsity}
              </button>
            )}
            {rest.length > 0 && (
              <button type="button" className="chip" onClick={() => set(rest)}>
                Everyone else
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
            Tap a name to put that runner in this race or take them out. During
            the race the buttons show a first name and an initial, so tap targets
            stay big enough to hit while watching the course.
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
                    i === varsity ? 'after-varsity' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => !held && onChange(toggle(selected, a.id))}
                  aria-pressed={inRace}
                  aria-label={`${a.name}, ${a.pr == null ? '' : `best ${formatPr(a.pr)}, `}${
                    inRace ? 'in this race' : 'not in this race'
                  }${held ? ', already has a time here' : ''}`}
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
                      say under it, so neither is a surprise mid meet. The list is
                      in PR order, so the times also show at a glance where the
                      line the coach is drawing actually falls.
                    */}
                    <span className="lineup-label">
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
