import {
  collection, collectionGroup, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc,
  serverTimestamp, query, orderBy,
} from 'firebase/firestore'
import { db } from './config'
import { decodeFileNumberParam } from '../utils/fileNumbers'

const COL = () => collection(db, 'field_reports')

export async function listFieldReports() {
  const snap = await getDocs(query(COL(), orderBy('created_at', 'desc')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

function tsMillis(v) {
  if (!v) return 0
  if (typeof v.toMillis === 'function') return v.toMillis()
  if (typeof v.seconds === 'number') return v.seconds * 1000
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? 0 : d.getTime()
}

// Field Reports list PLUS every facility-scoped enforcement action that isn't
// already mirrored into `field_reports`. Enforcement records created directly on
// a facility (or imported from the Google Drive migration) never got a mirror
// row, so they were invisible on the Field Reports page — this folds them in as
// read-only synthetic rows keyed to the source subrecord.
export async function listFieldReportsWithFacilityEnforcement() {
  const [reports, enfSnap, facSnap] = await Promise.all([
    listFieldReports(),
    getDocs(collectionGroup(db, 'enforcement')),
    getDocs(collection(db, 'facilities')),
  ])

  const facilitiesById = new Map()
  facSnap.docs.forEach((d) => facilitiesById.set(d.id, d.data()))

  // Keys for enforcement rows already represented by a field_report.
  const mirroredSourceIds = new Set()
  const mirroredFuzzyKeys = new Set()
  reports.forEach((r) => {
    if (r.report_type !== 'enforcement') return
    if (r.enforcement_source_id) {
      mirroredSourceIds.add(`${r.assigned_file_number ?? ''}::${r.enforcement_source_id}`)
    }
    mirroredFuzzyKeys.add(
      `${r.assigned_file_number ?? ''}::${tsMillis(r.date)}::${r.action_taken ?? ''}`,
    )
  })

  const synthetic = []
  enfSnap.docs.forEach((d) => {
    const facilityDocId = d.ref.parent.parent?.id
    if (!facilityDocId) return
    const fileNumber = decodeFileNumberParam(facilityDocId)
    const rec = d.data()

    if (mirroredSourceIds.has(`${fileNumber}::${d.id}`)) return
    if (mirroredFuzzyKeys.has(`${fileNumber}::${tsMillis(rec.date)}::${rec.action_taken ?? ''}`)) return

    const facility = facilitiesById.get(facilityDocId) ?? {}
    synthetic.push({
      id:                   `enf__${facilityDocId}__${d.id}`,
      synthetic:            true,
      source:               'facility_enforcement',
      enforcement_source_id: d.id,
      assigned_file_number: fileNumber,
      report_type:          'enforcement',
      facility_name:        facility.name ?? fileNumber,
      sector_prefix:        facility.sector_prefix ?? '',
      district:             facility.district ?? '',
      phone:                facility.phone ?? '',
      location:             rec.location ?? facility.location ?? '',
      enforcement_location: rec.location ?? '',
      contact_person:       rec.contact_person ?? '',
      action_taken:         rec.action_taken ?? '',
      follow_up_date:       rec.follow_up_date ?? null,
      date:                 rec.date ?? null,
      notes:                rec.notes ?? '',
      coordinates:          rec.coordinates ?? null,
      photos:               rec.photos ?? [],
      officer_id:           rec.officer_id ?? null,
      officer_name:         rec.officer_name ?? '',
      primary_officer:      rec.primary_officer ?? null,
      primary_officer_name: rec.primary_officer_name ?? null,
      supporting_officers:  rec.supporting_officers ?? [],
      created_at:           rec.created_at ?? rec.date ?? null,
      reporting_status:     'reported',
      invoice_status:       'pending',
    })
  })

  return [...reports, ...synthetic].sort((a, b) => {
    const aTs = a.report_type === 'enforcement' ? tsMillis(a.date) || tsMillis(a.created_at) : tsMillis(a.created_at)
    const bTs = b.report_type === 'enforcement' ? tsMillis(b.date) || tsMillis(b.created_at) : tsMillis(b.created_at)
    return bTs - aTs
  })
}

export async function getFieldReport(id) {
  const snap = await getDoc(doc(db, 'field_reports', id))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function createFieldReport(data, userId) {
  const ref = await addDoc(COL(), {
    ...data,
    reporting_status:      data.reporting_status ?? 'pending',
    invoice_status:        data.invoice_status ?? 'pending',
    assigned_file_number:  data.assigned_file_number ?? null,
    created_at:            serverTimestamp(),
    created_by:            userId,
  })
  return ref.id
}

export async function updateFieldReport(id, data, userId) {
  await updateDoc(doc(db, 'field_reports', id), {
    ...data,
    updated_at: serverTimestamp(),
    updated_by: userId,
  })
}

export async function deleteFieldReport(id) {
  await deleteDoc(doc(db, 'field_reports', id))
}
