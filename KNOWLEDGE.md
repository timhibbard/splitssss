# What we learned: the 2026 cross country season

Everything this season taught about running splitssss week to week: setting up a
meet, getting times off the phones, putting them right, publishing, and the
coach's standing rules. It's written so next season, or track, starts from what
we know instead of what we have to rediscover.

The how-it-works lives in [DESIGN.md](DESIGN.md) and [README.md](README.md). This
file covers how it gets used. The detailed meet-by-meet reconciliation log is
`docs/results-import-notes.md`. It stays out of the repo, like the rest of
`docs/`, because it quotes full rows.

Athletes are named here the way the app shows them, first name and last initial.

---

## The weekly cycle

### 1. Setting up a meet

The coach sends some or all of: the MileSplit meet link, the course map, the
lineup (who runs Varsity, JV or neither), the race plans, and a new PR and
season best list.

1. **Ask for the new PR list** if it didn't come with the setup. The coach's list
   beats MileSplit. MileSplit fills in anyone the list doesn't cover.
2. **Team list.** Edit the gitignored `roster.txt`: name, tab, PR, tab,
   `Varsity`/`JV`/nothing. The tag is this week's race. Never infer it from times.
   Keep the girls sorted fastest *season best* first, because that's the button
   order on the phones. Leave the boys' order as it is. Then
   `npm run team-file -- roster.txt`.
3. **Bests.** Rewrite `bests-girls-<year>.txt` (Athlete, PR, SB) from the coach's
   list, then `npm run bests-file -- bests-girls-2026.txt girls 2026`. Season
   bests come from the coach, never from the meet files.
4. **Meet file.** Write `meets/<slug>-girls.txt` (gitignored) with `# meet`,
   `# date`, `# team`, one `# event` block per race, `# marks 0.5mi 1mi 2mi 2.6mi`,
   and one row per runner (name, tabs for marks, best before this meet). Add the
   plan lines:
   - `# plan Name<TAB>0.5<TAB>1<TAB>2<TAB>2.6<TAB>finish` (times to hit)
   - `# stretchplan Name<TAB>p1<TAB>p2<TAB>p3<TAB>t1<TAB>t2<TAB>t3` (first 800,
     middle 2.1 and last 800, each as a pace and a time)

   Then `npm run meet-file -- meets/<slug>-girls.txt`. Check its tables against
   the sheet before committing.
5. **Pages.** Add the meet to `PUBLISHED` in `src/lib/pages.ts`, with `milesplit`
   and, once there's a map, `course`. The map is a JPEG in `public/courses/<year>/`
   about 1,000 to 1,100 px wide and under about 350 KB, because every phone
   downloads it with the app.
6. **Phones.** Set Setup's default meet name (`useState('<name>')` in
   `src/screens/Setup.tsx`) to the meet, and set the default race (`raceKind`) to
   whatever's run. Plans on the name buttons only appear when the phone's meet name
   matches the published one.
7. **Map open before the race.** The `<details>` in `src/screens/MeetLinks.tsx`
   is set to `open` for race week and collapsed again once results are up. It's one
   setting for every meet.
8. **Ship** (see below). Volunteers have to tap Refresh to get a new build.

**A meet with no JV race:** take every `JV` tag off `roster.txt` and Setup offers
only Varsity. Keep a copy of the tags first. This season's is in
`meets/roster-before-state-quals.txt`.

**Boys:** the phones get the boys' lineup and PRs, and that's all. Boys' results
never go on the site: no boys meet files, pages or bests. Boys' splits go to the
coach as a CSV or text.

### 2. Plans

- Paces go on the page **exactly as the sheet gives them**. Never work out a plan
  pace or time.
- **From State on, the times to hit are rounded:** 0.5 mi and 1 mi *up* to the
  second, 2 mi and 2.6 mi *up* to the next even second, and the finish *down* to
  the second. Whole-second plan times display as `m:ss` (`formatPlanned`). The
  plan's per-stretch *time* column is gone from the card and the athlete page,
  so only paces show. Apply the rounding to new sheets and say so.
- The coach's sheet has a row for the coach himself. Leave it out.
- **Race plan cards.** The athlete page has a "Race plan card" link before the
  race (`#name=…&meet=…&card`). The coach page has "Race plan cards" for every
  meet with plans, before and after, printing four to a letter sheet. For a
  printed sheet with full names, a one-off HTML file in `~/Downloads/race-cards/`
  works. It needs a 0.35 in page margin, because the coach's HP printer can't
  print to the edge and a no-margin page lost its top row.

### 3. Race day: what comes back

Each phone exports a summary and a CSV with `clock_time`, `iso_time`,
`elapsed_from_gun`, `gun_iso` and `session`. Volunteers add notes like "switched
Haiden and Harper" or "I changed MyAngel to Nasly". **Those notes are data.**
Apply them before anything else.

### 4. Results for the coach's spreadsheet

- **Order:** the coach's 28 girls, alphabetical by first name. If he pastes a list,
  his list wins.
- **Format:** one `.txt` per mark (0.5 mi, 1 mi, 2 mi, 2.6 mi, finish), plus an
  all-columns `.tsv`, opened in TextEdit.
  - One time per line, in that order.
  - **A runner with no time gets a single space, never an empty line.** An empty
    line collapses on paste and shifts every row below it.
  - Close and reopen the file in TextEdit after changing it, so he never pastes a
    stale copy.
- Finish times come from MileSplit (see Data sources). Splits come from the
  phones, put right as described in the next section.

### 5. Publishing results

Fill in the marks and finish in the meet file. Use `-` for a missing mark and drop
the row for anyone who didn't run.
- **Weather:** `npm run weather -- <station> <date> <gun>...`, then paste the
  `# station` and `# reading` lines and a `# gun` per event.
- **Note how the times were reconciled:** in the meet file's comments, and as a
  short `reconciled` note on the coach page via `pages.ts`.
- **Build:** rebuild the meet file and check it against the coach's breakdown
  sheet. Mile 3 is interpolated evenly by the app and won't match his sheet. That
  was his choice, so don't raise it.
- **Clean up:** collapse the map.
- **Ship.**

### Shipping

Branch, then run `npx tsc -b`, `npm run -s lint`, `node --test` and
`npm run -s build`, then preview in Playwright when the change is visible. Then
open the PR, merge it, wait for **that commit's** deploy run, and confirm the live
file matches.
- **Which run to watch:** `gh run list --commit <sha>`. The newest run in the list
  can still be the previous merge's.
- **Live checks:** GitHub Pages can serve the old file for a few seconds, so retry
  the comparison with a cache-busting query.
- **Standing permission:** merge and deploy every PR without asking, unless the
  coach says hold.

---

## Data sources

- **MileSplit meet page:** `sc.milesplit.com/meets/<id>-<slug>`. Its JSON-LD has
  the date and venue. `/info` sometimes has the race schedule.
- **Results, three shapes:**
  1. **Formatted** (`/results/<set>/formatted?...`) loads by JavaScript and is
     often empty for days.
  2. **Completed / raw** (`/results/<set>/raw`) has the data in a `<pre>` block and
     can be read with curl. Each race can be its own result set, listed in the
     page's result-set dropdown.
  3. **Live results** (`milesplit.live/meets/<id>/events/<n>/results/F/F`) is a
     JavaScript app, so it needs a headless browser with an ~8 s wait. It has
     **Finish, Mile 1 and Mile 2** views to click for chip-timed meets (County,
     State). Rows run place, name, `Team - #bib`, time. Disqualified runners appear
     at the bottom marked `DQ`. Some rows have a "Mile 1" time equal to the finish
     time where the mat missed the runner. Treat a split later than half the
     finish as missing.
- **Team scores** weren't posted for State. Standings worked out with standard
  scoring (complete teams of 5 or more, top five score, 6th and 7th push others
  down) are unofficial and should be labeled that way.
- **PRs:** the team roster page `sc.milesplit.com/teams/1154-jl-mann/roster`
  (JSON-LD has each athlete's URL), then `<athlete url>/stats`, *XC* block, *5K* row.
  - **Only count a meet's time if it's a PR.**
  - **Starlight doesn't count:** it was a short course, and the coach left it out
    of PRs. MileSplit still lists Starlight PRs.
  - **Full result lists** on athlete pages are behind the paywall. Get times from
    the meet results instead.
- **Name mismatches on MileSplit, every meet:** Libby B. is listed as "Elizabeth
  Barron", Mary Eliza D. as "Mary Duncan" and Sasha C. as "Sasha Codorn". Match
  within the team first, then by close name, and report each fuzzy match.
- **Weather stations used:** KGSP (Greer), KGMU (Greenville Downtown), KLUX
  (Clinton), KJZI (Johns Island), KGYH (Fountain Inn), KEOE (Newberry), KAIK
  (Aiken).

**Tools:** `/tmp` gets cleared between sessions. The headless browser setup
(`playwright-core` and short scripts) lives in `~/.cache/splitssss-tools/`. Use
`/opt/homebrew/bin/node` (v26). The default `/usr/local/bin/node` (v19) is too old
to run `npm run weather` and the Playwright scripts.

---

## Putting the phones' times right

Every phone starts its own gun, and the guns disagree by up to about 6 s.
Volunteers mis-tap. Fixing that was most of the work this season.

1. **Pick one reference gun.** At first it was the coach's phone. Once a volunteer
   stood at the start line, the coach chose that phone's gun ("she will have the
   best start time because she was at the start line"). Say which gun was used.
2. **Rebase every other phone from its crossing clock times:** elapsed =
   `iso_time` − reference `gun_iso`, truncated to tenths. Don't add an offset to
   already-rounded elapsed times. When a phone only sent its summary, shift its
   elapsed times by the gun difference.
3. **Apply volunteers' notes** (name swaps, a stand-in name used for a different
   runner).
4. **Two phones at one mark:** average them per runner. If they disagree on who
   was ahead, ask the coach. Averaging puts both runners at the same time, and the
   coach may say one was ahead. If so, average each phone's earlier tap for the
   runner who was ahead and their later taps for the other.
5. **Video beats taps for order.** The coach's video gives the order and the gaps
   ("4 feet behind", "half a stride"). In a bunch, the **first tap** is the real
   crossing and later taps lag while the volunteer finds the next name. So anchor
   on the first tap and space the others by the video gap, about 0.3 s per 4 feet
   at 6:00 pace.
6. **Use the finish order.** If the coach says nobody changed places after a
   mark, the order at that mark is the finish order. Runners who finished
   together were together at the mark, so a late tap is lag and not a gap.
7. **Check against the other marks.** A runner's time from 2 mi to 2.6 mi is about
   the same share of her time from 2 mi to the finish across a whole race: 54–55%
   at County, 53% at State. A decoded or doubtful time that breaks the pattern is
   suspect. Times worked out from the pattern are **estimates**: label them, or
   leave the cell blank if the coach says so.
8. **Flag, never auto-reject.** A breakout PR looks exactly like bad data. Show
   both readings, then ask or leave it blank.

### The touch-offset failure (County varsity 2.6 mi)

The coach's iPhone, running from the home screen, drew the page about one row
lower than where it took touches. Every tap landed on the button below the one
aimed at, Back and Done included. The grid is three names wide on his phone, so
"one row down" meant three places later in the list.
- **Struck-through buttons ignore taps.** Once the wrong runners were struck, later
  taps landed on dead buttons and recorded nothing.
- **Decoding:** replay the grid tap by tap, including the reshuffle 3 s after the
  last tap, which moves recorded runners to the back. Each recorded name is the
  button below the aimed one, and the decoded times then fit the other marks.
- **Cause:** probably an iOS bug in home-screen web apps after waking or after the
  keyboard. Nobody else had it. The coach now times in a Safari tab. The recovery
  for anyone else is to close and reopen the app, since every tap is saved as it's
  made.
- **Note:** Safari and the home-screen app keep **separate storage** on iOS.

---

## The coach's standing rules

- He's the coach and the only builder. Anything in the app is written for the
  parent volunteer holding a phone.
- **No commentary.** Results pages show numbers and where they came from. What a
  race meant is his to say.
- **Labels, not data.** Changing how a number reads, such as "Last 0.5" for 0.507
  mi, never changes the arithmetic without asking.
- **Published meets and addresses are permanent.** Never delete or move a `.dat` or
  a page address, and keep old copies.
- The app shows first name and last initial everywhere. Full names are public on
  MileSplit, so they're fine in committed files, but displays stay short.
- The team list changes by rebuilding and deploying. There's no on-phone roster
  editing.
- Athletes see the planned finish only before their race. After results, the
  athlete page shows the plan per mark and per stretch, never the planned finish.
- Coach pages stay open. If they're ever gated, the plan is an SMS allowlist of
  numbers he approves, kept out of the repo. The boys' coach's phone number lives
  only in the GitHub secret `BOYS_COACH_PHONE`. Never write it anywhere.
- Publish summaries report only what he doesn't already know. Don't repeat back
  the fixes he made himself.

---

## The 2026 season

| Meet | Date | Where | Notes |
|---|---|---|---|
| Eye Opener | Sep 5 | | first meet |
| Yellow Jacket | Sep 12 | | first full reconciliation; the original handed-out link `meets/2026/yellow-jacket/` is permanent |
| Clinton Home Meet #1 | Sep 22 | Clinton | |
| Low Country | Sep 26 | Johns Island | |
| Fountain Inn | Sep 30 | Fountain Inn | five phones on one gun |
| Wendy's | Oct 3 | | |
| Jim Crawford | Oct 8 | | JV girls |
| Starlight | Oct 17 | Riverside HS, Greer | short course, not counted for PRs |
| Regions (Region 1-5A) | Oct 24 | Woodmont HS, Piedmont | |
| County (Greenville County) | Oct 31 | Greer HS | touch-offset failure at 2.6 mi; JV 0.5 mi matched to the Mile 1 order |
| State Quals (5A) | Nov 6 | The Farm at Newberry | varsity only |
| State (5A) | Nov 14 | Aiken Steeplechase | varsity only; official Mile 1, Mile 2 and finish |

**State, by standard scoring (unofficial):** the J.L. Mann boys won 5A with 74
points, scoring places 2, 14, 17, 20 and 23. Hudson K. ran 15:30.11, 2nd in the
race and the second-fastest boy in any class that day. The J.L. Mann girls were
10th. They gained 108 places in all from Mile 1 to the finish, the most of any
5A girls' team and tied for the most of any girls' team that day. Niamh N. ran a
PR of 19:31.10, 19th, and gained 28 places. Greenville County schools were 22% of
the runners in their eight races and took 32% of the top-15 places. The full
analysis is in the coach's `state-2026-analysis` CSVs.

---

## Open items for next season

- **Lost taps.** At County, a volunteer's phone first exported 9 Mile 1 crossings.
  A later export from the same session had only 1. Something dropped 8 recorded
  crossings around moving to Mile 2. **Not investigated yet.** Worth reproducing
  before the next season.
- **Grid reshuffle under a thumb.** Recorded runners move to the back 3 s after the
  last tap. Where runners are spread out, as late in a race, that can move a
  button just as a tap lands. Leaving struck names in place was offered and not
  taken up.
- **Touch offset** on the home-screen app. A scroll reset on `visibilitychange`,
  `pageshow` and `visualViewport` changes was offered and declined. The coach
  uses Safari.
- **Meet-file gotcha.** A comment line that starts `# marks…` or `# plan…` is read
  as a directive. Word notes differently.
- **Results import.** The manual pass works: fetch, match within team, the coach's
  order, single-space blanks, one file per mark. It's the spec for building results
  import into the app. See `docs/results-import-notes.md`.

## Track

Track season is next. Before the first meet, check what assumes cross country:
- **Race length:** every race is a 5,000 m race (`RACE_METERS`).
- **Phone marks:** the presets are 0.5 mi, 1 mi, 2 mi and 2.6 mi.
- **Pages:** the mile and stretch tables are built around the three-stretch 5K
  plan.
- **PRs:** they come from MileSplit's XC 5K row. Track has an event per distance.
- **Teams:** the team list is per season and per team.

Laps, multiple events per athlete and much shorter races will each need decisions.
The coach makes those, so ask rather than guess.
