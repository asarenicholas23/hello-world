import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, MapPin, Phone, Plus, Search, User, AlertCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { listFacilities } from '../firebase/facilities'
import { SECTORS, SECTOR_COLORS } from '../data/constants'
import Spinner from '../components/Spinner'

export default function Facilities() {
  const { role } = useAuth()
  const navigate = useNavigate()

  const [facilities, setFacilities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [sectorFilter, setSectorFilter] = useState('')

  useEffect(() => {
    listFacilities()
      .then(setFacilities)
      .catch(() => setError('Failed to load facilities. Check your connection.'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return facilities.filter((f) => {
      const matchesSearch =
        !q ||
        f.file_number?.toLowerCase().includes(q) ||
        f.name?.toLowerCase().includes(q) ||
        f.contact_person?.toLowerCase().includes(q)
      const matchesSector = !sectorFilter || f.sector_prefix === sectorFilter
      return matchesSearch && matchesSector
    })
  }, [facilities, search, sectorFilter])

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
            <Plus size={16} />
            New Facility
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <div className="search-box">
          <Search size={15} className="search-icon" />
          <input
            className="search-input"
            placeholder="Search by name, file number, contact…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <select
            className="select"
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
          >
            <option value="">All sectors</option>
            {SECTORS.map((s) => (
              <option key={s.prefix} value={s.prefix}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* States */}
      {loading && <Spinner />}

      {error && (
        <div className="login-error">
          <AlertCircle size={15} />
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="empty-state">
          {facilities.length === 0
            ? 'No facilities registered yet. Click "New Facility" to add the first one.'
            : 'No facilities match your search.'}
        </div>
      )}

      {/* Card grid */}
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
            {f.location}{f.district ? ` · ${f.district}` : ''}
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
          {f.district ?? '—'}
        </span>
      </div>
    </div>
  )
}
