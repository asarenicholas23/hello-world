import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, Search, Filter } from 'lucide-react'
import { buildFacilityMap, getCrossRecords } from '../firebase/dashboard'
import { listFieldReports } from '../firebase/fieldReports'
import { facilityPath } from '../utils/fileNumbers'
import { SECTORS, DISTRICTS, SECTOR_COLORS } from '../data/constants'
import Spinner from '../components/Spinner'

const SUBRECORD_CATEGORIES = ['screenings', 'site_verifications', 'monitoring', 'enforcement']

function tsToMs(ts) {
  if (!ts) return null
  if (typeof ts.toMillis === 'function') return ts.toMillis()
  if (ts._seconds != null) return ts._seconds * 1000
  if (ts.seconds != null) return ts.seconds * 1000
  return null
}

function fmtMs(ms) {
  if (!ms) return '—'
  return new Date(ms).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })
}

function jan1ThisYear() {
  return `${new Date().getFullYear()}-01-01`
}

function esc(v) { return `"${String(v ?? '').replace(/"/g, '""')}"` }

function toCSV(rows) {
  const headers = ['Facility', 'File No.', 'Type of Undertaking', 'Sector', 'District',
    'First Visit', 'Registered', 'Reported', 'Permitted']
  const lines = [
    headers.map(esc).join(','),
    ...rows.map((r) => [
      r.name, r.fileNumber || 'Unregistered', r.typeOfUndertaking, r.sectorPrefix, r.district,
      fmtMs(r.firstVisitMs), r.registered ? 'Yes' : 'No', r.reported ? 'Yes' : 'No', r.permitted ? 'Yes' : 'No',
    ].map(esc).join(',')),
  ]
  return lines.join('\n')
}

function downloadCSV(content, filename) {
  const blob = new Blob([content], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

/**
 * Builds one row per facility/field-report "visited" since a given date, merging:
 *  - field_reports (visits to facilities not yet registered, or later assigned a file number)
 *  - facility sub-records (screenings/site_verifications/monitoring/enforcement) filed
 *    directly against an already-registered facility, with no mirrored field_report doc
 * keyed by file_number when known, otherwise by the field_report's own id.
 */
function buildVisitRows({ fieldReports, subrecordsByCategory, permittedFileNumbers }) {
  const visits = new Map()

  function upsert(key, patch, dateMs) {
    const existing = visits.get(key)
    if (!existing) {
      visits.set(key, { key, firstVisitMs: dateMs, reported: false, registered: false, ...patch })
      return
    }
    if (dateMs != null && (existing.firstVisitMs == null || dateMs < existing.firstVisitMs)) {
      existing.firstVisitMs = dateMs
    }
    Object.entries(patch).forEach(([k, v]) => {
      if (!existing[k] && v) existing[k] = v
    })
  }

  for (const category of SUBRECORD_CATEGORIES) {
    for (const rec of subrecordsByCategory[category]) {
      const dateMs = tsToMs(rec.date)
      if (dateMs == null) continue
      upsert(rec.fileNumber, {
        fileNumber: rec.fileNumber,
        name: rec.facilityName,
        typeOfUndertaking: rec.facilityUndertaking,
        sectorPrefix: rec.sectorPrefix,
        district: rec.facilityDistrict,
        registered: true,
        reported: true,
      }, dateMs)
    }
  }

  for (const r of fieldReports) {
    const dateMs = tsToMs(r.date) ?? tsToMs(r.date_reported) ?? tsToMs(r.date_letter_served)
    if (dateMs == null) continue
    const key = r.assigned_file_number || `unreg:${r.id}`
    upsert(key, {
      fileNumber: r.assigned_file_number || '',
      name: r.facility_name || '',
      typeOfUndertaking: r.type_of_undertaking || '',
      sectorPrefix: r.sector_prefix || '',
      district: r.district || '',
      registered: Boolean(r.assigned_file_number),
      reported: r.reporting_status === 'reported',
    }, dateMs)
  }

  return Array.from(visits.values()).map((v) => ({
    ...v,
    permitted: v.fileNumber ? permittedFileNumbers.has(v.fileNumber) : false,
  }))
}

export default function VisitReportsPage() {
  const navigate = useNavigate()

  const [visits, setVisits]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  const [search,   setSearch]   = useState('')
  const [sector,   setSector]   = useState('')
  const [district, setDistrict] = useState('')
  const [registeredFilter, setRegisteredFilter] = useState('')
  const [permitFilter,     setPermitFilter]     = useState('')
  const [reportedFilter,   setReportedFilter]   = useState('')
  const [dateFrom, setDateFrom] = useState(jan1ThisYear())
  const [dateTo,   setDateTo]   = useState('')

  useEffect(() => {
    async function load() {
      try {
        const facilityMap = await buildFacilityMap()
        const [fieldReports, screenings, siteVerifications, monitoring, enforcement, permits] = await Promise.all([
          listFieldReports(),
          getCrossRecords('screenings', facilityMap),
          getCrossRecords('site_verifications', facilityMap),
          getCrossRecords('monitoring', facilityMap),
          getCrossRecords('enforcement', facilityMap),
          getCrossRecords('permits', facilityMap),
        ])
        const permittedFileNumbers = new Set(permits.map((p) => p.fileNumber))
        const rows = buildVisitRows({
          fieldReports,
          subrecordsByCategory: { screenings, site_verifications: siteVerifications, monitoring, enforcement },
          permittedFileNumbers,
        })
        setVisits(rows)
      } catch (err) {
        setError(`Failed to load visit data: ${err.message}`)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    const fromMs = dateFrom ? new Date(dateFrom + 'T00:00:00').getTime() : null
    const toMs   = dateTo   ? new Date(dateTo   + 'T23:59:59').getTime() : null

    return visits.filter((v) => {
      if (fromMs && (v.firstVisitMs == null || v.firstVisitMs < fromMs)) return false
      if (toMs   && (v.firstVisitMs == null || v.firstVisitMs > toMs))   return false
      if (sector && v.sectorPrefix !== sector) return false
      if (district && v.district !== district) return false
      if (registeredFilter === 'registered'   && !v.registered) return false
      if (registeredFilter === 'unregistered' &&  v.registered) return false
      if (permitFilter === 'permitted'  && !v.permitted) return false
      if (permitFilter === 'no-permit'  &&  v.permitted) return false
      if (reportedFilter === 'reported'     && !v.reported) return false
      if (reportedFilter === 'not-reported' &&  v.reported) return false

      if (search.trim()) {
        const q = search.toLowerCase()
        return (
          v.name?.toLowerCase().includes(q) ||
          v.fileNumber?.toLowerCase().includes(q) ||
          v.typeOfUndertaking?.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [visits, search, sector, district, registeredFilter, permitFilter, reportedFilter, dateFrom, dateTo])

  const summary = useMemo(() => {
    const registered = filtered.filter((v) => v.registered)
    return {
      visited:   filtered.length,
      reported:  filtered.filter((v) => v.reported).length,
      permitted: filtered.filter((v) => v.permitted).length,
      permitPending: registered.filter((v) => !v.permitted).length,
      unregistered: filtered.filter((v) => !v.registered).length,
    }
  }, [filtered])

  const hasFilter = search || sector || district || registeredFilter || permitFilter || reportedFilter || dateTo || dateFrom !== jan1ThisYear()

  return (
    <div className="page">
      <button className="btn btn--ghost btn--sm btn--back" onClick={() => navigate('/')}>
        <ArrowLeft size={14} /> Dashboard
      </button>

      <div className="page-header" style={{ marginTop: 12 }}>
        <div>
          <div className="page-title">Visit Reports</div>
          <div className="page-subtitle">
            {loading ? 'Loading…' : `${filtered.length} facilities/reports visited`}
          </div>
        </div>
        {!loading && filtered.length > 0 && (
          <button
            className="btn btn--ghost"
            onClick={() => downloadCSV(toCSV(filtered), `epa-visits-${new Date().toISOString().slice(0, 10)}.csv`)}
          >
            <Download size={14} /> Export CSV
          </button>
        )}
      </div>

      {/* ── Filters ── */}
      <div className="analytics-filter-card">
        <div className="analytics-filter-card__title">
          <Filter size={13} /> Filters
          {hasFilter && (
            <button
              className="btn btn--ghost btn--sm"
              style={{ marginLeft: 'auto', fontSize: 12 }}
              onClick={() => {
                setSearch(''); setSector(''); setDistrict('')
                setRegisteredFilter(''); setPermitFilter(''); setReportedFilter('')
                setDateFrom(jan1ThisYear()); setDateTo('')
              }}
            >
              Clear all
            </button>
          )}
        </div>

        <div className="analytics-filter-grid">
          <div className="form-group">
            <label>Sector</label>
            <select className="select" value={sector} onChange={(e) => setSector(e.target.value)}>
              <option value="">All sectors</option>
              {SECTORS.map((s) => <option key={s.prefix} value={s.prefix}>{s.name}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>District</label>
            <select className="select" value={district} onChange={(e) => setDistrict(e.target.value)}>
              <option value="">All districts</option>
              {DISTRICTS.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>Registration</label>
            <select className="select" value={registeredFilter} onChange={(e) => setRegisteredFilter(e.target.value)}>
              <option value="">All</option>
              <option value="registered">Registered (has file no.)</option>
              <option value="unregistered">Unregistered</option>
            </select>
          </div>

          <div className="form-group">
            <label>Permit</label>
            <select className="select" value={permitFilter} onChange={(e) => setPermitFilter(e.target.value)}>
              <option value="">All</option>
              <option value="permitted">Permitted</option>
              <option value="no-permit">No permit yet</option>
            </select>
          </div>

          <div className="form-group">
            <label>Reported</label>
            <select className="select" value={reportedFilter} onChange={(e) => setReportedFilter(e.target.value)}>
              <option value="">All</option>
              <option value="reported">Reported</option>
              <option value="not-reported">Not yet reported</option>
            </select>
          </div>

          <div className="form-group">
            <label>Visited from</label>
            <input className="input" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>

          <div className="form-group">
            <label>Visited to</label>
            <input className="input" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>

          <div className="form-group">
            <label>Search</label>
            <div className="search-box">
              <Search size={14} className="search-icon" />
              <input
                className="search-input"
                placeholder="Facility, file no., type (e.g. church)…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Summary chips ── */}
      {!loading && filtered.length > 0 && (
        <div className="analytics-summary-row">
          <div className="analytics-chip" style={{ background: '#e0e7ff', color: '#3730a3' }}>
            <span className="analytics-chip__num">{summary.visited}</span> Visited
          </div>
          <div className="analytics-chip" style={{ background: '#dcfce7', color: '#166534' }}>
            <span className="analytics-chip__num">{summary.reported}</span> Reported
          </div>
          <div className="analytics-chip" style={{ background: '#dbeafe', color: '#1d4ed8' }}>
            <span className="analytics-chip__num">{summary.permitted}</span> Permitted
          </div>
          <div className="analytics-chip" style={{ background: '#fef9c3', color: '#854d0e' }}>
            <span className="analytics-chip__num">{summary.permitPending}</span> Registered, permit pending
          </div>
          <div className="analytics-chip" style={{ background: '#f3f4f6', color: '#374151' }}>
            <span className="analytics-chip__num">{summary.unregistered}</span> Unregistered
          </div>
        </div>
      )}

      {loading && <Spinner />}
      {error  && <div className="login-error" style={{ marginTop: 12 }}>{error}</div>}

      {!loading && !error && filtered.length === 0 && (
        <div className="empty-state">No visits match your filters.</div>
      )}

      {/* ── Results table ── */}
      {!loading && !error && filtered.length > 0 && (
        <div className="analytics-table-wrap">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>Facility</th>
                <th>File No.</th>
                <th>Type of Undertaking</th>
                <th>Sector</th>
                <th>District</th>
                <th>First Visit</th>
                <th>Reported</th>
                <th>Permitted</th>
              </tr>
            </thead>
            <tbody>
              {filtered
                .slice()
                .sort((a, b) => (b.firstVisitMs ?? 0) - (a.firstVisitMs ?? 0))
                .map((v) => {
                  const colors = SECTOR_COLORS[v.sectorPrefix] ?? { bg: '#f3f4f6', text: '#374151' }
                  const districtName = DISTRICTS.find((d) => d.code === v.district)?.name ?? v.district
                  return (
                    <tr
                      key={v.key}
                      className="analytics-table__row"
                      onClick={() => v.fileNumber && navigate(facilityPath(v.fileNumber))}
                      style={{ cursor: v.fileNumber ? 'pointer' : 'default' }}
                    >
                      <td className="analytics-table__name">{v.name || '—'}</td>
                      <td>
                        {v.fileNumber
                          ? <span className="file-num" style={{ fontSize: 12 }}>{v.fileNumber}</span>
                          : <span className="record-badge" style={{ background: '#f3f4f6', color: '#374151', fontSize: 10 }}>Unregistered</span>
                        }
                      </td>
                      <td style={{ fontSize: 12 }}>{v.typeOfUndertaking || '—'}</td>
                      <td>
                        {v.sectorPrefix && (
                          <span className="record-badge" style={{ background: colors.bg, color: colors.text, fontSize: 10 }}>
                            {v.sectorPrefix}
                          </span>
                        )}
                      </td>
                      <td style={{ fontSize: 12, color: '#6b7280' }}>{districtName || '—'}</td>
                      <td style={{ fontSize: 12, color: '#6b7280' }}>{fmtMs(v.firstVisitMs)}</td>
                      <td>
                        <span className="record-badge" style={v.reported ? { background: '#dcfce7', color: '#166534' } : { background: '#fef9c3', color: '#854d0e' }}>
                          {v.reported ? 'Reported' : 'Pending'}
                        </span>
                      </td>
                      <td>
                        <span className="record-badge" style={v.permitted ? { background: '#dbeafe', color: '#1d4ed8' } : { background: '#f3f4f6', color: '#374151' }}>
                          {v.permitted ? 'Permitted' : 'No permit'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
