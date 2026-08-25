/**
 * Prints a shareable roster link from a text file of names.
 *
 *   node tools/roster-link.ts roster.txt
 *   pbpaste | node tools/roster-link.ts
 *
 * One runner per line. A bib number on the line is stripped, so an entry list
 * can go in as it came out.
 *
 * The file is never committed: roster*.txt is gitignored, and the names end up
 * in the fragment of the link, which browsers do not send to a server. Uses the
 * same encoder the app does, so what this prints is exactly what Share produces.
 */
import { readFileSync } from 'node:fs'
import { encodeRoster } from '../src/lib/link.ts'
import { parseRoster } from '../src/lib/roster.ts'

const SITE = 'https://timhibbard.github.io/splitssss/'

const file = process.argv[2]
const text = readFileSync(file ?? 0, 'utf8')
const athletes = parseRoster(text)

if (athletes.length === 0) {
  console.error('No names found. One runner per line.')
  process.exit(1)
}

const url = `${SITE}#r=${encodeRoster(athletes)}`

console.error(`${athletes.length} runners, ${url.length} characters:`)
console.error(athletes.map((a) => `  ${a.name}`).join('\n'))
console.log(url)
