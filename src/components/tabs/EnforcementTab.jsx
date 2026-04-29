import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Edit2, Trash2, AlertCircle, Image, FileText } from 'lucide-react'
import { listSubRecords, deleteSubRecord } from '../../firebase/subrecords'
import { fmtDate } from '../../utils/records'
import { ADMIN_VIEW_ROLES, ENFORCEMENT_ACTIONS, FIELD_ROLES } from '../../data/constants'
import Spinner from '../Spinner'
import RecordDocumentModal from '../RecordDocumentModal'

const ACTION_COLORS = {
  warning: { bg: '#fef9c3', color: '#854d0e' },
  notice:  { bg: '#fff7ed', color: '#9a3412' },
  fine:    { bg: '#fef2f2', color: '#991b1b' },
  closure: { bg: '#fee2e2', color: '#7f1d1d' },
  other:   { bg: '#f3f4f6', color: '#374151' },
}

export default function EnforcementTab({ fileNumber, role }) {
  const navigate = useNavigate()
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const [viewRecord, setViewRecord] = useState(null)

  useEffect(() => { load() }, [fileNumber])

  async function load() {
    setLoading(true)
    try { setRecords(await listSubRecords(fileNumber, 'enforcement')) }
    catch { setError('Failed to load enforcement records.') }
    finally { setLoading(false) }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this enforcement record?\nThis cannot be undone.')) return
    setDeletingId(id)
    try {
      await deleteSubRecord(fileNumber, 'enforcement', id)
      setRecords((p) => p.filter((r) => r.id !== id))
    } catch { alert('Failed to delete. Try again.') }
    finally { setDeletingId(null) }
  }

  const canEdit = ADMIN_VIEW_ROLES.has(role) || FIELD_ROLES.has(role)
  const actionLabel = (val) => ENFORCEMENT_ACTIONS.find((a) => a.value === val)?.label ?? val

  if (loading) return <div className="tab-loading"><Spinner size={24} /></div>
  if (error) return <div className="login-error" style={{ margin: '12px 0' }}><AlertCircle size={14} /> {error}</div>

  return (
    <div>
      {viewRecord && (
        <RecordDocumentModal
          type="enforcement"
          record={viewRecord}
          fileNumber={fileNumber}
          onClose={() => setViewRecord(null)}
        />
      )}
      {canEdit && (
        <div className="tab-toolbar">
          <button className="btn btn--primary btn--sm" onClick={() => navigate(`/facilities/${fileNumber}/enforcement/new`)}>
            <Plus size={14} /> Add Action
          </button>
        </div>
      )}

      {records.length === 0 ? (
        <div className="tab-empty">No enforcement actions recorded yet.</div>
      ) : (
        <div className="record-list">
          {records.map((r) => {
            const ac = r.action_taken ? ACTION_COLORS[r.action_taken] ?? ACTION_COLORS.other : null
            return (
              <div key={r.id} className="record-item">
                <div className="record-item__header">
                  <span className="record-item__title">Enforcement — {fmtDate(r.date)}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {ac && <span className="record-badge" style={ac}>{actionLabel(r.action_taken)}</span>}
                    {r.photos?.length > 0 && (
                      <span className="record-badge" style={{ background: '#f0f9ff', color: '#0369a1' }}>
                        <Image size={11} style={{ marginRight: 3 }} />{r.photos.length}
                      </span>
                    )}
                  </div>
                </div>
                <div className="record-item__meta">
                  <span>Officer: {r.officer_name || '—'}</span>
                  {r.contact_person && <span>Contact: {r.contact_person}</span>}
                  {r.follow_up_date && <span>Follow-up: {fmtDate(r.follow_up_date)}</span>}
                </div>
                {r.location && <div className="record-item__note">{r.location}</div>}
                {r.notes && <div className="record-item__note">{r.notes}</div>}
                <div className="record-item__actions">
                  <button className="btn btn--ghost btn--xs" onClick={() => setViewRecord(r)}>
                    <FileText size={12} /> View
                  </button>
                  {canEdit && (
                    <>
                      <button className="btn btn--ghost btn--xs" onClick={() => navigate(`/facilities/${fileNumber}/enforcement/${r.id}/edit`)}>
                        <Edit2 size={12} /> Edit
                      </button>
                      <button className="btn btn--ghost btn--xs btn--danger" onClick={() => handleDelete(r.id)} disabled={deletingId === r.id}>
                        <Trash2 size={12} /> {deletingId === r.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
