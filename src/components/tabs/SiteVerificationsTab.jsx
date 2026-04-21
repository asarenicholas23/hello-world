import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Edit2, Trash2, AlertCircle, Image } from 'lucide-react'
import { listSubRecords, deleteSubRecord } from '../../firebase/subrecords'
import { fmtDate } from '../../utils/records'
import Spinner from '../Spinner'
import { FIELD_ROLES } from '../../data/constants'

export default function SiteVerificationsTab({ fileNumber, role }) {
  const navigate = useNavigate()
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => { load() }, [fileNumber])

  async function load() {
    setLoading(true)
    try { setRecords(await listSubRecords(fileNumber, 'site_verifications')) }
    catch { setError('Failed to load site verifications.') }
    finally { setLoading(false) }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this site verification?\nThis cannot be undone.')) return
    setDeletingId(id)
    try {
      await deleteSubRecord(fileNumber, 'site_verifications', id)
      setRecords((p) => p.filter((r) => r.id !== id))
    } catch { alert('Failed to delete. Try again.') }
    finally { setDeletingId(null) }
  }

  const canEdit = role === 'admin' || FIELD_ROLES.has(role)

  if (loading) return <div className="tab-loading"><Spinner size={24} /></div>
  if (error) return <div className="login-error" style={{ margin: '12px 0' }}><AlertCircle size={14} /> {error}</div>

  return (
    <div>
      {canEdit && (
        <div className="tab-toolbar">
          <button className="btn btn--primary btn--sm" onClick={() => navigate(`/facilities/${fileNumber}/site-verifications/new`)}>
            <Plus size={14} /> Add Verification
          </button>
        </div>
      )}

      {records.length === 0 ? (
        <div className="tab-empty">No site verifications recorded yet.</div>
      ) : (
        <div className="record-list">
          {records.map((r) => (
            <div key={r.id} className="record-item">
              <div className="record-item__header">
                <span className="record-item__title">Site Verification — {fmtDate(r.date)}</span>
                {r.photos?.length > 0 && (
                  <span className="record-badge" style={{ background: '#f0f9ff', color: '#0369a1' }}>
                    <Image size={11} style={{ marginRight: 3 }} />{r.photos.length} photo{r.photos.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div className="record-item__meta">
                <span>Officer: {r.officer_name || '—'}</span>
                {r.linked_permit_id && <span>Linked to permit</span>}
                {r.coordinates && <span>GPS captured</span>}
              </div>
              {r.notes && <div className="record-item__note">{r.notes}</div>}
              {canEdit && (
                <div className="record-item__actions">
                  <button className="btn btn--ghost btn--xs" onClick={() => navigate(`/facilities/${fileNumber}/site-verifications/${r.id}/edit`)}>
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
