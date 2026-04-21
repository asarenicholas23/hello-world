const OFFICE  = 'EPA Konongo Area Office'
const CONTACT = '032-200-0000'  // update with real office number

function permitExpiry(facilityName, fileNumber, daysLeft, expiryDateStr) {
  return `Dear ${facilityName} (${fileNumber}), your EPA Environmental Permit expires in ${daysLeft} day(s) on ${expiryDateStr}. Contact ${OFFICE} to begin renewal. ${CONTACT}`
}

function permitExpired(facilityName, fileNumber) {
  return `Dear ${facilityName} (${fileNumber}), your EPA Environmental Permit has EXPIRED. Operating without a valid permit is a violation of the EPA Act. Contact ${OFFICE} immediately. ${CONTACT}`
}

function unpaidInvoice(facilityName, fileNumber, type, amount) {
  return `Dear ${facilityName} (${fileNumber}), you have an outstanding ${type} of GHS ${Number(amount).toFixed(2)} owed to ${OFFICE}. Please settle promptly to avoid enforcement action. ${CONTACT}`
}

// Client-side preview helper (same logic, exported for React app to use)
const TEMPLATES = {
  permit_expiry_60: { label: 'Permit Expiry — 60 days', build: (fac) => permitExpiry(fac.name, fac.file_number, 60, '(expiry date)') },
  permit_expiry_30: { label: 'Permit Expiry — 30 days', build: (fac) => permitExpiry(fac.name, fac.file_number, 30, '(expiry date)') },
  permit_expiry_7:  { label: 'Permit Expiry — 7 days',  build: (fac) => permitExpiry(fac.name, fac.file_number, 7,  '(expiry date)') },
  permit_expired:   { label: 'Permit Expired Notice',   build: (fac) => permitExpired(fac.name, fac.file_number) },
  unpaid_invoice:   { label: 'Unpaid Invoice Reminder', build: (fac) => unpaidInvoice(fac.name, fac.file_number, '(payment type)', '(amount)') },
}

module.exports = { permitExpiry, permitExpired, unpaidInvoice, TEMPLATES, OFFICE, CONTACT }
