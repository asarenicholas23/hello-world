import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Building2, MapPin, Phone, Plus, Search, User, AlertCircle, Clock, Trash2, CheckCircle, ChevronDown } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSync } from '../context/SyncContext'
import { listFacilities } from '../firebase/facilities'
import { SECTORS, DISTRICTS, SECTOR_COLORS } from '../data/constants'
import Spinner from '../components/Spinner'

const SORT_OPTIONS = [
  { value: 'newest',  label: 'Newest first' },
  { value: 'az',      label: 'Name A–Z' },
  { value: 'za',      label: 'Name Z–A' },
  { value: 'sector',  label: 'By sector' },
]

function sortFacilities(list, sort) {
  const copy = [...list]
  if (sort === 'az')     return copy.sort((a, b) => a.name.localeCompare(b.name))
  if (sort === 'za')     return copy.sort((a, b) => b.name.localeCompare(a.name))
  if (sort === 'sector') return copy.sort((a, b) => (a.sector_prefix ?? '').localeCompare(b.sector_prefix ?? ''))
  return copy // newest — already ordered by created_at desc from Firestore
}

export default function Facilities() {
  const { role } = useAuth()
  const { drafts, removeDraft } = useSync()
  const navigate = useNavigate()
  const location = useLocation()

  const [facilities, setFacilities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const draftSaved = location.state?.draftSaved ?? false

  const [search, setSearch]           = useState('')
  const [sectorFilter, setSectorFilter] = useState('')
  const [districtFilter, setDistrictFilter] = useState('')
  const [sort, setSort]               = useState('newest')

  useEffect(() => {
    listFacilities()
      .then(setFacilities)
      .catch(() => setError('Failed to load facilities. Check your connection.'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    const base = facilities.filter((f) => {
      const matchesSearch =
        !q ||
        f.file_number?.toLowerCase().includes(q) ||
        f.name?.toLowerCase().includes(q) ||
        f.contact_person?.toLowerCase().includes(q) ||
        f.location?.toLowerCase().includes(q)
      const matchesSector   = !sectorFilter   || f.sector_prefix === sectorFilter
      const matchesDistrict = !districtFilter || f.district       === districtFilter
      return matchesSearch && matchesSector && matchesDistrict
    })
    return sortFacilities(base, sort)
  }, [facilities, search, sectorFilter, districtFilter, sort])

  const activeFilters = [sectorFilter, districtFilter].filter(Boolean).length

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Facilities</div>
          <div className="page-subtitle">
            {loading ? 'Loading…' : `${filtered.length} of ${facilities.length} registered`}
          </div>
        </div>
        {role === 'admin' && (
          <button className="btn btn--primary" onClick={() => navigate('/facilities/new')}>
            <Plus size={16} /> New Facility
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <div className="search-box">
          <Search size={15} className="search-icon" />
          <input
            className="search-input"
            placeholder="Search by name, file number, location, contact…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <select className="select" value={sectorFilter} onChange={(e) => setSectorFilter(e.target.value)}>
            <option value="">All sectors</option>
            {SECTORS.map((s) => (
              <option key={s.prefix} value={s.prefix}>{s.name} ({s.prefix})</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <select className="select" value={districtFilter} onChange={(e) => setDistrictFilter(e.target.value)}>
            <option value="">All districts</option>
            {DISTRICTS.map((d) => (
              <option key={d.code} value={d.code}>{d.name}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <select className="select" value={sort} onChange={(e) => setSort(e.target.value)}
            style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* Active filter pills */}
      {activeFilters > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {sectorFilter && (
            <span className="filter-pill">
              Sector: {SECTORS.find((s) => s.prefix === sectorFilter)?.name}
              <button onClick={() => setSectorFilter('')}>✕</button>
            </span>
          )}
          {districtFilter && (
            <span className="filter-pill">
              District: {DISTRICTS.find((d) => d.code === districtFilter)?.name}
              <button onClick={() => setDistrictFilter('')}>✕</button>
            </span>
          )}
          <button
            className="btn btn--ghost btn--xs"
            onClick={() => { setSectorFilter(''); setDistrictFilter(''); setSearch('') }}
          >
            Clear all
          </button>
        </div>
      )}

      {/* Draft-saved banner */}
      {draftSaved && (
        <div className="draft-saved-banner">
          <CheckCircle size={15} style={{ flexShrink: 0 }} />
          Facility saved as a draft. It will sync automatically when you&apos;re back online.
        </div>
      )}

      {/* Pending drafts */}
      {drafts.length > 0 && (
        <div>
          <div className="home-section-title" style={{ marginBottom: 10 }}>
            Pending Drafts ({drafts.length}) — awaiting sync
          </div>
          <div className="firms-grid" style={{ marginBottom: 8 }}>
            {drafts.map((draft) => (
              <DraftCard key={draft._id} draft={draft} onDelete={() => removeDraft(draft._id)} />
            ))}
          </div>
        </div>
      )}

      {loading && <Spinner />}

      {error && (
        <div className="login-error">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="empty-state">
          {facilities.length === 0
            ? 'No facilities registered yet. Click "New Facility" to add the first one.'
            : 'No facilities match your search or filters.'}
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="firms-grid">
          {filtered.map((f) => (
            <FacilityCard key={f.file_number} facility={f} onClick={() => navigate(`/facilities/${f.file_number}`)} />
          ))}
        </div>
      )}
    </div>
  )
}

function FacilityCard({ facility: f, onClick }) {
  const colors = SECTOR_COLORS[f.sector_prefix] ?? { bg: '#f3f4f6', text: '#374151' }
  const district = DISTRICTS.find((d) => d.code === f.district)

  return (
    <div className="firm-card" onClick={onClick}>
      <div className="firm-card__header">
        <div>
          <span className="firm-card__name">{f.name}</span>
          <span
            className="firm-card__industry facility-sector-badge"
            style={{ background: colors.bg, color: colors.text }}
          >
            {f.sector}
          </span>
        </div>
        <span className="file-num">{f.file_number}</span>
      </div>

      <div className="firm-card__meta">
        {f.location && (
          <span>
            <MapPin size={12} />
            {f.location}{district ? ` · ${district.name}` : f.district ? ` · ${f.district}` : ''}
          </span>
        )}
        {f.contact_person && (
          <span>
            <User size={12} />
            {f.contact_person}
            {f.designation ? ` — ${f.designation}` : ''}
          </span>
        )}
        {f.phone && (
          <span>
            <Phone size={12} />
            {f.phone}
          </span>
        )}
      </div>

      <div className="firm-card__footer">
        <span className="firm-card__date">
          {f.type_of_undertaking || <span className="text-muted">—</span>}
        </span>
        <span className="badge badge--gray" style={{ fontSize: 11 }}>
          {district?.name ?? f.district ?? '—'}
        </span>
      </div>
    </div>
  )
}

function DraftCard({ draft, onDelete }) {
  const colors = SECTOR_COLORS[draft.sector_prefix] ?? { bg: '#fef9c3', text: '#a16207' }
  const created = new Date(draft._created_at).toLocaleString('en-GH', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="firm-card draft-card">
      <div className="firm-card__header">
        <div>
          <span className="firm-card__name">{draft.name}</span>
          <span
            className="firm-card__industry facility-sector-badge"
            style={{ background: colors.bg, color: colors.text }}
          >
            {draft.sector}
          </span>
        </div>
        <span className="badge badge--yellow" style={{ fontSize: 11 }}>DRAFT</span>
      </div>

      <div className="firm-card__meta">
        {draft.location && <span><MapPin size={12} />{draft.location}</span>}
        <span><Clock size={12} />Saved offline · {created}</span>
      </div>

      <div className="firm-card__footer">
        <span style={{ fontSize: 12, color: '#a16207' }}>File number assigned on sync</span>
        <button
          className="btn btn--ghost btn--sm"
          style={{ color: '#dc2626', borderColor: '#fecaca', padding: '3px 8px' }}
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          title="Discard draft"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}
