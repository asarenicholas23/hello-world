import {
  collection, addDoc, getDocs, updateDoc, doc,
  query, where, orderBy, limit, onSnapshot, serverTimestamp,
} from 'firebase/firestore'
import { db } from './config'

export async function createNotification(recipientUid, type, message, metadata = {}) {
  await addDoc(collection(db, 'notifications'), {
    recipient_uid: recipientUid,
    type,
    message,
    metadata,
    read: false,
    created_at: serverTimestamp(),
  })
}

export function subscribeNotifications(uid, callback) {
  const q = query(
    collection(db, 'notifications'),
    where('recipient_uid', '==', uid),
    orderBy('created_at', 'desc'),
    limit(30),
  )
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

export async function markRead(notifId) {
  await updateDoc(doc(db, 'notifications', notifId), { read: true })
}

export async function markAllRead(uid) {
  const q = query(
    collection(db, 'notifications'),
    where('recipient_uid', '==', uid),
    where('read', '==', false),
  )
  const snap = await getDocs(q)
  await Promise.all(snap.docs.map((d) => updateDoc(d.ref, { read: true })))
}
