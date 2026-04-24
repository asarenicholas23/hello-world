/**
 * Repair facility sector fields from the facility file-number prefix.
 *
 * Examples:
 *   node scripts/fixFacilitySectorsByFileNumber.cjs
 *   node scripts/fixFacilitySectorsByFileNumber.cjs --prefix=PP
 *   node scripts/fixFacilitySectorsByFileNumber.cjs --write
 *
 * Optional flags:
 *   --write            apply updates; otherwise dry-run only
 *   --prefix=<prefix>  limit to one sector prefix, e.g. PP
 *   --limit=<number>   stop after matching this many mismatches
 */

const admin = require('firebase-admin')

const SECTORS = [
  { prefix: 'CU', name: 'Manufacturing' },
  { prefix: 'CI', name: 'Infrastructure' },
  { prefix: 'CH', name: 'Health' },
  { prefix: 'CT', name: 'Hospitality' },
  { prefix: 'CE', name: 'Energy' },
  { prefix: 'PP', name: 'Agrochemical & Pesticide' },
  { prefix: 'CA', name: 'Agriculture' },
  { prefix: 'CM', name: 'Mining' },
]

const SECTOR_BY_PREFIX = new Map(SECTORS.map((sector) => [sector.prefix, sector]))

function parseArgs(argv) {
  const out = {
    write: false,
    prefix: '',
    limit: null,
  }

  for (const arg of argv) {
    if (arg === '--write') out.write = true
    else if (arg.startsWith('--prefix=')) out.prefix = arg.split('=').slice(1).join('=').trim().toUpperCase()
    else if (arg.startsWith('--limit=')) out.limit = Number(arg.split('=').slice(1).join('='))
  }

  return out
}

function initAdmin() {
  try {
    return admin.app()
  } catch {
    const serviceAccount = require('./serviceAccountKey.json')
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    })
  }
}

function extractPrefix(fileNumber) {
  const match = String(fileNumber || '').trim().toUpperCase().match(/^[A-Z]+/)
  return match ? match[0] : ''
}

function sameSector(data, expected) {
  return data.sector === expected.name && data.sector_prefix === expected.prefix
}

async function commitBatch(batch, count) {
  if (count > 0) await batch.commit()
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  initAdmin()
  const db = admin.firestore()

  const snap = await db.collection('facilities').get()
  let batch = db.batch()
  let batchCount = 0

  const stats = {
    inspected: 0,
    unknownPrefix: 0,
    alreadyCorrect: 0,
    matched: 0,
    updated: 0,
  }

  console.log(options.write ? 'WRITE MODE: applying facility sector repairs.' : 'DRY RUN: no Firestore writes will be made.')
  if (options.prefix) console.log(`Prefix filter: ${options.prefix}`)
  console.log('')

  for (const doc of snap.docs) {
    stats.inspected += 1
    const data = doc.data()
    const fileNumber = data.file_number || doc.id
    const prefix = extractPrefix(fileNumber)

    if (options.prefix && prefix !== options.prefix) continue

    const expected = SECTOR_BY_PREFIX.get(prefix)
    if (!expected) {
      stats.unknownPrefix += 1
      console.log(`SKIP ${doc.id}: unknown prefix "${prefix}" from file number "${fileNumber}"`)
      continue
    }

    if (sameSector(data, expected)) {
      stats.alreadyCorrect += 1
      continue
    }

    if (options.limit && stats.matched >= options.limit) break
    stats.matched += 1

    console.log(`${options.write ? 'FIX' : 'WOULD'} ${doc.id}: "${data.sector || ''}" (${data.sector_prefix || ''}) -> "${expected.name}" (${expected.prefix})`)

    if (options.write) {
      batch.update(doc.ref, {
        sector: expected.name,
        sector_prefix: expected.prefix,
        sector_repaired_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      })
      batchCount += 1
      stats.updated += 1

      if (batchCount >= 400) {
        await commitBatch(batch, batchCount)
        batch = db.batch()
        batchCount = 0
      }
    }
  }

  if (options.write) await commitBatch(batch, batchCount)

  console.log('')
  console.log('Summary')
  console.log(`  Facilities inspected: ${stats.inspected}`)
  console.log(`  Already correct: ${stats.alreadyCorrect}`)
  console.log(`  Unknown prefixes: ${stats.unknownPrefix}`)
  console.log(`  Mismatches ${options.write ? 'found' : 'that would update'}: ${stats.matched}`)
  console.log(`  Facilities updated: ${stats.updated}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
