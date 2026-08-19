import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc,
  serverTimestamp, query, where, orderBy,
} from 'firebase/firestore'
import { db } from './config'
import { uploadFile, deleteFile, makePhotoPath } from './storage'
import { createSubRecord, listSubRecords } from './subrecords'
import { getFacility, createFacilityWithId } from './facilities'
import { screeningRecordToForm } from '../data/screeningFieldMeta'

const COL = () => collection(db, 'tasks')

export const TASK_TYPES = [
  { value: 'screening',         label: 'Screening',          annotated: true,  formFlow: true },
  { value: 'site_verification', label: 'Site Verification',  annotated: false, formFlow: true },
  { value: 'monitoring',        label: 'Monitoring',         annotated: false, formFlow: false },
  { value: 'enforcement',       label: 'Enforcement',        annotated: false, formFlow: false },
  { value: 'schedule',          label: 'Schedule',           annotated: false, formFlow: false },
  { value: 'other',             label: 'Other',               annotated: false, formFlow: false },
]

/** Task types filled in-app as a real form (vs. a plain file upload). */
export function isFormTask(taskType) {
  return TASK_TYPES.find((t) => t.value === taskType)?.formFlow ?? false
}

export function taskTypeLabel(type) {
  return TASK_TYPES.find((t) => t.value === type)?.label ?? type
}

/**
 * Agrochemical/Pesticide (PP) facilities use the same Pesticides Checklist
 * for both their "Screening" and "Site Verification" tasks — there's no
 * separate EA1-style screening for this sector. Prefer the sector captured
 * on the task at assignment time (available before submission); fall back
 * to whatever was captured on the submitted form_data.
 */
export function isPesticideChecklistTask(task) {
  if (!task) return false
  if (task.task_type !== 'screening' && task.task_type !== 'site_verification') return false
  const sector = task.sector_prefix ?? task.form_data?.sector_prefix ?? task.form_data?.facility_sub_type
  return sector === 'PP'
}

/** Display label for a task — swaps in "Pesticides Checklist" for PP-sector screening/site verification tasks. */
export function taskDisplayLabel(task) {
  if (isPesticideChecklistTask(task)) return 'Pesticides Checklist'
  return taskTypeLabel(task.task_type)
}

export async function createTask({
  taskType, facilityMode, fileNumber = null, facilityName, facilityDetails = null,
  fieldReportId = null, screeningPrefill = null, sectorPrefix = null,
  assignedToUid, assignedToName, assignedTo2Uid = null, assignedTo2Name = '',
  assignedByUid, assignedByName, dueDate = null, notes = '',
}) {
  // Carry over screening details already captured on a field report, so the
  // assigned officer doesn't have to re-collect information gathered during
  // an earlier walk-in/enforcement visit — they review & confirm instead of
  // starting from a blank form.
  const prefillForm = taskType === 'screening' && screeningPrefill
    ? {
        ...screeningRecordToForm(screeningPrefill),
        photos:      screeningPrefill.photos ?? [],
        coordinates: screeningPrefill.coordinates ?? null,
      }
    : null

  const ref = await addDoc(COL(), {
    task_type:          taskType,
    facility_mode:       facilityMode,
    file_number:         fileNumber,
    facility_name:       facilityName,
    facility_details:    facilityDetails,
    field_report_id:     fieldReportId,
    sector_prefix:       sectorPrefix,
    assigned_to:         assignedToUid,
    assigned_to_name:    assignedToName,
    assigned_to_2:       assignedTo2Uid,
    assigned_to_2_name:  assignedTo2Name,
    assigned_by:         assignedByUid,
    assigned_by_name:    assignedByName,
    due_date:            dueDate,
    notes,
    status:              'assigned',
    form_data:           prefillForm,
    prefilled_from_field_report: Boolean(prefillForm),
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

/**
 * Lets the assigner edit a task's assignment details after creation (who
 * it's assigned to, task type, facility, due date, notes) — does not touch
 * status, form_data, submission, or annotations, so it can't clobber work
 * the assignee has already submitted.
 */
export async function updateTaskAssignment(id, {
  taskType, facilityMode, fileNumber = null, facilityName, facilityDetails = null,
  fieldReportId = null, sectorPrefix = null, assignedToUid, assignedToName, assignedTo2Uid = null, assignedTo2Name = '',
  dueDate = null, notes = '',
}, uid) {
  await updateDoc(doc(db, 'tasks', id), {
    task_type:          taskType,
    facility_mode:       facilityMode,
    file_number:         fileNumber,
    facility_name:       facilityName,
    facility_details:    facilityDetails,
    field_report_id:     fieldReportId,
    sector_prefix:       sectorPrefix,
    assigned_to:         assignedToUid,
    assigned_to_name:    assignedToName,
    assigned_to_2:       assignedTo2Uid,
    assigned_to_2_name:  assignedTo2Name,
    due_date:            dueDate,
    notes,
    updated_at:          serverTimestamp(),
    updated_by:          uid,
  })
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

/** Submits a filled-in form task (screening or site verification) for review. */
export async function submitFormTask(id, { formData, revisionNote = '', uid }) {
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

/**
 * Persists in-progress form state for a task the assignee hasn't submitted
 * yet, so they can pick up where they left off later. Deliberately leaves
 * `status` and `annotations` untouched — a draft never becomes visible to
 * the assigner or counts as a (re)submission.
 */
export async function saveTaskFormDraft(id, { formData, uid }) {
  await updateDoc(doc(db, 'tasks', id), {
    form_data:  formData,
    updated_at: serverTimestamp(),
    updated_by: uid,
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

  if (task.task_type === 'site_verification' && task.facility_mode === 'registered' && task.file_number && task.form_data) {
    const recordId = await createSubRecord(task.file_number, 'site_verifications', task.form_data, uid)
    patch.linked_file_number = task.file_number
    patch.linked_record_id   = recordId
  }

  await updateDoc(ref, patch)
}

/**
 * Registers a task's not-yet-in-the-system facility (typed freeform when the
 * task was assigned, with no linked field report) as a real facility record
 * — mirrors the "Assign File Number" flow in FieldReportsPage.jsx. Details
 * already captured in facility_details carry straight over instead of being
 * retyped.
 */
export async function registerTaskFacility(id, { fileNumber, sectorPrefix, sector, typeOfUndertaking = '' }, uid) {
  const trimmed = fileNumber?.trim().toUpperCase()
  if (!trimmed) throw new Error('File number is required.')

  const task = await getTask(id)
  if (!task) throw new Error('Task not found.')

  const existing = await getFacility(trimmed)
  if (!existing) {
    const details = task.facility_details ?? {}
    await createFacilityWithId(trimmed, {
      name:                task.facility_name ?? details.name ?? '',
      sector_prefix:       sectorPrefix,
      sector,
      type_of_undertaking: typeOfUndertaking,
      location:            details.location ?? '',
      district:            details.district ?? '',
      contact_person:      details.contact_person ?? '',
      phone:               details.phone ?? '',
    }, uid)
  }

  const patch = {
    facility_mode: 'registered',
    file_number:   trimmed,
    sector_prefix: sectorPrefix,
    updated_at:    serverTimestamp(),
    updated_by:    uid,
  }

  // If this screening/site verification was already approved before the
  // facility existed, the approval-time copy into the facility's sub-records
  // never ran (it only fires for already-registered facilities) — catch it
  // up now so the captured data isn't stranded on the task alone.
  if (task.task_type === 'screening' && task.status === 'approved' && task.form_data && !task.linked_record_id) {
    const subs = await listSubRecords(trimmed, 'screenings')
    const screeningId = `SCR-${trimmed}-${String(subs.length + 1).padStart(3, '0')}`
    const recordId = await createSubRecord(trimmed, 'screenings', { ...task.form_data, screening_id: screeningId }, uid)
    patch.linked_file_number = trimmed
    patch.linked_record_id   = recordId
  }
  if (task.task_type === 'site_verification' && task.status === 'approved' && task.form_data && !task.linked_record_id) {
    const recordId = await createSubRecord(trimmed, 'site_verifications', task.form_data, uid)
    patch.linked_file_number = trimmed
    patch.linked_record_id   = recordId
  }

  await updateDoc(doc(db, 'tasks', id), patch)
  return trimmed
}

export async function deleteTaskSubmissionFile(task) {
  if (task?.submission?.file_path) await deleteFile(task.submission.file_path)
}
