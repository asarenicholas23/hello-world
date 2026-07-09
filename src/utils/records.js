import { Timestamp } from 'firebase/firestore'

/** Firestore Timestamp → 'YYYY-MM-DD' for date inputs */
export function tsToInput(ts) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toISOString().split('T')[0]
}

/** 'YYYY-MM-DD' → Firestore Timestamp (local midnight) */
export function inputToTs(str) {
  if (!str) return null
  return Timestamp.fromDate(new Date(str + 'T00:00:00'))
}

/** Firestore Timestamp → human-readable date */
export function fmtDate(ts) {
  if (!ts) return '—'
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Current date as 'YYYY-MM-DD' (Ghana has no DST, so UTC date = local date) */
export function dateStr(d = new Date()) {
  return d.toISOString().split('T')[0]
}

/** Firestore Timestamp → time-of-day, e.g. "8:32 AM" */
export function fmtTime(ts) {
  if (!ts) return '—'
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleTimeString('en-GH', { hour: 'numeric', minute: '2-digit' })
}

/** Compute permit status from expiry Timestamp */
export function permitStatus(expiryTs) {
  if (!expiryTs) return null
  const expiry = expiryTs.toDate ? expiryTs.toDate() : new Date(expiryTs)
  const diff = expiry - Date.now()
  if (diff < 0) return 'expired'
  if (diff < 60 * 24 * 60 * 60 * 1000) return 'expiring'
  return 'active'
}
