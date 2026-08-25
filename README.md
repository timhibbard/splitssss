# Splitssss

**Splits, Saved, Sorted, Sent.**

Hand timing for cross country splits, for the J.L. Mann Academy Patriots girls
team. A volunteer stands at a course marker, taps a big button as each of our
runners passes, attaches names afterward, and texts the coach a CSV.

Live at **https://timhibbard.github.io/splitssss/**

## Why it works the way it does

- **Tap now, name later.** A tap records a time and claims the next place
  number. Nothing else is needed in the moment. Runners cross a point in order,
  so finish order is free information.
- **Split points are distances.** Presets for 800m, Mile 1, 2K, 3K, Mile 2 and
  4K, plus a custom distance in meters, kilometers, or miles. The distance is
  stored so pace per mile can be computed. There is no finish line station,
  because the meet already provides finish times.
- **The gun time is optional.** Every tap stores an absolute time of day, so
  elapsed times are computed later by subtracting the gun time. A volunteer at
  Mile 2 who cannot hear the start does not need to know when the race began.
- **Names go on during the race or after.** Add the roster from the panel at the
  top of the setup screen, or from Add names on the capture screen mid race, then tap a name
  instead of the big button and it records and names in one tap. Fall behind and
  the name buttons switch to filling in the crossings already waiting, oldest
  first, which is correct because runners cross in order.
- **Projected finish.** Races are 5K, so the header shows what the current pace
  projects to at the finish. Linear, to the second, because the number gets said
  out loud to a runner.
- **A refresh loses nothing.** Every tap is on disk before the button springs
  back. Reloading restores the race, the roster, and every crossing in order.
- **Stop takes two taps**, because an accidental stop mid race is the worst
  thing this app could do to a volunteer. Resuming undoes it.
- **Clear everything.** At the bottom of the setup screen, with the counts it
  would destroy spelled out and two taps to confirm. Handy while building, and
  the only way to hand the phone on clean.
- **No backend.** Static site, all state on the device, exports leave by way of
  the share sheet.
- **Works with no signal.** Fully offline once loaded, which matters at the two
  mile mark of a rural course.

See [DESIGN.md](DESIGN.md) for the reasoning, the tradeoffs, and the known
limitations.

## Privacy

Athlete rosters are never committed to this repository. Roster data travels in
the URL fragment of a shared link, which browsers do not send to the server, so
the names of minors never reach a web server log or a CDN cache.

The school's logo file is also not committed. This app uses the school colors
and the Patriots name and ships its own stopwatch mark rather than
redistributing school artwork from a public repo.

## Develop

```sh
npm install
npm run dev
```

```sh
npm run build    # type check and build
npm run lint
npm test         # clock, storage, and distance math, via node --test
npm run preview  # serve the production build at /splitssss/
```

Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`.

Do not deploy on a meet morning.

## Icons

Source SVGs live in `assets/`. Regenerate the PNGs after editing them:

```sh
magick -background none assets/icon.svg -resize 192x192 public/pwa-192.png
magick -background none assets/icon.svg -resize 512x512 public/pwa-512.png
magick -background none assets/icon-maskable.svg -resize 512x512 public/pwa-maskable-512.png
magick -background '#1d507b' assets/icon.svg -resize 180x180 -flatten -alpha off public/apple-touch-icon.png
cp assets/icon.svg public/favicon.svg
```
