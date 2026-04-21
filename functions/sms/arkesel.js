const SENDER  = 'EPA Konongo'
const API_URL = 'https://sms.arkesel.com/api/v2/sms/send'

async function sendSms(apiKey, recipients, message) {
  const phones = recipients.filter(Boolean)
  if (!phones.length) throw new Error('No valid recipients')

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sender: SENDER, message, recipients: phones }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message ?? `Arkesel error ${res.status}`)
  return data
}

// Normalise Ghanaian numbers to 233XXXXXXXXX format
function normalizePhone(raw) {
  if (!raw) return null
  const n = String(raw).replace(/[\s\-()+]/g, '')
  if (n.startsWith('233') && n.length === 12) return n
  if (n.startsWith('0')   && n.length === 10) return '233' + n.slice(1)
  return null
}

module.exports = { sendSms, normalizePhone }
