/**
 * One-off migration: split the old auto-generated "staff_id" (STF001, …)
 * away from the real, management-issued Staff ID.
 *
 * For every staff doc that doesn't already have a system_id:
 *   - copies its current staff_id (e.g. "STF003") into a new system_id field
 *   - blanks out staff_id so each staff member can fill in their real,
 *     management-issued ID from My Profile
 *
 * Dry-run by default — prints what it would change. Pass --write to apply.
 *
 * Usage:
 *   node scripts/migrateStaffIdToSystemId.cjs
 *   node scripts/migrateStaffIdToSystemId.cjs --write
 */

const { initializeApp, cert } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const serviceAccount = require('./serviceAccountKey.json')

initializeApp({
  credential: cert(serviceAccount),
})

const db = getFirestore()
const WRITE = process.argv.includes('--write')

async function migrate() {
  console.log(`\n=== Staff ID → System ID migration (${WRITE ? 'WRITE' : 'DRY RUN'}) ===\n`)

  const snap = await db.collection('staff').get()
  let changed = 0
  let skipped = 0

  for (const doc of snap.docs) {
    const data = doc.data()

    if (data.system_id) {
      skipped++
      continue
    }

    const oldStaffId = data.staff_id ?? ''
    console.log(`  ${data.name ?? doc.id}: staff_id "${oldStaffId}" → system_id "${oldStaffId}", staff_id cleared`)

    if (WRITE) {
      await doc.ref.update({
        system_id: oldStaffId,
        staff_id: '',
      })
    }
    changed++
  }

  console.log(`\n${WRITE ? 'Updated' : 'Would update'} ${changed} staff doc(s). Skipped ${skipped} (already migrated).`)
  if (!WRITE) console.log('\nThis was a dry run — re-run with --write to apply.\n')
  process.exit(0)
}

migrate().catch((err) => {
  console.error('\nMigration failed:', err.message)
  process.exit(1)
})
