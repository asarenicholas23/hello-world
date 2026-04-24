import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  runTransaction, serverTimestamp, query, orderBy, writeBatch,
} from 'firebase/firestore'
import { db } from './config'

const FACILITY_SUBCOLLECTIONS = [
  'permits',
  'finance',
  'screenings',
  'site_verifications',
  'monitoring',
  'enforcement',
  'assignment_history',
]

/**
 * Atomically increments the sector counter and returns the new file number.
 * Requires network — cannot run offline.
 */
export async function generateFileNumber(sectorPrefix) {
  const counterRef = doc(db, 'counters', sectorPrefix)
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef)
    if (!snap.exists()) throw new Error(`Counter not found for sector prefix: ${sectorPrefix}`)
    const newCount = snap.data().last_count + 1
    tx.update(counterRef, { last_count: newCount })
    return `${sectorPrefix}${newCount}`
  })
}

/**
 * Create a facility with an explicit file number (used during CSV import).
 * Also bumps the sector counter so future auto-generation won't collide.
 */
export async function createFacilityWithId(fileNumber, data, userId) {
  const prefix = fileNumber.replace(/\d+$/, '')
  const numPart = parseInt(fileNumber.replace(/^\D+/, ''), 10)
  const counterRef = doc(db, 'counters', prefix)
  const facilityRef = doc(db, 'facilities', fileNumber)

  await runTransaction(db, async (tx) => {
    const counterSnap = await tx.get(counterRef)
    if (counterSnap.exists() && numPart > counterSnap.data().last_count) {
      tx.update(counterRef, { last_count: numPart })
    }
    tx.set(facilityRef, {
      ...data,
      file_number: fileNumber,
      region: 'Ashanti',
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
      created_by: userId,
    })
  })
  return fileNumber
}

export async function createFacility(data, userId) {
  const fileNumber = await generateFileNumber(data.sector_prefix)
  await setDoc(doc(db, 'facilities', fileNumber), {
    ...data,
    file_number: fileNumber,
    region: 'Ashanti',
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
    created_by: userId,
  })
  return fileNumber
}

export async function updateFacility(fileNumber, data, userId) {
  await updateDoc(doc(db, 'facilities', fileNumber), {
    ...data,
    updated_at: serverTimestamp(),
    updated_by: userId,
  })
}

export async function renameFacilityFileNumber(oldFileNumber, newFileNumber, data, userId) {
  const oldRef = doc(db, 'facilities', oldFileNumber)
  const newRef = doc(db, 'facilities', newFileNumber)
  const [oldSnap, newSnap] = await Promise.all([getDoc(oldRef), getDoc(newRef)])

  if (!oldSnap.exists()) throw new Error(`Facility not found: ${oldFileNumber}`)
  if (newSnap.exists()) throw new Error(`File number already exists: ${newFileNumber}`)

  const prefix = newFileNumber.replace(/\d+$/, '')
  const numPart = parseInt(newFileNumber.replace(/^\D+/, ''), 10)
  const counterRef = doc(db, 'counters', prefix)
  await runTransaction(db, async (tx) => {
    const counterSnap = await tx.get(counterRef)
    if (counterSnap.exists() && numPart > counterSnap.data().last_count) {
      tx.update(counterRef, { last_count: numPart })
    }
  })

  const subcollectionDocs = await Promise.all(
    FACILITY_SUBCOLLECTIONS.map(async (name) => ({
      name,
      snap: await getDocs(collection(db, 'facilities', oldFileNumber, name)),
    }))
  )

  const ops = [
    ['set', newRef, {
      ...oldSnap.data(),
      ...data,
      file_number: newFileNumber,
      updated_at: serverTimestamp(),
      updated_by: userId,
    }],
  ]

  for (const { name, snap } of subcollectionDocs) {
    for (const subDoc of snap.docs) {
      ops.push(['set', doc(db, 'facilities', newFileNumber, name, subDoc.id), subDoc.data()])
      ops.push(['delete', subDoc.ref])
    }
  }
  ops.push(['delete', oldRef])

  for (let i = 0; i < ops.length; i += 450) {
    const batch = writeBatch(db)
    for (const [type, ref, value] of ops.slice(i, i + 450)) {
      if (type === 'set') batch.set(ref, value)
      else batch.delete(ref)
    }
    await batch.commit()
  }
}

export async function deleteFacility(fileNumber) {
  await deleteDoc(doc(db, 'facilities', fileNumber))
}

export async function getFacility(fileNumber) {
  const snap = await getDoc(doc(db, 'facilities', fileNumber))
  return snap.exists() ? snap.data() : null
}

export async function listFacilities() {
  const snap = await getDocs(
    query(collection(db, 'facilities'), orderBy('created_at', 'desc'))
  )
  return snap.docs.map((d) => d.data())
}
