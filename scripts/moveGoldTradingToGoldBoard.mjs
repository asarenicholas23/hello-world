/**
 * Move gold trading facilities to Infrastructure › Gold board applications.
 *
 * Finds facilities whose type of undertaking (or name, when the type is blank) says
 * gold trading / buying / GoldBod, using the same rules as the fee estimate and the
 * Facilities sub-sector filter (src/utils/subSectors.js), and sets
 *   sector: 'Infrastructure', sector_prefix: 'CI', sub_sector: 'gold_board'.
 * The file number (document ID) is not changed. The old sector is kept in
 * `previous_sector` / `previous_sector_prefix` so the move can be undone.
 * Facilities marked sub_sector 'none' are left alone.
 *
 *   node scripts/moveGoldTradingToGoldBoard.mjs           dry run: lists what would change
 *   node scripts/moveGoldTradingToGoldBoard.mjs --write   apply
 */
import { createRequire } from 'node:module'
import { facilitySubSector } from '../src/utils/subSectors.js'

const require = createRequire(import.meta.url)
const { initializeApp, cert } = require('firebase-admin/app')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')

const write = process.argv.includes('--write')
initializeApp({ credential: cert(require('./serviceAccountKey.json')) })
const db = getFirestore()

const snap = await db.collection('facilities').get()
const moves = []
for (const doc of snap.docs) {
  const f = { file_number: doc.id, ...doc.data() }
  const sub = facilitySubSector(f)
  if (sub?.value !== 'gold_board') continue
  if (f.sector_prefix === 'CI' && f.sector === 'Infrastructure' && f.sub_sector === 'gold_board') continue
  moves.push({ ref: doc.ref, f })
}

console.log(`${snap.size} facilities checked; ${moves.length} to move to Infrastructure › Gold board applications${write ? '' : ' (dry run)'}:`)
for (const { f } of moves) {
  console.log(`  ${String(f.file_number).padEnd(10)} ${String(f.sector_prefix || '-').padEnd(3)} → CI  ${f.name ?? ''}  |  ${f.type_of_undertaking ?? ''}`)
}

if (write && moves.length) {
  for (let i = 0; i < moves.length; i += 400) {
    const batch = db.batch()
    for (const { ref, f } of moves.slice(i, i + 400)) {
      batch.update(ref, {
        sector: 'Infrastructure',
        sector_prefix: 'CI',
        sub_sector: 'gold_board',
        ...(f.sector_prefix !== 'CI' ? { previous_sector: f.sector ?? '', previous_sector_prefix: f.sector_prefix ?? '' } : {}),
        updated_at: FieldValue.serverTimestamp(),
        updated_by: 'script:moveGoldTradingToGoldBoard',
      })
    }
    await batch.commit()
  }
  console.log(`Moved ${moves.length}.`)
}
