const OFFICE  = 'EPA Konongo Area Office'
const CONTACT = '0541405654'  // update with real office number

function permitExpiry(facilityName, fileNumber, daysLeft, expiryDateStr) {
  return `Dear ${facilityName} (${fileNumber}), your EPA Environmental Permit expires in ${daysLeft} day(s) on ${expiryDateStr}. Contact ${OFFICE} to begin renewal. ${CONTACT}`
}

function permitExpired(facilityName, fileNumber) {
  return `Dear ${facilityName} (${fileNumber}), your EPA Environmental Permit has EXPIRED. Kindly visit ${OFFICE}  located at Lowcost, near Holy Virgin School, to commence the permit renewal process immediately. For any enquiries or assistance, kindly contact us on ${CONTACT}`
}

// `records` is an array of { payment_type, amount } for every unpaid finance
// record on the facility — each is named and amounted individually, with a
// running total when there's more than one.
function unpaidInvoice(facilityName, fileNumber, records) {
  const items = records && records.length ? records : [{ payment_type: 'invoice', amount: 0 }]
  const total = items.reduce((sum, r) => sum + Number(r.amount ?? 0), 0)

  const body = items.length > 1
    ? `the following outstanding invoices owed to ${OFFICE}: ${items.map((r) => `${r.payment_type || 'Invoice'} - GHS ${Number(r.amount ?? 0).toFixed(2)}`).join('; ')} (Total: GHS ${total.toFixed(2)})`
    : `an outstanding ${items[0].payment_type || 'invoice'} of GHS ${Number(items[0].amount ?? 0).toFixed(2)} owed to ${OFFICE}`

  return `Dear ${facilityName} (${fileNumber}), you have ${body}. Pay via Ghana.gov (ghana.gov) using reference ${fileNumber}. Please settle promptly to avoid enforcement action. ${CONTACT}`
}

function enforcementReminder(facilityName, fileNumber, actionLabel, date) {
  return `Dear ${facilityName} (${fileNumber}), this is a reminder of the ${actionLabel} issued against your facility on ${date}. Please visit ${OFFICE} to discuss compliance steps. ${CONTACT}`
}

function permitReady(facilityName, fileNumber) {
  return `Dear ${facilityName} (${fileNumber}), your EPA Environmental Permit is ready for collection at ${OFFICE}. Please visit us with the required fees to collect it. ${CONTACT}`
}

// Client-side preview helper (same logic, exported for React app to use)
const TEMPLATES = {
  permit_expiry_60:       { label: 'Permit Expiry — 60 days',       build: (fac) => permitExpiry(fac.name, fac.file_number, 60, '(expiry date)') },
  permit_expiry_30:       { label: 'Permit Expiry — 30 days',       build: (fac) => permitExpiry(fac.name, fac.file_number, 30, '(expiry date)') },
  permit_expiry_7:        { label: 'Permit Expiry — 7 days',        build: (fac) => permitExpiry(fac.name, fac.file_number, 7,  '(expiry date)') },
  permit_expired:         { label: 'Permit Expired Notice',         build: (fac) => permitExpired(fac.name, fac.file_number) },
  unpaid_invoice:         { label: 'Unpaid Invoice Reminder',       build: (fac) => unpaidInvoice(fac.name, fac.file_number, [{ payment_type: '(payment type)', amount: 0 }]) },
  enforcement_reminder:   { label: 'Enforcement Action Reminder',   build: (fac) => enforcementReminder(fac.name, fac.file_number, '(action)', '(date)') },
  permit_ready:           { label: 'Permit Ready for Collection',   build: (fac) => permitReady(fac.name, fac.file_number) },
}

module.exports = { permitExpiry, permitExpired, unpaidInvoice, enforcementReminder, permitReady, TEMPLATES, OFFICE, CONTACT }
