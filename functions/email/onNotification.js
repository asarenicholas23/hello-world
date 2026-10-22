const { onDocumentCreated }        = require('firebase-functions/v2/firestore')
const { defineSecret }             = require('firebase-functions/params')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const { getMessaging }             = require('firebase-admin/messaging')
const nodemailer                   = require('nodemailer')

const EMAIL_USER = defineSecret('EMAIL_USER')
const EMAIL_PASS = defineSecret('EMAIL_PASS')

const APP_URL   = 'https://epa-kon-pms.web.app'
const OFFICE    = 'EPA Konongo Area Office'

const TYPE_SUBJECTS = {
  facility_assigned:          'Facility Assignment',
  supporting_assigned:        'Supporting Officer Assignment',
  permit_expiry:              'Permit Expiry Alert',
  enforcement:                'Enforcement Notice',
  monitoring_report_review:   'Monitoring Report — Review Requested',
  monitoring_report_decision: 'Monitoring Report — Review Decision',
  task_assigned:              'New Task Assigned',
  task_submitted:              'Task Submitted for Review',
  task_changes_requested:      'Task — Changes Requested',
  task_approved:               'Task Approved',
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
    .msg  { font-size: 13pt; line-height: 1.65; color: #111827; margin: 0 0 24px; }
    .btn  { display: inline-block; background: #1a5276; color: #fff !important; padding: 11px 22px; border-radius: 6px; text-decoration: none; font-weight: 700; font-size: 12pt; }
    .foot { padding: 14px 28px; background: #f9fafb; border-top: 1px solid #e5e7eb; font-size: 9pt; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hdr">
      <h1>${OFFICE}</h1>
      <p>Permit Management System — Automated Notification</p>
    </div>
    <div class="body">
      <p class="msg">${message.replace(/\n/g, '<br>')}</p>
      <a href="${APP_URL}" class="btn">Open EPA PMS →</a>
    </div>
    <div class="foot">This is an automated notification. Please do not reply to this email.</div>
  </div>
</body>
</html>`
}

exports.sendNotificationEmail = onDocumentCreated({
  document: 'notifications/{notifId}',
  region:   'europe-west1',
  secrets:  [EMAIL_USER, EMAIL_PASS],
}, async (event) => {
  const data = event.data?.data()
  if (!data) return

  const { recipient_uid, type, message } = data
  if (!recipient_uid || !message) return

  // Fetch recipient's staff doc
  const staffSnap = await getFirestore().doc(`staff/${recipient_uid}`).get()
  if (!staffSnap.exists) return

  const staffData  = staffSnap.data()
  const notifEmail = staffData.notification_email?.trim()
  const staffName  = staffData.name ?? ''
  const fcmTokens  = staffData.fcm_tokens ?? []

  const subject = `[EPA PMS] ${TYPE_SUBJECTS[type] ?? 'New Notification'}`

  // --- FCM push notification ---
  if (fcmTokens.length > 0) {
    try {
      const res = await getMessaging().sendEachForMulticast({
        tokens: fcmTokens,
        notification: { title: subject, body: message },
        webpush: { notification: { icon: '/epa-logo-192.png' } },
      })
      // Remove tokens that are no longer valid
      const staleTokens = fcmTokens.filter((_, i) => res.responses[i]?.error)
      if (staleTokens.length > 0) {
        await getFirestore().doc(`staff/${recipient_uid}`).update({
          fcm_tokens: FieldValue.arrayRemove(...staleTokens),
        })
      }
      console.log(`[fcm] sent to ${res.successCount}/${fcmTokens.length} tokens for ${staffName}`)
    } catch (err) {
      console.error(`[fcm] failed for ${staffName}:`, err.message)
    }
  }

  // --- Email notification ---
  if (!notifEmail) return   // opt-out: no email address set

  const emailUser = EMAIL_USER.value()
  const emailPass = EMAIL_PASS.value()

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: emailUser, pass: emailPass },
  })

  try {
    await transporter.sendMail({
      from:    `"${OFFICE}" <${emailUser}>`,
      to:      notifEmail,
      subject,
      text:    `${message}\n\nLog in at ${APP_URL}`,
      html:    buildHtml(message),
    })
    console.log(`[email] sent to ${notifEmail} (${staffName}) for type=${type}`)
  } catch (err) {
    console.error(`[email] failed for ${notifEmail}:`, err.message)
  }
})
