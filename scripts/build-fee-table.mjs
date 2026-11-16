#!/usr/bin/env node
// Rebuilds the permits-and-certificates part of the Act 1080 fee table from the
// fee Sheet.
//
// 1. In the fee Sheet, download the "Permits and certificates" tab as CSV.
// 2. Run:  node scripts/build-fee-table.mjs path/to/Permits-and-certificates.csv
// 3. Check the summary it prints, run `npm run build`, then deploy.
//
// Only the `main` rows are replaced. The other Act charges and product labels
// stay as they are. See docs/fee-calculator/README.md.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import FEE from '../src/utils/feeCalc.js'

const here = dirname(fileURLToPath(import.meta.url))
const tablePath = resolve(here, '../src/data/act1080Fees.json')

const csvPath = process.argv[2]
if (!csvPath) {
  console.error('Usage: node scripts/build-fee-table.mjs <Permits-and-certificates.csv>')
  process.exit(1)
}

const table = JSON.parse(readFileSync(tablePath, 'utf8'))
const before = table.main.length
let rows
try {
  rows = FEE.mainRowsFromCSV(readFileSync(csvPath, 'utf8'))
} catch (err) {
  console.error(err.message)
  process.exit(1)
}
if (!rows.length) {
  console.error('The CSV has the right columns but no lines. Nothing was changed.')
  process.exit(1)
}

// Every fee cell must read as a fee or be blank, or the calculator would show nonsense.
const bad = []
for (const r of rows) {
  for (const i of [10, 11, 12, 13]) {
    if (r[i] && !FEE.parseFee(r[i])) bad.push(`${r[0]} column ${FEE.MAIN_COLS[i]}: "${r[i]}"`)
  }
}
if (bad.length) {
  console.error(`${bad.length} fee cell(s) could not be read. Fix them in the Sheet and export again:`)
  bad.slice(0, 30).forEach((b) => console.error('  ' + b))
  process.exit(1)
}

const ids = new Set()
const dupes = rows.filter((r) => (ids.has(r[0]) ? true : (ids.add(r[0]), false))).map((r) => r[0])
if (dupes.length) console.warn(`Warning: repeated line IDs: ${[...new Set(dupes)].join(', ')}`)

table.main = rows
table.built = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
writeFileSync(tablePath, JSON.stringify(table))

const count = (k, v) => rows.filter((r) => r[k] === v).length
console.log(`Fee table updated: ${before} → ${rows.length} permit and certificate lines.`)
console.log(`  Matches office document: ${count(15, 'Matches office document')}`)
console.log(`  Differs from office document: ${count(15, 'Differs from office document')}`)
console.log(`  Check: ${count(15, 'Check')}`)
console.log(`  Not in office document: ${count(15, 'Not in office document')}`)
console.log(`  Flat – confirm: ${count(9, 'Flat – confirm')}`)
console.log(`Table date set to ${table.built}.`)
