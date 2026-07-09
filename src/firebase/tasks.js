import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc,
  serverTimestamp, query, where, orderBy,
} from 'firebase/firestore'
import { db } from './config'
import { uploadFile, deleteFile, makePhotoPath } from './storage'
import { createSubRecord, listSubRecords } from './subrecords'

const COL = () => collection(db, 'tasks')

export const TASK_TYPES = [
  { value: 'screening',         label: 'Screening',          annotated: true },
  { value: 'site_verification', label: 'Site Verification',  annotated: false },
  { value: 'monitoring',        label: 'Monitoring',         annotated: false },
  { value: 'enforcement',       label: 'Enforcement',        annotated: false },
  { value: 'schedule',          label: 'Schedule',           annotated: false },
  { value: 'other',             label: 'Other',               annotated: false },
]

export function taskTypeLabel(type) {
  return TASK_TYPES.find((t) => t.value === type)?.label ?? type
}

export async function createTask({
  taskType, facilityMode, fileNumber = null, facilityName, facilityDetails = null,
  assignedToUid, assignedToName, assignedTo2Uid = null, assignedTo2Name = '',
  assignedByUid, assignedByName, dueDate = null, notes = '',
}) {
  const ref = await addDoc(COL(), {
    task_type:          taskType,
    facility_mode:       facilityMode,
    file_number:         fileNumber,
    facility_name:       facilityName,
    facility_details:    facilityDetails,
    assigned_to:         assignedToUid,
    assigned_to_name:    assignedToName,
    assigned_to_2:       assignedTo2Uid,
    assigned_to_2_name:  assignedTo2Name,
    assigned_by:         assignedByUid,
    assigned_by_name:    assignedByName,
    due_date:            dueDate,
    notes,
    status:              'assigned',
    form_data:           null,
    annotations:         [],
    revision_note:       '',
    linked_file_number:  null,
    linked_record_id:    null,
    submission:          null,
    review_notes:        '',
    created_at:          serverTimestamp(),
    updated_at:          serverTimestamp(),
  })
  return ref.id
}

/** Is this uid one of the (up to two) officers a task is assigned to? */
export function isTaskAssignee(task, uid) {
  return task.assigned_to === uid || task.assigned_to_2 === uid
}

export async function listMyTasks(uid) {
  const [asAssignee, asAssignee2, asAssigner] = await Promise.all([
    getDocs(query(COL(), where('assigned_to', '==', uid))),
    getDocs(query(COL(), where('assigned_to_2', '==', uid))),
    getDocs(query(COL(), where('assigned_by', '==', uid))),
  ])
  const byId = new Map()
  for (const d of [...asAssignee.docs, ...asAssignee2.docs, ...asAssigner.docs]) {
    byId.set(d.id, { id: d.id, ...d.data() })
  }
  return [...byId.values()].sort((a, b) => (b.created_at?.toMillis?.() ?? 0) - (a.created_at?.toMillis?.() ?? 0))
}

/** All tasks org-wide — used by the All Assignments management view. */
export async function listAllTasks() {
  const snap = await getDocs(query(COL(), orderBy('created_at', 'desc')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function getTask(id) {
  const snap = await getDoc(doc(db, 'tasks', id))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function submitScreeningTask(id, { formData, revisionNote = '', uid }) {
  const ref = doc(db, 'tasks', id)
  const snap = await getDoc(ref)
  const existingAnnotations = snap.data()?.annotations ?? []
  await updateDoc(ref, {
    form_data:     formData,
    status:        'submitted',
    revision_note: revisionNote,
    annotations:   existingAnnotations.map((a) => ({ ...a, resolved: true })),
    updated_at:    serverTimestamp(),
    updated_by:    uid,
  })
}

export async function uploadGenericTaskSubmission(id, file, { uid }) {
  const path = makePhotoPath('tasks', id, `${Date.now()}_${Math.random().toString(36).slice(2)}_${file.name}`)
  const fileUrl = await uploadFile(file, path)
  await updateDoc(doc(db, 'tasks', id), {
    submission: { file_url: fileUrl, file_name: file.name, file_path: path },
    status:     'submitted',
    updated_at: serverTimestamp(),
    updated_by: uid,
  })
}

export async function addAnnotationsAndRequestChanges(id, { newAnnotations, uid, name }) {
  const ref = doc(db, 'tasks', id)
  const snap = await getDoc(ref)
  const existing = snap.data()?.annotations ?? []
  const toAdd = newAnnotations.map((a) => ({
    id:               `${Date.now()}_${Math.random().toString(36).slice(2)}`,
    field_key:        a.field_key,
    field_label:      a.field_label,
    comment:          a.comment,
    created_by:       uid,
    created_by_name:  name,
    created_at:       new Date().toISOString(),
    resolved:         false,
  }))
  await updateDoc(ref, {
    annotations: [...existing, ...toAdd],
    status:      'changes_requested',
    updated_at:  serverTimestamp(),
    updated_by:  uid,
  })
}

export async function requestGenericChanges(id, { reviewNotes, uid }) {
  await updateDoc(doc(db, 'tasks', id), {
    review_notes: reviewNotes,
    status:       'changes_requested',
    updated_at:   serverTimestamp(),
    updated_by:   uid,
  })
}

export async function approveTask(id, { uid, reviewNotes = '' }) {
  const ref  = doc(db, 'tasks', id)
  const task = await getTask(id)
  if (!task) throw new Error('Task not found.')

  const patch = {
    status:       'approved',
    review_notes: reviewNotes,
    updated_at:   serverTimestamp(),
    updated_by:   uid,
  }

  if (task.task_type === 'screening' && task.facility_mode === 'registered' && task.file_number && task.form_data) {
    const existing = await listSubRecords(task.file_number, 'screenings')
    const screeningId = `SCR-${task.file_number}-${String(existing.length + 1).padStart(3, '0')}`
    const recordId = await createSubRecord(task.file_number, 'screenings', { ...task.form_data, screening_id: screeningId }, uid)
    patch.linked_file_number = task.file_number
    patch.linked_record_id   = recordId
  }

  await updateDoc(ref, patch)
}

export async function deleteTaskSubmissionFile(task) {
  if (task?.submission?.file_path) await deleteFile(task.submission.file_path)
}
