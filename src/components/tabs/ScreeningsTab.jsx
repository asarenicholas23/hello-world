import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Edit2, Trash2, AlertCircle, Image, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import { listSubRecords, deleteSubRecord } from '../../firebase/subrecords'
import { fmtDate } from '../../utils/records'
import Spinner from '../Spinner'
import { FIELD_ROLES } from '../../data/constants'

function DecisionBadge({ record }) {
  if (record.permit_declined === 'Yes') {
    return <span className="record-badge" style={{ background: '#fee2e2', color: '#991b1b' }}><XCircle size={10} /> Declined</span>
  }
  if (record.permit_recommended === 'Yes') {
    return <span className="record-badge" style={{ background: '#dcfce7', color: '#166534' }}><CheckCircle size={10} /> Recommended</span>
  }
  if (record.eia_recommended === 'Yes') {
    return <span className="record-badge" style={{ background: '#fef9c3', color: '#854d0e' }}><AlertTriangle size={10} /> EIA</span>
  }
  if (record.per_recommended === 'Yes') {
    return <span className="record-badge" style={{ background: '#fff7ed', color: '#c2410c' }}><AlertTriangle size={10} /> PER</span>
  }
  return null
}

export default function ScreeningsTab({ fileNumber, role }) {
  const navigate = useNavigate()
  const [records, setRecords]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => { load() }, [fileNumber])

  async function load() {
    setLoading(true)
    try { setRecords(await listSubRecords(fileNumber, 'screenings')) }
    catch { setError('Failed to load screenings.') }
    finally { setLoading(false) }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this screening record?\nThis cannot be undone.')) return
    setDeletingId(id)
    try {
      await deleteSubRecord(fileNumber, 'screenings', id)
      setRecords((p) => p.filter((r) => r.id !== id))
    } catch { alert('Failed to delete. Try again.') }
    finally { setDeletingId(null) }
  }

  const canEdit = role === 'admin' || FIELD_ROLES.has(role)

  if (loading) return <div className="tab-loading"><Spinner size={24} /></div>
  if (error)   return <div className="login-error" style={{ margin: '12px 0' }}><AlertCircle size={14} /> {error}</div>

  return (
    <div>
      {canEdit && (
        <div className="tab-toolbar">
          <button className="btn btn--primary btn--sm"
            onClick={() => navigate(`/facilities/${fileNumber}/screenings/new`)}>
            <Plus size={14} /> Add Screening
          </button>
        </div>
      )}

      {records.length === 0 ? (
        <div className="tab-empty">No screenings recorded yet.</div>
      ) : (
        <div className="record-list">
          {records.map((r) => (
            <div key={r.id} className="record-item">
              <div className="record-item__header">
                <span className="record-item__title">
                  {r.screening_id && <span className="file-num" style={{ fontSize: 11, marginRight: 6 }}>{r.screening_id}</span>}
                  Screening — {fmtDate(r.inspection_date ?? r.date)}
                </span>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <DecisionBadge record={r} />
                  {r.photos?.length > 0 && (
                    <span className="record-badge" style={{ background: '#f0f9ff', color: '#0369a1' }}>
                      <Image size={10} /> {r.photos.length} photo{r.photos.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
              <div className="record-item__meta">
                {r.company_name && <span>{r.company_name}</span>}
                {r.proponent_name && <span>{r.proponent_name}</span>}
                <span>Officer: {r.officer_name || '—'}</span>
              </div>
              {r.type_of_undertaking && (
                <div className="record-item__note">{r.type_of_undertaking}</div>
              )}
              {canEdit && (
                <div className="record-item__actions">
                  <button className="btn btn--ghost btn--xs"
                    onClick={() => navigate(`/facilities/${fileNumber}/screenings/${r.id}/edit`)}>
                    <Edit2 size={12} /> Edit
                  </button>
                  <button className="btn btn--ghost btn--xs btn--danger"
                    onClick={() => handleDelete(r.id)} disabled={deletingId === r.id}>
                    <Trash2 size={12} /> {deletingId === r.id ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
