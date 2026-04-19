import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Search, AlertCircle } from 'lucide-react'
import { getCrossRecords, buildFacilityMap } from '../firebase/dashboard'
import { fmtDate, permitStatus } from '../utils/records'
import { SECTOR_COLORS, ENFORCEMENT_ACTIONS, COMPLIANCE_STATUS } from '../data/constants'
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
  if (category === 'finance' && record.payment_type) {
    return <span className="record-badge" style={{ bg: '#f0fdf4', color: '#166534' }}>{record.payment_type}</span>
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

export default function CrossRecordsPage() {
  const { module } = useParams()
  const navigate = useNavigate()

  const collection = URL_TO_COLLECTION[module] ?? module
  const config = CATEGORY_CONFIG[collection]

  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

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
      } catch {
        setError(`Failed to load ${config?.label ?? 'records'}.`)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [collection, config])

  const filtered = useMemo(() => {
    if (!search.trim()) return records
    const q = search.toLowerCase()
    return records.filter(
      (r) =>
        r.facilityName?.toLowerCase().includes(q) ||
        r.fileNumber?.toLowerCase().includes(q) ||
        (r.permit_number && r.permit_number.toLowerCase().includes(q)) ||
        (r.officer_name && r.officer_name.toLowerCase().includes(q))
    )
  }, [records, search])

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
