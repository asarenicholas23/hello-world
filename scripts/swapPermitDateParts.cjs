/**
 * One-time repair for permit dates imported with month/day transposed.
 *
 * What it does:
 *   - Scans every facilities/{fileNumber}/permits/{permitId} document
 *   - Swaps the month and day for permit date fields
 *   - Defaults to dry-run mode and prints every proposed change
 *
 * Examples:
 *   node scripts/swapPermitDateParts.cjs
 *   node scripts/swapPermitDateParts.cjs --facility=PP035
 *   node scripts/swapPermitDateParts.cjs --fields=issue_date,expiry_date
 *   node scripts/swapPermitDateParts.cjs --write
 *
 * Optional flags:
 *   --write                  apply updates; otherwise dry-run only
 *   --facility=<fileNumber>  limit to one facility document id
 *   --permit=<value>         limit to permit document id or permit_number
 *   --fields=<csv>           default: issue_date,effective_date,expiry_date
 *   --created-after=<date>   only include permits created on/after YYYY-MM-DD
 *   --created-before=<date>  only include permits created before YYYY-MM-DD
 *   --recent=<number>        show most recent permit docs by created_at; no swaps
 *   --limit=<number>         stop after matching this many permit docs
 *   --force                  include docs already marked date_parts_swapped_at
 */

const admin = require('firebase-admin')

const DEFAULT_FIELDS = ['issue_date', 'effective_date', 'expiry_date']

function parseArgs(argv) {
  const out = {
    write: false,
    facility: '',
    permit: '',
    fields: DEFAULT_FIELDS,
    createdAfter: null,
    createdBefore: null,
    recent: null,
    limit: null,
    force: false,
  }

  for (const arg of argv) {
    if (arg === '--write') out.write = true
    else if (arg === '--force') out.force = true
    else if (arg.startsWith('--facility=')) out.facility = arg.split('=').slice(1).join('=').trim()
    else if (arg.startsWith('--permit=')) out.permit = arg.split('=').slice(1).join('=').trim()
    else if (arg.startsWith('--created-after=')) out.createdAfter = parseFilterDate(arg.split('=').slice(1).join('='), 'start')
    else if (arg.startsWith('--created-before=')) out.createdBefore = parseFilterDate(arg.split('=').slice(1).join('='), 'start')
    else if (arg.startsWith('--recent=')) out.recent = Number(arg.split('=').slice(1).join('='))
    else if (arg.startsWith('--limit=')) out.limit = Number(arg.split('=').slice(1).join('='))
    else if (arg.startsWith('--fields=')) {
      out.fields = arg
        .split('=')
        .slice(1)
        .join('=')
        .split(',')
        .map((field) => field.trim())
        .filter(Boolean)
    }
  }

  out.fields = out.fields.filter((field) => DEFAULT_FIELDS.includes(field))
  if (!out.fields.length) out.fields = DEFAULT_FIELDS

  return out
}

function parseFilterDate(value, mode) {
  const match = String(value || '').trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (!match) throw new Error(`Invalid date filter "${value}". Use YYYY-MM-DD.`)
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  if (mode === 'end') date.setUTCDate(date.getUTCDate() + 1)
  return date
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

function toDate(value) {
  if (!value) return null
  if (typeof value.toDate === 'function') return value.toDate()
  if (value instanceof Date) return value
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000)
  return null
}

function formatDate(date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

function swapMonthDay(value) {
  const date = toDate(value)
  if (!date || Number.isNaN(date.getTime())) {
    return { skipped: true, reason: 'not a timestamp/date value' }
  }

  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() + 1
  const day = date.getUTCDate()

  if (month === day) {
    return { skipped: true, reason: 'month and day are the same' }
  }

  if (day < 1 || day > 12) {
    return { skipped: true, reason: `current day ${day} cannot become a month` }
  }

  const swapped = new Date(Date.UTC(
    year,
    day - 1,
    month,
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
    date.getUTCMilliseconds()
  ))

  if (
    Number.isNaN(swapped.getTime()) ||
    swapped.getUTCFullYear() !== year ||
    swapped.getUTCMonth() + 1 !== day ||
    swapped.getUTCDate() !== month
  ) {
    return { skipped: true, reason: 'swap would create an invalid date' }
  }

  return {
    skipped: false,
    before: date,
    after: swapped,
    timestamp: admin.firestore.Timestamp.fromDate(swapped),
  }
}

async function commitBatch(batch, count) {
  if (count > 0) await batch.commit()
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  initAdmin()
  const db = admin.firestore()

  if (options.recent) {
    const snap = await db.collectionGroup('permits').get()
    const rows = snap.docs
      .map((doc) => {
        const data = doc.data()
        const facilityRef = doc.ref.parent.parent
        return {
          facilityFileNumber: facilityRef?.id || '',
          permitId: doc.id,
          permitNumber: data.permit_number || '',
          createdAt: toDate(data.created_at),
          issueDate: toDate(data.issue_date),
          effectiveDate: toDate(data.effective_date),
          expiryDate: toDate(data.expiry_date),
        }
      })
      .filter((row) => row.createdAt)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, options.recent)

    for (const row of rows) {
      console.log([
        formatDate(row.createdAt),
        `${row.facilityFileNumber}/${row.permitId}`,
        row.permitNumber,
        `issue=${row.issueDate ? formatDate(row.issueDate) : '-'}`,
        `effective=${row.effectiveDate ? formatDate(row.effectiveDate) : '-'}`,
        `expiry=${row.expiryDate ? formatDate(row.expiryDate) : '-'}`,
      ].join(' | '))
    }
    return
  }

  const snap = await db.collectionGroup('permits').get()
  let batch = db.batch()
  let batchCount = 0

  const stats = {
    inspected: 0,
    skippedAlreadyMarked: 0,
    matched: 0,
    docsChanged: 0,
    fieldsChanged: 0,
    fieldsSkipped: 0,
  }

  console.log(options.write ? 'WRITE MODE: applying permit date swaps.' : 'DRY RUN: no Firestore writes will be made.')
  console.log(`Fields: ${options.fields.join(', ')}`)
  if (options.facility) console.log(`Facility filter: ${options.facility}`)
  if (options.permit) console.log(`Permit filter: ${options.permit}`)
  if (options.createdAfter) console.log(`Created after: ${formatDate(options.createdAfter)}`)
  if (options.createdBefore) console.log(`Created before: ${formatDate(options.createdBefore)}`)
  console.log('')

  for (const doc of snap.docs) {
    stats.inspected += 1
    const facilityRef = doc.ref.parent.parent
    const facilityFileNumber = facilityRef?.id || ''
    const data = doc.data()
    const permitNumber = data.permit_number || ''
    const createdAt = toDate(data.created_at)

    if (options.facility && facilityFileNumber !== options.facility) continue
    if (options.permit && doc.id !== options.permit && permitNumber !== options.permit) continue
    if (options.createdAfter && (!createdAt || createdAt < options.createdAfter)) continue
    if (options.createdBefore && (!createdAt || createdAt >= options.createdBefore)) continue
    if (!options.force && data.date_parts_swapped_at) {
      stats.skippedAlreadyMarked += 1
      continue
    }

    if (options.limit && stats.matched >= options.limit) break
    stats.matched += 1

    const update = {}
    const changedFields = []

    for (const field of options.fields) {
      const result = swapMonthDay(data[field])
      if (result.skipped) {
        if (data[field]) {
          stats.fieldsSkipped += 1
          console.log(`SKIP ${facilityFileNumber}/${doc.id} ${permitNumber} ${field}: ${result.reason}`)
        }
        continue
      }

      update[field] = result.timestamp
      changedFields.push(field)
      stats.fieldsChanged += 1
      console.log(`${options.write ? 'SWAP' : 'WOULD'} ${facilityFileNumber}/${doc.id} ${permitNumber} ${field}: ${formatDate(result.before)} -> ${formatDate(result.after)}`)
    }

    if (!changedFields.length) continue

    stats.docsChanged += 1
    if (options.write) {
      update.date_parts_swapped_at = admin.firestore.FieldValue.serverTimestamp()
      update.date_parts_swapped_fields = admin.firestore.FieldValue.arrayUnion(...changedFields)
      update.updated_at = admin.firestore.FieldValue.serverTimestamp()
      batch.update(doc.ref, update)
      batchCount += 1

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
  console.log(`  Permit docs inspected: ${stats.inspected}`)
  console.log(`  Permit docs matched filters: ${stats.matched}`)
  console.log(`  Permit docs ${options.write ? 'updated' : 'that would update'}: ${stats.docsChanged}`)
  console.log(`  Date fields ${options.write ? 'updated' : 'that would update'}: ${stats.fieldsChanged}`)
  console.log(`  Date fields skipped: ${stats.fieldsSkipped}`)
  console.log(`  Docs skipped as already marked: ${stats.skippedAlreadyMarked}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
