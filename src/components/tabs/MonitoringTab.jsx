import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Edit2, Trash2, AlertCircle, Image, FileText } from 'lucide-react'
import { listSubRecords, deleteSubRecord } from '../../firebase/subrecords'
import { fmtDate } from '../../utils/records'
import { MONITORING_CHECKLISTS } from '../../data/monitoringChecklists'
import Spinner from '../Spinner'
import RecordDocumentModal from '../RecordDocumentModal'
import { ADMIN_VIEW_ROLES, FIELD_ROLES } from '../../data/constants'

function complianceSummary(r) {
  const prefix = r.sector_prefix ?? r.mon_id?.split('-')[1]?.replace(/\d+$/, '')
  if (!prefix) return null
  const checklist = MONITORING_CHECKLISTS[prefix]
  if (!checklist) return null

  let yes = 0, total = 0
  for (const section of checklist.sections) {
    for (const item of section.items) {
      if (item.type === 'text' || item.type === 'select') continue
      if (item.conditional) continue  // skip conditional items for summary
      total++
      if (r[item.key] === 'Yes') yes++
    }
  }
  return total > 0 ? { yes, total } : null
}

function ComplianceBadge({ r }) {
  const summary = complianceSummary(r)
  if (!summary) return null
  const pct = summary.yes / summary.total
  let bg, color
  if (pct >= 0.8)      { bg = '#dcfce7'; color = '#166534' }
  else if (pct >= 0.5) { bg = '#fef9c3'; color = '#854d0e' }
  else                  { bg = '#fee2e2'; color = '#991b1b' }
  return (
    <span className="record-badge" style={{ bg, color, background: bg }}>
      {summary.yes}/{summary.total} compliant
    </span>
  )
}

export default function MonitoringTab({ fileNumber, role }) {
  const navigate = useNavigate()
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [deletingSelected, setDeletingSelected] = useState(false)
  const [viewRecord, setViewRecord] = useState(null)

  useEffect(() => { load() }, [fileNumber])

  async function load() {
    setLoading(true)
    try {
      setRecords(await listSubRecords(fileNumber, 'monitoring'))
      setSelectedIds([])
    }
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

  const canEdit = ADMIN_VIEW_ROLES.has(role) || FIELD_ROLES.has(role)
  const selectedIdSet = new Set(selectedIds)
  const visibleRecordIds = records.map((r) => r.id)
  const allVisibleSelected = visibleRecordIds.length > 0 && visibleRecordIds.every((id) => selectedIdSet.has(id))

  function toggleRecordSelection(id) {
    setSelectedIds((prev) => (
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    ))
  }

  function toggleSelectAllVisible() {
    setSelectedIds((prev) => {
      if (allVisibleSelected) return prev.filter((id) => !visibleRecordIds.includes(id))
      return [...new Set([...prev, ...visibleRecordIds])]
    })
  }

  async function handleDeleteSelected() {
    if (selectedIds.length === 0 || deletingSelected) return
    const label = selectedIds.length === 1 ? 'monitoring record' : 'monitoring records'
    if (!window.confirm(`Delete ${selectedIds.length} selected ${label}?\nThis cannot be undone.`)) return

    setDeletingSelected(true)
    const idsToDelete = records.filter((r) => selectedIdSet.has(r.id)).map((r) => r.id)
    const results = await Promise.allSettled(idsToDelete.map((id) => deleteSubRecord(fileNumber, 'monitoring', id)))
    const deletedIds = idsToDelete.filter((_, index) => results[index].status === 'fulfilled')
    const failedCount = idsToDelete.length - deletedIds.length

    if (deletedIds.length > 0) {
      setRecords((prev) => prev.filter((r) => !deletedIds.includes(r.id)))
      setSelectedIds((prev) => prev.filter((id) => !deletedIds.includes(id)))
    }
    if (failedCount > 0) alert(`Deleted ${deletedIds.length}, but ${failedCount} failed. Try again.`)
    setDeletingSelected(false)
  }

  if (loading) return <div className="tab-loading"><Spinner size={24} /></div>
  if (error) return <div className="login-error" style={{ margin: '12px 0' }}><AlertCircle size={14} /> {error}</div>

  return (
    <div>
      {viewRecord && (
        <RecordDocumentModal
          type="monitoring"
          record={viewRecord}
          fileNumber={fileNumber}
          onClose={() => setViewRecord(null)}
        />
      )}
      {canEdit && (
        <div className="tab-toolbar">
          <button className="btn btn--primary btn--sm"
            onClick={() => navigate(`/facilities/${fileNumber}/monitoring/new`)}>
            <Plus size={14} /> Add Visit
          </button>
        </div>
      )}

      {records.length === 0 ? (
        <div className="tab-empty">No monitoring visits recorded yet.</div>
      ) : (
        <>
          {canEdit && (
            <div className="bulk-actions-bar" style={{ marginBottom: 12 }}>
              <label className="bulk-actions-bar__checkbox">
                <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAllVisible} />
                Select all
              </label>
              <span className="bulk-actions-bar__count">{selectedIds.length} selected</span>
              <button className="btn btn--ghost btn--xs" onClick={() => setSelectedIds([])} disabled={selectedIds.length === 0 || deletingSelected}>
                Clear
              </button>
              <button className="btn btn--ghost btn--xs btn--danger" onClick={handleDeleteSelected} disabled={selectedIds.length === 0 || deletingSelected}>
                <Trash2 size={12} /> {deletingSelected ? 'Deleting…' : 'Delete Selected'}
              </button>
            </div>
          )}
          <div className="record-list">
            {records.map((r) => (
              <div key={r.id} className={`record-item${selectedIdSet.has(r.id) ? ' cross-record-item--selected' : ''}`}>
              <div className="record-item__header">
                <span className="record-item__title">
                  {canEdit && (
                    <label className="bulk-card-checkbox" onClick={(e) => e.stopPropagation()} style={{ marginRight: 8 }}>
                      <input type="checkbox" checked={selectedIdSet.has(r.id)} onChange={() => toggleRecordSelection(r.id)} />
                    </label>
                  )}
                  {r.mon_id && (
                    <span className="file-num" style={{ fontSize: 11, marginRight: 6 }}>{r.mon_id}</span>
                  )}
                  Monitoring Visit — {fmtDate(r.date)}
                </span>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <ComplianceBadge r={r} />
                  {r.photos?.length > 0 && (
                    <span className="record-badge" style={{ background: '#f0f9ff', color: '#0369a1' }}>
                      <Image size={10} /> {r.photos.length} photo{r.photos.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
              <div className="record-item__meta">
                <span>Officer: {r.officer_name || '—'}</span>
                {r.location && <span>{r.location}</span>}
              </div>
              {r.notes && <div className="record-item__note">{r.notes}</div>}
              <div className="record-item__actions">
                <button className="btn btn--ghost btn--xs" onClick={() => setViewRecord(r)}>
                  <FileText size={12} /> View
                </button>
                {canEdit && (
                  <>
                    <button className="btn btn--ghost btn--xs"
                      onClick={() => navigate(`/facilities/${fileNumber}/monitoring/${r.id}/edit`)}>
                      <Edit2 size={12} /> Edit
                    </button>
                    <button className="btn btn--ghost btn--xs btn--danger"
                      onClick={() => handleDelete(r.id)} disabled={deletingId === r.id}>
                      <Trash2 size={12} /> {deletingId === r.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </>
                )}
              </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
