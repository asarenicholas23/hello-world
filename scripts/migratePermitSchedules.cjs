/**
 * One-time migration of AppSheet schedule PDFs into Firebase Storage.
 *
 * Strategy:
 *   - Use permit records that already have migrated permit-image metadata
 *   - Derive the AppSheet record prefix from the legacy permit image path
 *   - Find a Drive file in the provided folder tree with the same prefix and
 *     "schedule" in the filename/path
 *   - Upload that schedule PDF to Firebase Storage
 *   - Save its URL in permit.schedule_url
 *
 * This intentionally migrates schedules only.
 *
 * Requirements:
 *   1. scripts/serviceAccountKey.json must exist
 *   2. Set GOOGLE_DRIVE_ACCESS_TOKEN to an OAuth token with Drive read access
 *   3. Run a dry-run first
 *
 * Examples:
 *   GOOGLE_DRIVE_ACCESS_TOKEN="ya29..." node scripts/migratePermitSchedules.cjs --dry-run
 *   GOOGLE_DRIVE_ACCESS_TOKEN="ya29..." node scripts/migratePermitSchedules.cjs
 *
 * Optional flags:
 *   --folder-id=<drive folder id>
 *   --limit=<number of permits to inspect>
 *   --overwrite      migrate even when schedule_url already exists
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const admin = require('firebase-admin')

const DEFAULT_FOLDER_ID = '1MZseKzFB72GbVmbs0q7z9gzImpCOhTsa'

function parseArgs(argv) {
  const out = {
    dryRun: false,
    folderId: DEFAULT_FOLDER_ID,
    limit: null,
    overwrite: false,
  }

  for (const arg of argv) {
    if (arg === '--dry-run') out.dryRun = true
    else if (arg === '--overwrite') out.overwrite = true
    else if (arg.startsWith('--folder-id=')) out.folderId = arg.split('=').slice(1).join('=')
    else if (arg.startsWith('--limit=')) out.limit = Number(arg.split('=').slice(1).join('='))
  }

  return out
}

function readEnvFile() {
  const envPath = path.resolve(__dirname, '..', '.env')
  if (!fs.existsSync(envPath)) return {}

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/)
  const vars = {}

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    vars[key] = value
  }

  return vars
}

function initAdmin() {
  try {
    return admin.app()
  } catch {
    const envVars = readEnvFile()
    const serviceAccount = require('./serviceAccountKey.json')
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: envVars.VITE_FIREBASE_STORAGE_BUCKET || `${serviceAccount.project_id}.firebasestorage.app`,
    })
  }
}

function getDriveAccessToken() {
  const token = process.env.GOOGLE_DRIVE_ACCESS_TOKEN || process.env.DRIVE_ACCESS_TOKEN
  if (!token) {
    throw new Error(
      'Missing GOOGLE_DRIVE_ACCESS_TOKEN. Generate an OAuth token with Drive read access and retry.'
    )
  }
  return token
}

function basenameFromPath(value) {
  return String(value || '').split('/').filter(Boolean).pop() || ''
}

function extractAppSheetPrefix(value) {
  const filename = basenameFromPath(value)
  if (!filename) return ''
  return filename.split('.')[0] || ''
}

function extractFilenamePrefix(value) {
  const filename = basenameFromPath(value)
  if (!filename) return ''
  return filename.split('.')[0] || ''
}

function makeStorageDownloadUrl(bucketName, objectPath, token) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`
}

async function driveRequest(url, token) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Drive API ${res.status}: ${text}`)
  }

  return res
}

async function listDriveTree(folderId, token, pathPrefix = '') {
  const files = []
  let pageToken = ''

  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'nextPageToken, files(id,name,mimeType)',
      pageSize: '1000',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    })
    if (pageToken) params.set('pageToken', pageToken)

    const res = await driveRequest(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, token)
    const data = await res.json()

    for (const file of data.files || []) {
      const currentPath = pathPrefix ? `${pathPrefix}/${file.name}` : file.name
      if (file.mimeType === 'application/vnd.google-apps.folder') {
        files.push(...await listDriveTree(file.id, token, currentPath))
      } else {
        files.push({
          id: file.id,
          name: file.name,
          path: currentPath,
          mimeType: file.mimeType || 'application/octet-stream',
        })
      }
    }

    pageToken = data.nextPageToken || ''
  } while (pageToken)

  return files
}

async function downloadDriveFile(fileId, token) {
  const res = await driveRequest(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
    token
  )
  const arrayBuffer = await res.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

async function getPermitTargets(db, limit, overwrite) {
  const facilitiesSnap = await db.collection('facilities').get()
  const permits = []

  for (const facilityDoc of facilitiesSnap.docs) {
    const permitsSnap = await facilityDoc.ref.collection('permits').get()
    for (const permitDoc of permitsSnap.docs) {
      const data = permitDoc.data()
      if (!overwrite && data.schedule_url) continue

      const prefix = extractAppSheetPrefix(
        data.legacy_permit_image_drive_path ||
        data.legacy_permit_image_path ||
        data.permit_image_url
      )

      if (!prefix) continue

      permits.push({
        facilityFileNumber: facilityDoc.id,
        permitId: permitDoc.id,
        permitNumber: data.permit_number || '',
        prefix,
        facilityPrefix: extractFilenamePrefix(facilityDoc.id),
        existingScheduleUrl: data.schedule_url || '',
        permitRef: permitDoc.ref,
      })

      if (limit && permits.length >= limit) {
        return permits
      }
    }
  }

  return permits
}

function buildScheduleIndex(files) {
  const byRecordPrefix = new Map()
  const byFacilityPrefix = new Map()

  for (const file of files) {
    const lowered = `${file.name} ${file.path}`.toLowerCase()
    if (!lowered.includes('schedule')) continue

    const recordPrefix = extractAppSheetPrefix(file.name)
    if (recordPrefix) {
      const matches = byRecordPrefix.get(recordPrefix) || []
      matches.push(file)
      byRecordPrefix.set(recordPrefix, matches)
    }

    const facilityPrefix = extractFilenamePrefix(file.name).toUpperCase()
    if (facilityPrefix) {
      const matches = byFacilityPrefix.get(facilityPrefix) || []
      matches.push(file)
      byFacilityPrefix.set(facilityPrefix, matches)
    }
  }

  return { byRecordPrefix, byFacilityPrefix }
}

function chooseScheduleMatch(candidates) {
  if (!candidates || candidates.length === 0) {
    return { error: 'No schedule file found for AppSheet prefix' }
  }
  if (candidates.length === 1) {
    return { match: candidates[0], strategy: 'prefix+schedule' }
  }

  const pdfs = candidates.filter((file) => file.name.toLowerCase().endsWith('.pdf'))
  if (pdfs.length === 1) {
    return { match: pdfs[0], strategy: 'prefix+schedule+pdf' }
  }

  return { error: `Multiple schedule files matched prefix "${extractAppSheetPrefix(candidates[0].name)}"` }
}

function findScheduleMatch(index, permit) {
  const recordCandidates = index.byRecordPrefix.get(permit.prefix)
  const recordResolved = chooseScheduleMatch(recordCandidates)
  if (!recordResolved.error) {
    return { ...recordResolved, lookup: `record prefix ${permit.prefix}` }
  }

  const facilityCandidates = index.byFacilityPrefix.get(String(permit.facilityFileNumber || '').toUpperCase())
  const facilityResolved = chooseScheduleMatch(facilityCandidates)
  if (!facilityResolved.error) {
    return { ...facilityResolved, lookup: `facility prefix ${permit.facilityFileNumber}` }
  }

  return {
    error: recordResolved.error || facilityResolved.error || 'No schedule file matched permit',
  }
}

async function uploadToStorage(bucket, permit, driveFile, fileBuffer) {
  const safeName = driveFile.name.replace(/[^\w.\- ]+/g, '_')
  const objectPath = `facilities/${permit.facilityFileNumber}/permits/${permit.permitId}/schedule/${safeName}`
  const token = crypto.randomUUID()
  const file = bucket.file(objectPath)

  await file.save(fileBuffer, {
    resumable: false,
    metadata: {
      contentType: driveFile.mimeType,
      metadata: {
        firebaseStorageDownloadTokens: token,
        source: 'appsheet-schedule-migration',
        driveFileId: driveFile.id,
        appsheetPrefix: permit.prefix,
      },
    },
  })

  return {
    objectPath,
    downloadUrl: makeStorageDownloadUrl(bucket.name, objectPath, token),
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  initAdmin()
  const db = admin.firestore()
  const bucket = admin.storage().bucket()
  const driveToken = getDriveAccessToken()

  console.log('\n=== Permit Schedule Migration ===\n')
  console.log(`Mode: ${args.dryRun ? 'DRY RUN' : 'LIVE'}`)
  console.log(`Drive folder: ${args.folderId}`)
  console.log(`Bucket: ${bucket.name}\n`)

  console.log('Listing files from Google Drive folder tree...')
  const driveFiles = await listDriveTree(args.folderId, driveToken)
  const scheduleIndex = buildScheduleIndex(driveFiles)
  const scheduleFileCount = [...scheduleIndex.byFacilityPrefix.values()].reduce((sum, list) => sum + list.length, 0)
  console.log(`Found ${driveFiles.length} total file(s) in Drive.`)
  console.log(`Found ${scheduleFileCount} schedule candidate file(s).\n`)

  console.log('Scanning Firestore permits for schedule migration targets...')
  const permits = await getPermitTargets(db, args.limit, args.overwrite)
  console.log(`Found ${permits.length} permit(s) eligible for schedule migration.\n`)

  const summary = {
    scanned: permits.length,
    migrated: 0,
    skipped: 0,
    failed: 0,
  }

  for (const permit of permits) {
    const label = `${permit.facilityFileNumber} | ${permit.permitNumber || permit.permitId}`
    const resolved = findScheduleMatch(scheduleIndex, permit)

    if (resolved.error) {
      summary.failed += 1
      console.log(`[FAIL] ${label}`)
      console.log(`       ${resolved.error}`)
      console.log(`       prefix: ${permit.prefix}`)
      console.log(`       facility: ${permit.facilityFileNumber}`)
      continue
    }

    const driveFile = resolved.match
    console.log(`[MATCH] ${label}`)
    console.log(`        lookup:   ${resolved.lookup}`)
    console.log(`        schedule: ${driveFile.path} (${resolved.strategy})`)

    if (args.dryRun) {
      summary.skipped += 1
      continue
    }

    try {
      const fileBuffer = await downloadDriveFile(driveFile.id, driveToken)
      const uploaded = await uploadToStorage(bucket, permit, driveFile, fileBuffer)

      await permit.permitRef.update({
        schedule_url: uploaded.downloadUrl,
        legacy_schedule_drive_file_id: driveFile.id,
        legacy_schedule_drive_path: driveFile.path,
        schedule_migration_source: 'appsheet-drive',
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      })

      summary.migrated += 1
      console.log(`        storage:  ${uploaded.objectPath}`)
    } catch (err) {
      summary.failed += 1
      console.log(`        ERROR: ${err.message}`)
    }
  }

  console.log('\n=== Summary ===')
  console.log(`Scanned:  ${summary.scanned}`)
  console.log(`Migrated: ${summary.migrated}`)
  console.log(`Dry-run:  ${summary.skipped}`)
  console.log(`Failed:   ${summary.failed}\n`)
}

main().catch((err) => {
  console.error('\nMigration failed:', err.message)
  process.exit(1)
})
