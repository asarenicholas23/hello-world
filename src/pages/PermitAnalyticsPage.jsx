import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, Search, Filter } from 'lucide-react'
import { getCrossRecords, buildFacilityMap } from '../firebase/dashboard'
import { fmtDate, permitStatus } from '../utils/records'
import { SECTORS, DISTRICTS, SECTOR_COLORS, ENFORCEMENT_ACTIONS } from '../data/constants'
import Spinner from '../components/Spinner'

const EXPIRY_WINDOWS = [
  { value: '',    label: 'All permits' },
  { value: '30',  label: 'Expiring in 30 days' },
  { value: '60',  label: 'Expiring in 60 days' },
  { value: '90',  label: 'Expiring in 3 months' },
  { value: '180', label: 'Expiring in 6 months' },
  { value: 'expired', label: 'Already expired' },
]

const STATUS_COLORS = {
  active:   { bg: '#dcfce7', color: '#166534' },
  expiring: { bg: '#fef9c3', color: '#854d0e' },
  expired:  { bg: '#fee2e2', color: '#991b1b' },
}
const STATUS_LABELS = { active: 'Active', expiring: 'Expiring', expired: 'Expired' }

function esc(v) { return `"${String(v ?? '').replace(/"/g, '""')}"` }

function toCSV(rows) {
  const fmt = (ts) => { try { return fmtDate(ts) } catch { return '' } }
  const headers = ['File No.', 'Facility', 'Sector', 'District', 'Type of Undertaking',
    'Permit Number', 'Issue Date', 'Effective Date', 'Expiry Date', 'Status', 'Notes']
  const lines = [
    headers.map(esc).join(','),
    ...rows.map((r) => [
      r.fileNumber, r.facilityName, r.facilitySector, r.facilityDistrict,
      r.facilityUndertaking, r.permit_number,
      fmt(r.issue_date), fmt(r.effective_date), fmt(r.expiry_date),
      STATUS_LABELS[permitStatus(r.expiry_date)] ?? '',
      r.notes,
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

export default function PermitAnalyticsPage() {
  const navigate = useNavigate()

  const [permits, setPermits]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')

  // Filters
  const [search,       setSearch]       = useState('')
  const [sector,       setSector]       = useState('')
  const [district,     setDistrict]     = useState('')
  const [expiryWindow, setExpiryWindow] = useState('')
  const [issuedFrom,   setIssuedFrom]   = useState('')
  const [issuedTo,     setIssuedTo]     = useState('')

  useEffect(() => {
    async function load() {
      try {
        const facilityMap = await buildFacilityMap()
        const recs = await getCrossRecords('permits', facilityMap)
        setPermits(recs)
      } catch (err) {
        setError(`Failed to load permits: ${err.message}`)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    const now   = Date.now()
    const fromMs = issuedFrom ? new Date(issuedFrom).getTime() : null
    const toMs   = issuedTo   ? new Date(issuedTo).getTime() + 86_400_000 : null

    return permits.filter((r) => {
      // Sector filter
      if (sector && r.sectorPrefix !== sector) return false

      // District filter
      if (district && r.facilityDistrict !== district) return false

      // Issued date range
      if (fromMs || toMs) {
        const issuedMs = r.issue_date?.toMillis?.() ?? null
        if (!issuedMs) return false
        if (fromMs && issuedMs < fromMs) return false
        if (toMs   && issuedMs > toMs)   return false
      }

      // Expiry window
      if (expiryWindow) {
        const expiryMs = r.expiry_date?.toMillis?.() ?? null
        if (!expiryMs) return false
        if (expiryWindow === 'expired') {
          if (expiryMs >= now) return false
        } else {
          const windowMs = now + parseInt(expiryWindow, 10) * 86_400_000
          if (expiryMs < now || expiryMs > windowMs) return false
        }
      }

      // Text search
      if (search.trim()) {
        const q = search.toLowerCase()
        return (
          r.facilityName?.toLowerCase().includes(q) ||
          r.fileNumber?.toLowerCase().includes(q) ||
          r.permit_number?.toLowerCase().includes(q) ||
          r.facilityDistrict?.toLowerCase().includes(q)
        )
      }

      return true
    })
  }, [permits, sector, district, expiryWindow, issuedFrom, issuedTo, search])

  // Summary counts from filtered set
  const summary = useMemo(() => {
    const now = Date.now()
    const in60 = now + 60 * 86_400_000
    let active = 0, expiring = 0, expired = 0
    filtered.forEach((r) => {
      const ms = r.expiry_date?.toMillis?.() ?? null
      if (!ms) return
      if (ms < now) expired++
      else if (ms < in60) expiring++
      else active++
    })
    return { active, expiring, expired }
  }, [filtered])

  const hasFilter = sector || district || expiryWindow || issuedFrom || issuedTo || search

  return (
    <div className="page">
      <button className="btn btn--ghost btn--sm btn--back" onClick={() => navigate('/')}>
        <ArrowLeft size={14} /> Dashboard
      </button>

      <div className="page-header" style={{ marginTop: 12 }}>
        <div>
          <div className="page-title">Permit Analytics</div>
          <div className="page-subtitle">
            {loading ? 'Loading…' : `${filtered.length} of ${permits.length} permits`}
          </div>
        </div>
        {!loading && filtered.length > 0 && (
          <button
            className="btn btn--ghost"
            onClick={() => downloadCSV(toCSV(filtered), `epa-permits-${new Date().toISOString().slice(0,10)}.csv`)}
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
              onClick={() => { setSector(''); setDistrict(''); setExpiryWindow(''); setIssuedFrom(''); setIssuedTo(''); setSearch('') }}
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
            <label>Expiry window</label>
            <select className="select" value={expiryWindow} onChange={(e) => setExpiryWindow(e.target.value)}>
              {EXPIRY_WINDOWS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>Issued from</label>
            <input className="input" type="date" value={issuedFrom} onChange={(e) => setIssuedFrom(e.target.value)} />
          </div>

          <div className="form-group">
            <label>Issued to</label>
            <input className="input" type="date" value={issuedTo} onChange={(e) => setIssuedTo(e.target.value)} />
          </div>

          <div className="form-group">
            <label>Search</label>
            <div className="search-box">
              <Search size={14} className="search-icon" />
              <input
                className="search-input"
                placeholder="Facility, file no., permit no.…"
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
          <div className="analytics-chip" style={{ background: '#dcfce7', color: '#166534' }}>
            <span className="analytics-chip__num">{summary.active}</span> Active
          </div>
          <div className="analytics-chip" style={{ background: '#fef9c3', color: '#854d0e' }}>
            <span className="analytics-chip__num">{summary.expiring}</span> Expiring ≤60d
          </div>
          <div className="analytics-chip" style={{ background: '#fee2e2', color: '#991b1b' }}>
            <span className="analytics-chip__num">{summary.expired}</span> Expired
          </div>
        </div>
      )}

      {loading && <Spinner />}
      {error  && <div className="login-error" style={{ marginTop: 12 }}>{error}</div>}

      {!loading && !error && filtered.length === 0 && (
        <div className="empty-state">No permits match your filters.</div>
      )}

      {/* ── Results table ── */}
      {!loading && !error && filtered.length > 0 && (
        <div className="analytics-table-wrap">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>File No.</th>
                <th>Facility</th>
                <th>Sector</th>
                <th>District</th>
                <th>Permit No.</th>
                <th>Issued</th>
                <th>Expires</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const s = permitStatus(r.expiry_date)
                const colors = SECTOR_COLORS[r.sectorPrefix] ?? { bg: '#f3f4f6', text: '#374151' }
                const district = DISTRICTS.find((d) => d.code === r.facilityDistrict)
                return (
                  <tr
                    key={`${r.fileNumber}-${r.id}`}
                    className="analytics-table__row"
                    onClick={() => navigate(`/facilities/${r.fileNumber}`, { state: { tab: 'permits' } })}
                  >
                    <td><span className="file-num" style={{ fontSize: 12 }}>{r.fileNumber}</span></td>
                    <td className="analytics-table__name">{r.facilityName}</td>
                    <td>
                      <span className="record-badge" style={{ background: colors.bg, color: colors.text, fontSize: 10 }}>
                        {r.sectorPrefix}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: '#6b7280' }}>{district?.name ?? r.facilityDistrict}</td>
                    <td style={{ fontSize: 12 }}>{r.permit_number}</td>
                    <td style={{ fontSize: 12, color: '#6b7280' }}>{fmtDate(r.issue_date)}</td>
                    <td style={{ fontSize: 12, color: '#6b7280' }}>{fmtDate(r.expiry_date)}</td>
                    <td>
                      {s && (
                        <span className="record-badge" style={STATUS_COLORS[s]}>
                          {STATUS_LABELS[s]}
                        </span>
                      )}
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
