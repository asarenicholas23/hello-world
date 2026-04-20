import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Plus, Search, Edit2, Trash2, AlertCircle, ChevronDown, ChevronUp, Users } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { listEnvEducation, deleteEnvEducation } from '../firebase/envEducation'
import { ADMIN_ROLES, FIELD_ROLES } from '../data/constants'
import { fmtDate } from '../utils/records'
import Spinner from '../components/Spinner'

export const ENV_ED_TYPES = [
  { value: 'workshop',          label: 'Workshop',           bg: '#eff6ff', color: '#1d4ed8' },
  { value: 'seminar',           label: 'Seminar',            bg: '#f5f3ff', color: '#7c3aed' },
  { value: 'community_outreach',label: 'Community Outreach', bg: '#dcfce7', color: '#166534' },
  { value: 'school_visit',      label: 'School Visit',       bg: '#f0fdfa', color: '#0891b2' },
  { value: 'radio_tv',          label: 'Radio / TV',         bg: '#fff7ed', color: '#c2410c' },
  { value: 'other',             label: 'Other',              bg: '#f3f4f6', color: '#374151' },
]

function typeStyle(value) {
  const t = ENV_ED_TYPES.find((t) => t.value === value)
  return t ? { background: t.bg, color: t.color } : { background: '#f3f4f6', color: '#374151' }
}
function typeLabel(value) {
  return ENV_ED_TYPES.find((t) => t.value === value)?.label ?? value
}

export default function EnvironmentalEducationPage() {
  const { user, role } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const canWrite = ADMIN_ROLES.has(role) || FIELD_ROLES.has(role)
  const isAdmin  = ADMIN_ROLES.has(role)

  const [records, setRecords]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [search, setSearch]         = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [officerFilter, setOfficerFilter] = useState(location.state?.officerUid ?? '')
  const [expanded, setExpanded]     = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    setOfficerFilter(location.state?.officerUid ?? '')
    setTypeFilter(location.state?.typeFilter ?? '')
  }, [location.key])

  useEffect(() => {
    listEnvEducation()
      .then(setRecords)
      .catch(() => setError('Failed to load environmental education records.'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    let result = records
    if (officerFilter) result = result.filter((r) => r.created_by === officerFilter)
    if (typeFilter)    result = result.filter((r) => r.type === typeFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((r) =>
        r.title?.toLowerCase().includes(q) ||
        r.location?.toLowerCase().includes(q) ||
        r.facilitator?.toLowerCase().includes(q) ||
        r.target_group?.toLowerCase().includes(q)
      )
    }
    return result
  }, [records, officerFilter, typeFilter, search])

  async function handleDelete(id, label) {
    if (!window.confirm(`Delete "${label}"?\nThis cannot be undone.`)) return
    setDeletingId(id)
    try {
      await deleteEnvEducation(id)
      setRecords((p) => p.filter((r) => r.id !== id))
    } catch { alert('Failed to delete. Try again.') }
    finally { setDeletingId(null) }
  }

  const canEdit = (r) => isAdmin || r.created_by === user?.uid

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Environmental Education</div>
          <div className="page-subtitle">
            {loading ? 'Loading…' : `${filtered.length} of ${records.length} sessions`}
          </div>
        </div>
        {canWrite && (
          <button className="btn btn--primary" onClick={() => navigate('/env-education/new')}>
            <Plus size={14} /> Log Session
          </button>
        )}
      </div>

      <div className="filter-bar">
        <div className="search-box" style={{ flex: 1 }}>
          <Search size={15} className="search-icon" />
          <input
            className="search-input"
            placeholder="Search by title, location, facilitator…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <select className="select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All types</option>
            {ENV_ED_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      {(officerFilter || typeFilter) && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {officerFilter && (
            <span className="filter-pill">
              Showing: your sessions only
              <button onClick={() => setOfficerFilter('')}>✕</button>
            </span>
          )}
          {typeFilter && (
            <span className="filter-pill">
              Type: {typeLabel(typeFilter)}
              <button onClick={() => setTypeFilter('')}>✕</button>
            </span>
          )}
          <button className="btn btn--ghost btn--xs" onClick={() => { setOfficerFilter(''); setTypeFilter(''); setSearch('') }}>
            Clear all
          </button>
        </div>
      )}

      {loading && <Spinner />}
      {error && <div className="login-error"><AlertCircle size={14} /> {error}</div>}

      {!loading && !error && filtered.length === 0 && (
        <div className="empty-state">
          {records.length === 0 ? 'No education sessions logged yet.' : 'No sessions match your search.'}
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
                  <span className="cross-record__facility-name">{r.title}</span>
                  <span className="record-badge" style={typeStyle(r.type)}>{typeLabel(r.type)}</span>
                  {r.participants_count > 0 && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, color: '#6b7280', marginLeft: 'auto' }}>
                      <Users size={12} /> {r.participants_count}
                    </span>
                  )}
                  {r.participants_count <= 0 && (
                    <span style={{ marginLeft: 'auto' }}>{isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
                  )}
                </div>

                <div className="cross-record__body" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                  {r.location && <span className="cross-record__primary">{r.location}</span>}
                  <span className="cross-record__meta">
                    {r.facilitator && `Facilitator: ${r.facilitator}`}
                    {r.facilitator && r.target_group && ' · '}
                    {r.target_group && `Target: ${r.target_group}`}
                  </span>
                </div>

                {isOpen && (
                  <div style={{ padding: '10px 0 4px', borderTop: '1px solid #f3f4f6', marginTop: 8 }}>
                    {r.notes && (
                      <div style={{ marginBottom: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notes</span>
                        <div style={{ fontSize: 13, color: '#374151', marginTop: 2 }}>{r.notes}</div>
                      </div>
                    )}
                    {canEdit(r) && (
                      <div className="record-item__actions" style={{ marginTop: 8 }}>
                        <button className="btn btn--ghost btn--xs" onClick={() => navigate(`/env-education/${r.id}/edit`)}>
                          <Edit2 size={12} /> Edit
                        </button>
                        {isAdmin && (
                          <button
                            className="btn btn--ghost btn--xs btn--danger"
                            onClick={() => handleDelete(r.id, r.title)}
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
