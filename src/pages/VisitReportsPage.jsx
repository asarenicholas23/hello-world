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

const PERMIT_OUTCOME_LABEL = {
  after_visit:          'Permitted after visit',
  renewed_after_visit:  'Permit renewed after visit',
  before_visit:         'Permit renewal pending',
  no_permit:            'No permit yet',
  unknown_timing:       'Permitted (date unknown)',
}

const PERMIT_OUTCOME_COLORS = {
  after_visit:         { background: '#dbeafe', color: '#1d4ed8' },
  renewed_after_visit: { background: '#ccfbf1', color: '#0f766e' },
  before_visit:        { background: '#fef3c7', color: '#92400e' },
  no_permit:           { background: '#f3f4f6', color: '#374151' },
  unknown_timing:      { background: '#fef9c3', color: '#854d0e' },
}

const VISIT_TYPE_LABEL = {
  walk_in:           'Walk-in',
  enforcement:       'Enforcement',
  screening:         'Screening',
  site_verification: 'Site Verification',
  monitoring:        'Monitoring',
}

const VISIT_TYPE_COLORS = {
  walk_in:           { background: '#f0fdf4', color: '#166534' },
  enforcement:       { background: '#fff7ed', color: '#c2410c' },
  screening:         { background: '#eff6ff', color: '#1d4ed8' },
  site_verification: { background: '#faf5ff', color: '#7e22ce' },
  monitoring:        { background: '#ecfeff', color: '#0e7490' },
}

// facility sub-record category -> singular visit-type key
const CATEGORY_TO_VISIT_TYPE = {
  screenings:         'screening',
  site_verifications: 'site_verification',
  monitoring:         'monitoring',
  enforcement:        'enforcement',
}

function toCSV(rows) {
  const headers = ['Facility', 'File No.', 'Visit Types', 'Type of Undertaking', 'Sector', 'District',
    'First Visit', 'Registered', 'Reported', 'Permit Outcome']
  const lines = [
    headers.map(esc).join(','),
    ...rows.map((r) => [
      r.name, r.fileNumber || 'Unregistered',
      r.visitTypes.map((t) => VISIT_TYPE_LABEL[t] ?? t).join('; '),
      r.typeOfUndertaking, r.sectorPrefix, r.district,
      fmtMs(r.firstVisitMs), r.registered ? 'Yes' : 'No', r.reported ? 'Yes' : 'No',
      PERMIT_OUTCOME_LABEL[r.permitOutcome] ?? r.permitOutcome,
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
 *
 * Every record has a `created_at`, so falling back to it when there's no more specific
 * date (many legacy/migrated reports only have created_at) means nothing gets dropped —
 * it's an approximate date for those, but keeps the record visible and countable.
 *
 * permitOutcome compares each facility's earliest and latest permit dates (effective_date,
 * falling back to issue_date) against the visit date, so a still-expired-today permit
 * still counts as "permitted" — only its *timing* relative to the visit is classified:
 *   - 'after_visit'          no permit predates the visit — the visit likely drove the first one
 *   - 'renewed_after_visit'  a permit already existed before the visit, AND a newer one
 *                            (the renewal) was issued on/after the visit
 *   - 'before_visit'         a permit already existed before the visit, with no renewal since —
 *                            i.e. the visit's presumed purpose (get them to renew) hasn't landed yet
 *   - 'unknown_timing'       has a permit but neither record has a usable date
 *   - 'no_permit'            no permit on file at all
 */
function buildVisitRows({ fieldReports, subrecordsByCategory, permits }) {
  const visits = new Map()

  function upsert(key, patch, dateMs, visitType) {
    const existing = visits.get(key)
    if (!existing) {
      visits.set(key, { key, firstVisitMs: dateMs, reported: false, registered: false, visitTypes: new Set([visitType]), ...patch })
      return
    }
    if (dateMs != null && (existing.firstVisitMs == null || dateMs < existing.firstVisitMs)) {
      existing.firstVisitMs = dateMs
    }
    existing.visitTypes.add(visitType)
    Object.entries(patch).forEach(([k, v]) => {
      if (!existing[k] && v) existing[k] = v
    })
  }

  for (const category of SUBRECORD_CATEGORIES) {
    for (const rec of subrecordsByCategory[category]) {
      const dateMs = tsToMs(rec.date) ?? tsToMs(rec.created_at)
      upsert(rec.fileNumber, {
        fileNumber: rec.fileNumber,
        name: rec.facilityName,
        typeOfUndertaking: rec.facilityUndertaking,
        sectorPrefix: rec.sectorPrefix,
        district: rec.facilityDistrict,
        registered: true,
        reported: true,
      }, dateMs, CATEGORY_TO_VISIT_TYPE[category])
    }
  }

  for (const r of fieldReports) {
    const dateMs = tsToMs(r.date) ?? tsToMs(r.date_reported) ?? tsToMs(r.date_letter_served) ?? tsToMs(r.created_at)
    const key = r.assigned_file_number || `unreg:${r.id}`
    upsert(key, {
      fileNumber: r.assigned_file_number || '',
      name: r.facility_name || '',
      typeOfUndertaking: r.type_of_undertaking || '',
      sectorPrefix: r.sector_prefix || '',
      district: r.district || '',
      registered: Boolean(r.assigned_file_number),
      reported: r.reporting_status === 'reported',
    }, dateMs, r.report_type)
  }

  // Earliest and latest dated permit per facility, plus which facilities have a permit
  // at all (some legacy permits carry neither an issue_date nor an effective_date).
  const hasAnyPermit = new Set()
  const earliestPermitMsByFileNumber = new Map()
  const latestPermitMsByFileNumber = new Map()
  for (const p of permits) {
    hasAnyPermit.add(p.fileNumber)
    const permitMs = tsToMs(p.effective_date) ?? tsToMs(p.issue_date)
    if (permitMs == null) continue
    const earliest = earliestPermitMsByFileNumber.get(p.fileNumber)
    if (earliest == null || permitMs < earliest) earliestPermitMsByFileNumber.set(p.fileNumber, permitMs)
    const latest = latestPermitMsByFileNumber.get(p.fileNumber)
    if (latest == null || permitMs > latest) latestPermitMsByFileNumber.set(p.fileNumber, permitMs)
  }

  return Array.from(visits.values()).map((v) => {
    const base = { ...v, visitTypes: Array.from(v.visitTypes).filter(Boolean) }
    if (!base.fileNumber || !hasAnyPermit.has(base.fileNumber)) return { ...base, permitOutcome: 'no_permit' }
    const earliestMs = earliestPermitMsByFileNumber.get(base.fileNumber)
    if (earliestMs == null || base.firstVisitMs == null) return { ...base, permitOutcome: 'unknown_timing' }
    if (earliestMs >= base.firstVisitMs) return { ...base, permitOutcome: 'after_visit' }
    // Already permitted before the visit — check for a later (renewal) permit since.
    const latestMs = latestPermitMsByFileNumber.get(base.fileNumber)
    if (latestMs != null && latestMs >= base.firstVisitMs) return { ...base, permitOutcome: 'renewed_after_visit' }
    return { ...base, permitOutcome: 'before_visit' }
  })
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
  const [visitTypeFilter,  setVisitTypeFilter]  = useState('')
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
        const rows = buildVisitRows({
          fieldReports,
          subrecordsByCategory: { screenings, site_verifications: siteVerifications, monitoring, enforcement },
          permits,
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
      if (permitFilter && v.permitOutcome !== permitFilter) return false
      if (reportedFilter === 'reported'     && !v.reported) return false
      if (reportedFilter === 'not-reported' &&  v.reported) return false
      if (visitTypeFilter && !v.visitTypes.includes(visitTypeFilter)) return false

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
  }, [visits, search, sector, district, registeredFilter, permitFilter, reportedFilter, visitTypeFilter, dateFrom, dateTo])

  const summary = useMemo(() => ({
    visited:         filtered.length,
    reported:        filtered.filter((v) => v.reported).length,
    permittedAfter:  filtered.filter((v) => v.permitOutcome === 'after_visit').length,
    renewedAfter:    filtered.filter((v) => v.permitOutcome === 'renewed_after_visit').length,
    renewalPending:  filtered.filter((v) => v.permitOutcome === 'before_visit').length,
    permitPending:   filtered.filter((v) => v.registered && v.permitOutcome === 'no_permit').length,
    unregistered:    filtered.filter((v) => !v.registered).length,
  }), [filtered])

  const hasFilter = search || sector || district || registeredFilter || permitFilter || reportedFilter || visitTypeFilter || dateTo || dateFrom !== jan1ThisYear()

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
                setRegisteredFilter(''); setPermitFilter(''); setReportedFilter(''); setVisitTypeFilter('')
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
            <label>Visit Type</label>
            <select className="select" value={visitTypeFilter} onChange={(e) => setVisitTypeFilter(e.target.value)}>
              <option value="">All types</option>
              <option value="walk_in">Walk-in</option>
              <option value="enforcement">Enforcement</option>
              <option value="screening">Screening</option>
              <option value="site_verification">Site Verification</option>
              <option value="monitoring">Monitoring</option>
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
              <option value="after_visit">Permitted after visit</option>
              <option value="renewed_after_visit">Permit renewed after visit</option>
              <option value="before_visit">Permit renewal pending</option>
              <option value="no_permit">No permit yet</option>
              <option value="unknown_timing">Permitted (date unknown)</option>
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
            <span className="analytics-chip__num">{summary.permittedAfter}</span> Permitted after visit
          </div>
          <div className="analytics-chip" style={{ background: '#ccfbf1', color: '#0f766e' }}>
            <span className="analytics-chip__num">{summary.renewedAfter}</span> Renewed after visit
          </div>
          <div className="analytics-chip" style={{ background: '#fef3c7', color: '#92400e' }}>
            <span className="analytics-chip__num">{summary.renewalPending}</span> Renewal pending
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
                <th>Visit Type</th>
                <th>Type of Undertaking</th>
                <th>Sector</th>
                <th>District</th>
                <th>First Visit</th>
                <th>Reported</th>
                <th>Permit Outcome</th>
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
                      <td>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {v.visitTypes.map((t) => (
                            <span key={t} className="record-badge" style={{ ...VISIT_TYPE_COLORS[t], fontSize: 10 }}>
                              {VISIT_TYPE_LABEL[t] ?? t}
                            </span>
                          ))}
                        </div>
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
                        <span className="record-badge" style={PERMIT_OUTCOME_COLORS[v.permitOutcome]}>
                          {PERMIT_OUTCOME_LABEL[v.permitOutcome]}
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
