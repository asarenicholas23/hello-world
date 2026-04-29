import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Edit2, Trash2, AlertCircle, Paperclip, PackageCheck } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { listSubRecords, deleteSubRecord, updateSubRecord } from '../../firebase/subrecords'
import { fmtDate, permitStatus } from '../../utils/records'
import { normalizeAttachmentUrl } from '../../utils/attachments'
import { ADMIN_ROLES, FIELD_ROLES, ADMIN_VIEW_ROLES } from '../../data/constants'
import Spinner from '../Spinner'

const STATUS_LABELS = { active: 'Active', expiring: 'Expiring Soon', expired: 'Expired' }
const STATUS_COLORS = {
  active:   { bg: '#dcfce7', color: '#166534' },
  expiring: { bg: '#fef9c3', color: '#854d0e' },
  expired:  { bg: '#fee2e2', color: '#991b1b' },
}

export default function PermitsTab({ fileNumber, facilityOfficer }) {
  const { role, user } = useAuth()
  const navigate = useNavigate()

  const [records, setRecords]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const [togglingId, setTogglingId] = useState(null)

  const canAdd  = ADMIN_ROLES.has(role) || (FIELD_ROLES.has(role) && user?.uid === facilityOfficer)
  const canEdit = ADMIN_VIEW_ROLES.has(role)
  const canDelete = ADMIN_ROLES.has(role)

  useEffect(() => { load() }, [fileNumber])

  async function load() {
    setLoading(true)
    try { setRecords(await listSubRecords(fileNumber, 'permits')) }
    catch { setError('Failed to load permits.') }
    finally { setLoading(false) }
  }

  async function toggleReady(r) {
    setTogglingId(r.id)
    try {
      const next = !r.ready_to_collect
      await updateSubRecord(fileNumber, 'permits', r.id, { ready_to_collect: next }, user?.uid)
      setRecords((prev) => prev.map((p) => p.id === r.id ? { ...p, ready_to_collect: next } : p))
    } catch { alert('Failed to update. Try again.') }
    finally { setTogglingId(null) }
  }

  async function handleDelete(id, label) {
    if (!window.confirm(`Delete permit "${label}"?\nThis cannot be undone.`)) return
    setDeletingId(id)
    try {
      await deleteSubRecord(fileNumber, 'permits', id)
      setRecords((p) => p.filter((r) => r.id !== id))
    } catch { alert('Failed to delete. Try again.') }
    finally { setDeletingId(null) }
  }

  if (loading) return <div className="tab-loading"><Spinner size={24} /></div>
  if (error)   return <div className="login-error" style={{ margin: '12px 0' }}><AlertCircle size={14} /> {error}</div>

  return (
    <div>
      {canAdd && (
        <div className="tab-toolbar">
          <button className="btn btn--primary btn--sm" onClick={() => navigate(`/facilities/${fileNumber}/permits/new`)}>
            <Plus size={14} /> Add Permit
          </button>
        </div>
      )}

      {records.length === 0 ? (
        <div className="tab-empty">No permits recorded yet.</div>
      ) : (
        <div className="record-list">
          {records.map((r) => {
            const status = permitStatus(r.expiry_date)
            const sc     = status ? STATUS_COLORS[status] : null
            return (
              <div key={r.id} className="record-item">
                <div className="record-item__header">
                  <span className="record-item__title">{r.permit_number}</span>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {status && <span className="record-badge" style={sc}>{STATUS_LABELS[status]}</span>}
                    {r.ready_to_collect && (
                      <span className="record-badge" style={{ background: '#dbeafe', color: '#1e40af' }}>
                        <PackageCheck size={10} /> Ready to Collect
                      </span>
                    )}
                  </div>
                </div>
                <div className="record-item__meta">
                  <span>Issued: {fmtDate(r.issue_date)}</span>
                  <span>Effective: {fmtDate(r.effective_date)}</span>
                  <span>Expires: {fmtDate(r.expiry_date)}</span>
                </div>
                {r.issue_location && <div className="record-item__note">{r.issue_location}</div>}
                {r.notes          && <div className="record-item__note">{r.notes}</div>}
                {(r.permit_image_url || r.schedule_url) && (
                  <div className="record-item__attachments">
                    {r.permit_image_url && (
                      <a href={normalizeAttachmentUrl(r.permit_image_url)} target="_blank" rel="noopener noreferrer" className="attachment-link">
                        <Paperclip size={11} /> Permit Image
                      </a>
                    )}
                    {r.schedule_url && (
                      <a href={normalizeAttachmentUrl(r.schedule_url)} target="_blank" rel="noopener noreferrer" className="attachment-link">
                        <Paperclip size={11} /> Schedule
                      </a>
                    )}
                  </div>
                )}
                {canEdit && (
                  <div className="record-item__actions">
                    <button
                      className={`btn btn--ghost btn--xs${r.ready_to_collect ? ' btn--active' : ''}`}
                      onClick={() => toggleReady(r)}
                      disabled={togglingId === r.id}
                      title={r.ready_to_collect ? 'Mark as NOT ready to collect' : 'Mark as ready to collect'}
                    >
                      <PackageCheck size={12} />
                      {togglingId === r.id ? '…' : r.ready_to_collect ? 'Ready ✓' : 'Mark Ready'}
                    </button>
                    <button className="btn btn--ghost btn--xs" onClick={() => navigate(`/facilities/${fileNumber}/permits/${r.id}/edit`)}>
                      <Edit2 size={12} /> Edit
                    </button>
                    {canDelete && (
                      <button className="btn btn--ghost btn--xs btn--danger"
                        onClick={() => handleDelete(r.id, r.permit_number)}
                        disabled={deletingId === r.id}>
                        <Trash2 size={12} /> {deletingId === r.id ? 'Deleting…' : 'Delete'}
                      </button>
                    )}
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
