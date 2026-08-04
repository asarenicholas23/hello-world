const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { defineSecret }      = require('firebase-functions/params')
const admin                 = require('firebase-admin')
const nodemailer            = require('nodemailer')
const {
  permitExpiry, permitExpired, unpaidInvoice, enforcementReminder, permitReady, OFFICE, CONTACT,
} = require('../sms/templates')

const EMAIL_USER = defineSecret('EMAIL_USER')
const EMAIL_PASS = defineSecret('EMAIL_PASS')
const ADMIN_ROLES = new Set(['admin', 'director'])

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function assertAdmin(auth) {
  if (!auth?.uid) throw new HttpsError('unauthenticated', 'Sign in required.')
  const snap = await admin.firestore().doc(`staff/${auth.uid}`).get()
  if (!snap.exists) throw new HttpsError('permission-denied', 'Admin, Director, or Data Access role required.')
  const data = snap.data()
  if (!ADMIN_ROLES.has(data.role) && !data.data_access) {
    throw new HttpsError('permission-denied', 'Admin, Director, or Data Access role required.')
  }
}

async function logEmail(db, payload) {
  await db.collection('email_log').add({
    ...payload,
    sent_at: admin.firestore.FieldValue.serverTimestamp(),
  })
}

function buildHtml(message) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, Helvetica, sans-serif; background: #f3f4f6; margin: 0; padding: 24px; }
    .wrap { max-width: 560px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,.1); }
    .hdr  { background: #1a5276; color: #fff; padding: 20px 28px; }
    .hdr h1 { margin: 0; font-size: 15pt; font-weight: 700; }
    .hdr p  { margin: 4px 0 0; font-size: 10pt; opacity: .8; }
    .body { padding: 28px; }
    .msg  { font-size: 12.5pt; line-height: 1.65; color: #111827; margin: 0; white-space: pre-wrap; }
    .foot { padding: 14px 28px; background: #f9fafb; border-top: 1px solid #e5e7eb; font-size: 9pt; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hdr">
      <h1>${OFFICE}</h1>
      <p>Environmental Protection Authority — Permit Management System</p>
    </div>
    <div class="body">
      <p class="msg">${message.replace(/\n/g, '<br>')}</p>
    </div>
    <div class="foot">This is an official communication from ${OFFICE}. Please do not reply directly to this email — contact ${CONTACT} with any questions.</div>
  </div>
</body>
</html>`
}

// Callable: send an email to a facility from the admin UI
exports.sendFacilityEmail = onCall({
  region:  'europe-west1',
  secrets: [EMAIL_USER, EMAIL_PASS],
}, async (request) => {
  await assertAdmin(request.auth)
  const db = admin.firestore()
  const {
    facilityId, template, customSubject, customMessage,
    extraEmails = [], attachments = [], facilityName: overrideName,
  } = request.data

  let facilityName = overrideName ?? ''
  let recipients   = []

  if (facilityId) {
    const facDoc = await db.collection('facilities').doc(facilityId).get()
    if (!facDoc.exists) throw new HttpsError('not-found', 'Facility not found.')
    const fac = facDoc.data()
    facilityName = fac.name
    if (fac.email?.trim() && EMAIL_RE.test(fac.email.trim())) recipients.push(fac.email.trim())
  }

  for (const e of extraEmails) {
    const trimmed = e?.trim()
    if (trimmed && EMAIL_RE.test(trimmed)) recipients.push(trimmed)
  }
  recipients = [...new Set(recipients)]

  if (!recipients.length) {
    throw new HttpsError('invalid-argument', 'No valid email addresses. Check the facility has an email on record.')
  }

  // Build subject + message from template
  let subject = ''
  let message = ''

  if (template === 'custom') {
    if (!customMessage?.trim()) throw new HttpsError('invalid-argument', 'Message text is required.')
    subject = customSubject?.trim() || `Notice from ${OFFICE}`
    message = customMessage.trim().replace(/\[Facility Name\]/gi, facilityName || 'Facility')

  } else if (template === 'permit_expiry_60' || template === 'permit_expiry_30' || template === 'permit_expiry_7') {
    const days = parseInt(template.replace('permit_expiry_', ''), 10)
    const permitsSnap = await db.collection(`facilities/${facilityId}/permits`)
      .orderBy('expiry_date', 'asc').limit(1).get()
    const permit = permitsSnap.docs[0]?.data()
    const expiryDateStr = permit?.expiry_date
      ? permit.expiry_date.toDate().toLocaleDateString('en-GH', { day: 'numeric', month: 'long', year: 'numeric' })
      : '(date unknown)'
    subject = `Permit Expiry Notice — ${days} day(s)`
    message = permitExpiry(facilityName, facilityId, days, expiryDateStr)

  } else if (template === 'permit_expired') {
    subject = 'Permit Expired Notice'
    message = permitExpired(facilityName, facilityId)

  } else if (template === 'unpaid_invoice') {
    const financeSnap = await db.collection(`facilities/${facilityId}/finance`)
      .where('payment_status', '==', 'unpaid').limit(1).get()
    const record = financeSnap.docs[0]?.data()
    subject = 'Outstanding Invoice Reminder'
    message = unpaidInvoice(
      facilityName, facilityId,
      record?.payment_type ?? 'outstanding invoice',
      record?.amount ?? 0,
    )

  } else if (template === 'enforcement_reminder') {
    const enfSnap = await db.collection(`facilities/${facilityId}/enforcement`)
      .orderBy('date', 'desc').limit(1).get()
    const enf = enfSnap.docs[0]?.data()
    const actionLabel = enf?.action_taken ?? 'enforcement action'
    const date = enf?.date
      ? enf.date.toDate().toLocaleDateString('en-GH', { day: 'numeric', month: 'long', year: 'numeric' })
      : '(date unknown)'
    subject = 'Enforcement Action Reminder'
    message = enforcementReminder(facilityName, facilityId, actionLabel, date)

  } else if (template === 'permit_ready') {
    subject = 'Permit Ready for Collection'
    message = permitReady(facilityName, facilityId)

  } else if (template === 'monitoring_report') {
    subject = 'Monitoring Report'
    message = customMessage?.trim() ||
      `Dear ${facilityName} (${facilityId}), please find attached your environmental monitoring report from ${OFFICE}. Kindly review and contact us at ${CONTACT} with any questions.`

  } else if (template === 'schedule_notice') {
    subject = 'Schedule Notice'
    message = customMessage?.trim() ||
      `Dear ${facilityName} (${facilityId}), please find attached the schedule from ${OFFICE}. Contact us at ${CONTACT} with any questions.`

  } else {
    throw new HttpsError('invalid-argument', `Unknown template: ${template}`)
  }

  const mailAttachments = attachments
    .filter((a) => a?.url && a?.filename)
    .map((a) => ({ filename: a.filename, path: a.url }))

  const emailUser = EMAIL_USER.value()
  const emailPass = EMAIL_PASS.value()
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: emailUser, pass: emailPass },
  })

  try {
    await transporter.sendMail({
      from:        `"${OFFICE}" <${emailUser}>`,
      to:          recipients.join(', '),
      subject,
      text:        message,
      html:        buildHtml(message),
      attachments: mailAttachments,
    })
    await logEmail(db, {
      recipients,
      subject,
      message,
      template,
      facility_id:   facilityId ?? null,
      facility_name: facilityName || null,
      attachments:   mailAttachments.map((a) => a.filename),
      triggered_by:  request.auth.uid,
      status:        'sent',
    })
    return { success: true, recipients, subject }
  } catch (err) {
    await logEmail(db, {
      recipients,
      subject,
      message,
      template,
      facility_id:  facilityId ?? null,
      facility_name: facilityName || null,
      attachments:  mailAttachments.map((a) => a.filename),
      triggered_by: request.auth.uid,
      status:       'failed',
      error:        err.message,
    })
    throw new HttpsError('internal', err.message)
  }
})
