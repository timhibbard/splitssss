# Splitssss

**Splits, Saved, Sorted, Sent.**

Hand timing for cross country splits, for the J.L. Mann Academy Patriots boys and
girls cross country teams. A volunteer stands at a course marker, taps a big
button as each of our runners passes, attaches names afterward, and texts the
coach a CSV.

Live at **https://timhibbard.github.io/splitssss/**

## Why it works the way it does

- **Tap now, name later.** A tap records a time and claims the next place
  number. Nothing else is needed in the moment. Runners cross a point in order,
  so finish order is free information.
- **Split points are distances.** Presets for the four points this team stands
  at — 0.5 mi, Mile 1, Mile 2 and 2.6 mi, the last being roughly 800 to go, where
  the athlete is told to start speeding up — plus a custom distance in meters,
  kilometers, or miles. The distance is
  stored so pace per mile can be computed. There is no finish line station,
  because the meet already provides finish times.
- **A split taker can move mid race.** Tapping the marker name at the top moves
  the phone to another marker with the same gun and clock. Earlier splits stay in
  the list under their own marker, and the one CSV has a row per crossing, each
  with the station it was taken at and its place there.
- **The gun time is optional.** Every tap stores an absolute time of day, so
  elapsed times are computed later by subtracting the gun time. A volunteer at
  Mile 2 who cannot hear the start does not need to know when the race began.
- **The team is already on the phone.** The build ships the team list, as the
  short labels the buttons say, so a parent handed a phone ten minutes before the
  gun opens the app and finds the names on it. Nothing to open, nothing to type.
  A list somebody edited by hand is never overwritten: that gets asked about.
- **Both teams, one phone.** Every phone holds the boys and the girls, so either
  coach's race can be covered by whoever is standing at the marker. Race setup
  asks which team before anything else and the grid shows that team only, and every
  phone opens on the same pair, Varsity Girls, so a dozen of them handed out at a
  meet all say the same thing and either chip is one tap. In the
  roster text a line reading `# Boys` or `# Girls` puts the runners under it on
  that team, so a paste, a link and the shipped file all carry it the same way. A
  list with no such line is untagged and shows in either race, which is how a
  phone that predates the change keeps working.
- **The roster travels by link.** The coach taps "Send this list to a volunteer"
  and texts a link that loads all the names, and their PRs, in one tap.
  The names ride in the URL fragment, which browsers never send to a server, so
  they reach no log or cache. The recipient gets a prompt, not a silent
  overwrite. This is the only channel that carries full names, and it is the only
  one that needs a person to do anything.
- **Names go on during the race or after.** The team list is already on the
  phone, and it changes by rebuilding the app rather than by anyone editing it at a
  course. Tapping a name records that runner's crossing at that moment, and the
  big button records anyone you cannot name. A name tap never fills in an older
  crossing, because that would put a stale time on a runner standing in front of
  you.
- **A button says a first name and an initial.** "Rowan H." fits a phone, and a
  three word name keeps the first two words, so "Anna Grace F." is what the team
  calls out. If two labels would read the same they grow a letter until they do
  not: Rowan Ha. and Rowan He. Full names go to the export and to screen readers.
- **Pick who is running.** A race is one team's lineup, not the whole phone.
  Nothing works out who is varsity: the team list says, because coach sets it per
  meet, so Varsity Girls opens with the runners marked varsity this week however
  fast they are. Choose it before the race or change it mid race, with Varsity, JV,
  Everyone and Nobody one tap each. A list that says nothing falls back to the
  coach's order — the top of it for varsity, the rest for JV, and all of it for the
  boys, whose list is the varsity squad. The choice is remembered under the race
  name, so next week's race opens with who you picked, and "Varsity Boys" and
  "Varsity Girls" remember their own. Anyone who already has a time cannot be
  taken out.
- **A Refresh next to the build date.** Added to the home screen there is no pull
  to refresh, and everything is precached, so a stale phone cannot get itself
  current. Refresh looks for a newer build, takes it if there is one, and reloads
  either way. Nothing is lost: the races and times are on the phone, not in the
  screen.
- **Scrolling the names records nothing.** The grid of names scrolls, so a name
  button holds the time from the moment your finger lands and only records it if
  the finger lifts without dragging. A tap is timed to the instant it landed. A
  scroll is a scroll.
- **Recorded runners get out of the way.** A name you have tapped is struck
  through where it stands, then falls to the back of the grid three seconds after
  the last crossing, so the runners still out on the course stay together at the
  top. Every crossing restarts those three seconds, because a pack is several taps
  in a row and nothing should move under your thumb mid burst. An undo brings a
  name back to its place at once.
- **A running list of every tap.** Named and unnamed crossings sit together in
  crossing order, newest at the top, each with its split and its projected 5K.
  Tap any row to name it, or to fix a name: the picker offers the runners who
  have no crossing there yet, or type in a runner nobody has a button for.
- **Projected finish.** Races are 5K, so the header shows what the current pace
  projects to at the finish, and every row in the list carries its own. Linear,
  to the second, because the number gets said out loud to a runner.
- **Every runner's PR is on their button.** Put a 5K PR after a name
  when you paste the list, "Rowan Hayes 21:34.60", and the button shows it. Then
  every crossing says where that pace stands against that runner's own PR,
  `+0:12` behind or `-0:08` ahead, in the list and in the export. A runner with
  no PR simply has none, and a race that is not a 5K gets no comparison
  rather than a wrong one.
- **A refresh loses nothing.** Every tap is on disk before the button springs
  back. Reloading restores the race, the roster, and every crossing in order.
- **Stop takes two taps**, because an accidental stop mid race is the worst
  thing this app could do to a volunteer. "Keep timing" undoes it.
- **Looking at a race does not restart it.** A stopped race under "Earlier today"
  opens frozen, so you can fix a name or send the CSV again without its clock
  running. Undoing a stop is its own button.
- **The buttons stay put.** The name grid and the running list each hold a fixed
  share of the screen, so nine crossings look like two, and the list never grows
  over the names or pushes Stop and Export off the bottom.
- **A new meet starts fresh.** A race from an earlier day is never picked back up
  as the one you are timing, even if nobody ever tapped Stop on it.
- **Earlier meets are still there.** Anything from a previous day is one tap away
  under "Earlier meets", with the day and the meet on it, so a race nobody
  exported is not stranded by the date changing.
- **Clear all races.** At the bottom of the home screen, with the counts it would
  destroy spelled out and two taps to confirm. It clears races and crossings only.
  The runners stay, since a race is the part of this with no copy anywhere, while
  the names come back with the next build of the app.
- **The instructions are in the app.** "How this works, and the questions people
  ask" at the top of the home screen: the workflow as four short lists, from
  installing it on the phone through sending the CSV, then the questions a
  volunteer actually has, with an answer each. It is offline like everything else,
  so it is readable standing at the marker.
- **The help page can be texted.** It has an address of its own, `/help/`, and a
  button on it that shares the link. A parent who taps that link lands on the
  instructions, with the app and the names one Back away, so a text message is the
  whole briefing. The old `#help` still resolves, because it was texted to parents
  before the page had a path and those messages are not going anywhere.
- **Results, once a meet has been reconciled.** Two pages per team per season.
  `/meets/2026/girls/` is for the runners: pick your name and get your most recent
  race, with a Race picker for the other meets you ran — your finish against your
  PR, your miles, both ends of the race as times and then as paces beside your
  average, and every mark with the time it was taken at. Numbers only; what a race
  meant is the coach's to say. `/meets/2026/girls/coach/` is the spreadsheet for
  whichever meet is picked, every derived column for each race in it, with what is
  measured and what is calculated spelled out at the bottom. Two addresses on
  purpose, because only the first one should ever be texted to a team. The boys
  have the same pair, `/meets/2026/boys/` and its `coach/`, which say there are no
  results yet until the boys' first meet is published. The Yellow Jacket addresses
  texted out before seasons existed, `/meets/2026/yellow-jacket/` and its `coach/`,
  still open on that race and always will. Neither page is reachable from the
  timing screens.
- **Real paths, on a host with no routing.** The build writes an actual `index.html`
  at every address, so a texted link is a 200 and a real link preview rather than a
  404 the app recovers from. The season is in the path because the same
  invitational comes back every September, and a link sent out last year should not
  start showing this year's splits.
- **No backend.** Static site, all state on the device, exports leave by way of
  the share sheet.
- **Works with no signal.** Fully offline once loaded, which matters at the two
  mile mark of a rural course.

See [DESIGN.md](DESIGN.md) for the reasoning, the tradeoffs, and the known
limitations.

## Privacy

Plaintext athlete names are never committed to this repository. A full name
travels exactly one way: in the fragment of a shared link, which browsers do not
send to the server, so the names of minors never reach a web server log or a CDN
cache.

`public/team.dat` is committed, and it is the one file in the repo that carries
anything about a runner. It holds first names and an initial with a 5K PR after
each, "Rowan H. 21:34.60", scrambled. Scrambled is not encrypted: the app reads
it with nothing typed, so the way to read it ships in the JavaScript and anyone
who wants the list can have it. That is the trade for the names being there
automatically, and it is why the file holds no surnames. The times are in it for
the same reason: a PR that has to be sent to a volunteer never reaches the
one at the two mile mark, and a 5K PR is already published next to a full name
on the meet's own results page. See DESIGN.md.

`public/meets/<year>/<team>/<meet>.dat`, such as
`public/meets/2026/girls/yellow-jacket.dat`, is one meet's reconciled results for one
team and follows the same rule: short labels, no surnames, scrambled rather than
encrypted, with its own key so it can never be confused for the team file. The
older `public/meets/2026/yellow-jacket.dat` is the same meet in the first format,
and stays because published data is never removed. Its source, the full-name spreadsheet paste under
`meets/`, is gitignored like `roster.txt`, along with `docs/`, where the notes from
reconciling a meet by hand quote real rows while the work is going on. The splits are
not published anywhere else, which is why they travel attached to a first name and an
initial.

There is no season passphrase and no encrypted roster. There used to be an
AES-GCM `public/roster.enc` for publishing full names with the app; it is gone,
because first name plus last initial is what the buttons and the export say, so
nothing on a volunteer's phone needed a full name badly enough to be worth a
secret. DESIGN.md keeps the reasoning.

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
npm test         # clock, storage, roster, link, addresses, team file, meet file, distance, split, gesture, name, and lineup logic, via node --test
npm run preview  # serve the production build at /splitssss/
```

Ship the teams with the app, so every phone opens with the names on it and the
right lineup already picked. One runner per line in `roster.txt`, with that
runner's 5K PR after the name if there is one and the race they are in this week
after that, under a heading per team:

```
# Girls
Marlowe Holloway   21:34.60   Varsity
Rowan Hayes        22:29.15   JV

# Boys
Jordan Blake       17:12.40
Quinn Delgado      18:05.00
```

The race is what changes every week, and it is a decision rather than a
computation: nobody is put in the varsity race by being fast. Give the runners in
whatever order suits you — PR order reads best — and mark the race; a runner marked
neither is on the team and in no race, which is what a scratch looks like. A team
whose lines say nothing, which is the boys, falls back to the coach's order: the
top of it for varsity and the rest for JV.

One file for both teams, because one person keeps the times. A file with no
headings still works and ships everyone untagged.

```sh
npm run team-file -- roster.txt     # writes public/team.dat, prints the list in order
git add public/team.dat             # short labels and PRs, scrambled, meant to be committed
```

Re-run it before each meet, once the lineup is set, and after adding a runner,
after somebody sets a PR, or after a runner changes teams. Output is
deterministic, so a rebuild with no change is not a diff.
A phone that already took the last list takes the new one on its own; a phone with
a hand edited list gets asked. Short labels are worked out within each team, since
the two never race at once, so a girls "Avery L." and a boys "Avery L." both keep
the label the team actually calls out.

Generate a roster link from a file of names, without the names touching git. This
is how full names reach a phone, and the only way they do:

```sh
npm run roster-link roster.txt     # roster*.txt is gitignored
pbpaste | npm run roster-link
```

Publish a meet's results, once they have been reconciled against the meet's own
finish times and every station has been put on one gun. One source file per meet
per team, named for the meet with `-girls` or `-boys` on the end:

```sh
npm run meet-file -- meets/yellow-jacket-girls.txt  # /meets/ is gitignored
git add public/meets/2026/girls/yellow-jacket.dat   # short labels, scrambled, meant to be committed
```

The source opens with `# meet`, `# date` and `# team` lines, then one block per
race: `# event Varsity` (or JV), `# marks 0.5mi 1mi 2mi 2.6mi` for the markers that
race actually had, `# distance 4000` if it was not a 5K, and one runner per line,
tab separated, full names, a cell per mark, the finish, and that runner's 5K PR from
*before* this meet. A dash in a mark is the volunteer there missing that runner; a
dash for the finish is a DNF, which publishes with the marks that were timed and
nothing derived, and the tool names who it was. A trailing `~` marks a value
calculated from the marks either side of it rather than timed, and the coach page
keeps saying so. A row with the wrong number of cells for its race's marks is
refused with its line number, and nothing is written. Nothing derived is stored —
every split, net, pace and whole mile is computed at render time, so a hand-edited
cell can never disagree with the page.

The tool prints the whole derived table on the way out; check it against the sheet
before committing. It also compares the runners with the meets already published
that season and lists anyone new, anyone missing, and any pair that might be one
runner whose label changed ("Same runner?"), since that is how a season is joined
up.

The file is half of publishing a meet. The other half is a line in `PUBLISHED` in
`src/lib/pages.ts`, which is what puts the meet on its season's pages and makes the
build write a real page for that season — the tool prints the line to add, and the
addresses it will be at. The year comes off the meet's own date line, the team off
its team line, and the meet's name in the path off the input file's name without its
suffix, so the address and the data file are derived from the source rather than
typed twice. A suffix that disagrees with the team line is refused.

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
