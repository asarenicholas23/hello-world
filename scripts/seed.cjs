/**
 * EPA Permit Management — Seed Script
 *
 * Creates 3 test staff accounts (one per role) and initialises 8 sector counters.
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

const db = admin.firestore()
const authAdmin = admin.auth()

// ── Test staff accounts ────────────────────────────────
const STAFF = [
  {
    email: 'admin@epa-ashanti.gh',
    password: 'Admin@1234',
    name: 'Kofi Mensah',
    role: 'admin',
    staff_id: 'STF001',
    designation: 'Regional Director',
    phone: '+233244000001',
  },
  {
    email: 'finance@epa-ashanti.gh',
    password: 'Finance@1234',
    name: 'Ama Owusu',
    role: 'finance',
    staff_id: 'STF002',
    designation: 'Finance Officer',
    phone: '+233244000002',
  },
  {
    email: 'officer@epa-ashanti.gh',
    password: 'Officer@1234',
    name: 'Kwame Asante',
    role: 'officer',
    staff_id: 'STF003',
    designation: 'Environmental Officer',
    phone: '+233244000003',
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
  console.log('Creating staff accounts...')
  for (const s of STAFF) {
    let uid

    try {
      const existing = await authAdmin.getUserByEmail(s.email)
      uid = existing.uid
      console.log(`  [exists] ${s.email}  uid=${uid}`)
    } catch {
      const record = await authAdmin.createUser({
        email: s.email,
        password: s.password,
        displayName: s.name,
      })
      uid = record.uid
      console.log(`  [created] ${s.email}  uid=${uid}`)
    }

    await db
      .collection('staff')
      .doc(uid)
      .set(
        {
          uid,
          staff_id: s.staff_id,
          name: s.name,
          email: s.email,
          role: s.role,
          designation: s.designation,
          phone: s.phone,
        },
        { merge: true }
      )

    console.log(`  [staff doc] ${s.staff_id} → role: ${s.role}`)
  }

  // ── Counters ───────────────────────────────────────
  console.log('\nInitialising sector counters...')
  for (const c of COUNTERS) {
    const ref = db.collection('counters').doc(c.id)
    const snap = await ref.get()

    if (!snap.exists) {
      await ref.set({ last_count: 0, sector_name: c.sector_name })
      console.log(`  [created] ${c.id} — ${c.sector_name}`)
    } else {
      console.log(`  [exists]  ${c.id} — ${c.sector_name} (last_count=${snap.data().last_count})`)
    }
  }

  console.log('\nSeed complete.\n')
  console.log('Test credentials:')
  console.log('  admin@epa-ashanti.gh   / Admin@1234')
  console.log('  finance@epa-ashanti.gh / Finance@1234')
  console.log('  officer@epa-ashanti.gh / Officer@1234')
  console.log()

  process.exit(0)
}

seed().catch((err) => {
  console.error('\nSeed failed:', err.message)
  process.exit(1)
})
