import { getFunctions, httpsCallable } from 'firebase/functions'
import { collection, getDocs, orderBy, limit, query } from 'firebase/firestore'
import { db } from './config'

const functions = getFunctions(undefined, 'europe-west1')

export async function sendFacilitySms({ facilityId, template, customMessage, extraPhones }) {
  const fn = httpsCallable(functions, 'sendFacilitySms')
  const result = await fn({ facilityId, template, customMessage, extraPhones })
  return result.data
}

export async function getSmsLog(limitCount = 100) {
  const snap = await getDocs(
    query(collection(db, 'sms_log'), orderBy('sent_at', 'desc'), limit(limitCount))
  )
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

// Template previews for the compose UI (mirrors functions/sms/templates.js)
const OFFICE  = 'EPA Konongo Area Office'
const CONTACT = '032-200-0000'

export const SMS_TEMPLATES = [
  { value: 'permit_expiry_60', label: 'Permit Expiry — 60 days',  requiresFacility: true },
  { value: 'permit_expiry_30', label: 'Permit Expiry — 30 days',  requiresFacility: true },
  { value: 'permit_expiry_7',  label: 'Permit Expiry — 7 days',   requiresFacility: true },
  { value: 'permit_expired',   label: 'Permit Expired Notice',    requiresFacility: true },
  { value: 'unpaid_invoice',   label: 'Unpaid Invoice Reminder',  requiresFacility: true },
  { value: 'custom',           label: 'Custom Message',           requiresFacility: false },
]

export function previewTemplate(template, facility) {
  const name = facility?.name ?? '[Facility Name]'
  const id   = facility?.file_number ?? '[File No]'
  switch (template) {
    case 'permit_expiry_60': return `Dear ${name} (${id}), your EPA Environmental Permit expires in 60 day(s) on (expiry date). Contact ${OFFICE} to begin renewal. ${CONTACT}`
    case 'permit_expiry_30': return `Dear ${name} (${id}), your EPA Environmental Permit expires in 30 day(s) on (expiry date). Contact ${OFFICE} to begin renewal. ${CONTACT}`
    case 'permit_expiry_7':  return `Dear ${name} (${id}), your EPA Environmental Permit expires in 7 day(s) on (expiry date). Contact ${OFFICE} to begin renewal. ${CONTACT}`
    case 'permit_expired':   return `Dear ${name} (${id}), your EPA Environmental Permit has EXPIRED. Operating without a valid permit is a violation of the EPA Act. Contact ${OFFICE} immediately. ${CONTACT}`
    case 'unpaid_invoice':   return `Dear ${name} (${id}), you have an outstanding (payment type) of GHS (amount) owed to ${OFFICE}. Please settle promptly to avoid enforcement action. ${CONTACT}`
    default: return ''
  }
}
