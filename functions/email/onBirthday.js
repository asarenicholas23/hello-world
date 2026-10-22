const { onSchedule }   = require('firebase-functions/v2/scheduler')
const { defineSecret } = require('firebase-functions/params')
const { getFirestore } = require('firebase-admin/firestore')
const nodemailer       = require('nodemailer')

const EMAIL_USER = defineSecret('EMAIL_USER')
const EMAIL_PASS = defineSecret('EMAIL_PASS')

const APP_URL = 'https://epa-kon-pms.web.app'
const OFFICE  = 'EPA Konongo Area Office'

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

exports.birthdayReminders = onSchedule({
  schedule:  '0 8 * * *',   // 8 am daily
  timeZone:  'Africa/Accra',
  region:    'europe-west1',
  secrets:   [EMAIL_USER, EMAIL_PASS],
}, async () => {
  const today = new Date()
  const todayMD = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const staffSnap = await getFirestore().collection('staff').get()
  const allStaff  = staffSnap.docs.map((d) => d.data())

  const celebrants = allStaff.filter((s) => s.date_of_birth?.slice(5) === todayMD)
  if (celebrants.length === 0) return

  const admins = allStaff.filter((s) => s.role === 'admin' && s.notification_email?.trim())

  const emailUser = EMAIL_USER.value()
  const emailPass = EMAIL_PASS.value()
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: emailUser, pass: emailPass },
  })

  // Notify admins
  if (admins.length > 0) {
    const label   = (s) => s.staff_id ? `${s.name} (${s.staff_id})` : s.name
    const names   = celebrants.map(label).join(', ')
    const message = celebrants.length === 1
      ? `Today is ${names}'s birthday. Consider sending a message or acknowledgement.`
      : `The following staff members have birthdays today:\n${celebrants.map((s) => `• ${label(s)}`).join('\n')}`

    for (const adm of admins) {
      try {
        await transporter.sendMail({
          from:    `"${OFFICE}" <${emailUser}>`,
          to:      adm.notification_email.trim(),
          subject: `[EPA PMS] Staff Birthday${celebrants.length > 1 ? 's' : ''} Today`,
          text:    `${message}\n\nLog in at ${APP_URL}`,
          html:    buildHtml(message),
        })
        console.log(`[birthday] admin notice sent to ${adm.notification_email}`)
      } catch (err) {
        console.error(`[birthday] admin notice failed for ${adm.notification_email}:`, err.message)
      }
    }
  }

  // Send birthday message to each celebrant
  for (const celebrant of celebrants) {
    const email = celebrant.notification_email?.trim()
    if (!email) continue

    const firstName = celebrant.name?.split(' ')[0] ?? celebrant.name ?? 'Colleague'
    const message   = `Dear ${firstName},\n\nWishing you a very Happy Birthday on behalf of the entire team at ${OFFICE}.\n\nMay this special day bring you joy and happiness. Thank you for your continued dedication and service.\n\nWarm regards,\n${OFFICE}`

    try {
      await transporter.sendMail({
        from:    `"${OFFICE}" <${emailUser}>`,
        to:      email,
        subject: `Happy Birthday, ${firstName}! 🎂`,
        text:    message,
        html:    buildHtml(message),
      })
      console.log(`[birthday] message sent to ${email} (${celebrant.name})`)
    } catch (err) {
      console.error(`[birthday] message failed for ${email}:`, err.message)
    }
  }
})
