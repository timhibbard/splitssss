/**
 * Prints a shareable roster link from a text file of names.
 *
 *   node tools/roster-link.ts roster.txt
 *   pbpaste | node tools/roster-link.ts
 *
 * One runner per line, in any of the forms the app accepts: "Avery Collins",
 * "14 Rowan Hayes", "Jordan Blake, 22".
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
console.error(athletes.map((a) => (a.bib ? `  ${a.bib} ${a.name}` : `  ${a.name}`)).join('\n'))
console.log(url)
