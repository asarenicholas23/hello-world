export const WORKFLOW_STEPS = [
  { step: 1,  label: 'Reported' },
  { step: 2,  label: 'EA1 Filled' },
  { step: 3,  label: 'Additional Documents Submitted / Not Required' },
  { step: 4,  label: 'Payment Done' },
  { step: 5,  label: 'Screening / Site Verification' },
  { step: 6,  label: 'Schedule Writing' },
  { step: 7,  label: 'Quality Assurance', qa: true },
  { step: 8,  label: 'TCR' },
  { step: 9,  label: 'Permit Printed' },
  { step: 10, label: 'Permit Taken by Proponent' },
]

// Count Mon–Fri working days since a Firestore timestamp or Date
export function workingDaysSince(timestamp) {
  if (!timestamp) return 0
  const from = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
  const end  = new Date()
  let count = 0
  const cur = new Date(from)
  cur.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)
  while (cur < end) {
    const d = cur.getDay()
    if (d !== 0 && d !== 6) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

export function isPermitStuck(permit) {
  const step = permit.workflow_current_step ?? 0
  if (step === 0 || step >= 10) return false
  return workingDaysSince(permit.workflow_updated_at) >= 5
}

export function workflowSummary(permit) {
  const step = permit.workflow_current_step ?? 0
  if (step === 0)  return { label: 'Not started', step: 0, pct: 0 }
  if (step >= 10)  return { label: 'Complete',    step: 10, pct: 100 }
  const next = WORKFLOW_STEPS.find((s) => s.step === step + 1)
  return { label: next?.label ?? `Step ${step + 1}`, step, pct: Math.round((step / 10) * 100) }
}
