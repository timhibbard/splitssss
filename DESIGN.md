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

### A name tap records a time. It never fills in an old one

Tapping a name records a crossing **at that moment** and names it. Tapping a row
in the running list names **that** crossing. Two gestures, two jobs, and neither
one can be mistaken for the other.

The first version made a name tap fill in the oldest crossing that was still
waiting, on the reasoning that runners cross in order, so naming them in tap
order matches the order they passed. That is true, and it was still wrong. The
two modes mix in practice: a volunteer taps the big button for a runner they
cannot place, then taps a name for the next runner they can. Under the old rule
that second tap silently attached a time from thirty seconds ago to a runner who
was standing right there. A wrong split on a real runner is the one failure this
app must not have, and nothing on screen would have contradicted it.

So the oldest-first rule is gone. What replaces it costs one extra tap, on the
crossing itself, and it is the tap that says which crossing you mean.

A named athlete stays visible in the grid, struck through and not tappable,
rather than being removed. Removing it would reflow the grid under a thumb
already on its way down to the next name.

An athlete holds at most one crossing per race, so naming that athlete on a
second one takes the name off the first and leaves that crossing unnamed and
waiting. That is what makes a mix up fixable: two names tapped in the wrong order
are two more taps to correct, and no crossing is ever counted twice. The rule lives in
`lib/splits.ts` as a function that returns only the crossings that changed, and
it is tested, because a misattributed split is a silent failure.

### A tap and the start of a scroll look identical, so the name grid waits

The big button fires on `pointerdown`, because waiting for the finger to lift
adds real latency to a gesture whose whole purpose is recording a moment. The
name buttons started out doing the same thing, and it was a bug: twenty eight
names do not fit on a phone, so the grid scrolls, and dragging it means putting a
finger on a name first. Every scroll recorded a crossing for whichever runner the
thumb happened to land on. Worse than a lost tap, it is a fabricated split with a
real name on it.

The fix keeps the accuracy and drops the guess. The name buttons take the time on
the way **down** and hold it. If the finger lifts without travelling, that held
time is what gets recorded, so a tap is timed exactly as it was before. If the
finger travels more than ten pixels, or the browser cancels the gesture to scroll
with it, the held time is thrown away and nothing is recorded. Ten pixels is
about where browsers themselves decide a touch is a pan.

The big button keeps firing on `pointerdown` and is deliberately different:
nothing scrolls under it, so there is no gesture to tell apart, and its crossing
is on disk before the finger is off the glass. That is the button a volunteer
hits under pressure, and it should be the one with nothing between the tap and
the write.

Move and cancel are handled on the grid rather than on each of the buttons, since
a touch keeps sending its events to the element it started on and they bubble.
Keyboard and assistive activation arrive as a click with no pointer events behind
it, which is handled separately, and a click that follows a real press is ignored
so a crossing cannot be recorded twice.

The slop rule is a pure function in `lib/gesture.ts` with its own tests. The rest
was verified by driving a real DOM: a drag over a name records nothing, a lifted
press records at the landing moment even when the finger is held down for a
quarter second, and a mouse drag's trailing click does not sneak through.

### The running list

The capture screen shows every crossing as it happens: place, split, who it was,
and the finish that split projects to. Decisions inside it:

- **Named and unnamed crossings are one list, interlaced in crossing order.**
  They happened in one order and separating them would lose it. An unnamed row is
  not an error state, it is a row waiting for a name.
- **Newest first.** The crossing that just landed is the one being checked, and
  it should never need a scroll. Chronological order would push it out of view
  after eight runners.
- **Tapping a row opens a picker for that crossing,** over the screen rather than
  beside it, because until the row has a name nothing else on the screen matters.
  It offers only the runners with no crossing here yet, in roster order, so the
  list shrinks as the race goes on and the last few are easy to hit. Everything
  cancels: the backdrop, a Cancel button, or Escape.
- **The crossing being named is held as an id** and looked up again every render,
  so an undo cannot leave the picker pointing at a crossing that no longer
  exists.
- **A name can also be typed.** Another school's runner, or one who never made
  the list, gets a name rather than a blank row. The name joins this race only,
  not the team list, because a course is not where the coach's list gets edited. A
  typed name that matches someone already on the race reuses that runner instead
  of making a twin on the grid. The field is in the picker and never focused on its
  own, so a keyboard cannot cover the course mid race.
- **A name can come back off,** keeping the time, because the crossing was real
  even when the name was a guess.
- **The projection is per row,** not just for the clock in the header, since the
  number a coach says out loud is that runner's, not the leader's.
- With no gun time the list shows time of day and no projection. The times are
  still real and the gun can be set later.

### The panes are shares, not contents

Everything under the header on the capture screen is a share of what the header,
the crossings line, and the two rows of buttons leave over. The name grid takes
two parts and the running list takes one, and neither is sized by what is inside
it: whatever a volunteer taps gets twice the room of what they read.

That is a fix rather than a preference. The grid used to be the only pane with a
floor of zero while the list grew to fit its rows, so five crossings into a race
the list had taken the middle of the screen and the names were a scrollbar's
width tall. On a 375 by 556 phone the grid measured zero. The buttons a volunteer
came to tap were gone, and Stop and Export were on their way off the bottom.

Fixed shares fix a second thing at the same time. A pane whose size does not
depend on how many crossings are recorded does not move, so the name a thumb is
travelling towards is in the same place after the tap that just landed as it was
before it.

The ratio is picked against a target: three rows of name buttons on a 390 by 664
phone, which is a varsity seven with nothing to scroll. The unnamed crossing
button gives up its share to get there, becoming a fixed 13vh band once a roster
is loaded rather than a hero button. Neither pane gets a floor in pixels, on
purpose. A floor plus the fixed chrome can add up to more than a short viewport,
and then the footer goes off screen, which is the complaint this started as.

Measured in Chrome at real device metrics rather than eyeballed. At 390 by 664
the grid is 209px and a seven runner lineup is 209px tall, and the geometry is
identical at one crossing, five, and nine. At 375 by 556 both panes shrink and
both scroll, and Stop, Export, Setup and "Who is running" are all still on
screen.

### Every screen has a way out

The first version put the roster behind a plain button low on the setup screen,
and the capture screen had no way back at all. Since the app restores the race
in progress on load, a returning user landed on the clock and could not reach
setup or the roster from there. Two lessons, both now built in:

- The roster has to be reachable from wherever you are, not only from the screen
  that happens to be first.
- The capture screen carries quiet Setup and "Who is running" links under the
  race actions. Leaving is free, because taps are already on disk and the race stays
  the active one, so these are safe to hit by accident. That is why they are
  small and grey rather than styled like Stop.

Opening setup mid race puts "Back to timing" at the top, and the race in
progress is left out of the "Earlier today" list so it appears in exactly one
place.

### Earlier meets are reachable

The setup screen used to list only today's races. A race nobody exported before
the date changed was then the one thing on the phone with no copy anywhere else,
with no way to open it and no way to send it. The only thing that ever removed it
was Clear all races.

So races from before today get their own list, with the day and the meet on each
one and ", never stopped" where that applies. It is folded behind a link by
default: reaching last Saturday's race is a real need and a rare one, and by
November the list is long enough to bury the race being set up now.

Opening one makes it the race this phone points at, which is what makes the
button at the top of setup describe a stopped race rather than claim to be timing
it: "Back to JV Girls at Mile 1, stopped".

### Editing the team list is a link, not a panel

For a while the roster was a bordered panel above the race fields, on the theory
that it is the one thing a new user has to find. Shipping the team with the app
retired that theory. The names are already there, so on a normal phone editing
the list is a once a season job sitting on top of the screen a volunteer uses
every race.

So it is a plain underlined link at the bottom, below Start timing and above Start
over, and it says what it would open: "Edit the 28 runners on this phone". That
label is also the answer to the only question the old panel really answered, which
is whether the names made it onto this phone. The lineup panel still sits with the
race, because who is running changes every race and that is the opposite kind of
setting.

The loud panel is not gone, it is conditional. A phone with nobody on it, meaning
a wipe, a browser that dropped its storage, or a clone with no team file, still
gets the bordered panel with "Add runners" or "Load them", because then it is the
only thing on the screen worth doing. Quiet by default, loud when it is the task.

Underlined and grey, but still a real button with 44px of height. Looking
secondary is not a reason to be hard to hit.

### A button says a first name and an initial

Twenty eight full names do not fit on a phone, and a volunteer picking a runner
out of a field of a hundred does not read a surname to know who is coming. So a
button says "Caroline K." A three word name keeps the first two words as the
first name, because "Mary Eliza D." is what the team calls out and "Mary E." is
somebody else.

Two buttons that read the same would be a split on the wrong runner, so a clash
costs letters until it is gone: Emma R. and Emma R. become Emma Ri. and Emma Ro.
Only the clashing pair grows, and the comparison ignores a trailing dot, so
"Ella Hu" and "Ella Hu." are treated as the same label rather than as two
buttons that differ by a speck of punctuation. Twenty letters in, two people
genuinely share a name and both get it in full.

Short labels are for the grid, the running list and the picker. Full names go to
storage, to the export, to every `aria-label`, and to the lineup screen, where a
coach is deciding and a surname is part of deciding. The rules are pure
functions in `lib/names.ts` with tests, because a wrong label is a wrong split.

### The team list is on the device, the lineup is on the race

Two different lists. The team is everyone on the phone, edited once. A lineup is
who is in one race, and it is what the grid shows: seven buttons for a varsity
race, not twenty eight.

Who is running is chosen on its own screen, reachable from setup before the race
and from the capture screen during it, because a late scratch or a runner moved
up is a fact of a meet morning and should not cost a restart. Top 7, Everyone
else, Everyone and Nobody are one tap each, and the list is drawn in team order
with a rule under the seventh name, so the order the coach typed carries the
seeding. A race whose name contains "JV" defaults to everyone below the seven,
one containing "varsity" to the top seven, anything else to everyone. Defaults
only: the tap wins, and `lib/lineup.ts` holds the rules with tests.

A chosen lineup is remembered under the race name, so next Saturday's varsity
race opens with the seven picked for this one rather than with the top of the
list again. The key is a slug of the name, so "Varsity Girls" and " varsity
girls " are the same lineup. Never chosen reads as `null` rather than as an empty
list, because picking nobody is a choice and has to survive a reload.

Editing the team mid race merges into the race being timed, so a name added at
the starting line appears on the grid without restarting anything. The merge
respects the lineup: a runner deliberately left out of this race does not come
back because the team list was touched. Anyone holding a crossing stays whatever
either list says, and cannot be removed by the lineup screen either, because a
recorded time must never lose its name. That rule lives in `lib/roster.ts` with
tests, rather than inline in a component, because it fails silently.

### Clear all races, and not the runners

This button used to wipe everything, including the team list, on the theory that
"start over" should mean start over. Two things made that wrong.

The names are the part with no copy on the phone to rebuild from, and they are the
part somebody had to get onto it in the first place. Races are what accumulates:
last Saturday's meet is clutter by Tuesday, while the twenty eight runners are
the same twenty eight runners all season. So the button clears races, crossings
and the pointer at the race being timed, and touches nothing else. The team list,
the lineups remembered under each race name, and the record of which shipped list
this phone has seen all stay.

A runner leaves the team list one at a time, from the roster screen, which is
where a change to the team belongs. There is still no per race delete: a screen
that can erase a morning's crossings one tap at a time is worse than one that
cannot erase them at all.

The times are still unrecoverable, because nothing is ever sent anywhere, so the
panel says what it will destroy in counts ("2 races and 34 crossings"), says to
export first, asks twice like Stop does, disarms itself after four seconds, and
disables when there are no races. It also says plainly that the runners stay,
because a coach who learned the old behavior should not have to test the button to
find out it changed.

Race and tap keys are matched by shape, `ss.<version>.race.` and
`ss.<version>.tap.`, rather than by the current schema version, so an older
build's races go too while a key this app does not own is never touched. It lives
at the bottom of the setup screen, below a rule, where nothing shares an edge with
a button used on race day.

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
export screen.

It is reversible, and how it is reversed matters. Undoing a stop used to be a
side effect of opening a race from "Earlier today", which meant looking at the
morning's first race to fix a name or send the CSV again started its clock
running from a stop that had happened an hour ago. The frozen split times on
screen were suddenly moving, and the race that was finished was live.

So opening a race only opens it. A stopped race opens stopped, with the clock
frozen where it stopped, the big button reading STOPPED and refusing to record.
The way back to timing is a "Keep timing" button in Stop's place on that screen.
One tap, no confirm, because unlike Stop it destroys nothing: the crossings are
untouched and Stop is right there again. Names can still be tapped in and fixed on
a stopped race, which is most of why anyone opens one.

The "Earlier today" list says which kind each race is, "stopped" or "still
timing", so what a tap will do is readable before making it.

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

### Only today's race is still being timed

Restoring the race in progress is right within a meet and wrong across meets. A
volunteer who never tapped Stop leaves a race active forever, so opening the app
at the next meet landed on the last one, with an hour on its clock, and the first
crossings of the morning went into it.

So a stored race is restored only if its date is today. The race itself is not
touched and it is still there to export under earlier meets. It just stops being
the race this phone is timing, and the pointer to it is cleared rather than left,
because nothing else would clear it and a stale pointer would keep offering to go
back to last Saturday.

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

### The team list that ships with the app

The link works and the vault works, and both still ask something of a human. The
coach asked for the case where nobody does anything: hand a parent a phone ten
minutes before the gun, they open the app, and the names are on it.

That request settles the tradeoff by itself. A list the page reads with nothing
typed is a list anyone can read, because the way to read it has to ship in the
JavaScript. There is no arrangement of files and keys that changes this. So the
choice is not how to hide the file, it is what goes in it.

What goes in it is the short label a button already says:

```
public/team.dat    "Caroline K.", scrambled, committed
```

First name and an initial, never a surname. That is what a meet program prints
next to a time anyway, and what a spectator hears called across a field. Full
names still cost a link or a passphrase, and plaintext still never gets
committed.

`npm run team-file -- roster.txt` writes it, through the same `shortNames` the
buttons use, so what it writes is what a volunteer reads. The scramble is a
deterministic XOR keystream with the key in the source. Naming it honestly
matters: it is obfuscation. What it buys is real but small. The names are not
plaintext in a public repo, not indexed by a search engine, and not readable by
someone glancing at the file listing. What it does not buy is confidentiality
from anyone who spends a minute on it, and the tool says so on every run.

Because output is deterministic, a rebuild with no roster change is not a diff.

Adopting it is where the care goes, since a file that arrives on its own can
destroy work nobody asked it to touch:

- **Silent only when there is nothing to lose.** An empty phone, or one still
  holding exactly the list this build replaces. Automatic is the whole point, and
  a phone that took the last list clearly wants this one.
- **Anything else gets the prompt a shared link gets.** A hand edited list, or the
  coach's phone holding full names, is not the app's to overwrite.
- **`ss.v2.shipped` records what this phone has seen**, so a rebuild that changes
  no name never asks twice, and a dismissed list stays dismissed.
- **A dismissed list is still reachable.** The roster screen keeps a quiet button
  for it, so "Not now" is not "never".
- **A pending shared link wins.** That is a decision already in progress.
- **Never mid race.** A volunteer watching the course does not get pulled off the
  clock by a roster that can wait.
- **A header and a footer sentinel**, so a half finished download is rejected
  rather than read as a short team ending in half a name.
- **No file means no feature.** A fresh clone has no `team.dat`; the fetch 404s
  and nothing appears. It is precached like the rest of the build, so it lands
  with no signal.

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
ss.v2.lineup.<raceName>      who ran a race by that name last time
ss.v2.shipped                the shipped list this phone has already been offered
```

Reads are defensive per key: an unreadable tap is skipped and logged rather
than thrown, so a partial write costs one crossing and not the race.

IndexedDB is the migration path if the data model ever outgrows this.

### Tests

`npm test` runs Node's built in test runner directly against the TypeScript,
no build step and no test framework. Coverage is deliberately narrow: the clock,
the storage layer, the distance math, the naming rules behind the running list,
the short labels, the lineup defaults, and the three ways a roster arrives, which
are the places a bug is silent and unrecoverable. A wrong pixel is visible on
race day. A wrong split is not.

The split tests cover the pieces of the running list that could lose a name
without saying so: which clock each row is measured against, a station with no
distance, a crossing pointing at an athlete who has since been deleted, and
naming a runner onto a second crossing freeing the first.

The name tests cover what a button says: a three word first name, a surname
shorter than the letters asked for, and a clash growing only for the pair that
clashes. The lineup tests cover the defaults and the promise underneath them,
that a runner left out of a race stays out when the team list is edited and a
runner holding a time is never dropped.

The gesture tests cover the line between a tap and a scroll: a still finger, a
wobble, a drag on either axis, and a diagonal that trips the threshold without
either axis doing it alone.

The storage tests install a synchronous in memory `localStorage` before
importing the module, which is a faithful stand in precisely because the
durability claim rests on `setItem` being synchronous. They cover the refresh
path, out of order and past ten sequence numbers, corrupt records, and races
not leaking taps into each other.

The vault tests assert the claim the whole feature rests on: that no name appears
anywhere in the published file, that a wrong passphrase and a tampered file both
yield nothing rather than a plausible wrong list, and that a missing or malformed
file reads as no prompt rather than as an error.

The team file tests hold it to the one thing it does claim, that no name is
readable in it, including with the spaces taken out, and to the failure that
would be worst: every truncation point of a good file is rejected, so a partial
download cannot become a short list ending in half a name. They also pin the
determinism a clean rebuild depends on, and that a missing file, a tampered file
and garbage all read as no shipped team.

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
- Timing other teams. The list is our team only, about 20 in a JV race.
- Finish line timing, ever. The meet provides it.
- Central result collection. Volunteers text exports to the coach.

## Roadmap

1. **Capture** (done). Setup, big tap button, undo, gun time, stop, CSV export.
2. **Name** (done). Roster on the device, name buttons that record a crossing as
   each runner passes, and a running list where any crossing can be named or
   renamed.
3. **Share** (roster links and the encrypted published roster done). A QR code
   next, and a link that also carries
   the meet and the split point so a volunteer opens straight into position.
4. **Records.** Long format export, stable split distances per course, season
   over season comparison.
