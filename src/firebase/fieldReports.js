import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc,
  serverTimestamp, query, orderBy,
} from 'firebase/firestore'
import { db } from './config'

const COL = () => collection(db, 'field_reports')

export async function listFieldReports() {
  const snap = await getDocs(query(COL(), orderBy('created_at', 'desc')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function getFieldReport(id) {
  const snap = await getDoc(doc(db, 'field_reports', id))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function createFieldReport(data, userId) {
  const ref = await addDoc(COL(), {
    ...data,
    reporting_status:      'pending',
    invoice_status:        'pending',
    assigned_file_number:  null,
    created_at:            serverTimestamp(),
    created_by:            userId,
  })
  return ref.id
}

export async function updateFieldReport(id, data, userId) {
  await updateDoc(doc(db, 'field_reports', id), {
    ...data,
    updated_at: serverTimestamp(),
    updated_by: userId,
  })
}

export async function deleteFieldReport(id) {
  await deleteDoc(doc(db, 'field_reports', id))
}
