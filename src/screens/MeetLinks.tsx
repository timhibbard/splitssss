import type { Published } from '../lib/pages'

/**
 * Where to find the meet itself, and the way around its course. Nothing when the
 * meet has neither, which is every meet from before there was a place for them.
 */
export function MeetLinks({ published }: { published: Published }) {
  const { milesplit, course, name } = published
  if (!milesplit && !course) return null
  const map = course && `${import.meta.env.BASE_URL}${course}`
  return (
    <div className="meet-links">
      {milesplit && (
        <a href={milesplit} target="_blank" rel="noopener noreferrer">
          {name} on MileSplit
        </a>
      )}
      {map && (
        <details>
          <summary>Course map</summary>
          {/* Tap for the full size, to pinch in on the marks. */}
          <a href={map} target="_blank" rel="noopener">
            <img src={map} alt={`The ${name} course`} loading="lazy" />
          </a>
        </details>
      )}
    </div>
  )
}
