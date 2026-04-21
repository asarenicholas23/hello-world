import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Search, AlertCircle, Download, Plus } from 'lucide-react'
import { getCrossRecords, buildFacilityMap } from '../firebase/dashboard'
import { fmtDate, permitStatus } from '../utils/records'
import { SECTOR_COLORS, ENFORCEMENT_ACTIONS, COMPLIANCE_STATUS, FIELD_ROLES, ADMIN_ROLES } from '../data/constants'
import Spinner from '../components/Spinner'

// ── Per-category configuration ──────────────────────────

const STATUS_COLORS = {
  active:   { bg: '#dcfce7', color: '#166534' },
  expiring: { bg: '#fef9c3', color: '#854d0e' },
  expired:  { bg: '#fee2e2', color: '#991b1b' },
}
const STATUS_LABELS = { active: 'Active', expiring: 'Expiring Soon', expired: 'Expired' }

const COMPLIANCE_COLORS = {
  compliant:     { bg: '#dcfce7', color: '#166534' },
  partial:       { bg: '#fef9c3', color: '#854d0e' },
  non_compliant: { bg: '#fee2e2', color: '#991b1b' },
}
const ACTION_COLORS = {
  warning: { bg: '#fef9c3', color: '#854d0e' },
  notice:  { bg: '#fff7ed', color: '#9a3412' },
  fine:    { bg: '#fef2f2', color: '#991b1b' },
  closure: { bg: '#fee2e2', color: '#7f1d1d' },
  other:   { bg: '#f3f4f6', color: '#374151' },
}

function RecordBadge({ record, category }) {
  if (category === 'permits') {
    const s = permitStatus(record.expiry_date)
    if (!s) return null
    return <span className="record-badge" style={STATUS_COLORS[s]}>{STATUS_LABELS[s]}</span>
  }
  if (category === 'monitoring' && record.compliance_status) {
    const cc = COMPLIANCE_COLORS[record.compliance_status]
    const label = COMPLIANCE_STATUS.find((s) => s.value === record.compliance_status)?.label
    return cc ? <span className="record-badge" style={cc}>{label}</span> : null
  }
  if (category === 'enforcement' && record.action_taken) {
    const ac = ACTION_COLORS[record.action_taken] ?? ACTION_COLORS.other
    const label = ENFORCEMENT_ACTIONS.find((a) => a.value === record.action_taken)?.label
    return <span className="record-badge" style={ac}>{label}</span>
  }
  if (category === 'finance') {
    const isPaid = (record.payment_status ?? 'paid') !== 'unpaid'
    return (
      <>
        {record.payment_type && (
          <span className="record-badge" style={{ background: '#f0fdf4', color: '#166534' }}>{record.payment_type}</span>
        )}
        <span className="record-badge" style={isPaid ? { background: '#dcfce7', color: '#166534' } : { background: '#fef9c3', color: '#854d0e' }}>
          {isPaid ? 'Paid' : 'Unpaid'}
        </span>
      </>
    )
  }
  return null
}

function RecordSummary({ record, category }) {
  if (category === 'permits') {
    return (
      <>
        <span className="cross-record__primary">{record.permit_number}</span>
        <span className="cross-record__meta">
          Issued: {fmtDate(record.issue_date)} · Expires: {fmtDate(record.expiry_date)}
        </span>
      </>
    )
  }
  if (category === 'finance') {
    return (
      <>
        <span className="cross-record__primary">
          {record.currency} {Number(record.amount ?? 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}
        </span>
        <span className="cross-record__meta">
          {record.payment_type} · {fmtDate(record.date)}
          {record.reference_number ? ` · Ref: ${record.reference_number}` : ''}
        </span>
      </>
    )
  }
  if (category === 'screenings') {
    return (
      <>
        <span className="cross-record__primary">Screening — {fmtDate(record.date)}</span>
        <span className="cross-record__meta">
          Officer: {record.officer_name || '—'}
          {record.photos?.length ? ` · ${record.photos.length} photo${record.photos.length !== 1 ? 's' : ''}` : ''}
        </span>
      </>
    )
  }
  if (category === 'site_verifications') {
    return (
      <>
        <span className="cross-record__primary">Site Verification — {fmtDate(record.date)}</span>
        <span className="cross-record__meta">Officer: {record.officer_name || '—'}</span>
      </>
    )
  }
  if (category === 'monitoring') {
    const items = record.checklist ? Object.values(record.checklist) : []
    const ok = items.filter((v) => v.ok).length
    return (
      <>
        <span className="cross-record__primary">Monitoring Visit — {fmtDate(record.date)}</span>
        <span className="cross-record__meta">
          Officer: {record.officer_name || '—'}
          {items.length > 0 ? ` · ${ok}/${items.length} items OK` : ''}
        </span>
      </>
    )
  }
  if (category === 'enforcement') {
    return (
      <>
        <span className="cross-record__primary">Enforcement — {fmtDate(record.date)}</span>
        <span className="cross-record__meta">
          Officer: {record.officer_name || '—'}
          {record.follow_up_date ? ` · Follow-up: ${fmtDate(record.follow_up_date)}` : ''}
        </span>
      </>
    )
  }
  return null
}

const CATEGORY_CONFIG = {
  permits:            { label: 'Permits',           tab: 'permits',            editPath: 'permits' },
  finance:            { label: 'Finance',           tab: 'finance',            editPath: 'finance' },
  screenings:         { label: 'Screening',         tab: 'screenings',         editPath: 'screenings' },
  site_verifications: { label: 'Site Verifications',tab: 'site_verifications', editPath: 'site-verifications' },
  monitoring:         { label: 'Monitoring',        tab: 'monitoring',         editPath: 'monitoring' },
  enforcement:        { label: 'Enforcement',       tab: 'enforcement',        editPath: 'enforcement' },
}

// Map URL segments to Firestore collection names
const URL_TO_COLLECTION = {
  permits:             'permits',
  finance:             'finance',
  screening:           'screenings',
  'site-verifications':'site_verifications',
  monitoring:          'monitoring',
  enforcement:         'enforcement',
}

function toCSV(rows, category) {
  const fmt = (ts) => {
    if (!ts) return ''
    try { return fmtDate(ts) } catch { return '' }
  }
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`

  const SCHEMAS = {
    permits: {
      headers: ['File No.', 'Entity Name', 'Sector', 'Type of Undertaking', 'Location', 'District', 'Contact Person', 'Designation', 'Phone', 'Email', 'Permit Number', 'Issue Date', 'Effective Date', 'Expiry Date', 'Issue Location', 'Status', 'Notes'],
      row: (r) => [r.fileNumber, r.facilityName, r.facilitySector, r.facilityUndertaking, r.facilityLocation, r.facilityDistrict, r.facilityContact, r.facilityDesignation, r.facilityPhone, r.facilityEmail, r.permit_number, fmt(r.issue_date), fmt(r.effective_date), fmt(r.expiry_date), r.issue_location, STATUS_LABELS[permitStatus(r.expiry_date)] ?? '', r.notes],
    },
    finance: {
      headers: ['File No.', 'Facility', 'Sector', 'Date', 'Payment Type', 'Amount', 'Currency', 'Reference', 'Notes'],
      row: (r) => [r.fileNumber, r.facilityName, r.sectorPrefix, fmt(r.date), r.payment_type, r.amount, r.currency, r.reference_number, r.notes],
    },
    screenings: {
      headers: ['File No.', 'Facility', 'Sector', 'Date', 'Officer', 'Notes'],
      row: (r) => [r.fileNumber, r.facilityName, r.sectorPrefix, fmt(r.date), r.officer_name, r.notes],
    },
    site_verifications: {
      headers: ['File No.', 'Facility', 'Sector', 'Date', 'Officer', 'Notes'],
      row: (r) => [r.fileNumber, r.facilityName, r.sectorPrefix, fmt(r.date), r.officer_name, r.notes],
    },
    monitoring: {
      headers: ['File No.', 'Facility', 'Sector', 'Date', 'Officer', 'Compliance Status', 'Notes'],
      row: (r) => [r.fileNumber, r.facilityName, r.sectorPrefix, fmt(r.date), r.officer_name, COMPLIANCE_STATUS.find((s) => s.value === r.compliance_status)?.label ?? r.compliance_status, r.notes],
    },
    enforcement: {
      headers: ['File No.', 'Facility', 'Sector', 'Date', 'Action', 'Officer', 'Follow-up Date', 'Notes'],
      row: (r) => [r.fileNumber, r.facilityName, r.sectorPrefix, fmt(r.date), ENFORCEMENT_ACTIONS.find((a) => a.value === r.action_taken)?.label ?? r.action_taken, r.officer_name, fmt(r.follow_up_date), r.notes],
    },
  }

  const schema = SCHEMAS[category] ?? SCHEMAS.screenings
  const lines = [
    schema.headers.map(esc).join(','),
    ...rows.map((r) => schema.row(r).map(esc).join(',')),
  ]
  return lines.join('\n')
}

function downloadCSV(content, filename) {
  const blob = new Blob([content], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function CrossRecordsPage() {
  const { module } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { staff } = useAuth()

  const collection = URL_TO_COLLECTION[module] ?? module
  const config = CATEGORY_CONFIG[collection]

  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter]       = useState(location.state?.statusFilter ?? '')
  const [officerFilter, setOfficerFilter]     = useState(location.state?.officerUid ?? '')
  const [paymentTypeFilter, setPaymentTypeFilter]     = useState(location.state?.paymentType ?? '')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState(location.state?.paymentStatus ?? '')

  // Re-sync filters on every navigation (handles same-route re-navigation)
  useEffect(() => {
    setStatusFilter(location.state?.statusFilter ?? '')
    setOfficerFilter(location.state?.officerUid ?? '')
    setPaymentTypeFilter(location.state?.paymentType ?? '')
    setPaymentStatusFilter(location.state?.paymentStatus ?? '')
  }, [location.key])

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const facilityMap = await buildFacilityMap()
        const recs = await getCrossRecords(collection, facilityMap)
        // Sort newest first (by created_at or date)
        recs.sort((a, b) => {
          const aTs = a.created_at?.toMillis?.() ?? a.date?.toMillis?.() ?? 0
          const bTs = b.created_at?.toMillis?.() ?? b.date?.toMillis?.() ?? 0
          return bTs - aTs
        })
        setRecords(recs)
      } catch (err) {
        console.error('CrossRecordsPage load error:', err)
        setError(`Failed to load ${config?.label ?? 'records'}: ${err.message}`)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [collection, config])

  const filtered = useMemo(() => {
    let result = records
    if (officerFilter) {
      result = collection === 'permits'
        ? result.filter((r) => r.facilityOfficer === officerFilter)
        : result.filter((r) => r.created_by === officerFilter)
    }
    if (statusFilter && collection === 'permits') {
      result = result.filter((r) => permitStatus(r.expiry_date) === statusFilter)
    }
    if (paymentTypeFilter && collection === 'finance') {
      result = result.filter((r) => r.payment_type === paymentTypeFilter)
    }
    if (paymentStatusFilter && collection === 'finance') {
      result = result.filter((r) => (r.payment_status ?? 'paid') === paymentStatusFilter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (r) =>
          r.facilityName?.toLowerCase().includes(q) ||
          r.fileNumber?.toLowerCase().includes(q) ||
          (r.permit_number && r.permit_number.toLowerCase().includes(q)) ||
          (r.officer_name && r.officer_name.toLowerCase().includes(q))
      )
    }
    return result
  }, [records, search, statusFilter, officerFilter, paymentTypeFilter, paymentStatusFilter, collection])

  if (!config) return <div className="page"><div className="empty-state">Unknown module.</div></div>

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">{config.label}</div>
          <div className="page-subtitle">
            {loading ? 'Loading…' : `${filtered.length} of ${records.length} records across all facilities`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {collection === 'enforcement' && (ADMIN_ROLES.has(staff?.role) || FIELD_ROLES.has(staff?.role)) && (
            <button className="btn btn--primary" onClick={() => navigate('/field-reports/new')}>
              <Plus size={14} /> Field Report
            </button>
          )}
          {!loading && filtered.length > 0 && (
            <button
              className="btn btn--ghost"
              onClick={() => downloadCSV(toCSV(filtered, collection), `epa-${collection}-${new Date().toISOString().slice(0,10)}.csv`)}
            >
              <Download size={14} /> Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="filter-bar">
        <div className="search-box" style={{ flex: 1 }}>
          <Search size={15} className="search-icon" />
          <input
            className="search-input"
            placeholder="Search by facility, file number, officer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {(officerFilter || (collection === 'permits' && statusFilter) || paymentTypeFilter || paymentStatusFilter) && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
          {officerFilter && (
            <span className="filter-pill">
              Showing: your records only
              <button onClick={() => setOfficerFilter('')}>✕</button>
            </span>
          )}
          {collection === 'permits' && statusFilter && (
            <span className="filter-pill">
              Status: {STATUS_LABELS[statusFilter]}
              <button onClick={() => setStatusFilter('')}>✕</button>
            </span>
          )}
          {paymentTypeFilter && (
            <span className="filter-pill">
              Type: {paymentTypeFilter}
              <button onClick={() => setPaymentTypeFilter('')}>✕</button>
            </span>
          )}
          {paymentStatusFilter && (
            <span className="filter-pill">
              {paymentStatusFilter === 'unpaid' ? 'Unpaid / Outstanding' : 'Paid'}
              <button onClick={() => setPaymentStatusFilter('')}>✕</button>
            </span>
          )}
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
          {records.length === 0
            ? `No ${config.label.toLowerCase()} recorded across any facility yet.`
            : 'No records match your search.'}
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="cross-record-list">
          {filtered.map((r) => {
            const colors = SECTOR_COLORS[r.sectorPrefix] ?? { bg: '#f3f4f6', text: '#374151' }
            return (
              <div
                key={`${r.fileNumber}-${r.id}`}
                className="cross-record-item"
                onClick={() =>
                  navigate(`/facilities/${r.fileNumber}`, { state: { tab: config.tab } })
                }
              >
                <div className="cross-record__facility">
                  <span className="file-num" style={{ fontSize: 12 }}>{r.fileNumber}</span>
                  <span className="cross-record__facility-name">{r.facilityName}</span>
                  <span
                    className="record-badge"
                    style={{ background: colors.bg, color: colors.text, fontSize: 10 }}
                  >
                    {r.sectorPrefix}
                  </span>
                </div>
                <div className="cross-record__body">
                  <div className="cross-record__content">
                    <RecordSummary record={r} category={collection} />
                    {r.notes && <span className="cross-record__note">{r.notes}</span>}
                  </div>
                  <RecordBadge record={r} category={collection} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
