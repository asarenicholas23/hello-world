import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Upload, Trash2, AlertCircle, FileText, Download, Send,
  CheckCircle, XCircle, Clock, Edit3,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import {
  listMonitoringReports, uploadMonitoringReport, decideReport, deleteMonitoringReport,
} from '../../firebase/monitoringReports'
import { listStaff } from '../../firebase/staff'
import { createNotification } from '../../firebase/notifications'
import { fmtDate } from '../../utils/records'
import { ADMIN_VIEW_ROLES, FIELD_ROLES } from '../../data/constants'
import Spinner from '../Spinner'

// Roles eligible to review/approve an uploaded monitoring report
const REVIEWER_ROLES = new Set(['senior_officer', 'officer', 'assistant_officer'])

const STATUS_META = {
  pending:            { label: 'Pending Review',    bg: '#fef9c3', color: '#854d0e', icon: Clock },
  changes_requested:  { label: 'Changes Requested',  bg: '#fee2e2', color: '#991b1b', icon: Edit3 },
  approved:           { label: 'Approved',           bg: '#dcfce7', color: '#166534', icon: CheckCircle },
  sent:               { label: 'Sent',               bg: '#e0f2fe', color: '#075985', icon: Send },
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status] ?? STATUS_META.pending
  const Icon = meta.icon
  return (
    <span className="record-badge" style={{ background: meta.bg, color: meta.color }}>
      <Icon size={11} /> {meta.label}
    </span>
  )
}

export default function MonitoringReportsTab({ fileNumber, facilityName }) {
  const { user, staff, role } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reviewers, setReviewers] = useState([])
  const [assignTo, setAssignTo] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [decidingId, setDecidingId] = useState(null)
  const [notesById, setNotesById] = useState({})
  const [deletingId, setDeletingId] = useState(null)

  const canEdit = ADMIN_VIEW_ROLES.has(role) || FIELD_ROLES.has(role)

  useEffect(() => { load() }, [fileNumber])

  async function load() {
    setLoading(true)
    try {
      const [reportList, staffList] = await Promise.all([
        listMonitoringReports(fileNumber),
        listStaff(),
      ])
      setReports(reportList)
      const eligible = staffList.filter((s) => REVIEWER_ROLES.has(s.role))
      setReviewers(eligible)
      if (eligible.length && !assignTo) setAssignTo(eligible[0].id)
    } catch {
      setError('Failed to load monitoring reports.')
    } finally {
      setLoading(false)
    }
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!assignTo) { setUploadError('Select a reviewer for this report.'); return }

    setUploading(true)
    setUploadError('')
    try {
      const reviewer = reviewers.find((s) => s.id === assignTo)
      const reportId = await uploadMonitoringReport(fileNumber, file, {
        assignedToUid:   assignTo,
        assignedToName:  reviewer?.name ?? '',
        uploadedByUid:   user.uid,
        uploadedByName:  staff?.name ?? '',
      })
      await createNotification(
        assignTo, 'monitoring_report_review',
        `${staff?.name ?? 'A colleague'} uploaded a monitoring report for ${facilityName ?? fileNumber} (${fileNumber}) and needs your review.`,
        { fileNumber, facilityName: facilityName ?? '', reportId },
      ).catch(() => {})
      await load()
    } catch (err) {
      setUploadError(`Upload failed: ${err.message}`)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDecision(report, decision) {
    setDecidingId(report.id)
    try {
      await decideReport(fileNumber, report.id, {
        decision,
        notes: notesById[report.id] ?? '',
        reviewerUid: user.uid,
        reviewerName: staff?.name ?? '',
      })
      await createNotification(
        report.uploaded_by,
        'monitoring_report_decision',
        decision === 'approved'
          ? `Your monitoring report for ${facilityName ?? fileNumber} (${fileNumber}) was approved and is ready to send.`
          : `Changes were requested on your monitoring report for ${facilityName ?? fileNumber} (${fileNumber}).${notesById[report.id] ? ` Note: ${notesById[report.id]}` : ''}`,
        { fileNumber, facilityName: facilityName ?? '', reportId: report.id },
      ).catch(() => {})
      await load()
    } catch {
      alert('Failed to record decision. Try again.')
    } finally {
      setDecidingId(null)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this monitoring report?\nThis cannot be undone.')) return
    setDeletingId(id)
    try {
      await deleteMonitoringReport(fileNumber, id)
      setReports((p) => p.filter((r) => r.id !== id))
    } catch {
      alert('Failed to delete. Try again.')
    } finally {
      setDeletingId(null)
    }
  }

  function handleSendViaEmail(report) {
    navigate('/email', {
      state: {
        prefillFacility: fileNumber,
        prefillAttachment: { filename: report.file_name, url: report.file_url, reportId: report.id, fileNumber },
      },
    })
  }

  if (loading) return <div className="tab-loading"><Spinner size={24} /></div>
  if (error) return <div className="login-error" style={{ margin: '12px 0' }}><AlertCircle size={14} /> {error}</div>

  return (
    <div>
      {canEdit && (
        <div className="form-card" style={{ marginBottom: 16 }}>
          <div className="form-section">
            <div className="form-section-title">Upload Monitoring Report</div>
            {reviewers.length === 0 ? (
              <div style={{ fontSize: 13, color: '#9ca3af' }}>No eligible reviewers on staff yet — add a Senior Programme Officer, Programme Officer, or Assistant Programme Officer before uploading reports for review.</div>
            ) : (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <select className="select" style={{ minWidth: 220 }} value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
                  {reviewers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleUpload} />
                <button className="btn btn--primary btn--sm" type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  <Upload size={14} /> {uploading ? 'Uploading…' : 'Upload Report'}
                </button>
              </div>
            )}
            {uploadError && (
              <div className="login-error" style={{ marginTop: 8, fontSize: 13 }}>
                <AlertCircle size={13} /> {uploadError}
              </div>
            )}
          </div>
        </div>
      )}

      {reports.length === 0 ? (
        <div className="tab-empty">No monitoring reports uploaded yet.</div>
      ) : (
        <div className="record-list">
          {reports.map((r) => {
            const isReviewer = user?.uid === r.assigned_to
            // Only a fresh, undecided upload can be approved/changes-requested —
            // once changes are requested the uploader must upload a new report
            // rather than the reviewer re-deciding on the same unrevised file.
            const canDecide = isReviewer && r.status === 'pending'
            return (
              <div key={r.id} className="record-item">
                <div className="record-item__header">
                  <span className="record-item__title">
                    <FileText size={13} style={{ marginRight: 6, verticalAlign: -2 }} />
                    {r.file_name}
                  </span>
                  <StatusBadge status={r.status} />
                </div>
                <div className="record-item__meta">
                  <span>Uploaded by: {r.uploaded_by_name || '—'} · {fmtDate(r.created_at)}</span>
                  <span>Reviewer: {r.assigned_to_name || '—'}</span>
                </div>
                {r.review_notes && (
                  <div className="record-item__note">Review note: {r.review_notes}</div>
                )}
                <div className="record-item__actions" style={{ flexWrap: 'wrap' }}>
                  <a className="btn btn--ghost btn--xs" href={r.file_url} target="_blank" rel="noopener noreferrer">
                    <Download size={12} /> View / Download
                  </a>
                  {r.status === 'approved' && (
                    <button className="btn btn--ghost btn--xs" onClick={() => handleSendViaEmail(r)}>
                      <Send size={12} /> Send via Email
                    </button>
                  )}
                  {canEdit && (
                    <button className="btn btn--ghost btn--xs btn--danger" onClick={() => handleDelete(r.id)} disabled={deletingId === r.id}>
                      <Trash2 size={12} /> {deletingId === r.id ? 'Deleting…' : 'Delete'}
                    </button>
                  )}
                </div>
                {canDecide && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #f3f4f6' }}>
                    <textarea
                      className="input textarea"
                      rows={2}
                      placeholder="Optional note (required if requesting changes)…"
                      value={notesById[r.id] ?? ''}
                      onChange={(e) => setNotesById((p) => ({ ...p, [r.id]: e.target.value }))}
                      style={{ marginBottom: 8 }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="btn btn--primary btn--xs"
                        disabled={decidingId === r.id}
                        onClick={() => handleDecision(r, 'approved')}
                      >
                        <CheckCircle size={12} /> Approve
                      </button>
                      <button
                        className="btn btn--ghost btn--xs"
                        style={{ color: '#dc2626', borderColor: '#fecaca' }}
                        disabled={decidingId === r.id || !notesById[r.id]?.trim()}
                        onClick={() => handleDecision(r, 'changes_requested')}
                      >
                        <XCircle size={12} /> Request Changes
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
