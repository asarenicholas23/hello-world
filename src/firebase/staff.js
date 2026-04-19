import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  serverTimestamp,
} from 'firebase/firestore'
import {
  createUserWithEmailAndPassword, signOut as authSignOut,
  updatePassword, EmailAuthProvider, reauthenticateWithCredential,
} from 'firebase/auth'
import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { db } from './config'
import { firebaseConfig } from './config'

function getSecondaryAuth() {
  const existing = getApps().find((a) => a.name === 'secondary')
  const app = existing ?? initializeApp(firebaseConfig, 'secondary')
  return getAuth(app)
}

async function getNextStaffId() {
  const snap = await getDocs(collection(db, 'staff'))
  const nums = snap.docs
    .map((d) => parseInt((d.data().staff_id ?? '').replace('STF', ''), 10))
    .filter((n) => !isNaN(n))
  const max = nums.length ? Math.max(...nums) : 0
  return `STF${String(max + 1).padStart(3, '0')}`
}

export async function listStaff() {
  const snap = await getDocs(collection(db, 'staff'))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function getStaffMember(uid) {
  const snap = await getDoc(doc(db, 'staff', uid))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function createStaff({ name, email, password, role, phone }, createdBy) {
  const secondaryAuth = getSecondaryAuth()
  const { user } = await createUserWithEmailAndPassword(secondaryAuth, email, password)
  await authSignOut(secondaryAuth)

  const staffId = await getNextStaffId()
  await setDoc(doc(db, 'staff', user.uid), {
    uid: user.uid,
    staff_id: staffId,
    name,
    email,
    role,
    phone: phone ?? '',
    created_at: serverTimestamp(),
    created_by: createdBy,
  })
  return user.uid
}

export async function updateStaff(uid, { name, role, phone }) {
  await updateDoc(doc(db, 'staff', uid), {
    name,
    role,
    phone: phone ?? '',
    updated_at: serverTimestamp(),
  })
}

export async function deleteStaff(uid) {
  await deleteDoc(doc(db, 'staff', uid))
}
