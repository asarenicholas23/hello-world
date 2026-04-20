/**
 * EPA Permit Management — Seed Script
 *
 * Creates 7 test staff accounts (one per role) and initialises 8 sector counters.
 * Safe to re-run — uses merge so existing data is updated, not duplicated.
 *
 * BEFORE RUNNING:
 *   1. Go to Firebase Console → Project Settings → Service Accounts
 *   2. Click "Generate New Private Key" → save as scripts/serviceAccountKey.json
 *   3. npm install (firebase-admin should already be in devDependencies)
 *   4. node scripts/seed.cjs
 */

const admin = require('firebase-admin')
const serviceAccount = require('./serviceAccountKey.json')

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
})

const db        = admin.firestore()
const authAdmin = admin.auth()

// role_level mirrors src/data/constants.js ROLES
const ROLE_LEVEL = {
  director:          1,
  admin:             2,
  senior_officer:    3,
  officer:           4,
  assistant_officer: 5,
  junior_officer:    6,
  finance:           null,
}

// ── Test staff accounts ────────────────────────────────
const STAFF = [
  {
    email:       'director@epa-ashanti.gh',
    password:    'Director@1234',
    name:        'Emmanuel Boateng',
    role:        'director',
    staff_id:    'STF004',
    designation: 'Regional Director',
    phone:       '+233244000004',
  },
  {
    email:       'admin@epa-ashanti.gh',
    password:    'Admin@1234',
    name:        'Kofi Mensah',
    role:        'admin',
    staff_id:    'STF001',
    designation: 'Administrative Officer',
    phone:       '+233244000001',
  },
  {
    email:       'senior@epa-ashanti.gh',
    password:    'Senior@1234',
    name:        'Abena Frimpong',
    role:        'senior_officer',
    staff_id:    'STF005',
    designation: 'Senior Environmental Officer',
    phone:       '+233244000005',
  },
  {
    email:       'officer@epa-ashanti.gh',
    password:    'Officer@1234',
    name:        'Kwame Asante',
    role:        'officer',
    staff_id:    'STF003',
    designation: 'Environmental Officer',
    phone:       '+233244000003',
  },
  {
    email:       'assistant@epa-ashanti.gh',
    password:    'Assistant@1234',
    name:        'Yaw Darko',
    role:        'assistant_officer',
    staff_id:    'STF006',
    designation: 'Assistant Environmental Officer',
    phone:       '+233244000006',
  },
  {
    email:       'junior@epa-ashanti.gh',
    password:    'Junior@1234',
    name:        'Akosua Mensah',
    role:        'junior_officer',
    staff_id:    'STF007',
    designation: 'Junior Environmental Officer',
    phone:       '+233244000007',
  },
  {
    email:       'finance@epa-ashanti.gh',
    password:    'Finance@1234',
    name:        'Ama Owusu',
    role:        'finance',
    staff_id:    'STF002',
    designation: 'Finance Officer',
    phone:       '+233244000002',
  },
]

// ── Sector counters ────────────────────────────────────
const COUNTERS = [
  { id: 'CU', sector_name: 'Manufacturing' },
  { id: 'CI', sector_name: 'Infrastructure' },
  { id: 'CH', sector_name: 'Health' },
  { id: 'CT', sector_name: 'Hospitality' },
  { id: 'CE', sector_name: 'Energy' },
  { id: 'PP', sector_name: 'Agrochemical & Pesticide' },
  { id: 'CA', sector_name: 'Agriculture' },
  { id: 'CM', sector_name: 'Mining' },
]

async function seed() {
  console.log('\n=== EPA Permit System — Seed ===\n')

  // ── Staff ──────────────────────────────────────────
  console.log('Creating / updating staff accounts...\n')
  for (const s of STAFF) {
    let uid

    try {
      const existing = await authAdmin.getUserByEmail(s.email)
      uid = existing.uid
      console.log(`  [exists]  ${s.email}  uid=${uid}`)
    } catch {
      const record = await authAdmin.createUser({
        email:       s.email,
        password:    s.password,
        displayName: s.name,
      })
      uid = record.uid
      console.log(`  [created] ${s.email}  uid=${uid}`)
    }

    await db.collection('staff').doc(uid).set(
      {
        uid,
        staff_id:    s.staff_id,
        name:        s.name,
        email:       s.email,
        role:        s.role,
        role_level:  ROLE_LEVEL[s.role] ?? null,
        designation: s.designation,
        phone:       s.phone,
      },
      { merge: true }
    )

    console.log(`  [staff doc] ${s.staff_id} → role: ${s.role} (level: ${ROLE_LEVEL[s.role] ?? 'n/a'})\n`)
  }

  // ── Counters ───────────────────────────────────────
  console.log('Initialising sector counters...')
  for (const c of COUNTERS) {
    const ref  = db.collection('counters').doc(c.id)
    const snap = await ref.get()
    if (!snap.exists) {
      await ref.set({ last_count: 0, sector_name: c.sector_name })
      console.log(`  [created] ${c.id} — ${c.sector_name}`)
    } else {
      console.log(`  [exists]  ${c.id} — ${c.sector_name} (last_count=${snap.data().last_count})`)
    }
  }

  console.log('\n=== Seed complete ===\n')
  console.log('Test credentials:')
  console.log('  director@epa-ashanti.gh    / Director@1234')
  console.log('  admin@epa-ashanti.gh       / Admin@1234')
  console.log('  senior@epa-ashanti.gh      / Senior@1234')
  console.log('  officer@epa-ashanti.gh     / Officer@1234')
  console.log('  assistant@epa-ashanti.gh   / Assistant@1234')
  console.log('  junior@epa-ashanti.gh      / Junior@1234')
  console.log('  finance@epa-ashanti.gh     / Finance@1234')
  console.log()

  process.exit(0)
}

seed().catch((err) => {
  console.error('\nSeed failed:', err.message)
  process.exit(1)
})
