const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { defineSecret }      = require('firebase-functions/params')
const admin                 = require('firebase-admin')
const { sendSms, normalizePhone } = require('./arkesel')
const { permitExpiry, permitExpired, unpaidInvoice, enforcementReminder, permitReady } = require('./templates')

const ARKESEL_API_KEY = defineSecret('ARKESEL_API_KEY')
const ADMIN_ROLES     = new Set(['admin', 'director'])

async function assertAdmin(auth) {
  if (!auth?.uid) throw new HttpsError('unauthenticated', 'Sign in required.')
  const snap = await admin.firestore().doc(`staff/${auth.uid}`).get()
  if (!snap.exists || !ADMIN_ROLES.has(snap.data().role)) {
    throw new HttpsError('permission-denied', 'Admin or Director role required.')
  }
}

async function logSms(db, payload) {
  await db.collection('sms_log').add({
    ...payload,
    sent_at: admin.firestore.FieldValue.serverTimestamp(),
  })
}

// Callable: send an SMS from the admin UI
exports.sendFacilitySms = onCall({
  region:  'europe-west1',
  secrets: [ARKESEL_API_KEY],
}, async (request) => {
  await assertAdmin(request.auth)
  const db     = admin.firestore()
  const apiKey = ARKESEL_API_KEY.value()
  const { facilityId, template, customMessage, extraPhones = [], facilityName: overrideName } = request.data

  let facilityName = overrideName ?? ''
  let recipients   = []

  if (facilityId) {
    const facDoc = await db.collection('facilities').doc(facilityId).get()
    if (!facDoc.exists) throw new HttpsError('not-found', 'Facility not found.')
    const fac = facDoc.data()
    facilityName = fac.name
    const phone = normalizePhone(fac.phone)
    if (phone) recipients.push(phone)
  }

  // Extra manual phone numbers added in the UI
  for (const p of extraPhones) {
    const n = normalizePhone(p)
    if (n) recipients.push(n)
  }

  console.log(`[sendFacilitySms] facilityId=${facilityId} template=${template} rawRecipients=${JSON.stringify(recipients)}`)

  if (!recipients.length) {
    console.error('[sendFacilitySms] no valid phone numbers after normalisation. Raw phone from facility:', facilityId)
    throw new HttpsError('invalid-argument', 'No valid phone numbers. Check the facility has a phone on record.')
  }

  // Build message from template
  let message = ''
  if (template === 'custom') {
    if (!customMessage?.trim()) throw new HttpsError('invalid-argument', 'Message text is required.')
    message = customMessage.trim()

  } else if (template === 'permit_expiry_60' || template === 'permit_expiry_30' || template === 'permit_expiry_7') {
    const days = parseInt(template.replace('permit_expiry_', ''), 10)
    const permitsSnap = await db.collection(`facilities/${facilityId}/permits`)
      .orderBy('expiry_date', 'asc').limit(1).get()
    const permit = permitsSnap.docs[0]?.data()
    const expiryDateStr = permit?.expiry_date
      ? permit.expiry_date.toDate().toLocaleDateString('en-GH', { day: 'numeric', month: 'long', year: 'numeric' })
      : '(date unknown)'
    message = permitExpiry(facilityName, facilityId, days, expiryDateStr)

  } else if (template === 'permit_expired') {
    message = permitExpired(facilityName, facilityId)

  } else if (template === 'unpaid_invoice') {
    const financeSnap = await db.collection(`facilities/${facilityId}/finance`)
      .where('payment_status', '==', 'unpaid').limit(1).get()
    const record = financeSnap.docs[0]?.data()
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
    message = enforcementReminder(facilityName, facilityId, actionLabel, date)

  } else if (template === 'permit_ready') {
    message = permitReady(facilityName, facilityId)

  } else {
    throw new HttpsError('invalid-argument', `Unknown template: ${template}`)
  }

  try {
    const arkeselResponse = await sendSms(apiKey, recipients, message)
    // Capture per-recipient info from Arkesel data[] — use null not undefined (Firestore rejects undefined)
    const recipientStatuses = Array.isArray(arkeselResponse.data)
      ? arkeselResponse.data.map((r) => ({
          recipient: r.recipient ?? null,
          status:    r.status   ?? null,
          reason:    r.reason   ?? null,
        }))
      : []
    await logSms(db, {
      recipients,
      message,
      template,
      facility_id:       facilityId ?? null,
      facility_name:     facilityName || null,   // empty string → null
      triggered_by:      request.auth.uid,
      status:            'sent',
      arkesel_response:  arkeselResponse,
      recipient_statuses: recipientStatuses,
    })
    return { success: true, recipients, message }
  } catch (err) {
    await logSms(db, {
      recipients,
      message,
      template,
      facility_id:      facilityId ?? null,
      triggered_by:     request.auth.uid,
      status:           'failed',
      arkesel_response: { error: err.message },
    })
    throw new HttpsError('internal', err.message)
  }
})
