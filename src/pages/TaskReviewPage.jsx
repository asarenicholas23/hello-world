import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, AlertCircle, CheckCircle, XCircle, Download, FileText } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  getTask, addAnnotationsAndRequestChanges, requestGenericChanges, approveTask, registerTaskFacility,
  taskDisplayLabel, isPesticideChecklistTask,
} from '../firebase/tasks'
import { getSubRecord } from '../firebase/subrecords'
import { createNotification } from '../firebase/notifications'
import { facilityPath } from '../utils/fileNumbers'
import { SECTORS, hasFullDataAccess } from '../data/constants'
import AnnotatableScreeningReview from '../components/tasks/AnnotatableScreeningReview'
import RecordDocumentModal from '../components/RecordDocumentModal'
import Spinner from '../components/Spinner'

export default function TaskReviewPage() {
  const { taskId } = useParams()
  const navigate = useNavigate()
  const { user, staff, dataAccess } = useAuth()
  const canEditAllEntries = hasFullDataAccess(staff?.role, dataAccess)

  const [task, setTask]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [deciding, setDeciding] = useState(false)
  const [pendingComments, setPendingComments] = useState([])
  const [genericNotes, setGenericNotes] = useState('')
  const [docRecord, setDocRecord] = useState(null)
  const [docOpen, setDocOpen]     = useState(false)

  const [regFileNumber, setRegFileNumber]   = useState('')
  const [regSectorPrefix, setRegSectorPrefix] = useState('')
  const [regType, setRegType]               = useState('')
  const [registering, setRegistering]       = useState(false)
  const [registerError, setRegisterError]   = useState('')

  useEffect(() => { load() }, [taskId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    try {
      const t = await getTask(taskId)
      if (!t) { setError('Task not found.'); return }
      setTask(t)
      setPendingComments([])

      const isChecklist = t.task_type === 'site_verification' || isPesticideChecklistTask(t)
      const usesAnnotatedFlow = t.task_type === 'screening' && !isPesticideChecklistTask(t)
      const recordCategory = t.task_type === 'site_verification' ? 'site_verifications' : 'screenings'

      if (t.status === 'approved' && (usesAnnotatedFlow || isChecklist)) {
        const materialized = t.linked_file_number && t.linked_record_id
          ? await getSubRecord(t.linked_file_number, recordCategory, t.linked_record_id).catch(() => null)
          : null
        setDocRecord(materialized ?? t.form_data)
      } else if (isChecklist && t.form_data) {
        setDocRecord(t.form_data)
      }
    } catch {
      setError('Failed to load task.')
    } finally {
      setLoading(false)
    }
  }

  function handleAddComment(fieldKey, fieldLabel, comment) {
    setPendingComments((prev) => [...prev.filter((c) => c.field_key !== fieldKey), { field_key: fieldKey, field_label: fieldLabel, comment }])
  }

  async function notifyAssignee(type, message) {
    createNotification(task.assigned_to, type, message, { taskId }).catch(() => {})
    if (task.assigned_to_2) createNotification(task.assigned_to_2, type, message, { taskId }).catch(() => {})
  }

  async function handleRequestChanges() {
    if (usesAnnotatedFlow) {
      if (pendingComments.length === 0) { setError('Add at least one comment before requesting changes.'); return }
      setDeciding(true)
      try {
        await addAnnotationsAndRequestChanges(taskId, { newAnnotations: pendingComments, uid: user.uid, name: staff?.name ?? '' })
        await notifyAssignee('task_changes_requested', `${staff?.name ?? 'The reviewer'} requested changes on your ${taskDisplayLabel(task)} task for ${task.facility_name}.`)
        navigate(-1)
      } catch {
        setError('Failed to request changes. Try again.')
        setDeciding(false)
      }
    } else {
      if (!genericNotes.trim()) { setError('Add a note explaining the requested changes.'); return }
      setDeciding(true)
      try {
        await requestGenericChanges(taskId, { reviewNotes: genericNotes.trim(), uid: user.uid })
        await notifyAssignee('task_changes_requested', `${staff?.name ?? 'The reviewer'} requested changes on your ${taskDisplayLabel(task)} task for ${task.facility_name}.`)
        navigate(-1)
      } catch {
        setError('Failed to request changes. Try again.')
        setDeciding(false)
      }
    }
  }

  async function handleApprove() {
    setDeciding(true)
    setError('')
    try {
      await approveTask(taskId, { uid: user.uid, reviewNotes: genericNotes.trim() })
      await notifyAssignee('task_approved', `Your ${taskDisplayLabel(task)} task for ${task.facility_name} was approved.`)
      navigate(-1)
    } catch (err) {
      setError(`Failed to approve: ${err.message}`)
      setDeciding(false)
    }
  }

  async function handleRegisterFacility() {
    setRegisterError('')
    if (!regFileNumber.trim()) { setRegisterError('Enter a file number.'); return }
    if (!regSectorPrefix) { setRegisterError('Select a sector.'); return }
    setRegistering(true)
    try {
      const sector = SECTORS.find((s) => s.prefix === regSectorPrefix)
      await registerTaskFacility(taskId, {
        fileNumber: regFileNumber, sectorPrefix: regSectorPrefix, sector: sector?.name ?? '', typeOfUndertaking: regType.trim(),
      }, user.uid)
      await load()
    } catch (err) {
      setRegisterError(err.message ?? 'Failed to register facility.')
    } finally {
      setRegistering(false)
    }
  }

  if (loading) return <Spinner size={40} />
  if (error && !task) {
    return <div className="page"><div className="login-error"><AlertCircle size={15} /> {error}</div></div>
  }

  const isChecklistTask = task.task_type === 'site_verification' || isPesticideChecklistTask(task)
  const usesAnnotatedFlow = task.task_type === 'screening' && !isPesticideChecklistTask(task)
  const canDecide = task.assigned_by === user.uid && task.status === 'submitted'
  const needsRegistration = task.facility_mode === 'unregistered' && !task.field_report_id && canEditAllEntries
  const facilityLinkNumber = task.linked_file_number ?? (task.facility_mode === 'registered' ? task.file_number : null)
  const facilityLinkTab = task.task_type === 'site_verification' ? 'site_verifications' : 'screenings'

  return (
    <div className="page">
      <button className="btn btn--ghost btn--sm btn--back" onClick={() => navigate(-1)}>
        <ArrowLeft size={14} /> Back
      </button>

      <div className="page-header" style={{ marginTop: 12 }}>
        <div>
          <div className="page-title">{taskDisplayLabel(task)} — {task.facility_name}</div>
          <div className="page-subtitle">
            Submitted by {task.assigned_to_name}{task.assigned_to_2_name ? ` & ${task.assigned_to_2_name}` : ''}
            {facilityLinkNumber && (
              <> · <a onClick={(e) => {
                e.preventDefault()
                navigate(facilityPath(facilityLinkNumber), task.linked_file_number ? { state: { tab: facilityLinkTab } } : undefined)
              }} href="#">
                View on facility record
              </a></>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="login-error" style={{ marginBottom: 16 }}>
          <AlertCircle size={15} style={{ flexShrink: 0 }} /> {error}
        </div>
      )}

      {needsRegistration && (
        <div className="card form-card">
          <div className="form-section-title">Register This Facility</div>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
            This facility isn&apos;t in the system yet — give it a file number to add it. The name, location, and contact details already captured on this task carry over automatically.
          </p>
          <div className="form-row">
            <div className="form-group">
              <label>Sector</label>
              <select className="select" value={regSectorPrefix} onChange={(e) => setRegSectorPrefix(e.target.value)}>
                <option value="">Select sector…</option>
                {SECTORS.map((s) => <option key={s.prefix} value={s.prefix}>{s.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Type of Undertaking</label>
              <input className="input" value={regType} onChange={(e) => setRegType(e.target.value)} placeholder="e.g. Road construction" />
            </div>
          </div>
          <div className="form-group">
            <label>File Number</label>
            <input className="input" style={{ textTransform: 'uppercase' }} placeholder="e.g. CI42"
              value={regFileNumber} onChange={(e) => setRegFileNumber(e.target.value)} />
          </div>
          {registerError && (
            <div className="login-error" style={{ marginBottom: 12 }}>
              <AlertCircle size={14} style={{ flexShrink: 0 }} /> {registerError}
            </div>
          )}
          <button className="btn btn--primary btn--sm" onClick={handleRegisterFacility} disabled={registering}>
            {registering ? 'Registering…' : 'Register Facility'}
          </button>
        </div>
      )}

      {task.status === 'assigned' && (
        <div className="tab-empty">This task hasn't been submitted yet.</div>
      )}

      {task.status !== 'assigned' && (
        <>
          {usesAnnotatedFlow ? (
            task.status === 'approved' ? (
              <div className="card form-card">
                <div className="form-section-title">Approved</div>
                <p style={{ fontSize: 13, color: '#374151', marginBottom: 12 }}>
                  This screening has been approved{task.linked_file_number ? ` and saved to the facility record (${task.linked_file_number})` : ''}.
                </p>
                <button className="btn btn--primary btn--sm" onClick={() => setDocOpen(true)} disabled={!docRecord}>
                  <FileText size={14} /> View / Print PDF
                </button>
              </div>
            ) : (
              <div className="card" style={{ padding: 16 }}>
                <AnnotatableScreeningReview
                  formData={task.form_data}
                  annotations={[...(task.annotations ?? []), ...pendingComments.map((c) => ({ ...c, resolved: false }))]}
                  onAddComment={handleAddComment}
                  readOnly={!canDecide}
                />
              </div>
            )
          ) : isChecklistTask ? (
            <div className="card form-card">
              <div className="form-section-title">{task.status === 'approved' ? 'Approved' : `Submitted ${taskDisplayLabel(task)}`}</div>
              <p style={{ fontSize: 13, color: '#374151', marginBottom: 12 }}>
                {task.status === 'approved'
                  ? `This has been approved${task.linked_file_number ? ` and saved to the facility record (${task.linked_file_number})` : ''}.`
                  : 'Review the filled form below before approving or requesting changes.'}
              </p>
              <button className="btn btn--primary btn--sm" onClick={() => setDocOpen(true)} disabled={!docRecord}>
                <FileText size={14} /> {task.status === 'approved' ? 'View / Print PDF' : 'View Submission'}
              </button>
            </div>
          ) : (
            <div className="card form-card">
              <div className="form-section-title">Submitted File</div>
              {task.submission?.file_url ? (
                <a className="btn btn--ghost btn--sm" href={task.submission.file_url} target="_blank" rel="noopener noreferrer">
                  <Download size={14} /> {task.submission.file_name}
                </a>
              ) : <div style={{ color: '#9ca3af', fontSize: 13 }}>No file submitted.</div>}
            </div>
          )}

          {task.revision_note && (
            <div className="card form-card">
              <div className="form-section-title">Note from Assignee</div>
              <div style={{ fontSize: 13 }}>{task.revision_note}</div>
            </div>
          )}

          {!usesAnnotatedFlow && canDecide && (
            <div className="card form-card">
              <div className="form-section-title">Review Notes</div>
              <textarea className="input textarea" rows={2} value={genericNotes}
                onChange={(e) => setGenericNotes(e.target.value)}
                placeholder="Notes (required if requesting changes)…" />
            </div>
          )}

          {canDecide && (
            <div className="form-actions">
              <button className="btn btn--ghost" style={{ color: '#dc2626', borderColor: '#fecaca' }}
                onClick={handleRequestChanges} disabled={deciding}>
                <XCircle size={15} /> Request Changes
              </button>
              <button className="btn btn--primary" onClick={handleApprove} disabled={deciding}>
                <CheckCircle size={15} /> Approve
              </button>
            </div>
          )}
        </>
      )}

      {docOpen && docRecord && (
        <RecordDocumentModal
          type={task.task_type === 'site_verification' ? 'site_verification' : 'screening'}
          record={docRecord}
          fileNumber={task.linked_file_number ?? (task.facility_mode === 'registered' ? task.file_number : null)}
          onClose={() => setDocOpen(false)}
        />
      )}
    </div>
  )
}
