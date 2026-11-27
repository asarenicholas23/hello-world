import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { Building2, MapPin, Phone, Plus, Search, User, AlertCircle, Clock, Trash2, CheckCircle, LayoutGrid, Table2, MessageSquare, PackageCheck, Download } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSync } from '../context/SyncContext'
import { listFacilities, deleteFacility } from '../firebase/facilities'
import { getPermitDetailsMap, getPermitReadySet } from '../firebase/dashboard'
import { SECTORS, DISTRICTS, SECTOR_COLORS, ADMIN_ROLES } from '../data/constants'
import { facilityPath } from '../utils/fileNumbers'
import { SUB_SECTORS, facilitySubSector, subSectorName } from '../utils/subSectors'
import Spinner from '../components/Spinner'

// The mobile app defaults to cards (the table needs a wide screen) and keeps its
// own saved preference so it doesn't inherit the desktop choice.
const IS_NATIVE = Capacitor.isNativePlatform()
const VIEW_STORAGE_KEY = IS_NATIVE ? 'facilities-view-native' : 'facilities-view'
const DEFAULT_VIEW = IS_NATIVE ? 'cards' : 'table'

const SORT_OPTIONS = [
  { value: 'newest',  label: 'Newest first' },
  { value: 'az',      label: 'Name A–Z' },
  { value: 'za',      label: 'Name Z–A' },
  { value: 'sector',  label: 'By sector' },
]

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && typeof value.toDate !== 'function'
}

function formatFieldValue(value) {
  if (value == null) return ''
  if (typeof value.toDate === 'function') return value.toDate().toISOString()
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(formatFieldValue).filter(Boolean).join('; ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function flattenRecord(record, prefix = '') {
  return Object.entries(record ?? {}).reduce((acc, [key, value]) => {
    const field = prefix ? `${prefix}.${key}` : key
    if (isPlainObject(value)) {
      return { ...acc, ...flattenRecord(value, field) }
    }
    acc[field] = formatFieldValue(value)
    return acc
  }, {})
}

function fieldLabel(field) {
  return field
    .replaceAll('_', ' ')
    .replaceAll('.', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function searchableText(record, field = '') {
  const flat = flattenRecord(record)
  if (field) return (flat[field] ?? '').toLowerCase()
  return Object.values(flat).join(' ').toLowerCase()
}

function csvEscape(value) {
  const str = value == null ? '' : String(value)
  return /[",\n\r]/.test(str) ? `"${str.replaceAll('"', '""')}"` : str
}

function toFacilitiesCSV(rows, fields) {
  const header = fields.map(csvEscape).join(',')
  const body = rows.map((row) => {
    const flat = flattenRecord(row)
    return fields.map((field) => csvEscape(flat[field] ?? '')).join(',')
  })
  return [header, ...body].join('\n')
}

function downloadCSV(content, filename) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function sortFacilities(list, sort) {
  const copy = [...list]
  if (sort === 'az')     return copy.sort((a, b) => a.name.localeCompare(b.name))
  if (sort === 'za')     return copy.sort((a, b) => b.name.localeCompare(a.name))
  if (sort === 'sector') return copy.sort((a, b) => (a.sector_prefix ?? '').localeCompare(b.sector_prefix ?? ''))
  return copy // newest — already ordered by created_at desc from Firestore
}

function permitStatusForFacility(map, facility) {
  const fileNumber = String(facility.file_number ?? '').trim()
  return map[fileNumber]?.status ?? 'none'
}

export default function Facilities() {
  const { role, dataAccess } = useAuth()
  const { drafts, removeDraft } = useSync()
  const navigate = useNavigate()
  const location = useLocation()

  const [facilities, setFacilities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const draftSaved = location.state?.draftSaved ?? false

  const [search, setSearch]                 = useState('')
  const [searchField, setSearchField]       = useState('')
  const [sectorFilter, setSectorFilter]     = useState('')
  const [subSectorFilter, setSubSectorFilter] = useState(location.state?.subSector ?? '')
  const [districtFilter, setDistrictFilter] = useState('')
  const [permitFilter, setPermitFilter]     = useState(location.state?.permitFilter ?? '')
  const [officerFilter, setOfficerFilter]   = useState(location.state?.officerUid ?? '')

  // Re-sync on every navigation (handles same-route re-navigation)
  useEffect(() => {
    const nextOfficer = location.state?.officerUid ?? ''
    const nextPermit = location.state?.permitFilter ?? ''
    let cancelled = false
    Promise.resolve().then(() => {
      if (!cancelled) setOfficerFilter((current) => current === nextOfficer ? current : nextOfficer)
      if (!cancelled) setPermitFilter((current) => current === nextPermit ? current : nextPermit)
    })
    return () => { cancelled = true }
  }, [location.key, location.state?.officerUid, location.state?.permitFilter])
  const [permitStatusMap, setPermitStatusMap] = useState(null)
  const [permitMapLoading, setPermitMapLoading] = useState(false)
  const [permitReadySet, setPermitReadySet]   = useState(null)
  const [readySetLoading, setReadySetLoading] = useState(false)
  const [readyFilter, setReadyFilter]         = useState(false)
  const [sort, setSort]   = useState('newest')
  const [view, setView]   = useState(() => localStorage.getItem(VIEW_STORAGE_KEY) ?? DEFAULT_VIEW)
  const [selectedIds, setSelectedIds] = useState([])
  const [deletingSelected, setDeletingSelected] = useState(false)

  function toggleView(v) {
    setView(v)
    localStorage.setItem(VIEW_STORAGE_KEY, v)
  }

  useEffect(() => {
    listFacilities()
      .then(setFacilities)
      .catch(() => setError('Failed to load facilities. Check your connection.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!permitFilter || permitStatusMap !== null) return
    let cancelled = false
    Promise.resolve().then(async () => {
      setPermitMapLoading(true)
      try {
        const map = await getPermitDetailsMap()
        if (!cancelled) setPermitStatusMap(map)
      } catch {
        // Keep the filter settled if permit status lookup fails.
        if (!cancelled) setPermitStatusMap({})
      } finally {
        if (!cancelled) setPermitMapLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [permitFilter, permitStatusMap])

  useEffect(() => {
    if (!readyFilter || permitReadySet !== null) return
    let cancelled = false
    Promise.resolve().then(async () => {
      setReadySetLoading(true)
      try {
        const set = await getPermitReadySet()
        if (!cancelled) setPermitReadySet(set)
      } catch {
        // Keep the filter non-blocking if permit readiness lookup fails.
      } finally {
        if (!cancelled) setReadySetLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [readyFilter, permitReadySet])

  const databaseFields = useMemo(() => {
    const fields = new Set()
    facilities.forEach((facility) => {
      Object.keys(flattenRecord(facility)).forEach((field) => fields.add(field))
    })
    return [...fields].sort((a, b) => a.localeCompare(b))
  }, [facilities])

  // Sub-sector per facility: the saved sub_sector, or read from what it does.
  const subSectorByFile = useMemo(
    () => new Map(facilities.map((f) => [f.file_number, facilitySubSector(f)])),
    [facilities],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = facilities.filter((f) => {
      const matchesSearch = !q || searchableText(f, searchField).includes(q)
      const matchesSector   = !sectorFilter   || f.sector_prefix === sectorFilter
      const matchesSubSector = !subSectorFilter || subSectorByFile.get(f.file_number)?.value === subSectorFilter
      const matchesDistrict = !districtFilter || f.district       === districtFilter
      const matchesOfficer  = !officerFilter  || f.primary_officer === officerFilter
      let matchesPermit = true
      if (permitFilter) {
        if (permitStatusMap === null) return false
        const status = permitStatusForFacility(permitStatusMap, f)
        matchesPermit = status === permitFilter
      }
      const matchesReady = !readyFilter || (permitReadySet !== null && permitReadySet.has(f.file_number))
      return matchesSearch && matchesSector && matchesSubSector && matchesDistrict && matchesPermit && matchesOfficer && matchesReady
    })
    return sortFacilities(base, sort)
  }, [facilities, search, searchField, sectorFilter, subSectorFilter, subSectorByFile, districtFilter, permitFilter, officerFilter, permitStatusMap, sort, readyFilter, permitReadySet])

  const activeFilters = [search.trim(), searchField, sectorFilter, subSectorFilter, districtFilter, permitFilter, officerFilter, readyFilter ? 'ready' : ''].filter(Boolean).length
  const canBulkManage = ADMIN_ROLES.has(role)
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const visibleFacilityIds = filtered.map((f) => f.file_number)
  const allVisibleSelected = visibleFacilityIds.length > 0 && visibleFacilityIds.every((id) => selectedIdSet.has(id))

  async function handleExportCSV() {
    let permitMap = permitStatusMap
    if (permitMap === null) {
      try { permitMap = await getPermitDetailsMap() } catch { permitMap = {} }
      setPermitStatusMap(permitMap)
    }

    const permitFields = ['permit_status', 'permit_number', 'permit_issue_date', 'permit_effective_date', 'permit_expiry_date']
    const baseFields = databaseFields.length > 0 ? databaseFields : ['file_number', 'name']
    const fields = [...baseFields, ...(baseFields.includes('sub_sector') ? [] : ['sub_sector']), ...permitFields]
    const rows = filtered.map((facility) => {
      const entry = permitMap[String(facility.file_number ?? '').trim()]
      return {
        ...facility,
        sub_sector:             subSectorByFile.get(facility.file_number)?.name ?? '',
        permit_status:          entry?.status ?? 'none',
        permit_number:          entry?.permit_number ?? '',
        permit_issue_date:      entry?.issue_date ?? null,
        permit_effective_date:  entry?.effective_date ?? null,
        permit_expiry_date:     entry?.expiry_date ?? null,
      }
    })
    downloadCSV(toFacilitiesCSV(rows, fields), `epa-facilities-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  function toggleFacilitySelection(fileNumber) {
    setSelectedIds((prev) => (
      prev.includes(fileNumber)
        ? prev.filter((id) => id !== fileNumber)
        : [...prev, fileNumber]
    ))
  }

  function toggleSelectAllVisible() {
    setSelectedIds((prev) => {
      if (allVisibleSelected) {
        return prev.filter((id) => !visibleFacilityIds.includes(id))
      }
      return [...new Set([...prev, ...visibleFacilityIds])]
    })
  }

  function clearSelection() {
    setSelectedIds([])
  }

  async function handleDeleteSelected() {
    if (selectedIds.length === 0 || deletingSelected) return
    const label = selectedIds.length === 1 ? 'facility' : 'facilities'
    if (!window.confirm(`Delete ${selectedIds.length} selected ${label}? This cannot be undone.`)) return

    setDeletingSelected(true)
    setActionError('')

    const results = await Promise.allSettled(selectedIds.map((fileNumber) => deleteFacility(fileNumber)))
    const deletedIds = selectedIds.filter((_, index) => results[index].status === 'fulfilled')
    const failedCount = results.length - deletedIds.length

    if (deletedIds.length > 0) {
      setFacilities((prev) => prev.filter((facility) => !deletedIds.includes(facility.file_number)))
      setSelectedIds((prev) => prev.filter((id) => !deletedIds.includes(id)))
    }

    if (failedCount > 0) {
      setActionError(`Deleted ${deletedIds.length} ${label}, but ${failedCount} failed. Please try again.`)
    }

    setDeletingSelected(false)
  }

  return (
    <div className="page studio-skin">
      <div className="page-header">
        <div>
          <div className="page-title">Facilities</div>
          <div className="page-subtitle">
            {loading ? 'Loading…' : `${filtered.length} of ${facilities.length} registered`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {canBulkManage && filtered.length > 0 && (
            <>
              <button
                className="btn btn--ghost"
                onClick={toggleSelectAllVisible}
                disabled={deletingSelected}
              >
                {allVisibleSelected ? 'Unselect Visible' : 'Select Visible'}
              </button>
              <button
                className="btn btn--ghost"
                onClick={clearSelection}
                disabled={selectedIds.length === 0 || deletingSelected}
              >
                Clear ({selectedIds.length})
              </button>
              <button
                className="btn btn--ghost btn--danger"
                onClick={handleDeleteSelected}
                disabled={selectedIds.length === 0 || deletingSelected}
              >
                <Trash2 size={14} /> {deletingSelected ? 'Deleting…' : `Delete Selected (${selectedIds.length})`}
              </button>
            </>
          )}
          {canBulkManage && filtered.length > 0 && (
            <button
              className="btn btn--ghost"
              onClick={() => navigate('/sms', { state: { bulkFacilities: filtered } })}
              title="Send SMS to all facilities in this filtered view"
            >
              <MessageSquare size={14} /> SMS ({filtered.length})
            </button>
          )}
          {filtered.length > 0 && (
            <button
              className="btn btn--ghost"
              onClick={handleExportCSV}
              title="Export the current filtered facility view to CSV"
            >
              <Download size={14} /> Export CSV
            </button>
          )}
          {(role === 'admin' || dataAccess) && (
            <button className="btn btn--primary" onClick={() => navigate('/facilities/new')}>
              <Plus size={16} /> New Facility
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <div className="search-box">
          <Search size={15} className="search-icon" />
          <input
            className="search-input"
            placeholder={searchField ? `Search ${fieldLabel(searchField)}…` : 'Search all database fields…'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <select className="select" value={searchField} onChange={(e) => setSearchField(e.target.value)}>
            <option value="">All database fields</option>
            {databaseFields.map((field) => (
              <option key={field} value={field}>{fieldLabel(field)}</option>
            ))}
          </select>
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
          <select className="select" value={subSectorFilter} onChange={(e) => setSubSectorFilter(e.target.value)} aria-label="Filter by sub-sector">
            <option value="">All sub-sectors</option>
            {SUB_SECTORS.map((s) => (
              <option key={s.value} value={s.value}>{s.name} ({SECTORS.find((x) => x.prefix === s.sector)?.name ?? s.sector})</option>
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
          <select
            className="select"
            value={permitFilter}
            onChange={(e) => setPermitFilter(e.target.value)}
          >
            <option value="">All permit statuses</option>
            <option value="active">Active permit</option>
            <option value="expiring">Expiring ≤60 days</option>
            <option value="expired">Expired permit</option>
            <option value="none">No permit on file</option>
          </select>
        </div>

        <div className="filter-group">
          <button
            className={`btn btn--sm${readyFilter ? ' btn--primary' : ' btn--ghost'}`}
            onClick={() => setReadyFilter((v) => !v)}
            title="Show only facilities with permits ready to collect"
          >
            <PackageCheck size={13} /> {readyFilter ? 'Ready to Collect ✓' : 'Permit Ready?'}
          </button>
        </div>

        <div className="filter-group">
          <select className="select" value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div className="view-toggle">
          <button
            className={`view-toggle__btn${view === 'table' ? ' view-toggle__btn--active' : ''}`}
            onClick={() => toggleView('table')}
            title="Table view"
          >
            <Table2 size={15} />
          </button>
          <button
            className={`view-toggle__btn${view === 'cards' ? ' view-toggle__btn--active' : ''}`}
            onClick={() => toggleView('cards')}
            title="Card view"
          >
            <LayoutGrid size={15} />
          </button>
        </div>
      </div>

      {/* Active filter pills */}
      {activeFilters > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {search.trim() && (
            <span className="filter-pill">
              Search: {searchField ? `${fieldLabel(searchField)} = ` : ''}{search.trim()}
              <button onClick={() => setSearch('')}>✕</button>
            </span>
          )}
          {searchField && !search.trim() && (
            <span className="filter-pill">
              Search field: {fieldLabel(searchField)}
              <button onClick={() => setSearchField('')}>✕</button>
            </span>
          )}
          {officerFilter && (
            <span className="filter-pill">
              Showing: your assigned facilities
              <button onClick={() => setOfficerFilter('')}>✕</button>
            </span>
          )}
          {sectorFilter && (
            <span className="filter-pill">
              Sector: {SECTORS.find((s) => s.prefix === sectorFilter)?.name}
              <button onClick={() => setSectorFilter('')}>✕</button>
            </span>
          )}
          {subSectorFilter && (
            <span className="filter-pill">
              Sub-sector: {subSectorName(subSectorFilter)}
              <button onClick={() => setSubSectorFilter('')}>✕</button>
            </span>
          )}
          {districtFilter && (
            <span className="filter-pill">
              District: {DISTRICTS.find((d) => d.code === districtFilter)?.name}
              <button onClick={() => setDistrictFilter('')}>✕</button>
            </span>
          )}
          {permitFilter && (
            <span className="filter-pill">
              Permit: {permitFilter === 'none' ? 'No permit on file' : permitFilter === 'active' ? 'Active' : permitFilter === 'expiring' ? 'Expiring ≤60d' : 'Expired'}
              {permitMapLoading && ' (loading…)'}
              <button onClick={() => setPermitFilter('')}>✕</button>
            </span>
          )}
          {readyFilter && (
            <span className="filter-pill">
              <PackageCheck size={11} /> Permit ready to collect
              {readySetLoading && ' (loading…)'}
              <button onClick={() => setReadyFilter(false)}>✕</button>
            </span>
          )}
          <button
            className="btn btn--ghost btn--xs"
            onClick={() => { setSectorFilter(''); setSubSectorFilter(''); setDistrictFilter(''); setPermitFilter(''); setOfficerFilter(''); setSearch(''); setSearchField(''); setReadyFilter(false) }}
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

      {canBulkManage && filtered.length > 0 && (
        <div className="bulk-actions-bar">
          <span className="bulk-actions-bar__hint">Admin bulk actions are enabled. Use the checkboxes below to select facilities.</span>
          <label className="bulk-actions-bar__checkbox">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleSelectAllVisible}
            />
            <span>Select all visible</span>
          </label>
          <span className="bulk-actions-bar__count">
            {selectedIds.length} selected
          </span>
          <button
            className="btn btn--ghost btn--xs"
            onClick={clearSelection}
            disabled={selectedIds.length === 0 || deletingSelected}
          >
            Clear
          </button>
          <button
            className="btn btn--ghost btn--xs btn--danger"
            onClick={handleDeleteSelected}
            disabled={selectedIds.length === 0 || deletingSelected}
          >
            <Trash2 size={13} /> {deletingSelected ? 'Deleting…' : 'Delete Selected'}
          </button>
        </div>
      )}

      {loading && <Spinner />}

      {error && (
        <div className="login-error">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {!error && actionError && (
        <div className="login-error">
          <AlertCircle size={15} /> {actionError}
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
        view === 'table' ? (
          <FacilityTable
            facilities={filtered}
            onRowClick={(f) => navigate(facilityPath(f.file_number))}
            canSelect={canBulkManage}
            selectedIdSet={selectedIdSet}
            onToggleSelect={toggleFacilitySelection}
            allVisibleSelected={allVisibleSelected}
            onToggleSelectAll={toggleSelectAllVisible}
          />
        ) : (
          <div className="firms-grid">
            {filtered.map((f) => (
              <FacilityCard
                key={f.file_number}
                facility={f}
                onClick={() => navigate(facilityPath(f.file_number))}
                selectable={canBulkManage}
                selected={selectedIdSet.has(f.file_number)}
                onToggleSelect={() => toggleFacilitySelection(f.file_number)}
              />
            ))}
          </div>
        )
      )}
    </div>
  )
}

function FacilityTable({
  facilities,
  onRowClick,
  canSelect,
  selectedIdSet,
  onToggleSelect,
  allVisibleSelected,
  onToggleSelectAll,
}) {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table className="facility-table">
          <thead>
            <tr>
              {canSelect && (
                <th style={{ width: 42 }}>
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={onToggleSelectAll}
                    onClick={(e) => e.stopPropagation()}
                  />
                </th>
              )}
              <th>File No.</th>
              <th>Name</th>
              <th>Sector</th>
              <th>Type of Undertaking</th>
              <th>Location</th>
              <th>District</th>
              <th>Contact Person</th>
              <th>Phone</th>
            </tr>
          </thead>
          <tbody>
            {facilities.map((f) => {
              const colors   = SECTOR_COLORS[f.sector_prefix] ?? { bg: '#f3f4f6', text: '#374151' }
              const district = DISTRICTS.find((d) => d.code === f.district)
              const sub      = facilitySubSector(f)
              return (
                <tr
                  key={f.file_number}
                  className={`facility-table__row${selectedIdSet?.has(f.file_number) ? ' facility-table__row--selected' : ''}`}
                  onClick={() => onRowClick(f)}
                >
                  {canSelect && (
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIdSet.has(f.file_number)}
                        onChange={() => onToggleSelect(f.file_number)}
                      />
                    </td>
                  )}
                  <td className="facility-table__fileno">{f.file_number}</td>
                  <td className="facility-table__name">{f.name}</td>
                  <td>
                    <span className="facility-sector-badge" style={{ background: colors.bg, color: colors.text }}>
                      {f.sector_prefix}
                    </span>
                  </td>
                  <td>
                    {f.type_of_undertaking || <span style={{ color: '#9ca3af' }}>—</span>}
                    {sub && <span className="sub-sector-tag">{sub.name}</span>}
                  </td>
                  <td>{f.location || <span style={{ color: '#9ca3af' }}>—</span>}</td>
                  <td>{district?.name ?? f.district ?? <span style={{ color: '#9ca3af' }}>—</span>}</td>
                  <td>{f.contact_person || <span style={{ color: '#9ca3af' }}>—</span>}</td>
                  <td>{f.phone || <span style={{ color: '#9ca3af' }}>—</span>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function FacilityCard({ facility: f, onClick, selectable, selected, onToggleSelect }) {
  const colors = SECTOR_COLORS[f.sector_prefix] ?? { bg: '#f3f4f6', text: '#374151' }
  const district = DISTRICTS.find((d) => d.code === f.district)
  const sub = facilitySubSector(f)

  return (
    <div className={`firm-card${selected ? ' firm-card--selected' : ''}`} onClick={onClick}>
      <div className="firm-card__header">
        <div>
          <span className="firm-card__name">{f.name}</span>
          <span
            className="firm-card__industry facility-sector-badge"
            style={{ background: colors.bg, color: colors.text }}
          >
            {f.sector}
          </span>
          {sub && <span className="sub-sector-tag">{sub.name}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {selectable && (
            <label className="bulk-card-checkbox bulk-card-checkbox--header" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={selected}
                onChange={onToggleSelect}
              />
              <span>Select</span>
            </label>
          )}
          <span className="file-num">{f.file_number}</span>
        </div>
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
