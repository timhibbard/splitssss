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

### Naming during the race, without bookkeeping

A name button does one of two things, and the screen says which:

- Crossings are waiting to be named, so the tap names the **oldest** one.
- Nothing is waiting, so the tap records a crossing and names it at once.

Oldest first is correct with no extra state, because runners cross a point in
order. Naming them in the order they were tapped therefore matches the order
they passed. That one rule covers both modes of use: a coach who recognizes
every girl names as they go, and a volunteer who does not tap the big button
and fills names in afterward. Same buttons, no separate assign screen, and no
way to get out of sync.

A named athlete stays visible in the grid, struck through, rather than being
removed. Removing it would reflow the grid under a thumb already on its way
down to the next name.

### Every screen has a way out

The first version put the roster behind a plain button low on the setup screen,
and the capture screen had no way back at all. Since the app restores the race
in progress on load, a returning user landed on the clock and could not reach
setup or the roster from there. Two lessons, both now built in:

- The roster is set up once, so it belongs above the per race fields, not below
  them. It is a bordered panel with a count, not a button in a stack of buttons.
- The capture screen carries quiet Setup and Add names links under the race
  actions. Leaving is free, because taps are already on disk and the race stays
  the active one, so these are safe to hit by accident. That is why they are
  small and grey rather than styled like Stop.

Opening setup mid race puts "Back to timing" at the top, and the race in
progress is left out of the "Earlier today" list so it appears in exactly one
place.

### The roster follows the race that is running

The race stores a snapshot of the roster, so editing the team in November
cannot rewrite a race run in September. The exception is the race being timed
right now: adding a girl at the starting line has to put her on the grid without
restarting anything, so an edit is merged into the active race.

The merge lets the roster win, except that anyone already holding a crossing
stays on the race even if she is removed from the roster. A recorded time must
never lose the name attached to it. That rule lives in `lib/roster.ts` with
tests, rather than inline in a component, because it fails silently.

### Clear everything

Unrecoverable, on purpose, because nothing is ever sent anywhere and there is no
copy to restore from. So the button says what it will destroy in counts ("2
races, 34 crossings and 20 runners"), asks twice like Stop does, disarms itself
after four seconds, and disables when there is nothing to erase.

It matches on the `ss.` prefix rather than the current schema version, so an
older build's leftovers go with it, and it leaves keys it does not own alone. It
lives at the bottom of the setup screen, below a rule, where nothing shares an
edge with a button used on race day.

### Projected finish

Every race this team runs is a 5K, so there is no distance picker. The distance
still travels on the stored race and in the CSV rather than being assumed by
whatever reads the export, so a file says what it was measured against and a
future non 5K could not silently reinterpret old data.

The header carries the running clock and, under it, the finish time this pace
projects to. The projection is linear: `elapsed * (raceMeters / stationMeters)`.

Riegel's exponent would model fade more accurately, but this number gets read
off a phone mid race and said out loud to a teenager. "If you hold this pace"
is a thing a coach can explain and an athlete can act on. A decay exponent is
not. The projection is shown to the second, never to tenths, because pretending
otherwise would be false precision on top of an estimate.

It needs both a station distance and a race distance, so a custom split point
entered without a distance shows the clock and no projection rather than a
wrong number.

### Stop takes two taps

The stop button sits inches from a target being hit repeatedly under pressure,
and an accidental stop mid race is the worst thing this app could do to a
volunteer. So the first tap arms it and the second confirms, and the armed
state expires after four seconds. Stopping freezes the clock and moves to the
export screen. It is also reversible: resuming clears the stop, so a mis-tap
is not fatal.

### A refresh loses nothing

Every tap is already on disk before its event handler returns, and the id of
the race being timed is stored too, so a reload restores the race, the roster,
and every crossing in order. The only thing that changes is which clock is
authoritative.

`performance.timeOrigin` resets on reload, so monotonic readings from the new
page share no reference frame with the ones taken before it. Elapsed time
therefore falls back to the wall clock across a refresh, which is accurate to
the millisecond and only vulnerable to a clock correction landing inside the
race. Within one page session, monotonic time is preferred and such a
correction is ignored entirely. Both paths are covered by tests.

### A runner is a name, not a number

There are no bib numbers anywhere in the data model. A coach standing at 2K
knows the team by face, and a number is one more thing to read wrong at speed.
A pasted meet entry list usually carries numbers anyway, so a leading or
trailing number on a line is stripped on import rather than stored. Pasting a
list unmodified beats hand editing twenty eight lines.

### Roster travels in the URL fragment

There is no backend. The coach texts a link whose fragment carries the roster.
The texted link *is* the data transfer.

Two reasons this is the right call and not just the lazy one:

1. No accounts, no database, no server, nothing to run or pay for.
2. A URL fragment is never sent to the server, so the names of minors never
   touch a web server log or a CDN cache. The published site is public
   regardless of repository visibility.

**Plaintext names are never committed to this repository.** The encrypted form
below is the one exception, and it is ciphertext.

The payload is base64url of the same one-runner-per-line text a coach would
paste, so a link and a paste decode through identical code and there is one
format to get right rather than two. Base64 is not secrecy. It keeps a list of
names out of a message preview and survives clients that would otherwise mangle
spaces, commas, and accents. A twenty eight name roster makes a link of about
600 characters, which texts fine and leaves room for a QR code later.

Three rules the implementation follows:

- The fragment is read once at module load and stripped from the address bar
  immediately, so a refresh does not re-prompt and the names do not sit in a
  visible URL.
- Nothing is imported without a choice. The link opens the roster screen with
  "Use this list instead" and "Add to mine", because a volunteer who typed a few
  names by hand should not silently lose them.
- A truncated or hand-edited link imports nothing rather than half a name.

Athlete ids are minted fresh on import, since an id only means anything on the
device that made it.

One caveat worth stating in the UI, because it will otherwise waste somebody's
morning: on iOS a site added to the home screen keeps storage separate from
Safari. Open the link in the same place you intend to time.

### The encrypted roster, and what a public repo can and cannot keep

The link works, but it has to be re-sent, and a coach who wants the team already
in the app on any phone asked the obvious question: can the names be secret in
the repo and still load on the page?

Only one way, and it is worth being exact about why.

The repo has to be public for free GitHub Pages, and the published site is public
regardless. Anything the page can read without a human supplying something,
anyone can read: a base64 file, an obscure filename, a key shipped in the
JavaScript. Those are speed bumps. Worse, they read as protection, and git
history keeps the file after it is deleted.

So the only real option is a passphrase that never enters the repo:

```
public/roster.enc     AES-256-GCM ciphertext, committed
passphrase            in the coach's head, texted separately, never written here
```

`npm run roster-encrypt -- roster.txt` seals the same one-runner-per-line text a
paste or a link would carry, then reads the file back and opens it before saying
it worked. The app fetches the file at startup, and the roster screen offers an
unlock. Decryption is in the browser, so the passphrase never leaves the phone,
and the decrypted names persist locally, which makes this once per phone rather
than once per race. A wrong passphrase and a tampered file both fail, since GCM
authenticates: no version of this ever decrypts to the wrong names.

Choices worth defending:

- **PBKDF2-SHA256 at 1,200,000 rounds**, twice OWASP's 2023 floor. The count is
  stored in the file, so it can rise later without stranding a published roster.
  It measures at a fraction of a second, paid once per device, and the ciphertext
  is public forever, so the rounds are cheap here and expensive for anyone
  guessing offline. A count above four million is rejected rather than attempted,
  so a corrupt file cannot hang a phone at the starting line.
- **The encrypt tool refuses a passphrase under sixteen characters.** The file it
  protects can be attacked offline for years. Four random words is easy to text
  and far past anything worth grinding for a JV roster.
- **Unlocking routes through the same prompt a link does.** Both channels stage
  the names and ask before touching what is on the phone, so a volunteer who
  typed a few by hand does not lose them.
- **No published roster means no prompt.** A fresh clone has no `roster.enc`, the
  fetch 404s, and the feature is simply invisible. A 404 page, an offline phone
  and a malformed file all read as absent rather than as an error.
- **The file is precached** with the rest of the build, so an unlock works with no
  signal, and its revision is a content hash, so re-publishing a roster reaches
  every phone on the next load.

What this does not do: it does not make the names secret from anyone holding the
passphrase, and it does not unpublish the ciphertext already in git history.
Rotating means a new passphrase and a new file. Plaintext names still never get
committed, which is the rule the gitignore enforces.

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
ss.v2.tap.<raceId>.<seq>     one tap, seq zero padded so keys sort in order
ss.v2.active                 id of the race being timed
ss.v2.roster                 the team, per device, not per race
```

Reads are defensive per key: an unreadable tap is skipped and logged rather
than thrown, so a partial write costs one crossing and not the race.

IndexedDB is the migration path if the data model ever outgrows this.

### Tests

`npm test` runs Node's built in test runner directly against the TypeScript,
no build step and no test framework. Coverage is deliberately narrow: the clock,
the storage layer, the distance math, and the two ways a roster arrives, which
are the places a bug is silent and unrecoverable. A wrong pixel is visible on
race day. A wrong split is not.

The storage tests install a synchronous in memory `localStorage` before
importing the module, which is a faithful stand in precisely because the
durability claim rests on `setItem` being synchronous. They cover the refresh
path, out of order and past ten sequence numbers, corrupt records, and races
not leaking taps into each other.

The vault tests assert the claim the whole feature rests on: that no name appears
anywhere in the published file, that a wrong passphrase and a tampered file both
yield nothing rather than a plausible wrong list, and that a missing or malformed
file reads as no prompt rather than as an error.

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

1. **Capture** (done). Setup, big tap button, undo, gun time, stop, CSV export.
2. **Name** (done). Roster on the device, name buttons that record or assign
   depending on what is pending, oldest crossing first.
3. **Share** (roster links and the encrypted published roster done). A QR code
   next, and a link that also carries
   the meet and the split point so a volunteer opens straight into position.
4. **Records.** Long format export, stable split distances per course, season
   over season comparison.
