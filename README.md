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
- **Split points are distances.** Presets for 800m, Mile 1, 2K, 3K, Mile 2 and
  4K, plus a custom distance in meters, kilometers, or miles. The distance is
  stored so pace per mile can be computed. There is no finish line station,
  because the meet already provides finish times.
- **The gun time is optional.** Every tap stores an absolute time of day, so
  elapsed times are computed later by subtracting the gun time. A volunteer at
  Mile 2 who cannot hear the start does not need to know when the race began.
- **The team is already on the phone.** The build ships the team list, as the
  short labels the buttons say, so a parent handed a phone ten minutes before the
  gun opens the app and finds the names on it. Nothing to open, nothing to type.
  A list somebody edited by hand is never overwritten: that gets asked about.
- **Both teams, one phone.** Every phone holds the boys and the girls, so either
  coach's race can be covered by whoever is standing at the marker. Race setup
  asks which team before anything else and the grid shows that team only. In the
  roster text a line reading `# Boys` or `# Girls` puts the runners under it on
  that team, so a paste, a link, the encrypted roster and the shipped file all
  carry it the same way. A list with no such line is untagged and shows in either
  race, which is how a phone that predates the change keeps working.
- **The roster travels by link.** The coach taps "Send this list to a volunteer"
  and texts a link that loads all the names, and their best times, in one tap.
  The names ride in the URL fragment, which browsers never send to a server, so
  they reach no log or cache. The recipient gets a prompt, not a silent
  overwrite.
- **Or the roster ships encrypted with the app.** `public/roster.enc` is
  AES-GCM ciphertext, so it can sit in a public repo. The app asks for the season
  passphrase once per phone, decrypts in the browser, and keeps the names
  locally. The passphrase is never in the repo, never in the URL, and never sent
  anywhere. Plaintext names are still never committed.
- **Names go on during the race or after.** The team list is already on the
  phone, editable from the link at the bottom of the home screen or from "Who is
  running" mid race. Tapping a name records that runner's crossing at that moment, and the
  big button records anyone you cannot name. A name tap never fills in an older
  crossing, because that would put a stale time on a runner standing in front of
  you.
- **A button says a first name and an initial.** "Rowan H." fits a phone, and a
  three word name keeps the first two words, so "Anna Grace F." is what the team
  calls out. If two labels would read the same they grow a letter until they do
  not: Rowan Ha. and Rowan He. Full names go to the export and to screen readers.
- **Pick who is running.** A varsity race is seven buttons, not one team's whole
  list and certainly not both teams'. Choose the lineup before the race or change
  it mid race, with Top 7, Everyone else, Everyone and Nobody one tap each. The
  choice is remembered under the race name, so next week's varsity race opens with
  the seven you picked, and "Varsity Boys" and "Varsity Girls" remember their own.
  Anyone who already has a time cannot be taken out.
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
- **Every runner's best time is on their button.** Put a 5K best after a name
  when you paste the list, "Rowan Hayes 21:34.60", and the button shows it. Then
  every crossing says where that pace stands against that runner's own best,
  `+0:12` behind or `-0:08` ahead, in the list and in the export. A runner with
  no best time simply has none, and a race that is not a 5K gets no comparison
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
  The runners stay, since they are the part with no copy on the phone to rebuild
  from. Take someone off the team from the roster screen instead.
- **No backend.** Static site, all state on the device, exports leave by way of
  the share sheet.
- **Works with no signal.** Fully offline once loaded, which matters at the two
  mile mark of a rural course.

See [DESIGN.md](DESIGN.md) for the reasoning, the tradeoffs, and the known
limitations.

## Privacy

Plaintext athlete names are never committed to this repository. They travel two
ways, and neither one puts a name on a server:

- In the fragment of a shared link, which browsers do not send to the server, so
  the names of minors never reach a web server log or a CDN cache.
- In `public/roster.enc`, encrypted with a passphrase that lives only in the
  coach's head and in a text message. This repo is public and the published site
  is public either way, so a committed roster is only as private as the
  passphrase over it. See DESIGN.md for what that does and does not protect.

`public/team.dat` is committed too, and it is the one file that carries anything
about a runner without a passphrase over it. It holds first names and an initial
with a 5K best after each, "Rowan H. 21:34.60", scrambled. Scrambled is not
encrypted: the app reads it with nothing typed, so the way to read it ships in
the JavaScript and anyone who wants the list can have it. That is the trade for
the names being there automatically, and it is why the file holds no surnames.
The times are in it for the same reason: a best time that only arrives with a
passphrase never reaches the volunteer holding the phone, and a 5K best is
already published next to a full name on the meet's own results page. See
DESIGN.md.

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
npm test         # clock, storage, roster, link, vault, team file, distance, split, gesture, name, and lineup logic, via node --test
npm run preview  # serve the production build at /splitssss/
```

Ship the teams with the app, so every phone opens with the names on it. One
runner per line in `roster.txt`, with that runner's 5K best after the name if
there is one, under a heading per team. Each team in its own PR order, since the
top seven of the order is that team's varsity:

```
# Girls
Marlowe Holloway   21:34.60
Rowan Hayes        22:29.15

# Boys
Jordan Blake       17:12.40
Quinn Delgado      18:05.00
```

One file for both teams, because one person keeps the times. A file with no
headings still works and ships everyone untagged.

```sh
npm run team-file -- roster.txt     # writes public/team.dat, prints the list in order
git add public/team.dat             # short labels and best times, scrambled, meant to be committed
```

Re-run it after adding a runner, after somebody sets a PR, or after a runner
changes teams. Output is deterministic, so a rebuild with no change is not a diff.
A phone that already took the last list takes the new one on its own; a phone with
a hand edited list gets asked. Short labels are worked out within each team, since
the two never race at once, so a girls "Avery L." and a boys "Avery L." both keep
the label the team actually calls out.

Generate a roster link from a file of names, without the names touching git:

```sh
npm run roster-link roster.txt     # roster*.txt is gitignored
pbpaste | npm run roster-link
```

Publish the roster with the app instead, encrypted:

```sh
npm run roster-encrypt -- roster.txt   # prompts for the passphrase, twice
git add public/roster.enc              # ciphertext, and the only roster file that gets committed
```

Run `npm run dev` first and unlock it on localhost to confirm the passphrase
before pushing. Re-running the tool re-encrypts the whole list, which is how a
runner gets added and how the passphrase gets rotated. Old ciphertext stays in
git history forever, so rotating means a new passphrase *and* a new file.

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
