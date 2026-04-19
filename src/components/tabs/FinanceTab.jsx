import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Edit2, Trash2, AlertCircle } from 'lucide-react'
import { listSubRecords, deleteSubRecord } from '../../firebase/subrecords'
import { fmtDate } from '../../utils/records'
import Spinner from '../Spinner'

export default function FinanceTab({ fileNumber, role }) {
  const navigate = useNavigate()
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => { load() }, [fileNumber])

  async function load() {
    setLoading(true)
    try { setRecords(await listSubRecords(fileNumber, 'finance')) }
    catch { setError('Failed to load finance records.') }
    finally { setLoading(false) }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this finance record?\nThis cannot be undone.')) return
    setDeletingId(id)
    try {
      await deleteSubRecord(fileNumber, 'finance', id)
      setRecords((p) => p.filter((r) => r.id !== id))
    } catch { alert('Failed to delete. Try again.') }
    finally { setDeletingId(null) }
  }

  const canEdit = role === 'admin' || role === 'finance'

  if (loading) return <div className="tab-loading"><Spinner size={24} /></div>
  if (error) return <div className="login-error" style={{ margin: '12px 0' }}><AlertCircle size={14} /> {error}</div>

  return (
    <div>
      {canEdit && (
        <div className="tab-toolbar">
          <button className="btn btn--primary btn--sm" onClick={() => navigate(`/facilities/${fileNumber}/finance/new`)}>
            <Plus size={14} /> Add Record
          </button>
        </div>
      )}

      {records.length === 0 ? (
        <div className="tab-empty">No finance records yet.</div>
      ) : (
        <div className="record-list">
          {records.map((r) => (
            <div key={r.id} className="record-item">
              <div className="record-item__header">
                <span className="record-item__title">
                  {r.currency} {Number(r.amount ?? 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}
                </span>
                <span className="record-badge" style={{ background: '#f0fdf4', color: '#166534' }}>{r.payment_type}</span>
              </div>
              <div className="record-item__meta">
                <span>Date: {fmtDate(r.date)}</span>
                {r.reference_number && <span>Ref: {r.reference_number}</span>}
              </div>
              {r.notes && <div className="record-item__note">{r.notes}</div>}
              {canEdit && (
                <div className="record-item__actions">
                  <button className="btn btn--ghost btn--xs" onClick={() => navigate(`/facilities/${fileNumber}/finance/${r.id}/edit`)}>
                    <Edit2 size={12} /> Edit
                  </button>
                  <button className="btn btn--ghost btn--xs btn--danger" onClick={() => handleDelete(r.id)} disabled={deletingId === r.id}>
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
