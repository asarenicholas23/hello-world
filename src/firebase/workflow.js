import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './config'
import { facilityDocId } from '../utils/fileNumbers'

function permitWorkflowRef(fileNumber, permitId) {
  return doc(db, 'facilities', facilityDocId(fileNumber), 'permit_workflows', permitId)
}

export async function advanceStep({ fileNumber, step, uid, name, notes = '' }) {
  await updateDoc(doc(db, 'facilities', facilityDocId(fileNumber)), {
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
  await updateDoc(doc(db, 'facilities', facilityDocId(fileNumber)), {
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
  await updateDoc(doc(db, 'facilities', facilityDocId(fileNumber)), {
    workflow_current_step: 10,
    workflow_updated_at:   serverTimestamp(),
    ...steps,
  })
}

export async function addQAApproval({ fileNumber, uid, name }) {
  const ref      = doc(db, 'facilities', facilityDocId(fileNumber))
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

export async function getPermitWorkflow(fileNumber, permitId) {
  if (!permitId) return null
  const snap = await getDoc(permitWorkflowRef(fileNumber, permitId))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function ensurePermitWorkflow({
  fileNumber,
  facilityName,
  permitId,
  permitNumber = '',
  uid,
}) {
  if (!permitId) throw new Error('A permit must be selected.')
  const ref = permitWorkflowRef(fileNumber, permitId)
  const snap = await getDoc(ref)
  if (snap.exists()) return { id: snap.id, ...snap.data() }

  const payload = {
    facility_id:      fileNumber,
    facility_name:    facilityName ?? '',
    permit_id:        permitId,
    permit_number:    permitNumber ?? '',
    current_step:     0,
    status:           'not_started',
    steps:            {},
    linked_records:   {},
    created_at:       serverTimestamp(),
    created_by:       uid ?? null,
    updated_at:       serverTimestamp(),
    updated_by:       uid ?? null,
  }
  await setDoc(ref, payload)
  return { id: permitId, ...payload }
}

export async function advancePermitWorkflowStep({
  fileNumber,
  facilityName,
  permitId,
  permitNumber = '',
  step,
  uid,
  name,
  notes = '',
}) {
  await ensurePermitWorkflow({ fileNumber, facilityName, permitId, permitNumber, uid })
  await updateDoc(permitWorkflowRef(fileNumber, permitId), {
    permit_number: permitNumber ?? '',
    current_step:  step,
    status:        step >= 10 ? 'complete' : 'in_progress',
    updated_at:    serverTimestamp(),
    updated_by:    uid,
    [`steps.${step}`]: {
      status:            'complete',
      completed_by:      uid,
      completed_by_name: name,
      completed_at:      serverTimestamp(),
      notes,
    },
  })
}

export async function resetPermitWorkflow({ fileNumber, permitId, uid }) {
  await updateDoc(permitWorkflowRef(fileNumber, permitId), {
    current_step:   0,
    status:         'not_started',
    steps:          {},
    updated_at:     serverTimestamp(),
    updated_by:     uid,
  })
}

export async function tickAllPermitWorkflowSteps({
  fileNumber,
  facilityName,
  permitId,
  permitNumber = '',
  uid,
  name,
}) {
  await ensurePermitWorkflow({ fileNumber, facilityName, permitId, permitNumber, uid })
  const steps = {}
  for (let i = 1; i <= 10; i++) {
    steps[`steps.${i}`] = {
      status:            'complete',
      completed_by:      uid,
      completed_by_name: name,
      completed_at:      serverTimestamp(),
      notes:             '',
    }
  }
  await updateDoc(permitWorkflowRef(fileNumber, permitId), {
    current_step: 10,
    status:       'complete',
    updated_at:   serverTimestamp(),
    updated_by:   uid,
    ...steps,
  })
}

export async function addPermitWorkflowQAApproval({
  fileNumber,
  facilityName,
  permitId,
  permitNumber = '',
  uid,
  name,
}) {
  const workflow = await ensurePermitWorkflow({ fileNumber, facilityName, permitId, permitNumber, uid })
  const existing = workflow.steps?.['7']?.approvals ?? []

  if (existing.some((a) => a.uid === uid)) return { alreadyApproved: true }

  const approvals  = [...existing, { uid, name, approved_at: new Date().toISOString() }]
  const isComplete = approvals.length >= 2

  await updateDoc(permitWorkflowRef(fileNumber, permitId), {
    updated_at: serverTimestamp(),
    updated_by: uid,
    'steps.7': {
      ...(workflow.steps?.['7'] ?? {}),
      approvals,
      ...(isComplete ? { status: 'complete', completed_at: serverTimestamp() } : {}),
    },
    ...(isComplete ? { current_step: 7, status: 'in_progress' } : {}),
  })

  return { approvals, isComplete }
}

export async function linkPermitWorkflowRecord({
  fileNumber,
  permitId,
  category,
  recordId,
  uid,
}) {
  if (!permitId || !category || !recordId) return
  const ref = permitWorkflowRef(fileNumber, permitId)
  const snap = await getDoc(ref)
  const payload = {
    current_step: 0,
    status: 'not_started',
    updated_at: serverTimestamp(),
    updated_by: uid ?? null,
    [`linked_records.${category}`]: recordId,
  }
  if (snap.exists()) {
    delete payload.current_step
    delete payload.status
    await updateDoc(ref, payload)
  } else {
    await setDoc(ref, {
      facility_id: fileNumber,
      permit_id: permitId,
      ...payload,
    }, { merge: true })
  }
}
