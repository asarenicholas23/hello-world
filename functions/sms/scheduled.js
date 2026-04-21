const { onSchedule }   = require('firebase-functions/v2/scheduler')
const { defineSecret } = require('firebase-functions/params')
const admin            = require('firebase-admin')
const { sendSms, normalizePhone } = require('./arkesel')
const { permitExpiry, permitExpired, unpaidInvoice } = require('./templates')

const ARKESEL_API_KEY = defineSecret('ARKESEL_API_KEY')
const EXPIRY_THRESHOLDS = [7, 30, 60]

function fmtDate(ts) {
  if (!ts) return '(unknown date)'
  const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000)
  return d.toLocaleDateString('en-GH', { day: 'numeric', month: 'long', year: 'numeric' })
}

function isoWeek(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7)
  const w1 = new Date(d.getFullYear(), 0, 4)
  return 1 + Math.round(((d - w1) / 86400000 - 3 + (w1.getDay() + 6) % 7) / 7)
}

async function alreadySent(db, key) {
  return (await db.collection('sms_dedup').doc(key).get()).exists
}

async function markSent(db, key) {
  await db.collection('sms_dedup').doc(key).set({
    sent_at: admin.firestore.FieldValue.serverTimestamp(),
  })
}

async function logSms(db, payload) {
  await db.collection('sms_log').add({
    ...payload,
    sent_at: admin.firestore.FieldValue.serverTimestamp(),
  })
}

// ── Daily permit expiry reminders — runs at 07:00 WAT ────────
exports.dailyPermitReminders = onSchedule({
  schedule:  '0 7 * * *',
  timeZone:  'Africa/Accra',
  region:    'europe-west1',
  secrets:   [ARKESEL_API_KEY],
}, async () => {
  const db     = admin.firestore()
  const apiKey = ARKESEL_API_KEY.value()
  const now    = Date.now()
  const todayStr = new Date().toISOString().slice(0, 10)

  const [facilitiesSnap, permitsSnap] = await Promise.all([
    db.collection('facilities').get(),
    db.collectionGroup('permits').get(),
  ])

  const facilities = {}
  facilitiesSnap.forEach((d) => { facilities[d.id] = d.data() })

  for (const doc of permitsSnap.docs) {
    const permit     = doc.data()
    const fileNumber = doc.ref.parent.parent.id
    const facility   = facilities[fileNumber]
    if (!facility) continue

    const phone = normalizePhone(facility.phone)
    if (!phone) continue

    const expiryMs = permit.expiry_date?.toMillis?.() ?? null
    if (!expiryMs) continue

    const daysLeft = Math.round((expiryMs - now) / 86400000)

    // Just-expired (within last 24 h)
    if (daysLeft === 0 || daysLeft === -1) {
      const key = `expired_${fileNumber}_${doc.id}_${todayStr}`
      if (await alreadySent(db, key)) continue
      const msg = permitExpired(facility.name, fileNumber)
      try {
        const resp = await sendSms(apiKey, [phone], msg)
        await logSms(db, { recipients: [phone], message: msg, template: 'permit_expired', facility_id: fileNumber, triggered_by: 'scheduled', status: 'sent', arkesel_response: resp })
        await markSent(db, key)
      } catch (err) {
        await logSms(db, { recipients: [phone], message: msg, template: 'permit_expired', facility_id: fileNumber, triggered_by: 'scheduled', status: 'failed', arkesel_response: { error: err.message } })
      }
      continue
    }

    for (const threshold of EXPIRY_THRESHOLDS) {
      if (daysLeft !== threshold) continue
      const key = `expiry_${threshold}d_${fileNumber}_${doc.id}_${todayStr}`
      if (await alreadySent(db, key)) continue
      const msg = permitExpiry(facility.name, fileNumber, threshold, fmtDate(permit.expiry_date))
      try {
        const resp = await sendSms(apiKey, [phone], msg)
        await logSms(db, { recipients: [phone], message: msg, template: `permit_expiry_${threshold}d`, facility_id: fileNumber, triggered_by: 'scheduled', status: 'sent', arkesel_response: resp })
        await markSent(db, key)
      } catch (err) {
        await logSms(db, { recipients: [phone], message: msg, template: `permit_expiry_${threshold}d`, facility_id: fileNumber, triggered_by: 'scheduled', status: 'failed', arkesel_response: { error: err.message } })
      }
    }
  }
})

// ── Weekly unpaid invoice reminders — runs Monday 08:00 WAT ──
exports.weeklyUnpaidReminders = onSchedule({
  schedule:  '0 8 * * 1',
  timeZone:  'Africa/Accra',
  region:    'europe-west1',
  secrets:   [ARKESEL_API_KEY],
}, async () => {
  const db     = admin.firestore()
  const apiKey = ARKESEL_API_KEY.value()
  const weekKey = `W${isoWeek(new Date())}_${new Date().getFullYear()}`

  const [facilitiesSnap, financeSnap] = await Promise.all([
    db.collection('facilities').get(),
    db.collectionGroup('finance').get(),
  ])

  const facilities = {}
  facilitiesSnap.forEach((d) => { facilities[d.id] = d.data() })

  for (const doc of financeSnap.docs) {
    const data = doc.data()
    if ((data.payment_status ?? 'paid') !== 'unpaid') continue

    const fileNumber = doc.ref.parent.parent.id
    const facility   = facilities[fileNumber]
    if (!facility) continue

    const phone = normalizePhone(facility.phone)
    if (!phone) continue

    const key = `unpaid_${fileNumber}_${doc.id}_${weekKey}`
    if (await alreadySent(db, key)) continue

    const msg = unpaidInvoice(facility.name, fileNumber, data.payment_type ?? 'invoice', data.amount ?? 0)
    try {
      const resp = await sendSms(apiKey, [phone], msg)
      await logSms(db, { recipients: [phone], message: msg, template: 'unpaid_invoice', facility_id: fileNumber, triggered_by: 'scheduled', status: 'sent', arkesel_response: resp })
      await markSent(db, key)
    } catch (err) {
      await logSms(db, { recipients: [phone], message: msg, template: 'unpaid_invoice', facility_id: fileNumber, triggered_by: 'scheduled', status: 'failed', arkesel_response: { error: err.message } })
    }
  }
})
