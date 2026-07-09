import { getFunctions, httpsCallable } from 'firebase/functions'
import { collection, getDocs, orderBy, limit, query } from 'firebase/firestore'
import { db } from './config'

const functions = getFunctions(undefined, 'europe-west1')

export async function sendFacilityEmail({
  facilityId, facilityName, template, customSubject, customMessage, extraEmails, attachments,
}) {
  const fn = httpsCallable(functions, 'sendFacilityEmail')
  const result = await fn({
    facilityId, facilityName, template, customSubject, customMessage,
    extraEmails: extraEmails ?? [],
    attachments: attachments ?? [],
  })
  return result.data
}

export async function getEmailLog(limitCount = 100) {
  const snap = await getDocs(
    query(collection(db, 'email_log'), orderBy('sent_at', 'desc'), limit(limitCount))
  )
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

// Template previews for the compose UI (mirrors functions/sms/templates.js + functions/email/facilityEmail.js)
const OFFICE  = 'EPA Konongo Area Office'
const CONTACT = '0541405654'

export const EMAIL_TEMPLATES = [
  { value: 'permit_expiry_60',     label: 'Permit Expiry — 60 days',       requiresFacility: true },
  { value: 'permit_expiry_30',     label: 'Permit Expiry — 30 days',       requiresFacility: true },
  { value: 'permit_expiry_7',      label: 'Permit Expiry — 7 days',        requiresFacility: true },
  { value: 'permit_expired',       label: 'Permit Expired Notice',         requiresFacility: true },
  { value: 'unpaid_invoice',       label: 'Unpaid Invoice Reminder',       requiresFacility: true },
  { value: 'enforcement_reminder', label: 'Enforcement Action Reminder',   requiresFacility: true },
  { value: 'permit_ready',         label: 'Permit Ready for Collection',   requiresFacility: true },
  { value: 'monitoring_report',    label: 'Monitoring Report',             requiresFacility: true },
  { value: 'schedule_notice',      label: 'Schedule Notice',               requiresFacility: true },
  { value: 'custom',               label: 'Custom Message',                requiresFacility: false },
]

export function previewTemplate(template, facility) {
  const name = facility?.name ?? '[Facility Name]'
  const id   = facility?.file_number ?? '[File No]'
  switch (template) {
    case 'permit_expiry_60':     return `Dear ${name} (${id}), your EPA Environmental Permit expires in 60 day(s) on (expiry date). Contact ${OFFICE} to begin renewal. ${CONTACT}`
    case 'permit_expiry_30':     return `Dear ${name} (${id}), your EPA Environmental Permit expires in 30 day(s) on (expiry date). Contact ${OFFICE} to begin renewal. ${CONTACT}`
    case 'permit_expiry_7':      return `Dear ${name} (${id}), your EPA Environmental Permit expires in 7 day(s) on (expiry date). Contact ${OFFICE} to begin renewal. ${CONTACT}`
    case 'permit_expired':       return `Dear ${name} (${id}), your EPA Environmental Permit has EXPIRED. Kindly visit ${OFFICE}  located at Lowcost, near Holy Virgin School, to commence the permit renewal process immediately. For any enquiries or assistance, kindly contact us on ${CONTACT}`
    case 'unpaid_invoice':       return `Dear ${name} (${id}), you have an outstanding (payment type) of GHS (amount) owed to ${OFFICE}. Please settle promptly to avoid enforcement action. ${CONTACT}`
    case 'enforcement_reminder': return `Dear ${name} (${id}), this is a reminder of the (action) issued against your facility on (date). Please visit ${OFFICE} to discuss compliance steps. ${CONTACT}`
    case 'permit_ready':         return `Dear ${name} (${id}), your EPA Environmental Permit is ready for collection at ${OFFICE}. Please visit us with the required fees to collect it. ${CONTACT}`
    case 'monitoring_report':    return `Dear ${name} (${id}), please find attached your environmental monitoring report from ${OFFICE}. Kindly review and contact us at ${CONTACT} with any questions.`
    case 'schedule_notice':      return `Dear ${name} (${id}), please find attached the schedule from ${OFFICE}. Contact us at ${CONTACT} with any questions.`
    default: return ''
  }
}

export function previewSubject(template) {
  switch (template) {
    case 'permit_expiry_60':
    case 'permit_expiry_30':
    case 'permit_expiry_7':      return 'Permit Expiry Notice'
    case 'permit_expired':       return 'Permit Expired Notice'
    case 'unpaid_invoice':       return 'Outstanding Invoice Reminder'
    case 'enforcement_reminder': return 'Enforcement Action Reminder'
    case 'permit_ready':         return 'Permit Ready for Collection'
    case 'monitoring_report':    return 'Monitoring Report'
    case 'schedule_notice':      return 'Schedule Notice'
    default: return ''
  }
}
