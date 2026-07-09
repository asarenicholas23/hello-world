import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc,
  serverTimestamp, query, orderBy,
} from 'firebase/firestore'
import { db } from './config'
import { facilityDocId } from '../utils/fileNumbers'
import { uploadFile, deleteFile, makePhotoPath } from './storage'

function reportsCol(fileNumber) {
  return collection(db, 'facilities', facilityDocId(fileNumber), 'monitoring_reports')
}

export async function listMonitoringReports(fileNumber) {
  const snap = await getDocs(query(reportsCol(fileNumber), orderBy('created_at', 'desc')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function getMonitoringReport(fileNumber, id) {
  const snap = await getDoc(doc(db, 'facilities', facilityDocId(fileNumber), 'monitoring_reports', id))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

/**
 * Upload a monitoring report file and create a pending review record.
 */
export async function uploadMonitoringReport(fileNumber, file, {
  linkedMonitoringId = '', assignedToUid, assignedToName, uploadedByUid, uploadedByName,
}) {
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}_${file.name}`
  const path = makePhotoPath(fileNumber, 'monitoring_reports', filename)
  const fileUrl = await uploadFile(file, path)

  const ref = await addDoc(reportsCol(fileNumber), {
    file_url:             fileUrl,
    file_name:            file.name,
    file_path:            path,
    linked_monitoring_id: linkedMonitoringId || null,
    uploaded_by:           uploadedByUid,
    uploaded_by_name:      uploadedByName,
    assigned_to:           assignedToUid,
    assigned_to_name:      assignedToName,
    status:                'pending',
    review_notes:          '',
    reviewed_by:           null,
    reviewed_by_name:      null,
    reviewed_at:           null,
    sent_at:               null,
    sent_to:               null,
    created_at:            serverTimestamp(),
    updated_at:            serverTimestamp(),
  })
  return ref.id
}

export async function decideReport(fileNumber, id, { decision, notes, reviewerUid, reviewerName }) {
  await updateDoc(doc(db, 'facilities', facilityDocId(fileNumber), 'monitoring_reports', id), {
    status:           decision,
    review_notes:     notes ?? '',
    reviewed_by:      reviewerUid,
    reviewed_by_name: reviewerName,
    reviewed_at:      serverTimestamp(),
    updated_at:       serverTimestamp(),
  })
}

export async function markReportSent(fileNumber, id, { sentTo }) {
  await updateDoc(doc(db, 'facilities', facilityDocId(fileNumber), 'monitoring_reports', id), {
    status:     'sent',
    sent_at:    serverTimestamp(),
    sent_to:    sentTo ?? null,
    updated_at: serverTimestamp(),
  })
}

export async function deleteMonitoringReport(fileNumber, id) {
  const report = await getMonitoringReport(fileNumber, id)
  await deleteDoc(doc(db, 'facilities', facilityDocId(fileNumber), 'monitoring_reports', id))
  if (report?.file_path) deleteFile(report.file_path)
}
