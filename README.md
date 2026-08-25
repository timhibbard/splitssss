# Splitssss

**Splits, Saved, Sorted, Sent.**

Hand timing for cross country splits. A volunteer stands at a mile marker, taps
a big button as each of our runners passes, attaches names afterward, and texts
the coach a CSV.

Live at **https://timhibbard.github.io/splitssss/**

## Why it works the way it does

- **Tap now, name later.** A tap records a time and claims the next place
  number. Nothing else is needed in the moment. Runners cross a point in order,
  so finish order is free information.
- **The gun time is optional.** Every tap stores an absolute time of day, so
  elapsed times are computed later by subtracting the gun time. A volunteer at
  Mile 2 who cannot hear the start does not need to know when the race began.
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

## Develop

```sh
npm install
npm run dev
```

```sh
npm run build    # type check and build
npm run lint
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
magick -background '#ff4d17' assets/icon.svg -resize 180x180 -flatten -alpha off public/apple-touch-icon.png
cp assets/icon.svg public/favicon.svg
```
