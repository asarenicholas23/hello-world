import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc,
  serverTimestamp, query, orderBy,
} from 'firebase/firestore'
import { db } from './config'

function historyColFor(basePath, recordId) {
  return collection(db, basePath, recordId, 'assignment_history')
}

export async function assignRecord({ basePath, recordId, toUid, toName, actorUid, actorRole, fromUid = null }) {
  await updateDoc(doc(db, basePath, recordId), {
    primary_officer:      toUid,
    primary_officer_name: toName,
    assigned_by:          actorUid,
    assigned_at:          serverTimestamp(),
  })
  await addDoc(historyColFor(basePath, recordId), {
    timestamp:    serverTimestamp(),
    action:       fromUid ? 'reassigned' : 'assigned',
    from_officer: fromUid ?? null,
    to_officer:   toUid,
    actor:        actorUid,
    actor_role:   actorRole,
  })
}

export async function unassignRecord({ basePath, recordId, fromUid, actorUid, actorRole }) {
  await updateDoc(doc(db, basePath, recordId), {
    primary_officer:      null,
    primary_officer_name: null,
    assigned_by:          null,
    assigned_at:          null,
  })
  await addDoc(historyColFor(basePath, recordId), {
    timestamp:    serverTimestamp(),
    action:       'unassigned',
    from_officer: fromUid,
    to_officer:   null,
    actor:        actorUid,
    actor_role:   actorRole,
  })
}

export async function addSupportingOfficerToRecord({ basePath, recordId, officerUid, actorUid, actorRole }) {
  const ref  = doc(db, basePath, recordId)
  const snap = await getDoc(ref)
  const current = snap.data()?.supporting_officers ?? []
  if (current.includes(officerUid)) return
  await updateDoc(ref, { supporting_officers: [...current, officerUid] })
  await addDoc(historyColFor(basePath, recordId), {
    timestamp:    serverTimestamp(),
    action:       'supporting_added',
    from_officer: null,
    to_officer:   officerUid,
    actor:        actorUid,
    actor_role:   actorRole,
  })
}

export async function getRecordAssignmentHistory(basePath, recordId) {
  const snap = await getDocs(query(historyColFor(basePath, recordId), orderBy('timestamp', 'desc')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}
