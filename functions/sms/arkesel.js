// Use ARKESEL_SENDER env var if set (allows override without redeployment).
// Must be a registered & approved Arkesel Sender ID, or a valid phone number.
const SENDER  = process.env.ARKESEL_SENDER ?? 'EPA'
const API_URL = 'https://sms.arkesel.com/api/v2/sms/send'

async function sendSms(apiKey, recipients, message) {
  const phones = recipients.filter(Boolean)
  if (!phones.length) throw new Error('No valid recipients')

  console.log(`[sendSms] sending to ${phones.length} recipient(s):`, phones)

  const res  = await fetch(API_URL, {
    method:  'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ sender: SENDER, message, recipients: phones }),
  })
  const data = await res.json()
  console.log('[sendSms] Arkesel response:', JSON.stringify(data))

  // Arkesel returns HTTP 200 even for application-level errors — check status field too
  if (!res.ok || data.status === 'error') {
    throw new Error(data.message ?? `Arkesel error HTTP ${res.status}`)
  }

  // Log per-recipient delivery status (Arkesel v2 returns data[] with per-number status)
  if (Array.isArray(data.data)) {
    for (const r of data.data) {
      if (r.status && r.status !== 'sent' && r.status !== 'success') {
        console.warn(`[sendSms] recipient ${r.recipient} status=${r.status} reason=${r.reason ?? '—'}`)
      }
    }
  }

  return data
}

// Normalise Ghanaian numbers to 233XXXXXXXXX format.
// Handles: 0XXXXXXXXX, 233XXXXXXXXX, +233XXXXXXXXX, and bare 9-digit XXXXXXXXX.
function normalizePhone(raw) {
  if (!raw) return null
  const n = String(raw).replace(/[\s\-()+]/g, '')
  if (n.startsWith('233') && n.length === 12) return n              // 233XXXXXXXXX
  if (n.startsWith('0')   && n.length === 10) return '233' + n.slice(1) // 0XXXXXXXXX
  if (/^\d{9}$/.test(n))                      return '233' + n          // XXXXXXXXX bare
  console.warn('[normalizePhone] unrecognised format, skipping:', raw)
  return null
}

module.exports = { sendSms, normalizePhone }
