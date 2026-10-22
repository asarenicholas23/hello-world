/**
 * Sets assistant@epa-ashanti.gh to the internal I.T role.
 *
 * Requires scripts/serviceAccountKey.json, same as scripts/seed.cjs.
 * Run with: node scripts/setAssistantItRole.cjs
 */

const { initializeApp, cert } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const { getAuth } = require('firebase-admin/auth')
const serviceAccount = require('./serviceAccountKey.json')

initializeApp({
  credential: cert(serviceAccount),
})

const db = getFirestore()
const authAdmin = getAuth()

async function main() {
  const email = 'assistant@epa-ashanti.gh'
  const user = await authAdmin.getUserByEmail(email)

  await db.collection('staff').doc(user.uid).set(
    {
      uid: user.uid,
      email,
      role: 'it',
      role_level: null,
      designation: 'Assistant Programme Officer / I.T',
      data_access: true,
    },
    { merge: true },
  )

  console.log(`${email} is now role=it, designation="Assistant Programme Officer / I.T", data_access=true`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err.message)
    process.exit(1)
  })
