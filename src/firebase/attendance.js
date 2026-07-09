import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
  query, where, orderBy, serverTimestamp,
} from 'firebase/firestore'
import { db } from './config'
import { dateStr } from '../utils/records'

const col = () => collection(db, 'attendance')
const docId = (uid, date) => `${uid}_${date}`

export async function getTodayAttendance(uid) {
  const snap = await getDoc(doc(db, 'attendance', docId(uid, dateStr())))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function clockIn(uid, staffName, staffRole, coords, distanceM) {
  const date = dateStr()
  const ref = doc(db, 'attendance', docId(uid, date))
  const existing = await getDoc(ref)
  if (existing.exists()) throw new Error('Already clocked in today.')

  await setDoc(ref, {
    staff_uid:             uid,
    staff_name:            staffName,
    staff_role:            staffRole,
    date,
    clock_in_at:           serverTimestamp(),
    clock_in_coords:       coords,
    clock_in_distance_m:   Math.round(distanceM),
    clock_out_at:          null,
    clock_out_coords:      null,
    clock_out_distance_m: null,
    created_at:            serverTimestamp(),
    updated_at:            serverTimestamp(),
  })
}

export async function clockOut(uid, coords, distanceM) {
  const ref = doc(db, 'attendance', docId(uid, dateStr()))
  const existing = await getDoc(ref)
  if (!existing.exists()) throw new Error('You have not clocked in today.')
  if (existing.data().clock_out_at) throw new Error('Already clocked out today.')

  await updateDoc(ref, {
    clock_out_at:          serverTimestamp(),
    clock_out_coords:      coords,
    clock_out_distance_m: Math.round(distanceM),
    updated_at:            serverTimestamp(),
  })
}

// Personal history — single equality filter, no composite index needed.
export async function listAttendanceForStaff(uid, { from, to } = {}) {
  const snap = await getDocs(query(col(), where('staff_uid', '==', uid)))
  let rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  if (from) rows = rows.filter((r) => r.date >= from)
  if (to)   rows = rows.filter((r) => r.date <= to)
  return rows.sort((a, b) => b.date.localeCompare(a.date))
}

// Admin report — range + orderBy on the same field ('date'), no composite index needed.
export async function listAllAttendance({ from, to } = {}) {
  const clauses = [orderBy('date', 'asc')]
  if (from) clauses.unshift(where('date', '>=', from))
  if (to)   clauses.unshift(where('date', '<=', to))
  const snap = await getDocs(query(col(), ...clauses))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}
