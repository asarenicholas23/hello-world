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
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, auth, storage } from './config'
import { firebaseConfig } from './config'
import { ROLE_LEVEL } from '../data/constants'

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

export async function uploadStaffPhoto(uid, file) {
  const storageRef = ref(storage, `staff-photos/${uid}`)
  await uploadBytes(storageRef, file)
  return getDownloadURL(storageRef)
}

export async function createStaff(
  { name, email, password, role, phone, designation, qualification,
    date_of_appointment, date_of_birth, address },
  createdBy,
) {
  const secondaryAuth = getSecondaryAuth()
  const { user } = await createUserWithEmailAndPassword(secondaryAuth, email, password)
  await authSignOut(secondaryAuth)

  const staffId = await getNextStaffId()
  await setDoc(doc(db, 'staff', user.uid), {
    uid:                 user.uid,
    staff_id:            staffId,
    name,
    email,
    role,
    role_level:          ROLE_LEVEL[role] ?? null,
    phone:               phone ?? '',
    designation:         designation ?? '',
    qualification:       qualification ?? '',
    date_of_appointment: date_of_appointment ?? '',
    date_of_birth:       date_of_birth ?? '',
    address:             address ?? '',
    picture_url:         '',
    created_at:          serverTimestamp(),
    created_by:          createdBy,
  })
  return user.uid
}

export async function updateStaff(uid, { name, role, phone, designation, qualification, date_of_appointment, date_of_birth, address, picture_url }) {
  const data = {
    name,
    role,
    role_level:          ROLE_LEVEL[role] ?? null,
    phone:               phone ?? '',
    designation:         designation ?? '',
    qualification:       qualification ?? '',
    date_of_appointment: date_of_appointment ?? '',
    date_of_birth:       date_of_birth ?? '',
    address:             address ?? '',
    updated_at:          serverTimestamp(),
  }
  if (picture_url !== undefined) data.picture_url = picture_url
  await updateDoc(doc(db, 'staff', uid), data)
}

export async function deleteStaff(uid) {
  await deleteDoc(doc(db, 'staff', uid))
}

export async function updateOwnProfile(uid, { name, phone, designation, qualification, date_of_birth, address, picture_url }) {
  const data = {
    name,
    phone:         phone ?? '',
    designation:   designation ?? '',
    qualification: qualification ?? '',
    date_of_birth: date_of_birth ?? '',
    address:       address ?? '',
    updated_at:    serverTimestamp(),
  }
  if (picture_url !== undefined) data.picture_url = picture_url
  await updateDoc(doc(db, 'staff', uid), data)
}

export async function changeOwnPassword(currentPassword, newPassword) {
  const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword)
  await reauthenticateWithCredential(auth.currentUser, credential)
  await updatePassword(auth.currentUser, newPassword)
}
