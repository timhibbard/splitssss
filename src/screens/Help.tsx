/**
 * What to do with this phone, in the order it gets done, and then the questions
 * people actually ask.
 *
 * It exists because the answer to most of them is a sentence and the person who
 * needs it is standing on a course with nobody to ask. A volunteer handed a phone
 * ten minutes before the gun cannot be trained, and a coach cannot brief twelve
 * parents twice a week, so this is the thing to point at: "check the help page".
 *
 * Read on a phone, in sun, possibly while a race is starting, so it is short
 * lines and no cleverness. Every example name here is invented, like everywhere
 * else in this repository.
 */

type Step = {
  /** The action, in the words that are actually on the button or the label. */
  act: string
  /** What it does, or why it is there at all. */
  note: string
}

/**
 * The workflow as three jobs rather than one list, because they belong to
 * different people on different days: the coach sets the phones up once, whoever
 * is holding one sets up a race, and then there is a race on.
 */
const WORKFLOW: { title: string; lead?: string; steps: Step[] }[] = [
  {
    title: 'Once, before the season',
    lead: 'The coach does this. A volunteer never has to.',
    steps: [
      {
        act: 'Open the app.',
        note: 'The team list comes with it, so the names are already on the phone. The link near the bottom of the home screen says how many, and that is how you check.',
      },
      {
        act: 'Add it to the home screen.',
        note: 'Do it at home, not at the course. Everything the app needs is stored on the phone the first time it loads, and after that it works with no signal at all.',
      },
      {
        act: 'Send this list to a volunteer.',
        note: 'On the runners screen. Texts a link that loads every name and best time in one tap. Only needed for a phone that should show full names: a phone that just opens the app already has first names and initials.',
      },
    ],
  },
  {
    title: 'Before each race',
    lead: 'Top to bottom on the home screen. It takes about twenty seconds.',
    steps: [
      { act: 'Meet.', note: 'Already filled in. Change it when the season moves on.' },
      {
        act: 'Which team.',
        note: 'This decides every name on the grid, so it is worth the one tap even though the race name below says it too.',
      },
      {
        act: 'Which race.',
        note: 'Varsity or JV. Other lets you type a name, for an open race or a time trial.',
      },
      {
        act: 'Choose.',
        note: 'Who is running. It fills itself in: whoever ran the last race by this name, or the usual lineup the first time that name is used. Change it here or at the starting line.',
      },
      {
        act: 'How far into the 5K are you.',
        note: 'The marker you are standing at, not where the race ends. One phone per marker, and several phones can time the same race at different points.',
      },
      { act: 'Your name.', note: 'So coach knows whose times these are.' },
      { act: 'Start timing.', note: 'That is it. You do not need to know when the race started.' },
    ],
  },
  {
    title: 'During the race',
    steps: [
      {
        act: 'Tap the name as that runner passes you.',
        note: 'The time recorded is the instant your finger landed, not when it lifted. The name is struck through afterwards and drops to the back of the grid, so the runners still coming stay together at the top.',
      },
      {
        act: 'Tap the big button for anyone you cannot name.',
        note: 'It records the crossing with no name on it. The time is what matters and the name can wait until the race is over.',
      },
      {
        act: 'Tap a row in the list to name it.',
        note: 'Pick from the runners who have not come past yet, or type a name for somebody who is not on the list. The same row is how you change a name or take one off.',
      },
      {
        act: 'Gun, if you can see the start.',
        note: 'Optional. Tap it when the starter fires and every crossing shows time since the gun, plus a projected 5K. Without it each crossing keeps the time of day, which coach can line up against the other markers afterwards.',
      },
      { act: 'Undo.', note: 'Removes the most recent crossing. Nothing else.' },
    ],
  },
  {
    title: 'When the race is over',
    steps: [
      {
        act: 'Stop, twice.',
        note: 'It asks again on purpose. The button sits inches from one you have been hitting under pressure.',
      },
      {
        act: 'Share.',
        note: 'Sends the CSV, usually as a text to coach. Copy and Save CSV are there for a phone that will not share a file.',
      },
      {
        act: 'Time another race.',
        note: 'The race you just sent stays on this phone under "Earlier today", so you can open it again and send it again.',
      },
    ],
  },
]

/**
 * The questions, in roughly the order they come up: the ones asked mid race
 * first, the ones asked afterwards last. Every answer is one or two sentences,
 * because a longer one will not be read standing up.
 */
const FAQ: { q: string; a: string }[] = [
  {
    q: 'Do I need to know when the race started?',
    a: 'No. Every tap keeps the time of day, so a coach can line your marker up with the others later. The Gun button is there if you happen to see the start, and it is the only thing it changes.',
  },
  {
    q: 'Somebody went past and I could not tell who it was.',
    a: 'Tap the big button. That records the time with no name, and you put the name on afterwards by tapping the row in the list.',
  },
  {
    q: 'I tapped the wrong name.',
    a: 'Tap that row in the list and pick the right runner, or use "Remove the name" to leave the time with nobody on it. Undo is different: it deletes the whole crossing, most recent first.',
  },
  {
    q: 'A name I tapped moved somewhere else.',
    a: 'That is meant to happen. A runner who has a time here is struck through and falls to the back of the grid three seconds after the last crossing, so the names still worth tapping stay under your thumb. An undo puts the name straight back where it was.',
  },
  {
    q: 'Why can I not tap a name twice?',
    a: 'A runner passes one point once. If you really did record the wrong person, fix it from their row in the list.',
  },
  {
    q: 'I scrolled the names and nothing got recorded. Is it broken?',
    a: 'No, that is the point. A name only records if your finger lifts without dragging, so scrolling past twenty eight names cannot record a crossing for whoever you touched on the way. A scroll is a scroll.',
  },
  {
    q: 'There is no signal at the two mile mark.',
    a: 'It all works with no signal. The app, the names and the best times are stored on the phone, nothing is ever sent to a server, and nothing here needs the internet until you send the CSV at the end.',
  },
  {
    q: 'The phone locked, or the screen reloaded. Did I lose my taps?',
    a: 'No. Every crossing is written to the phone before the screen even updates, so a lock, a reload, a low battery warning or a dropped phone cannot cost you a time. Open the app again and the race is where you left it.',
  },
  {
    q: 'What is the small number under the name on a button?',
    a: 'That runner\'s 5K best. It is the number a volunteer wants at the moment somebody comes into view, and it is the number the runner already knows.',
  },
  {
    q: 'What do the last two columns in the list mean?',
    a: 'The first is the 5K that split works out to at that pace. The second is the gap to that runner\'s own best: minus is ahead of their best pace, plus is behind it.',
  },
  {
    q: 'A runner from another school came past, or somebody who is not on the list.',
    a: 'Tap the big button, then tap that row and type the name. It joins this race only, not the team list, so the coach\'s list is never edited from a course.',
  },
  {
    q: 'Why does the grid only show one team?',
    a: 'Because the two teams never run at once, and a boys race showing twenty eight girls is a list nobody can find a name in. Which team is the first thing you set on the home screen.',
  },
  {
    q: 'Why do the buttons say "Rowan H." instead of the whole name?',
    a: 'A first name and an initial fits a button you have to hit while looking at a course, and nobody needs a surname to know who is coming. The export carries full names.',
  },
  {
    q: 'Can two of us time the same race?',
    a: 'Yes, and that is the normal way to use this. One phone per marker, each with its own runner list and its own name in "Your name", and each one sends its own CSV.',
  },
  {
    q: 'Should somebody stand at the finish?',
    a: 'No. The meet\'s own timing gives you the finish for free. This app is for the points along the way that nobody else records.',
  },
  {
    q: 'I hit Stop by mistake.',
    a: 'Tap "Keep timing". The clock picks back up and every crossing you already recorded is untouched.',
  },
  {
    q: 'Can I look at a race from earlier without breaking it?',
    a: 'Yes. Opening a stopped race shows it frozen where it stopped, so going back to fix a name or send the CSV again cannot set a finished race running.',
  },
  {
    q: 'The meet is over and I forgot to send one.',
    a: 'It is still on the phone. Today\'s races are under "Earlier today" on the home screen, and older ones are behind the "Show races from before today" link under it.',
  },
  {
    q: 'What does "Clear all races" erase?',
    a: 'The races and crossings on this phone, and nothing else. The team list stays. Nothing is ever sent anywhere, so an unsent race that gets cleared is gone: send it first.',
  },
  {
    q: 'What is the date at the very bottom?',
    a: 'When this version of the app was built. If two phones seem to behave differently, that is the first thing to compare.',
  },
]

type Props = {
  onBack: () => void
}

export function Help({ onBack }: Props) {
  return (
    <div className="screen help">
      <header className="bar">
        <button type="button" className="back" onClick={onBack}>
          Back
        </button>
        <div className="bar-where">
          <strong>How this works</strong>
          <span>Workflow, then questions</span>
        </div>
      </header>

      <p className="instructions">
        You are recording when each of our runners passes one point on the course,
        so the coach can see how the race was actually run. Tap a name as that
        runner goes by. Everything else on this page is detail.
      </p>

      {WORKFLOW.map((block) => (
        <section key={block.title} className="help-block">
          <h2>{block.title}</h2>
          {block.lead && <p className="hint">{block.lead}</p>}
          <ol className="help-steps">
            {block.steps.map((step) => (
              <li key={step.act}>
                <strong>{step.act}</strong> {step.note}
              </li>
            ))}
          </ol>
        </section>
      ))}

      <section className="help-block">
        <h2>Questions</h2>
        {FAQ.map((item) => (
          <div key={item.q} className="faq">
            <h3>{item.q}</h3>
            <p>{item.a}</p>
          </div>
        ))}
      </section>

      {/*
        The way out is the header, but this screen is long enough that scrolling
        back up to it is a chore, so there is a second one at the bottom where the
        reading ends.
      */}
      <button type="button" className="help-back" onClick={onBack}>
        Back to the race
      </button>
    </div>
  )
}
