import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, AlertCircle, Save, Loader, Upload } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useGPS } from '../hooks/useGPS'
import { getTask, submitScreeningTask, uploadGenericTaskSubmission, taskTypeLabel } from '../firebase/tasks'
import { createNotification } from '../firebase/notifications'
import { listStaff, getStaffMember } from '../firebase/staff'
import { EMPTY_SCREENING_FORM, buildScreeningPayload } from '../data/screeningFieldMeta'
import ScreeningFields from '../components/forms/ScreeningFields'
import Spinner from '../components/Spinner'

export default function TaskFillPage() {
  const { taskId } = useParams()
  const navigate = useNavigate()
  const { user, staff } = useAuth()

  const [task, setTask]             = useState(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Screening form state
  const [form, setForm]     = useState(EMPTY_SCREENING_FORM)
  const [photos, setPhotos] = useState([])
  const { coordinates, setCoordinates, loading: gpsLoading, error: gpsError, capture: captureGPS, clear: clearGPS } = useGPS()
  const [revisionNote, setRevisionNote] = useState('')
  const [allStaff, setAllStaff] = useState([])
  const [secondOfficerUid, setSecondOfficerUid] = useState('')

  // Generic (non-screening) submission state
  const [file, setFile] = useState(null)

  useEffect(() => {
    listStaff().then(setAllStaff).catch(() => setAllStaff([]))
  }, [])

  useEffect(() => {
    getTask(taskId)
      .then((t) => {
        if (!t) { setError('Task not found.'); return }
        setTask(t)
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

  function set(field, value) { setForm((f) => ({ ...f, [field]: value })) }
  function setManualCoordinates(next) {
    setCoordinates(next)
    setForm((f) => ({ ...f, latitude: next ? String(next.lat) : '', longitude: next ? String(next.lng) : '' }))
  }

  const unresolvedByField = {}
  for (const a of task?.annotations ?? []) {
    if (!a.resolved) unresolvedByField[a.field_key] = { comment: a.comment, field_label: a.field_label }
  }

  async function handleSubmitScreening(e) {
    e.preventDefault()
    if (!form.inspection_date) { setError('Inspection date is required.'); return }
    setSubmitting(true)
    setError('')
    try {
      const secondOfficerId = derivedOtherUid || secondOfficerUid || ''
      const secondOfficer = secondOfficerId ? await getStaffMember(secondOfficerId).catch(() => null) : null
      const formData = {
        ...buildScreeningPayload(form, coordinates),
        photos,
        officer_id:                    user.uid,
        officer_name:                  staff?.name ?? '',
        officer_signature_url:         staff?.signature_url ?? '',
        second_officer_id:             secondOfficerId,
        second_officer_name:           secondOfficer?.name ?? derivedOtherName ?? '',
        second_officer_signature_url:  secondOfficer?.signature_url ?? '',
      }
      const isResubmission = task.status === 'changes_requested'
      await submitScreeningTask(taskId, { formData, revisionNote, uid: user.uid })
      await createNotification(
        task.assigned_by,
        'task_submitted',
        `${staff?.name ?? 'A colleague'} ${isResubmission ? 'resubmitted' : 'submitted'} the ${taskTypeLabel(task.task_type)} task for ${task.facility_name}.`,
        { taskId },
      ).catch(() => {})
      navigate(-1)
    } catch (err) {
      setError(`Failed to submit: ${err.message}`)
      setSubmitting(false)
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
        `${staff?.name ?? 'A colleague'} submitted the ${taskTypeLabel(task.task_type)} task for ${task.facility_name}.`,
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

  const isScreening = task.task_type === 'screening'
  const alreadySubmitted = task.status === 'submitted' || task.status === 'approved'

  return (
    <div className="page">
      <button className="btn btn--ghost btn--sm btn--back" onClick={() => navigate(-1)}>
        <ArrowLeft size={14} /> Back
      </button>

      <div className="page-header" style={{ marginTop: 12 }}>
        <div>
          <div className="page-title">{taskTypeLabel(task.task_type)} Task</div>
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
            <button type="submit" className="btn btn--primary" disabled={submitting}>
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
