import {
  collection, doc, addDoc, getDoc, getDocs,
  updateDoc, deleteDoc, serverTimestamp, query, orderBy,
} from 'firebase/firestore'
import { db } from './config'

const col = () => collection(db, 'complaints')

export async function listComplaints() {
  const snap = await getDocs(query(col(), orderBy('created_at', 'desc')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function getComplaint(id) {
  const snap = await getDoc(doc(db, 'complaints', id))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function createComplaint(data, userId) {
  const ref = await addDoc(col(), { ...data, created_by: userId, created_at: serverTimestamp() })
  return ref.id
}

export async function updateComplaint(id, data, userId) {
  await updateDoc(doc(db, 'complaints', id), { ...data, updated_at: serverTimestamp(), updated_by: userId })
}

export async function deleteComplaint(id) {
  await deleteDoc(doc(db, 'complaints', id))
}
