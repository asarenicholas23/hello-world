/**
 * One-off backfill: set data_access: false on staff docs that predate the
 * field (e.g. the accounts created by scripts/seed.cjs). Without this,
 * firestore.rules comparisons against a missing data_access field can
 * evaluate as a rules error, denying otherwise-valid writes (e.g. a staff
 * member saving their own profile/signature).
 *
 * Dry-run by default — prints what it would change. Pass --write to apply.
 *
 * Usage:
 *   node scripts/backfillDataAccess.cjs
 *   node scripts/backfillDataAccess.cjs --write
 */

const { initializeApp, cert } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const serviceAccount = require('./serviceAccountKey.json')

initializeApp({
  credential: cert(serviceAccount),
})

const db = getFirestore()
const WRITE = process.argv.includes('--write')

async function backfill() {
  console.log(`\n=== data_access backfill (${WRITE ? 'WRITE' : 'DRY RUN'}) ===\n`)

  const snap = await db.collection('staff').get()
  let changed = 0
  let skipped = 0

  for (const doc of snap.docs) {
    const data = doc.data()

    if ('data_access' in data) {
      skipped++
      continue
    }

    console.log(`  ${data.name ?? doc.id} (${data.email ?? 'no email'}): data_access missing → false`)

    if (WRITE) {
      await doc.ref.update({ data_access: false })
    }
    changed++
  }

  console.log(`\n${WRITE ? 'Updated' : 'Would update'} ${changed} staff doc(s). Skipped ${skipped} (already had the field).`)
  if (!WRITE) console.log('\nThis was a dry run — re-run with --write to apply.\n')
  process.exit(0)
}

backfill().catch((err) => {
  console.error('\nBackfill failed:', err.message)
  process.exit(1)
})
