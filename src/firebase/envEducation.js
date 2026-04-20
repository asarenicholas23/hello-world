import {
  collection, doc, addDoc, getDoc, getDocs,
  updateDoc, deleteDoc, serverTimestamp, query, orderBy,
} from 'firebase/firestore'
import { db } from './config'

const col = () => collection(db, 'environmental_education')

export async function listEnvEducation() {
  const snap = await getDocs(query(col(), orderBy('created_at', 'desc')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function getEnvEducation(id) {
  const snap = await getDoc(doc(db, 'environmental_education', id))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function createEnvEducation(data, userId) {
  const ref = await addDoc(col(), { ...data, created_by: userId, created_at: serverTimestamp() })
  return ref.id
}

export async function updateEnvEducation(id, data, userId) {
  await updateDoc(doc(db, 'environmental_education', id), { ...data, updated_at: serverTimestamp(), updated_by: userId })
}

export async function deleteEnvEducation(id) {
  await deleteDoc(doc(db, 'environmental_education', id))
}
