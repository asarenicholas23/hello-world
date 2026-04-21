import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Edit2, Trash2, AlertCircle, Image } from 'lucide-react'
import { listSubRecords, deleteSubRecord } from '../../firebase/subrecords'
import { fmtDate } from '../../utils/records'
import { COMPLIANCE_STATUS } from '../../data/constants'
import Spinner from '../Spinner'
import { FIELD_ROLES } from '../../data/constants'

const COMPLIANCE_COLORS = {
  compliant:     { bg: '#dcfce7', color: '#166534' },
  partial:       { bg: '#fef9c3', color: '#854d0e' },
  non_compliant: { bg: '#fee2e2', color: '#991b1b' },
}

export default function MonitoringTab({ fileNumber, role }) {
  const navigate = useNavigate()
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => { load() }, [fileNumber])

  async function load() {
    setLoading(true)
    try { setRecords(await listSubRecords(fileNumber, 'monitoring')) }
    catch { setError('Failed to load monitoring visits.') }
    finally { setLoading(false) }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this monitoring record?\nThis cannot be undone.')) return
    setDeletingId(id)
    try {
      await deleteSubRecord(fileNumber, 'monitoring', id)
      setRecords((p) => p.filter((r) => r.id !== id))
    } catch { alert('Failed to delete. Try again.') }
    finally { setDeletingId(null) }
  }

  const canEdit = role === 'admin' || FIELD_ROLES.has(role)
  const statusLabel = (val) => COMPLIANCE_STATUS.find((s) => s.value === val)?.label ?? val

  if (loading) return <div className="tab-loading"><Spinner size={24} /></div>
  if (error) return <div className="login-error" style={{ margin: '12px 0' }}><AlertCircle size={14} /> {error}</div>

  return (
    <div>
      {canEdit && (
        <div className="tab-toolbar">
          <button className="btn btn--primary btn--sm" onClick={() => navigate(`/facilities/${fileNumber}/monitoring/new`)}>
            <Plus size={14} /> Add Visit
          </button>
        </div>
      )}

      {records.length === 0 ? (
        <div className="tab-empty">No monitoring visits recorded yet.</div>
      ) : (
        <div className="record-list">
          {records.map((r) => {
            const cc = r.compliance_status ? COMPLIANCE_COLORS[r.compliance_status] : null
            return (
              <div key={r.id} className="record-item">
                <div className="record-item__header">
                  <span className="record-item__title">Monitoring Visit — {fmtDate(r.date)}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {cc && (
                      <span className="record-badge" style={cc}>{statusLabel(r.compliance_status)}</span>
                    )}
                    {r.photos?.length > 0 && (
                      <span className="record-badge" style={{ background: '#f0f9ff', color: '#0369a1' }}>
                        <Image size={11} style={{ marginRight: 3 }} />{r.photos.length}
                      </span>
                    )}
                  </div>
                </div>
                <div className="record-item__meta">
                  <span>Officer: {r.officer_name || '—'}</span>
                  {r.checklist && (
                    <span>
                      {Object.values(r.checklist).filter((v) => v.ok).length}/
                      {Object.values(r.checklist).length} items OK
                    </span>
                  )}
                </div>
                {r.notes && <div className="record-item__note">{r.notes}</div>}
                {canEdit && (
                  <div className="record-item__actions">
                    <button className="btn btn--ghost btn--xs" onClick={() => navigate(`/facilities/${fileNumber}/monitoring/${r.id}/edit`)}>
                      <Edit2 size={12} /> Edit
                    </button>
                    <button className="btn btn--ghost btn--xs btn--danger" onClick={() => handleDelete(r.id)} disabled={deletingId === r.id}>
                      <Trash2 size={12} /> {deletingId === r.id ? 'Deleting…' : 'Delete'}
                    </button>
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
