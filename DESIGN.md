# Splitssss

**Splits, Saved, Sorted, Sent.**

A hand timing app for cross country splits, for the J.L. Mann Academy Patriots
girls team. One person stands at a course marker, taps a big button as each of
our runners passes, attaches names afterward, and texts the coach a CSV.

## Branding

School colors, taken from the J.L. Mann site and confirmed against the logo
artwork:

| Token | Value | Source |
| --- | --- | --- |
| `--navy` | `#1d507b` | school stylesheet, exact match to the logo wordmark |
| `--sky` | `#3a90c3` | lighter blue in the logo |
| `--ink` | `#0b0a0f` | near black of the Patriot figure |
| `--bg` | `#fafafa` | logo background |

The school's logo file is deliberately **not** committed here. This repository is
public, so it uses the colors and the Patriots name and ships its own stopwatch
mark instead of redistributing school artwork.

One consequence worth recording: the tap confirmation flash uses `--sky` rather
than navy, because the tap button is navy and a navy flash behind a navy button
is invisible. The flash exists to be seen peripherally by someone watching the
course, so it has to be a large luminance change.

## Who uses it

Two different people, with very different needs:

- **The volunteer** (usually a parent) stands at Mile 1 or Mile 2 for ten
  minutes. They may not recognize the athletes. They get a texted link minutes
  before the race and will not read instructions. Their job is to tap
  accurately and export without help.
- **The coach** assembles texted CSVs from several volunteers into a season
  record used to help athletes understand their pacing.

The volunteer is the primary user. Every design tradeoff favors them.

## Core decisions

### Split points are distances, not a fixed list

Course markers are not reliably at whole miles. A station is therefore a label
plus a distance in meters, with presets for the common points (800m, Mile 1, 2K,
3K, Mile 2, 4K) and a custom entry that accepts meters, kilometers, or miles.

Storing meters rather than just a label is what makes pace per mile computable,
which is the number that actually helps an athlete understand their race.

Pace is reported to whole seconds. A hand timed split over a marker that was
probably paced off by a volunteer does not support more precision than that.

### No finish line station

The meet's own timing provides finish times, so stationing a volunteer there
would duplicate work we already get for free. Volunteers cover the intermediate
markers only.

### Capture first, identify later

A tap records a time and claims the next place number. Nothing else is required
at capture time. Names get attached later, from a roster, in a calmer moment.
Finish order is free information in cross country because runners cross a point
in order.

### Every tap stores both a wall clock time and a monotonic time

Each tap records:

- `wallMs`, from `Date.now()`, the absolute time of day.
- `monoMs`, from `performance.timeOrigin + performance.now()`, immune to the
  system clock being corrected mid race.

Wall clock is what makes devices comparable. Every iPhone is NTP synced to
within tens of milliseconds, which is an order of magnitude better than a human
thumb. So splits captured on three different phones merge with no pairing, no
shared session, and no clock sync handshake.

Monotonic time is what protects the intervals within one device. If NTP
corrects the clock by two seconds in the middle of a race, wall clock deltas
become wrong and monotonic deltas do not.

### The start button is optional

This falls out of storing wall clock times, and it is the single most valuable
property of the design.

The most likely field failure is a volunteer at Mile 2 who cannot hear the gun,
forgets to hit start, or hits it late. Because every tap carries an absolute
time of day, elapsed time is computed later by subtracting the gun time. The gun
time is one fact, captured once, from anywhere, correctable after the fact.
Nobody at a split point needs to know when the race started.

### Precision claims

Human reaction time on a tap is 150ms to 300ms and varies per tap. That dwarfs
any platform level clock jitter, so the honest position is: store
milliseconds, display tenths, never display hundredths. The app should not
imply precision the method does not have.

### Roster travels in the URL fragment

There is no backend. The coach generates a link containing the race setup and
roster, compressed into the URL fragment, and texts it. The texted link *is*
the data transfer.

Two reasons this is the right call and not just the lazy one:

1. No accounts, no database, no server, nothing to run or pay for.
2. A URL fragment is never sent to the server, so the names of minors never
   touch a web server log or a CDN cache. The published site is public
   regardless of repository visibility.

**The roster is never committed to this repository.**

### Storage: synchronous, one key per tap

A tap must never be lost, including when iOS discards the page one frame after
the tap.

`localStorage` is used rather than IndexedDB because it is *synchronous*: the
write is durable before the event handler returns. IndexedDB's advantages, size
and async access, are irrelevant at roughly 60 taps per device per meet.

Each tap is written to its own key, so a write never rewrites another tap's
data and a single failure loses one tap rather than the race.

```
ss.v2.race.<raceId>          race metadata
ss.v2.tap.<raceId>.<seq>     one tap
ss.v2.active                 id of the race being timed
```

IndexedDB is the migration path if the data model ever outgrows this.

### Install to the home screen

Safari can clear script writable storage for sites not visited in seven days.
That eviction does **not** apply to a PWA installed to the home screen. So
"Add to Home Screen" is what protects data between meets, not just a nicer
looking chrome. The install prompt has to be prominent.

## Known limitation: no haptics on iOS web

There is no vibration API in iOS Safari. `navigator.vibrate` works on Android
and does nothing on iPhone. Tap confirmation is therefore an audible click via
Web Audio plus a full screen visual flash, so a volunteer can confirm a tap
landed without looking at the phone.

This is a real cost of choosing the web. It was accepted because distribution
matters more: handing a parent a link beats an App Store install, and there is
no TestFlight or device provisioning in the parking lot five minutes before a
race.

## Hosting

GitHub Pages, currently at a subpath (`/splitssss/`), which constrains the Vite
`base`, the service worker scope, and the manifest `start_url` and `scope`. A
custom domain would move this to the root and remove that whole class of bug.

GitHub Pages has no rewrite rules, so there is no server side routing. The app
is a single page and all state arrives in the URL fragment, which sidesteps this
entirely.

### Race day update risk

Pages serves through a CDN with a short TTL, and the service worker adds a
second cache layer. The failure mode is a volunteer opening a stale build at the
starting line. Mitigations: hashed filenames, a service worker that activates
immediately, a visible version string in the UI, and a rule against deploying
on meet mornings.

## Not in scope

- Team scoring.
- Timing other teams. Roster is our girls only, about 20 in a JV race.
- Finish line timing, ever. The meet provides it.
- Central result collection. Volunteers text exports to the coach.

## Roadmap

1. **Capture** (in progress). Setup, big tap button, undo, gun time, CSV export.
2. **Assign.** Unassigned taps plus a grid of remaining athlete names. One
   crossing per athlete per station makes this a one to one match, so the grid
   shrinks toward zero and a leftover name signals a problem.
3. **Share.** Roster link generation, QR code, and an export that reads well
   pasted into Messages alongside a CSV attachment.
4. **Records.** Long format export, stable split distances per course, season
   over season comparison.
