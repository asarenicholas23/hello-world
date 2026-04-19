import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  runTransaction, serverTimestamp, query, orderBy,
} from 'firebase/firestore'
import { db } from './config'

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
