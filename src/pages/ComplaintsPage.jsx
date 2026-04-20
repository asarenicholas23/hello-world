import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Plus, Search, Edit2, Trash2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { listComplaints, deleteComplaint } from '../firebase/complaints'
import { ADMIN_ROLES, FIELD_ROLES, DISTRICTS } from '../data/constants'
import { fmtDate } from '../utils/records'
import Spinner from '../components/Spinner'

export const COMPLAINT_STATUSES = [
  { value: 'open',        label: 'Open',        bg: '#fee2e2', color: '#991b1b' },
  { value: 'in_progress', label: 'In Progress',  bg: '#fef9c3', color: '#854d0e' },
  { value: 'resolved',    label: 'Resolved',     bg: '#dcfce7', color: '#166534' },
]

function statusStyle(value) {
  const s = COMPLAINT_STATUSES.find((s) => s.value === value)
  return s ? { background: s.bg, color: s.color } : { background: '#f3f4f6', color: '#374151' }
}
function statusLabel(value) {
  return COMPLAINT_STATUSES.find((s) => s.value === value)?.label ?? value
}
function districtName(code) { return DISTRICTS.find((d) => d.code === code)?.name ?? code ?? '—' }

export default function ComplaintsPage() {
  const { user, role } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const canWrite  = ADMIN_ROLES.has(role) || FIELD_ROLES.has(role)
  const isAdmin   = ADMIN_ROLES.has(role)

  const [records, setRecords]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [officerFilter, setOfficerFilter] = useState(location.state?.officerUid ?? '')
  const [expanded, setExpanded]   = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    setOfficerFilter(location.state?.officerUid ?? '')
    setStatusFilter(location.state?.statusFilter ?? '')
  }, [location.key])

  useEffect(() => {
    listComplaints()
      .then(setRecords)
      .catch(() => setError('Failed to load complaints.'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    let result = records
    if (officerFilter) result = result.filter((r) => r.created_by === officerFilter)
    if (statusFilter)  result = result.filter((r) => r.status === statusFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((r) =>
        r.nature?.toLowerCase().includes(q) ||
        r.complainant_name?.toLowerCase().includes(q) ||
        r.facility_name?.toLowerCase().includes(q) ||
        r.file_number?.toLowerCase().includes(q)
      )
    }
    return result
  }, [records, officerFilter, statusFilter, search])

  async function handleDelete(id, label) {
    if (!window.confirm(`Delete complaint "${label}"?\nThis cannot be undone.`)) return
    setDeletingId(id)
    try {
      await deleteComplaint(id)
      setRecords((p) => p.filter((r) => r.id !== id))
    } catch { alert('Failed to delete. Try again.') }
    finally { setDeletingId(null) }
  }

  const canEdit = (r) => isAdmin || r.created_by === user?.uid

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Complaints</div>
          <div className="page-subtitle">
            {loading ? 'Loading…' : `${filtered.length} of ${records.length} complaints`}
          </div>
        </div>
        {canWrite && (
          <button className="btn btn--primary" onClick={() => navigate('/complaints/new')}>
            <Plus size={14} /> Log Complaint
          </button>
        )}
      </div>

      <div className="filter-bar">
        <div className="search-box" style={{ flex: 1 }}>
          <Search size={15} className="search-icon" />
          <input
            className="search-input"
            placeholder="Search by nature, complainant, facility…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {COMPLAINT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {(officerFilter || statusFilter) && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {officerFilter && (
            <span className="filter-pill">
              Showing: your complaints only
              <button onClick={() => setOfficerFilter('')}>✕</button>
            </span>
          )}
          {statusFilter && (
            <span className="filter-pill">
              Status: {statusLabel(statusFilter)}
              <button onClick={() => setStatusFilter('')}>✕</button>
            </span>
          )}
          <button className="btn btn--ghost btn--xs" onClick={() => { setOfficerFilter(''); setStatusFilter(''); setSearch('') }}>
            Clear all
          </button>
        </div>
      )}

      {loading && <Spinner />}
      {error && <div className="login-error"><AlertCircle size={14} /> {error}</div>}

      {!loading && !error && filtered.length === 0 && (
        <div className="empty-state">
          {records.length === 0 ? 'No complaints logged yet.' : 'No complaints match your search.'}
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="cross-record-list">
          {filtered.map((r) => {
            const isOpen = expanded === r.id
            return (
              <div key={r.id} className="cross-record-item" style={{ cursor: 'default' }}>
                <div
                  className="cross-record__facility"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setExpanded(isOpen ? null : r.id)}
                >
                  <span style={{ fontSize: 12, color: '#6b7280' }}>{fmtDate(r.date)}</span>
                  {r.file_number && <span className="file-num" style={{ fontSize: 12 }}>{r.file_number}</span>}
                  {r.facility_name && <span className="cross-record__facility-name">{r.facility_name}</span>}
                  <span className="record-badge" style={statusStyle(r.status)}>{statusLabel(r.status)}</span>
                  <span style={{ marginLeft: 'auto' }}>{isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
                </div>

                <div className="cross-record__body" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                  <span className="cross-record__primary">{r.nature}</span>
                  {r.complainant_name && (
                    <span className="cross-record__meta">Complainant: {r.complainant_name}{r.complainant_contact ? ` · ${r.complainant_contact}` : ''}</span>
                  )}
                </div>

                {isOpen && (
                  <div style={{ padding: '10px 0 4px', borderTop: '1px solid #f3f4f6', marginTop: 8 }}>
                    {r.action_taken && (
                      <div style={{ marginBottom: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Action Taken</span>
                        <div style={{ fontSize: 13, color: '#374151', marginTop: 2 }}>{r.action_taken}</div>
                      </div>
                    )}
                    {r.notes && (
                      <div style={{ marginBottom: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notes</span>
                        <div style={{ fontSize: 13, color: '#374151', marginTop: 2 }}>{r.notes}</div>
                      </div>
                    )}
                    {canEdit(r) && (
                      <div className="record-item__actions" style={{ marginTop: 8 }}>
                        <button className="btn btn--ghost btn--xs" onClick={() => navigate(`/complaints/${r.id}/edit`)}>
                          <Edit2 size={12} /> Edit
                        </button>
                        {isAdmin && (
                          <button
                            className="btn btn--ghost btn--xs btn--danger"
                            onClick={() => handleDelete(r.id, r.nature?.slice(0, 40))}
                            disabled={deletingId === r.id}
                          >
                            <Trash2 size={12} /> {deletingId === r.id ? 'Deleting…' : 'Delete'}
                          </button>
                        )}
                      </div>
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
