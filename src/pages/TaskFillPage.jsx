import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, AlertCircle, Save, Bookmark, Loader, Upload } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useGPS } from '../hooks/useGPS'
import { getTask, submitFormTask, saveTaskFormDraft, uploadGenericTaskSubmission, taskDisplayLabel } from '../firebase/tasks'
import { createNotification } from '../firebase/notifications'
import { listStaff, getStaffMember } from '../firebase/staff'
import { getFacility } from '../firebase/facilities'
import { listSubRecords } from '../firebase/subrecords'
import { inputToTs, tsToInput } from '../utils/records'
import { EMPTY_SCREENING_FORM, buildScreeningPayload } from '../data/screeningFieldMeta'
import { SITE_VERIFICATION_CHECKLISTS, buildChecklistDefaults, applyChecklistPayload } from '../data/siteVerificationChecklists'
import ScreeningFields from '../components/forms/ScreeningFields'
import ChecklistFields from '../components/forms/ChecklistFields'
import Spinner from '../components/Spinner'


export default function TaskFillPage() {
  const { taskId } = useParams()
  const navigate = useNavigate()
  const { user, staff } = useAuth()

  const [task, setTask]             = useState(null)
  const [facility, setFacility]     = useState(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [draftSaved, setDraftSaved]   = useState(false)

  // Screening form state
  const [form, setForm]     = useState(EMPTY_SCREENING_FORM)
  const [photos, setPhotos] = useState([])
  const { coordinates, setCoordinates, loading: gpsLoading, error: gpsError, capture: captureGPS, clear: clearGPS } = useGPS()
  const [revisionNote, setRevisionNote] = useState('')
  const [allStaff, setAllStaff] = useState([])
  const [secondOfficerUid, setSecondOfficerUid] = useState('')

  // Checklist (Site Verification / Pesticides Screening) form state
  const [subType, setSubType] = useState('')
  const [checklistData, setChecklistData] = useState({ date: '', linked_permit_id: '', notes: '' })
  const [permits, setPermits] = useState([])

  // Generic (non-form) submission state
  const [file, setFile] = useState(null)

  useEffect(() => {
    listStaff().then(setAllStaff).catch(() => setAllStaff([]))
  }, [])

  useEffect(() => {
    getTask(taskId)
      .then(async (t) => {
        if (!t) { setError('Task not found.'); return }
        setTask(t)

        if (t.task_type === 'screening' || t.task_type === 'site_verification') {
          const fac = t.facility_mode === 'registered' && t.file_number
            ? await getFacility(t.file_number).catch(() => null)
            : null
          setFacility(fac)
          const sectorPrefix = fac?.sector_prefix ?? t.sector_prefix ?? null

          if (t.task_type === 'site_verification') {
            const initialSubType = sectorPrefix === 'CE' ? (t.form_data?.facility_sub_type ?? 'CE') : (sectorPrefix ?? 'CI')
            setSubType(initialSubType)
            if (t.facility_mode === 'registered' && t.file_number) {
              listSubRecords(t.file_number, 'permits').then(setPermits).catch(() => setPermits([]))
            }
          }

          const isPesticide = t.task_type === 'screening' && sectorPrefix === 'PP'
          if (isPesticide || t.task_type === 'site_verification') {
            const key = isPesticide ? 'PP' : (sectorPrefix === 'CE' ? (t.form_data?.facility_sub_type ?? 'CE') : (sectorPrefix ?? 'CI'))
            const checklist = SITE_VERIFICATION_CHECKLISTS[key] ?? SITE_VERIFICATION_CHECKLISTS.CI
            // Pesticide screenings (new facilities) also carry the written inspection report.
            const defaults = buildChecklistDefaults(checklist, { includeReport: isPesticide })
            const merged = { ...defaults }
            for (const k of Object.keys(defaults)) {
              if (t.form_data?.[k] !== undefined) merged[k] = t.form_data[k]
            }
            setChecklistData({
              date:             t.form_data?.date ? tsToInput(t.form_data.date) : '',
              linked_permit_id: t.form_data?.linked_permit_id ?? '',
              notes:            t.form_data?.notes ?? '',
              ...merged,
            })
            setSecondOfficerUid(t.form_data?.second_officer_id ?? '')
            setPhotos(t.form_data?.photos ?? [])
            if (t.form_data?.coordinates) setCoordinates(t.form_data.coordinates)
          }
        }

        if (t.task_type === 'screening' && t.form_data) {
          setForm({ ...EMPTY_SCREENING_FORM, ...t.form_data })
          setPhotos(t.form_data.photos ?? [])
          setSecondOfficerUid(t.form_data.second_officer_id ?? '')
          if (t.form_data.coordinates) setCoordinates(t.form_data.coordinates)
        }
      })
      .catch(() => setError('Failed to load task.'))
      .finally(() => setLoading(false))
  }, [taskId]) // eslint-disable-line react-hooks/exhaustive-deps

  // If this task was assigned to two officers, the "other" one is locked in
  // as the second signing officer — no need to pick manually.
  const derivedOtherUid = task && task.assigned_to_2
    ? (task.assigned_to === user.uid ? task.assigned_to_2 : task.assigned_to)
    : null
  const derivedOtherName = task && derivedOtherUid
    ? (task.assigned_to === user.uid ? task.assigned_to_2_name : task.assigned_to_name)
    : null

  function set(field, value) { setForm((f) => ({ ...f, [field]: value })); setDraftSaved(false) }
  function setManualCoordinates(next) {
    setCoordinates(next)
    setForm((f) => ({ ...f, latitude: next ? String(next.lat) : '', longitude: next ? String(next.lng) : '' }))
    setDraftSaved(false)
  }
  function setChecklistField(key, value) { setChecklistData((p) => ({ ...p, [key]: value })); setDraftSaved(false) }

  const unresolvedByField = {}
  for (const a of task?.annotations ?? []) {
    if (!a.resolved) unresolvedByField[a.field_key] = { comment: a.comment, field_label: a.field_label }
  }

  const sectorPrefix = facility?.sector_prefix ?? task?.sector_prefix ?? null
  const isPesticideScreening = task?.task_type === 'screening' && sectorPrefix === 'PP'
  const isSiteVerification = task?.task_type === 'site_verification'
  const isChecklistTask = isSiteVerification || isPesticideScreening
  const checklistKey = isPesticideScreening ? 'PP' : (sectorPrefix === 'CE' ? subType : (sectorPrefix ?? 'CI'))
  const checklist = isChecklistTask ? (SITE_VERIFICATION_CHECKLISTS[checklistKey] ?? SITE_VERIFICATION_CHECKLISTS.CI) : null

  function handleSubTypeChange(newSubType) {
    const newChecklist = SITE_VERIFICATION_CHECKLISTS[newSubType] ?? SITE_VERIFICATION_CHECKLISTS.CI
    setSubType(newSubType)
    setChecklistData((prev) => ({
      date:             prev.date,
      linked_permit_id: prev.linked_permit_id,
      notes:            prev.notes,
      ...buildChecklistDefaults(newChecklist),
    }))
  }

  async function buildScreeningFormData() {
    const secondOfficerId = derivedOtherUid || secondOfficerUid || ''
    const secondOfficer = secondOfficerId ? await getStaffMember(secondOfficerId).catch(() => null) : null
    return {
      ...buildScreeningPayload(form, coordinates),
      photos,
      officer_id:                    user.uid,
      officer_name:                  staff?.name ?? '',
      officer_signature_url:         staff?.signature_url ?? '',
      second_officer_id:             secondOfficerId,
      second_officer_name:           secondOfficer?.name ?? derivedOtherName ?? '',
      second_officer_signature_url:  secondOfficer?.signature_url ?? '',
    }
  }

  async function handleSubmitScreening(e) {
    e.preventDefault()
    if (!form.inspection_date) { setError('Inspection date is required.'); return }
    setSubmitting(true)
    setError('')
    try {
      const formData = await buildScreeningFormData()
      const isResubmission = task.status === 'changes_requested'
      await submitFormTask(taskId, { formData, revisionNote, uid: user.uid })
      await createNotification(
        task.assigned_by,
        'task_submitted',
        `${staff?.name ?? 'A colleague'} ${isResubmission ? 'resubmitted' : 'submitted'} the ${taskDisplayLabel(task)} task for ${task.facility_name}.`,
        { taskId },
      ).catch(() => {})
      navigate(-1)
    } catch (err) {
      setError(`Failed to submit: ${err.message}`)
      setSubmitting(false)
    }
  }

  function isChecklistItemVisible(item) {
    if (!item.conditional) return true
    return checklistData[item.conditional.key] === item.conditional.value
  }

  async function buildChecklistFormData() {
    const secondOfficerId = derivedOtherUid || secondOfficerUid || ''
    const secondOfficer = secondOfficerId ? await getStaffMember(secondOfficerId).catch(() => null) : null

    const formData = {
      date:                          checklistData.date ? inputToTs(checklistData.date) : null,
      officer_id:                    user.uid,
      officer_name:                  staff?.name ?? '',
      officer_signature_url:         staff?.signature_url ?? '',
      second_officer_id:             secondOfficerId,
      second_officer_name:           secondOfficer?.name ?? derivedOtherName ?? '',
      second_officer_signature_url:  secondOfficer?.signature_url ?? '',
      coordinates: coordinates ?? null,
      photos,
      notes: checklistData.notes.trim(),
      sector_prefix: isPesticideScreening ? 'PP' : (sectorPrefix ?? 'CI'),
      facility_sub_type: checklistKey,
      ...(isSiteVerification ? { linked_permit_id: checklistData.linked_permit_id } : {}),
    }
    applyChecklistPayload(formData, checklist, checklistData, {
      includeReport: isPesticideScreening,
      isVisible: isChecklistItemVisible,
    })
    return formData
  }

  async function handleSubmitChecklist(e) {
    e.preventDefault()
    if (!checklistData.date) { setError('Date is required.'); return }
    setSubmitting(true)
    setError('')
    try {
      const formData = await buildChecklistFormData()
      const isResubmission = task.status === 'changes_requested'
      await submitFormTask(taskId, { formData, revisionNote, uid: user.uid })
      await createNotification(
        task.assigned_by,
        'task_submitted',
        `${staff?.name ?? 'A colleague'} ${isResubmission ? 'resubmitted' : 'submitted'} the ${taskDisplayLabel(task)} task for ${task.facility_name}.`,
        { taskId },
      ).catch(() => {})
      navigate(-1)
    } catch (err) {
      setError(`Failed to submit: ${err.message}`)
      setSubmitting(false)
    }
  }

  async function handleSaveDraft() {
    setSavingDraft(true)
    setDraftSaved(false)
    setError('')
    try {
      const formData = isScreening ? await buildScreeningFormData() : await buildChecklistFormData()
      await saveTaskFormDraft(taskId, { formData, uid: user.uid })
      setDraftSaved(true)
    } catch (err) {
      setError(`Failed to save draft: ${err.message}`)
    } finally {
      setSavingDraft(false)
    }
  }

  async function handleSubmitGeneric(e) {
    e.preventDefault()
    if (!file) { setError('Choose a file to upload.'); return }
    setSubmitting(true)
    setError('')
    try {
      await uploadGenericTaskSubmission(taskId, file, { uid: user.uid })
      await createNotification(
        task.assigned_by, 'task_submitted',
        `${staff?.name ?? 'A colleague'} submitted the ${taskDisplayLabel(task)} task for ${task.facility_name}.`,
        { taskId },
      ).catch(() => {})
      navigate(-1)
    } catch (err) {
      setError(`Failed to submit: ${err.message}`)
      setSubmitting(false)
    }
  }

  if (loading) return <Spinner size={40} />
  if (error && !task) {
    return (
      <div className="page">
        <div className="login-error"><AlertCircle size={15} /> {error}</div>
      </div>
    )
  }

  const isScreening = task.task_type === 'screening' && !isPesticideScreening
  const alreadySubmitted = task.status === 'submitted' || task.status === 'approved'

  return (
    <div className="page">
      <button className="btn btn--ghost btn--sm btn--back" onClick={() => navigate(-1)}>
        <ArrowLeft size={14} /> Back
      </button>

      <div className="page-header" style={{ marginTop: 12 }}>
        <div>
          <div className="page-title">{taskDisplayLabel(task)} Task</div>
          <div className="page-subtitle">
            Facility: <strong>{task.facility_name}</strong>
            {task.facility_mode === 'unregistered' && <span style={{ marginLeft: 6, color: '#9ca3af' }}>(not registered in app)</span>}
          </div>
        </div>
      </div>

      {alreadySubmitted && (
        <div className="tab-empty">
          This task was already {task.status === 'approved' ? 'approved' : 'submitted and is awaiting review'} — no further action needed here.
        </div>
      )}

      {task.notes && (
        <div className="offline-banner" style={{ background: '#eff6ff', borderColor: '#bfdbfe', color: '#1e40af' }}>
          Instructions from {task.assigned_by_name}: {task.notes}
        </div>
      )}

      {task.prefilled_from_field_report && task.status === 'assigned' && (
        <div className="offline-banner" style={{ background: '#fff7ed', borderColor: '#fed7aa', color: '#c2410c' }}>
          This form has been pre-filled with screening details already captured on the field report for this facility — please review and correct anything before submitting.
        </div>
      )}

      {error && (
        <div className="login-error" style={{ marginBottom: 16 }}>
          <AlertCircle size={15} style={{ flexShrink: 0 }} /> {error}
        </div>
      )}

      {!alreadySubmitted && (isScreening ? (
        <form onSubmit={handleSubmitScreening}>
          <ScreeningFields
            form={form}
            set={set}
            officerName={staff?.name}
            coordinates={coordinates}
            gpsLoading={gpsLoading}
            gpsError={gpsError}
            onCaptureGPS={captureGPS}
            onClearGPS={clearGPS}
            onManualCoordinates={setManualCoordinates}
            photos={photos}
            onPhotosChange={setPhotos}
            photoFileNumber={task.facility_mode === 'registered' ? task.file_number : 'tasks'}
            photoCategory={task.facility_mode === 'registered' ? 'screenings' : `${taskId}/screenings`}
            annotationsByField={unresolvedByField}
            secondOfficerLocked={Boolean(derivedOtherUid)}
            secondOfficerName={derivedOtherName ?? ''}
            secondOfficerUid={secondOfficerUid}
            onSecondOfficerChange={setSecondOfficerUid}
            staffOptions={allStaff.filter((s) => s.id !== user.uid)}
          />

          {task.status === 'changes_requested' && (
            <div className="card form-card">
              <div className="form-section-title">Note to Reviewer (optional)</div>
              <textarea className="input textarea" rows={2} value={revisionNote}
                onChange={(e) => setRevisionNote(e.target.value)}
                placeholder="Let the reviewer know what changed…" />
            </div>
          )}

          <div className="form-actions">
            {draftSaved && <span style={{ fontSize: 12, color: '#16a34a', alignSelf: 'center' }}>Draft saved</span>}
            <button type="button" className="btn btn--ghost" onClick={handleSaveDraft} disabled={savingDraft || submitting}>
              {savingDraft
                ? <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</>
                : <><Bookmark size={15} /> Save Draft</>
              }
            </button>
            <button type="submit" className="btn btn--primary" disabled={submitting || savingDraft}>
              {submitting
                ? <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> Submitting…</>
                : <><Save size={15} /> {task.status === 'changes_requested' ? 'Resubmit' : 'Submit for Review'}</>
              }
            </button>
          </div>
        </form>
      ) : isChecklistTask ? (
        <form onSubmit={handleSubmitChecklist}>
          {isSiteVerification && sectorPrefix === 'CE' && (
            <div className="card form-card">
              <div className="form-section-title">Facility Sub-type</div>
              <div className="form-group">
                <label>Select facility type <span style={{ color: '#ef4444' }}>*</span></label>
                <select className="select" value={subType} onChange={(e) => handleSubTypeChange(e.target.value)}>
                  <option value="CE">Car Washing Bay</option>
                  <option value="CE_FUEL_STATION">Fuel Service and Filling Station</option>
                  <option value="CE_LPG">LPG Re-filling Plant</option>
                </select>
              </div>
            </div>
          )}

          <ChecklistFields
            checklist={checklist}
            detailsTitle={isPesticideScreening ? 'Inspection Details' : 'Verification Details'}
            dateLabel={isPesticideScreening ? 'Inspection Date' : 'Date'}
            date={checklistData.date}
            onDateChange={(v) => setChecklistField('date', v)}
            officerName={staff?.name}
            secondOfficerLocked={Boolean(derivedOtherUid)}
            secondOfficerName={derivedOtherName ?? ''}
            secondOfficerUid={secondOfficerUid}
            onSecondOfficerChange={setSecondOfficerUid}
            staffOptions={allStaff.filter((s) => s.id !== user.uid)}
            permits={isSiteVerification ? permits : null}
            linkedPermitId={checklistData.linked_permit_id}
            onLinkedPermitChange={(v) => setChecklistField('linked_permit_id', v)}
            coordinates={coordinates}
            gpsLoading={gpsLoading}
            gpsError={gpsError}
            onCaptureGPS={captureGPS}
            onClearGPS={clearGPS}
            onManualCoordinates={setCoordinates}
            formData={checklistData}
            set={setChecklistField}
            notes={checklistData.notes}
            onNotesChange={(v) => setChecklistField('notes', v)}
            photos={photos}
            onPhotosChange={setPhotos}
            photoFileNumber={task.facility_mode === 'registered' ? task.file_number : 'tasks'}
            photoCategory={task.facility_mode === 'registered' ? (isSiteVerification ? 'site_verifications' : 'screenings') : `${taskId}/${isSiteVerification ? 'site_verifications' : 'screenings'}`}
            annotationsByField={unresolvedByField}
            showReport={isPesticideScreening}
          />

          {task.status === 'changes_requested' && (
            <div className="card form-card">
              <div className="form-section-title">Note to Reviewer (optional)</div>
              <textarea className="input textarea" rows={2} value={revisionNote}
                onChange={(e) => setRevisionNote(e.target.value)}
                placeholder="Let the reviewer know what changed…" />
            </div>
          )}

          <div className="form-actions">
            {draftSaved && <span style={{ fontSize: 12, color: '#16a34a', alignSelf: 'center' }}>Draft saved</span>}
            <button type="button" className="btn btn--ghost" onClick={handleSaveDraft} disabled={savingDraft || submitting}>
              {savingDraft
                ? <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</>
                : <><Bookmark size={15} /> Save Draft</>
              }
            </button>
            <button type="submit" className="btn btn--primary" disabled={submitting || savingDraft}>
              {submitting
                ? <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> Submitting…</>
                : <><Save size={15} /> {task.status === 'changes_requested' ? 'Resubmit' : 'Submit for Review'}</>
              }
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleSubmitGeneric}>
          <div className="card form-card">
            <div className="form-section-title">Upload File</div>
            <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting
                ? <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> Submitting…</>
                : <><Upload size={15} /> Submit for Review</>
              }
            </button>
          </div>
        </form>
      ))}
    </div>
  )
}
