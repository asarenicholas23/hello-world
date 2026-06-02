import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  serverTimestamp, query, orderBy, writeBatch,
} from 'firebase/firestore'
import { db } from './config'
import { facilityDocId } from '../utils/fileNumbers'

const FACILITY_SUBCOLLECTIONS = [
  'permits',
  'finance',
  'screenings',
  'site_verifications',
  'monitoring',
  'enforcement',
  'assignment_history',
]

function assertValidFileNumber(fileNumber) {
  if (!fileNumber?.trim()) throw new Error('File number is required.')
}

/**
 * Create a facility with an explicit file number (used during CSV import and manual entry).
 */
export async function createFacilityWithId(fileNumber, data, userId) {
  assertValidFileNumber(fileNumber)
  const facilityRef = doc(db, 'facilities', facilityDocId(fileNumber))
  const existing = await getDoc(facilityRef)

  if (existing.exists()) throw new Error(`File number already exists: ${fileNumber}`)

  await setDoc(facilityRef, {
    ...data,
    file_number: fileNumber,
    region: 'Ashanti',
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
    created_by: userId,
  })
  return fileNumber
}

export async function createFacility(data, userId) {
  const fileNumber = data.file_number?.trim()
  return createFacilityWithId(fileNumber, { ...data, file_number: fileNumber }, userId)
}

export async function updateFacility(fileNumber, data, userId) {
  await updateDoc(doc(db, 'facilities', facilityDocId(fileNumber)), {
    ...data,
    updated_at: serverTimestamp(),
    updated_by: userId,
  })
}

export async function renameFacilityFileNumber(oldFileNumber, newFileNumber, data, userId) {
  assertValidFileNumber(newFileNumber)
  const oldRef = doc(db, 'facilities', facilityDocId(oldFileNumber))
  const newRef = doc(db, 'facilities', facilityDocId(newFileNumber))
  const [oldSnap, newSnap] = await Promise.all([getDoc(oldRef), getDoc(newRef)])

  if (!oldSnap.exists()) throw new Error(`Facility not found: ${oldFileNumber}`)
  if (newSnap.exists()) throw new Error(`File number already exists: ${newFileNumber}`)

  const subcollectionDocs = await Promise.all(
    FACILITY_SUBCOLLECTIONS.map(async (name) => ({
      name,
      snap: await getDocs(collection(db, 'facilities', facilityDocId(oldFileNumber), name)),
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
      ops.push(['set', doc(db, 'facilities', facilityDocId(newFileNumber), name, subDoc.id), subDoc.data()])
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
  await deleteDoc(doc(db, 'facilities', facilityDocId(fileNumber)))
}

export async function getFacility(fileNumber) {
  const snap = await getDoc(doc(db, 'facilities', facilityDocId(fileNumber)))
  return snap.exists() ? snap.data() : null
}

export async function listFacilities() {
  const snap = await getDocs(
    query(collection(db, 'facilities'), orderBy('created_at', 'desc'))
  )
  return snap.docs.map((d) => d.data())
}
