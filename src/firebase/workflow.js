import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './config'

export async function advanceStep({ fileNumber, step, uid, name, notes = '' }) {
  await updateDoc(doc(db, 'facilities', fileNumber), {
    workflow_current_step:    step,
    workflow_updated_at:      serverTimestamp(),
    [`workflow_steps.${step}`]: {
      status:            'complete',
      completed_by:      uid,
      completed_by_name: name,
      completed_at:      serverTimestamp(),
      notes,
    },
  })
}

export async function resetWorkflow(fileNumber) {
  await updateDoc(doc(db, 'facilities', fileNumber), {
    workflow_current_step: 0,
    workflow_steps:        {},
    workflow_updated_at:   serverTimestamp(),
  })
}

export async function tickAllSteps({ fileNumber, uid, name }) {
  const steps = {}
  for (let i = 1; i <= 10; i++) {
    steps[`workflow_steps.${i}`] = {
      status:            'complete',
      completed_by:      uid,
      completed_by_name: name,
      completed_at:      serverTimestamp(),
      notes:             '',
    }
  }
  await updateDoc(doc(db, 'facilities', fileNumber), {
    workflow_current_step: 10,
    workflow_updated_at:   serverTimestamp(),
    ...steps,
  })
}

export async function addQAApproval({ fileNumber, uid, name }) {
  const ref      = doc(db, 'facilities', fileNumber)
  const snap     = await getDoc(ref)
  const existing = snap.data()?.workflow_steps?.['7']?.approvals ?? []

  if (existing.some((a) => a.uid === uid)) return { alreadyApproved: true }

  const approvals  = [...existing, { uid, name, approved_at: new Date().toISOString() }]
  const isComplete = approvals.length >= 2

  await updateDoc(ref, {
    workflow_updated_at: serverTimestamp(),
    'workflow_steps.7': {
      ...(snap.data()?.workflow_steps?.['7'] ?? {}),
      approvals,
      ...(isComplete ? { status: 'complete', completed_at: serverTimestamp() } : {}),
    },
    ...(isComplete ? { workflow_current_step: 7 } : {}),
  })

  return { approvals, isComplete }
}
