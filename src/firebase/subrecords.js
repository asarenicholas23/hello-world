import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc,
  serverTimestamp, query, orderBy,
} from 'firebase/firestore'
import { db } from './config'

function subCol(fileNumber, category) {
  return collection(db, 'facilities', fileNumber, category)
}

export async function listSubRecords(fileNumber, category) {
  const snap = await getDocs(
    query(subCol(fileNumber, category), orderBy('created_at', 'desc'))
  )
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function getSubRecord(fileNumber, category, id) {
  const snap = await getDoc(doc(db, 'facilities', fileNumber, category, id))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function createSubRecord(fileNumber, category, data, userId) {
  const ref = await addDoc(subCol(fileNumber, category), {
    ...data,
    created_at: serverTimestamp(),
    created_by: userId,
  })
  return ref.id
}

export async function updateSubRecord(fileNumber, category, id, data, userId) {
  await updateDoc(doc(db, 'facilities', fileNumber, category, id), {
    ...data,
    updated_at: serverTimestamp(),
    updated_by: userId,
  })
}

export async function deleteSubRecord(fileNumber, category, id) {
  await deleteDoc(doc(db, 'facilities', fileNumber, category, id))
}
