import { getMessaging, getToken, onMessage } from 'firebase/messaging'
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore'
import { app, db } from './config'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY

let _messaging = null
function getMsg() {
  if (!_messaging) _messaging = getMessaging(app)
  return _messaging
}

export async function requestPushPermission(uid) {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return
  if (Notification.permission === 'denied') return
  try {
    const token = await getToken(getMsg(), { vapidKey: VAPID_KEY })
    if (token && uid) {
      await updateDoc(doc(db, 'staff', uid), { fcm_tokens: arrayUnion(token) })
    }
  } catch (err) {
    console.warn('[FCM] token request failed:', err.message)
  }
}

export async function removeFcmToken(uid, token) {
  try {
    await updateDoc(doc(db, 'staff', uid), { fcm_tokens: arrayRemove(token) })
  } catch { /* ignore */ }
}

export function onForegroundMessage(callback) {
  return onMessage(getMsg(), callback)
}
