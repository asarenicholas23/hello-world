/**
 * Sets assistant@epa-ashanti.gh to the internal I.T role.
 *
 * Requires scripts/serviceAccountKey.json, same as scripts/seed.cjs.
 * Run with: node scripts/setAssistantItRole.cjs
 */

const admin = require('firebase-admin')
const serviceAccount = require('./serviceAccountKey.json')

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
})

const db = admin.firestore()
const authAdmin = admin.auth()

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
