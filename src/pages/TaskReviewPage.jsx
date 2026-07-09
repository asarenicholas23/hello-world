import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, AlertCircle, CheckCircle, XCircle, Download, FileText } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  getTask, addAnnotationsAndRequestChanges, requestGenericChanges, approveTask, taskTypeLabel,
} from '../firebase/tasks'
import { getSubRecord } from '../firebase/subrecords'
import { createNotification } from '../firebase/notifications'
import { facilityPath } from '../utils/fileNumbers'
import AnnotatableScreeningReview from '../components/tasks/AnnotatableScreeningReview'
import RecordDocumentModal from '../components/RecordDocumentModal'
import Spinner from '../components/Spinner'

export default function TaskReviewPage() {
  const { taskId } = useParams()
  const navigate = useNavigate()
  const { user, staff } = useAuth()

  const [task, setTask]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [deciding, setDeciding] = useState(false)
  const [pendingComments, setPendingComments] = useState([])
  const [genericNotes, setGenericNotes] = useState('')
  const [docRecord, setDocRecord] = useState(null)
  const [docOpen, setDocOpen]     = useState(false)

  useEffect(() => { load() }, [taskId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    try {
      const t = await getTask(taskId)
      if (!t) { setError('Task not found.'); return }
      setTask(t)
      setPendingComments([])
      if (t.status === 'approved' && t.task_type === 'screening') {
        const materialized = t.linked_file_number && t.linked_record_id
          ? await getSubRecord(t.linked_file_number, 'screenings', t.linked_record_id).catch(() => null)
          : null
        setDocRecord(materialized ?? t.form_data)
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
    if (task.task_type === 'screening') {
      if (pendingComments.length === 0) { setError('Add at least one comment before requesting changes.'); return }
      setDeciding(true)
      try {
        await addAnnotationsAndRequestChanges(taskId, { newAnnotations: pendingComments, uid: user.uid, name: staff?.name ?? '' })
        await notifyAssignee('task_changes_requested', `${staff?.name ?? 'The reviewer'} requested changes on your ${taskTypeLabel(task.task_type)} task for ${task.facility_name}.`)
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
        await notifyAssignee('task_changes_requested', `${staff?.name ?? 'The reviewer'} requested changes on your ${taskTypeLabel(task.task_type)} task for ${task.facility_name}.`)
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
      await notifyAssignee('task_approved', `Your ${taskTypeLabel(task.task_type)} task for ${task.facility_name} was approved.`)
      navigate(-1)
    } catch (err) {
      setError(`Failed to approve: ${err.message}`)
      setDeciding(false)
    }
  }

  if (loading) return <Spinner size={40} />
  if (error && !task) {
    return <div className="page"><div className="login-error"><AlertCircle size={15} /> {error}</div></div>
  }

  const isScreening = task.task_type === 'screening'
  const canDecide = task.assigned_by === user.uid && task.status === 'submitted'

  return (
    <div className="page">
      <button className="btn btn--ghost btn--sm btn--back" onClick={() => navigate(-1)}>
        <ArrowLeft size={14} /> Back
      </button>

      <div className="page-header" style={{ marginTop: 12 }}>
        <div>
          <div className="page-title">{taskTypeLabel(task.task_type)} — {task.facility_name}</div>
          <div className="page-subtitle">
            Submitted by {task.assigned_to_name}{task.assigned_to_2_name ? ` & ${task.assigned_to_2_name}` : ''}
            {task.linked_file_number && (
              <> · <a onClick={(e) => { e.preventDefault(); navigate(facilityPath(task.linked_file_number), { state: { tab: 'screenings' } }) }} href="#">
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

      {task.status === 'assigned' && (
        <div className="tab-empty">This task hasn't been submitted yet.</div>
      )}

      {task.status !== 'assigned' && (
        <>
          {isScreening ? (
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

          {!isScreening && canDecide && (
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
          type="screening"
          record={docRecord}
          fileNumber={task.linked_file_number ?? null}
          onClose={() => setDocOpen(false)}
        />
      )}
    </div>
  )
}
