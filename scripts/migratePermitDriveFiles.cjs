/**
 * One-time migration of AppSheet permit file paths into Firebase Storage.
 *
 * Why:
 *   Legacy records store values like:
 *     Permit_Files_/b1b28090.Permit Image.144916.A Guest House.pdf
 *   These are AppSheet file paths, not real browser URLs.
 *
 * What this script does:
 *   1. Reads permit records from Firestore
 *   2. Finds legacy AppSheet file-path values
 *   3. Looks up matching files inside a Google Drive folder tree
 *   4. Uploads the files into Firebase Storage
 *   5. Updates the permit with a real Firebase download URL
 *
 * Requirements:
 *   1. scripts/serviceAccountKey.json must exist
 *   2. Set GOOGLE_DRIVE_ACCESS_TOKEN to an OAuth token with Drive read access
 *   3. Run a dry-run first
 *
 * Examples:
 *   GOOGLE_DRIVE_ACCESS_TOKEN="ya29..." node scripts/migratePermitDriveFiles.cjs --dry-run
 *   GOOGLE_DRIVE_ACCESS_TOKEN="ya29..." node scripts/migratePermitDriveFiles.cjs
 *
 * Optional flags:
 *   --folder-id=<drive folder id>
 *   --limit=<number of permits to process>
 *   --match-substring   allow substring filename match if exact match fails
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const admin = require('firebase-admin')

const DEFAULT_FOLDER_ID = '1bj2AFbOVWWvNEduYuRLrCM-GijqJO4UJ'
const DEFAULT_APPSHEET_PREFIX = 'Permit_Files_/'

function parseArgs(argv) {
  const out = {
    dryRun: false,
    folderId: DEFAULT_FOLDER_ID,
    limit: null,
    matchSubstring: false,
  }

  for (const arg of argv) {
    if (arg === '--dry-run') out.dryRun = true
    else if (arg === '--match-substring') out.matchSubstring = true
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
  let app
  try {
    app = admin.app()
  } catch {
    const envVars = readEnvFile()
    const serviceAccount = require('./serviceAccountKey.json')
    app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: envVars.VITE_FIREBASE_STORAGE_BUCKET || `${serviceAccount.project_id}.firebasestorage.app`,
    })
  }
  return app
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

function normalizeLegacyPath(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return ''
  if (/^(www\.)?appsheet\.com\//i.test(raw)) return ''
  if (/^\/template\/gettablefileurl/i.test(raw)) return ''
  return raw.replace(/^\/+/, '')
}

function basenameFromLegacyPath(legacyPath) {
  return legacyPath.split('/').filter(Boolean).pop() || ''
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
      fields: 'nextPageToken, files(id,name,mimeType,parents)',
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

async function getPermitsToMigrate(db, limit) {
  const facilitiesSnap = await db.collection('facilities').get()
  const permits = []

  for (const facilityDoc of facilitiesSnap.docs) {
    const permitsSnap = await facilityDoc.ref.collection('permits').get()
    for (const permitDoc of permitsSnap.docs) {
      const data = permitDoc.data()
      const legacyPath = normalizeLegacyPath(data.permit_image_url)
      if (!legacyPath) continue

      permits.push({
        facilityFileNumber: facilityDoc.id,
        permitId: permitDoc.id,
        permitNumber: data.permit_number || '',
        entityName: data.entity_name || '',
        legacyPath,
        permitRef: permitDoc.ref,
      })

      if (limit && permits.length >= limit) {
        return permits
      }
    }
  }

  return permits
}

function buildDriveIndexes(files) {
  const byPath = new Map()
  const byName = new Map()

  for (const file of files) {
    byPath.set(file.path, file)

    const list = byName.get(file.name) || []
    list.push(file)
    byName.set(file.name, list)
  }

  return { byPath, byName }
}

function findDriveFile(indexes, legacyPath, matchSubstring) {
  const normalized = legacyPath.replace(/^\/+/, '')

  if (indexes.byPath.has(normalized)) {
    return { match: indexes.byPath.get(normalized), strategy: 'path' }
  }

  const filename = basenameFromLegacyPath(normalized)
  const exactNameMatches = indexes.byName.get(filename) || []
  if (exactNameMatches.length === 1) {
    return { match: exactNameMatches[0], strategy: 'exact-name' }
  }
  if (exactNameMatches.length > 1) {
    return { error: `Multiple Drive files matched filename "${filename}"` }
  }

  if (matchSubstring) {
    const lowered = filename.toLowerCase()
    const partialMatches = []
    for (const file of indexes.byPath.values()) {
      if (file.name.toLowerCase().includes(lowered) || lowered.includes(file.name.toLowerCase())) {
        partialMatches.push(file)
      }
    }
    if (partialMatches.length === 1) {
      return { match: partialMatches[0], strategy: 'substring-name' }
    }
    if (partialMatches.length > 1) {
      return { error: `Multiple Drive files partially matched "${filename}"` }
    }
  }

  return { error: `No Drive file matched "${normalized}"` }
}

async function uploadToStorage(bucket, permit, driveFile, fileBuffer) {
  const safeName = driveFile.name.replace(/[^\w.\- ]+/g, '_')
  const objectPath = `facilities/${permit.facilityFileNumber}/permits/${permit.permitId}/migrated/${safeName}`
  const token = crypto.randomUUID()
  const file = bucket.file(objectPath)

  await file.save(fileBuffer, {
    resumable: false,
    metadata: {
      contentType: driveFile.mimeType,
      metadata: {
        firebaseStorageDownloadTokens: token,
        source: 'appsheet-drive-migration',
        driveFileId: driveFile.id,
        legacyPath: permit.legacyPath,
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
  const app = initAdmin()
  const db = admin.firestore()
  const bucket = admin.storage().bucket()
  const driveToken = getDriveAccessToken()

  console.log('\n=== Permit Drive Migration ===\n')
  console.log(`Mode: ${args.dryRun ? 'DRY RUN' : 'LIVE'}`)
  console.log(`Drive folder: ${args.folderId}`)
  console.log(`Bucket: ${bucket.name}\n`)

  console.log('Listing files from Google Drive folder tree...')
  const driveFiles = await listDriveTree(args.folderId, driveToken)
  const indexes = buildDriveIndexes(driveFiles)
  console.log(`Found ${driveFiles.length} file(s) in Drive.\n`)

  console.log('Scanning Firestore permits for legacy AppSheet file paths...')
  const permits = await getPermitsToMigrate(db, args.limit)
  console.log(`Found ${permits.length} permit(s) with legacy file paths.\n`)

  const summary = {
    scanned: permits.length,
    migrated: 0,
    skipped: 0,
    failed: 0,
  }

  for (const permit of permits) {
    const label = `${permit.facilityFileNumber} | ${permit.permitNumber || permit.permitId}`
    const resolved = findDriveFile(indexes, permit.legacyPath, args.matchSubstring)

    if (resolved.error) {
      summary.failed += 1
      console.log(`[FAIL] ${label}`)
      console.log(`       ${resolved.error}`)
      continue
    }

    const driveFile = resolved.match
    console.log(`[MATCH] ${label}`)
    console.log(`        legacy: ${permit.legacyPath}`)
    console.log(`        drive:  ${driveFile.path} (${resolved.strategy})`)

    if (args.dryRun) {
      summary.skipped += 1
      continue
    }

    try {
      const fileBuffer = await downloadDriveFile(driveFile.id, driveToken)
      const uploaded = await uploadToStorage(bucket, permit, driveFile, fileBuffer)

      await permit.permitRef.update({
        legacy_permit_image_path: permit.legacyPath,
        legacy_permit_image_drive_file_id: driveFile.id,
        legacy_permit_image_drive_path: driveFile.path,
        permit_image_url: uploaded.downloadUrl,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
        migration_source: 'appsheet-drive',
      })

      summary.migrated += 1
      console.log(`        storage: ${uploaded.objectPath}`)
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

