/**
 * Encrypts a roster so it can be committed and published with the app.
 *
 *   npm run roster-encrypt -- roster.txt
 *
 * One runner per line, bib numbers optional and stripped. Writes
 * public/roster.enc, which is ciphertext and is meant to be committed. The names
 * file is not: roster*.txt is gitignored, and it should stay off this machine's
 * repo entirely if you can help it.
 *
 * The passphrase is prompted for, not passed as an argument, so it stays out of
 * shell history and out of the process list. Set SPLITS_PASSPHRASE instead if you
 * are scripting this. It is never written anywhere. Text it to whoever is timing,
 * in a separate message from the link.
 *
 * Losing the passphrase costs nothing but a re-encrypt. Leaking it means the
 * published file is readable, including the copies already in git history, so
 * rotating it means a new passphrase *and* a new file.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { parseRoster } from '../src/lib/roster.ts'
import { isVault, ITERATIONS, openRoster, sealRoster, VAULT_FILE } from '../src/lib/vault.ts'

const OUT = `public/${VAULT_FILE}`

/**
 * A weak passphrase makes the whole exercise theater, because the file it
 * protects is public and can be attacked offline for years. Four random words is
 * easy to text and far past anything worth grinding for a JV roster.
 */
const MIN_LENGTH = 16

/**
 * Turns the terminal's own echo off and on, which is how a shell hides a
 * password. Doing it at the driver rather than in readline is the only version
 * that reliably hides the *first* character typed.
 */
function setEcho(on: boolean): boolean {
  try {
    execFileSync('stty', [on ? 'echo' : '-echo'], { stdio: ['inherit', 'ignore', 'ignore'] })
    return true
  } catch {
    return false
  }
}

/**
 * Asks for the passphrase twice, hidden. Null means Ctrl+C or Ctrl+D, which is a
 * cancel and not a passphrase. One readline interface serves both questions, so
 * no keystroke can land between two of them.
 */
async function askTwice(): Promise<[string, string] | null> {
  const hidden = setEcho(false)
  if (!hidden) {
    console.error('Could not turn off the terminal echo, so your typing will be visible.')
  }
  const restore = () => {
    if (hidden) setEcho(true)
  }
  // With echo off and no raw mode the driver still delivers Ctrl+C, so this only
  // has to make sure the terminal is not left mute for the next command.
  process.on('SIGINT', () => {
    restore()
    console.error('\nCancelled. Nothing was written.')
    process.exit(1)
  })

  const rl = createInterface({ input: process.stdin })
  const ask = (prompt: string) =>
    new Promise<string | null>((resolve) => {
      process.stderr.write(prompt)
      let answered = false
      rl.once('line', (line) => {
        answered = true
        // The newline the user typed was swallowed with the echo.
        process.stderr.write('\n')
        resolve(line)
      })
      rl.once('close', () => {
        if (!answered) resolve(null)
      })
    })

  try {
    const first = await ask('Season passphrase: ')
    if (first === null) return null
    const second = await ask('Again: ')
    return second === null ? null : [first, second]
  } finally {
    rl.close()
    restore()
  }
}

const file = process.argv[2]
if (!file) {
  console.error('Usage: npm run roster-encrypt -- roster.txt')
  process.exit(1)
}

const athletes = parseRoster(readFileSync(file, 'utf8'))
if (athletes.length === 0) {
  console.error(`No names found in ${file}. One runner per line.`)
  process.exit(1)
}

const plural = athletes.length === 1 ? 'runner' : 'runners'
console.error(`${athletes.length} ${plural}:`)
console.error(athletes.map((a) => `  ${a.name}`).join('\n'))
console.error('')

let passphrase = process.env.SPLITS_PASSPHRASE ?? ''
if (passphrase === '') {
  if (!process.stdin.isTTY) {
    console.error('No terminal to prompt on. Set SPLITS_PASSPHRASE instead.')
    process.exit(1)
  }
  const typed = await askTwice()
  if (typed === null) {
    console.error('Cancelled. Nothing was written.')
    process.exit(1)
  }
  if (typed[0] !== typed[1]) {
    console.error('Those did not match. Nothing was written.')
    process.exit(1)
  }
  passphrase = typed[0]
}

if (passphrase.length < MIN_LENGTH) {
  console.error(
    `That passphrase is ${passphrase.length} characters. This file will be public\n` +
      `forever, so it needs at least ${MIN_LENGTH}. Four random words is the easy answer.`,
  )
  process.exit(1)
}

const vault = await sealRoster(athletes, passphrase)
writeFileSync(OUT, `${JSON.stringify(vault, null, 2)}\n`)

// Read the file back and open it with the same passphrase, so a bad write or a
// format mistake is caught here rather than by a volunteer at the starting line.
const written: unknown = JSON.parse(readFileSync(OUT, 'utf8'))
const check = isVault(written) ? await openRoster(written, passphrase) : null
if (check?.map((a) => a.name).join('\n') !== athletes.map((a) => a.name).join('\n')) {
  console.error(`${OUT} did not open back to the same list. Do not publish it.`)
  process.exit(1)
}

console.error(`Wrote ${OUT}, ${athletes.length} ${plural}, ${ITERATIONS.toLocaleString()} rounds.`)
console.error('Read it back and opened it. The names match.')
console.error('')
console.error(`Commit ${OUT}. Do not commit ${file}.`)
console.error('Text the passphrase separately. The app asks for it once per phone.')
