import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Search, AlertCircle, Download, Plus, LayoutGrid, Table2, Trash2 } from 'lucide-react'
import { getCrossRecords, buildFacilityMap } from '../firebase/dashboard'
import { deleteSubRecord } from '../firebase/subrecords'
import { fmtDate, permitStatus } from '../utils/records'
import {
  SECTOR_COLORS, ENFORCEMENT_ACTIONS, COMPLIANCE_STATUS, FIELD_ROLES, ADMIN_ROLES,
  PAYMENT_TYPES, SECTORS, DISTRICTS,
} from '../data/constants'
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
          {record.permit_number ? ` · Permit: ${record.permit_number}` : ''}
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

function sectorLabel(prefix) {
  const sector = SECTORS.find((s) => s.prefix === prefix)
  return sector ? `${sector.name} (${sector.prefix})` : (prefix || 'Unknown')
}

function districtLabel(code) {
  return DISTRICTS.find((d) => d.code === code)?.name ?? code ?? 'Unknown'
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
      headers: ['File No.', 'Facility', 'Sector', 'Date', 'Payment Type', 'Amount', 'Currency', 'Payment Status', 'Permit Number', 'Reference', 'Notes'],
      row: (r) => [r.fileNumber, r.facilityName, r.sectorPrefix, fmt(r.date), r.payment_type, r.amount, r.currency, (r.payment_status ?? 'paid') === 'unpaid' ? 'Unpaid' : 'Paid', r.permit_number, r.reference_number, r.notes],
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
  const [actionError, setActionError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter]       = useState(location.state?.statusFilter ?? '')
  const [officerFilter, setOfficerFilter]     = useState(location.state?.officerUid ?? '')
  const [paymentTypeFilter, setPaymentTypeFilter]     = useState(location.state?.paymentType ?? '')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState(location.state?.paymentStatus ?? '')
  const [sectorFilter, setSectorFilter] = useState(location.state?.sectorPrefix ?? '')
  const [districtFilter, setDistrictFilter] = useState(location.state?.district ?? '')
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('finance-view') ?? 'cards')
  const [dateFrom, setDateFrom]           = useState('')
  const [dateTo, setDateTo]               = useState('')
  const [permitDateField, setPermitDateField] = useState('expiry_date')
  const [selectedKeys, setSelectedKeys] = useState([])
  const [deletingSelected, setDeletingSelected] = useState(false)

  // Re-sync filters on every navigation (handles same-route re-navigation)
  useEffect(() => {
    setStatusFilter(location.state?.statusFilter ?? '')
    setOfficerFilter(location.state?.officerUid ?? '')
    setPaymentTypeFilter(location.state?.paymentType ?? '')
    setPaymentStatusFilter(location.state?.paymentStatus ?? '')
    setSectorFilter(location.state?.sectorPrefix ?? '')
    setDistrictFilter(location.state?.district ?? '')
    setDateFrom('')
    setDateTo('')
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
    if (sectorFilter && collection === 'finance') {
      result = result.filter((r) => r.sectorPrefix === sectorFilter)
    }
    if (districtFilter && collection === 'finance') {
      result = result.filter((r) => r.facilityDistrict === districtFilter)
    }
    if (dateFrom || dateTo) {
      const getRecordDate = (r) => {
        const raw = collection === 'permits' ? r[permitDateField] : r.date
        if (!raw) return null
        const ts = raw?.toDate ? raw.toDate() : new Date(raw)
        return isNaN(ts) ? null : ts
      }
      const from = dateFrom ? new Date(dateFrom) : null
      const to   = dateTo   ? new Date(dateTo + 'T23:59:59') : null
      result = result.filter((r) => {
        const d = getRecordDate(r)
        if (!d) return false
        if (from && d < from) return false
        if (to   && d > to)   return false
        return true
      })
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
  }, [records, search, statusFilter, officerFilter, paymentTypeFilter, paymentStatusFilter, sectorFilter, districtFilter, dateFrom, dateTo, permitDateField, collection])

  const financeTotals = useMemo(() => {
    if (collection !== 'finance') return null
    let total = 0, paid = 0, unpaid = 0
    const bySector = {}
    const byDistrict = {}
    filtered.forEach((r) => {
      const amount = Number(r.amount ?? 0)
      total += amount
      if ((r.payment_status ?? 'paid') === 'unpaid') {
        unpaid += amount
      } else {
        paid += amount
        const sectorKey = r.sectorPrefix || 'unknown'
        const districtKey = r.facilityDistrict || 'unknown'
        bySector[sectorKey] = (bySector[sectorKey] ?? 0) + amount
        byDistrict[districtKey] = (byDistrict[districtKey] ?? 0) + amount
      }
    })
    const topSector = Object.entries(bySector).sort((a, b) => b[1] - a[1])[0] ?? null
    const topDistrict = Object.entries(byDistrict).sort((a, b) => b[1] - a[1])[0] ?? null
    return { total, paid, unpaid, topSector, topDistrict }
  }, [filtered, collection])
  const canBulkManage = ADMIN_ROLES.has(staff?.role)
  const selectedKeySet = useMemo(() => new Set(selectedKeys), [selectedKeys])
  const visibleRecordKeys = filtered.map((r) => `${r.fileNumber}::${r.id}`)
  const allVisibleSelected = visibleRecordKeys.length > 0 && visibleRecordKeys.every((key) => selectedKeySet.has(key))

  function toggleRecordSelection(recordKey) {
    setSelectedKeys((prev) => (
      prev.includes(recordKey)
        ? prev.filter((key) => key !== recordKey)
        : [...prev, recordKey]
    ))
  }

  function toggleSelectAllVisible() {
    setSelectedKeys((prev) => {
      if (allVisibleSelected) {
        return prev.filter((key) => !visibleRecordKeys.includes(key))
      }
      return [...new Set([...prev, ...visibleRecordKeys])]
    })
  }

  function clearSelection() {
    setSelectedKeys([])
  }

  async function handleDeleteSelected() {
    if (selectedKeys.length === 0 || deletingSelected) return
    const label = selectedKeys.length === 1 ? 'record' : 'records'
    if (!window.confirm(`Delete ${selectedKeys.length} selected ${label} from ${config.label}? This cannot be undone.`)) return

    setDeletingSelected(true)
    setActionError('')

    const selectedRecords = records.filter((record) => selectedKeySet.has(`${record.fileNumber}::${record.id}`))
    const results = await Promise.allSettled(
      selectedRecords.map((record) => deleteSubRecord(record.fileNumber, collection, record.id))
    )
    const deletedKeys = selectedRecords
      .filter((_, index) => results[index].status === 'fulfilled')
      .map((record) => `${record.fileNumber}::${record.id}`)
    const failedCount = results.length - deletedKeys.length

    if (deletedKeys.length > 0) {
      setRecords((prev) => prev.filter((record) => !deletedKeys.includes(`${record.fileNumber}::${record.id}`)))
      setSelectedKeys((prev) => prev.filter((key) => !deletedKeys.includes(key)))
    }

    if (failedCount > 0) {
      setActionError(`Deleted ${deletedKeys.length} ${label}, but ${failedCount} failed. Please try again.`)
    }

    setDeletingSelected(false)
  }

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
                disabled={selectedKeys.length === 0 || deletingSelected}
              >
                Clear ({selectedKeys.length})
              </button>
              <button
                className="btn btn--ghost btn--danger"
                onClick={handleDeleteSelected}
                disabled={selectedKeys.length === 0 || deletingSelected}
              >
                <Trash2 size={14} /> {deletingSelected ? 'Deleting…' : `Delete Selected (${selectedKeys.length})`}
              </button>
            </>
          )}
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

      {canBulkManage && filtered.length > 0 && (
        <div className="bulk-actions-bar">
          <span className="bulk-actions-bar__hint">Admin bulk actions are enabled. Use the checkboxes below to select records.</span>
          <label className="bulk-actions-bar__checkbox">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleSelectAllVisible}
            />
            <span>Select all visible</span>
          </label>
          <span className="bulk-actions-bar__count">{selectedKeys.length} selected</span>
          <button
            className="btn btn--ghost btn--xs"
            onClick={clearSelection}
            disabled={selectedKeys.length === 0 || deletingSelected}
          >
            Clear
          </button>
          <button
            className="btn btn--ghost btn--xs btn--danger"
            onClick={handleDeleteSelected}
            disabled={selectedKeys.length === 0 || deletingSelected}
          >
            <Trash2 size={13} /> {deletingSelected ? 'Deleting…' : 'Delete Selected'}
          </button>
        </div>
      )}

      {/* Search + filters */}
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
        {collection === 'permits' && (
          <select
            className="filter-select"
            value={permitDateField}
            onChange={(e) => setPermitDateField(e.target.value)}
          >
            <option value="expiry_date">Expiry Date</option>
            <option value="issue_date">Issue Date</option>
            <option value="effective_date">Effective Date</option>
          </select>
        )}
        <input
          type="date"
          className="filter-select"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          title="From date"
          style={{ width: 140 }}
        />
        <input
          type="date"
          className="filter-select"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          title="To date"
          style={{ width: 140 }}
        />
        {collection === 'finance' && (
          <>
            <select
              className="filter-select"
              value={paymentTypeFilter}
              onChange={(e) => setPaymentTypeFilter(e.target.value)}
            >
              <option value="">All Types</option>
              {PAYMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select
              className="filter-select"
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
            </select>
            <select
              className="filter-select"
              value={sectorFilter}
              onChange={(e) => setSectorFilter(e.target.value)}
            >
              <option value="">All Sectors</option>
              {SECTORS.map((s) => (
                <option key={s.prefix} value={s.prefix}>{s.name} ({s.prefix})</option>
              ))}
            </select>
            <select
              className="filter-select"
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
            >
              <option value="">All Districts</option>
              {DISTRICTS.map((d) => (
                <option key={d.code} value={d.code}>{d.name}</option>
              ))}
            </select>
            <div className="view-toggle">
              <button
                className={`view-toggle__btn${viewMode === 'cards' ? ' view-toggle__btn--active' : ''}`}
                onClick={() => { setViewMode('cards'); localStorage.setItem('finance-view', 'cards') }}
                title="Card view"
              >
                <LayoutGrid size={15} />
              </button>
              <button
                className={`view-toggle__btn${viewMode === 'table' ? ' view-toggle__btn--active' : ''}`}
                onClick={() => { setViewMode('table'); localStorage.setItem('finance-view', 'table') }}
                title="Table view"
              >
                <Table2 size={15} />
              </button>
            </div>
          </>
        )}
      </div>

      {(officerFilter || (collection === 'permits' && statusFilter) || paymentTypeFilter || paymentStatusFilter || sectorFilter || districtFilter || dateFrom || dateTo) && (
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
          {sectorFilter && (
            <span className="filter-pill">
              Sector: {sectorLabel(sectorFilter)}
              <button onClick={() => setSectorFilter('')}>✕</button>
            </span>
          )}
          {districtFilter && (
            <span className="filter-pill">
              District: {districtLabel(districtFilter)}
              <button onClick={() => setDistrictFilter('')}>✕</button>
            </span>
          )}
          {(dateFrom || dateTo) && (
            <span className="filter-pill">
              {collection === 'permits' && (
                <span style={{ opacity: 0.7 }}>
                  {{ expiry_date: 'Expiry', issue_date: 'Issue', effective_date: 'Effective' }[permitDateField]}:&nbsp;
                </span>
              )}
              {dateFrom && dateTo ? `${dateFrom} → ${dateTo}` : dateFrom ? `From ${dateFrom}` : `Until ${dateTo}`}
              <button onClick={() => { setDateFrom(''); setDateTo('') }}>✕</button>
            </span>
          )}
        </div>
      )}

      {/* Finance totals summary */}
      {!loading && financeTotals && filtered.length > 0 && (
        <div className="finance-totals-bar">
          <div className="finance-totals-bar__item">
            <span className="finance-totals-bar__label">Records</span>
            <span className="finance-totals-bar__value">{filtered.length}</span>
          </div>
          <div className="finance-totals-bar__item finance-totals-bar__item--total">
            <span className="finance-totals-bar__label">Total</span>
            <span className="finance-totals-bar__value">
              GH¢ {financeTotals.total.toLocaleString('en-GH', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="finance-totals-bar__item finance-totals-bar__item--paid">
            <span className="finance-totals-bar__label">Paid</span>
            <span className="finance-totals-bar__value">
              GH¢ {financeTotals.paid.toLocaleString('en-GH', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="finance-totals-bar__item finance-totals-bar__item--unpaid">
            <span className="finance-totals-bar__label">Unpaid</span>
            <span className="finance-totals-bar__value">
              GH¢ {financeTotals.unpaid.toLocaleString('en-GH', { minimumFractionDigits: 2 })}
            </span>
          </div>
          {financeTotals.topSector && (
            <div className="finance-totals-bar__item">
              <span className="finance-totals-bar__label">Top Sector</span>
              <span className="finance-totals-bar__value">
                {sectorLabel(financeTotals.topSector[0])}
              </span>
              <span className="finance-totals-bar__label">
                GH¢ {financeTotals.topSector[1].toLocaleString('en-GH', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
          {financeTotals.topDistrict && (
            <div className="finance-totals-bar__item">
              <span className="finance-totals-bar__label">Top District</span>
              <span className="finance-totals-bar__value">
                {districtLabel(financeTotals.topDistrict[0])}
              </span>
              <span className="finance-totals-bar__label">
                GH¢ {financeTotals.topDistrict[1].toLocaleString('en-GH', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
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
          {records.length === 0
            ? `No ${config.label.toLowerCase()} recorded across any facility yet.`
            : 'No records match your search.'}
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        collection === 'finance' && viewMode === 'table' ? (
          <div className="facility-table-wrap">
            <table className="facility-table">
              <thead>
                <tr>
                  {canBulkManage && (
                    <th style={{ width: 42 }}>
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleSelectAllVisible}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </th>
                  )}
                  <th>File No.</th>
                  <th>Facility</th>
                  <th>Sector</th>
                  <th>District</th>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Permit</th>
                  <th style={{ textAlign: 'right' }}>Amount (GHS)</th>
                  <th>Status</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const isPaid = (r.payment_status ?? 'paid') !== 'unpaid'
                  const colors = SECTOR_COLORS[r.sectorPrefix] ?? { bg: '#f3f4f6', text: '#374151' }
                  const recordKey = `${r.fileNumber}::${r.id}`
                  return (
                    <tr
                      key={`${r.fileNumber}-${r.id}`}
                      className={`facility-table__row${selectedKeySet.has(recordKey) ? ' facility-table__row--selected' : ''}`}
                      onClick={() => navigate(`/facilities/${r.fileNumber}`, { state: { tab: config.tab } })}
                    >
                      {canBulkManage && (
                        <td onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedKeySet.has(recordKey)}
                            onChange={() => toggleRecordSelection(recordKey)}
                          />
                        </td>
                      )}
                      <td className="facility-table__fileno">{r.fileNumber}</td>
                      <td className="facility-table__name">{r.facilityName}</td>
                      <td>
                        <span className="record-badge" style={{ background: colors.bg, color: colors.text, fontSize: 10 }}>
                          {r.sectorPrefix}
                        </span>
                      </td>
                      <td style={{ color: '#6b7280' }}>{districtLabel(r.facilityDistrict)}</td>
                      <td>{fmtDate(r.date)}</td>
                      <td>{r.payment_type || '—'}</td>
                      <td style={{ color: '#6b7280' }}>{r.permit_number || '—'}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {Number(r.amount ?? 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}
                      </td>
                      <td>
                        <span
                          className="record-badge"
                          style={isPaid ? { background: '#dcfce7', color: '#166534' } : { background: '#fef9c3', color: '#854d0e' }}
                        >
                          {isPaid ? 'Paid' : 'Unpaid'}
                        </span>
                      </td>
                      <td style={{ color: '#6b7280' }}>{r.reference_number || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="cross-record-list">
            {filtered.map((r) => {
              const colors = SECTOR_COLORS[r.sectorPrefix] ?? { bg: '#f3f4f6', text: '#374151' }
              const recordKey = `${r.fileNumber}::${r.id}`
              return (
                <div
                  key={`${r.fileNumber}-${r.id}`}
                  className={`cross-record-item${selectedKeySet.has(recordKey) ? ' cross-record-item--selected' : ''}`}
                  onClick={() =>
                    navigate(`/facilities/${r.fileNumber}`, { state: { tab: config.tab } })
                  }
                >
                  <div className="cross-record__topbar">
                    {canBulkManage && (
                      <label className="bulk-card-checkbox bulk-card-checkbox--header" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedKeySet.has(recordKey)}
                          onChange={() => toggleRecordSelection(recordKey)}
                        />
                        <span>Select</span>
                      </label>
                    )}
                  </div>
                  <div className="cross-record__facility">
                    <span className="file-num" style={{ fontSize: 12 }}>{r.fileNumber}</span>
                    <span className="cross-record__facility-name">{r.facilityName}</span>
                    <span
                      className="record-badge"
                      style={{ background: colors.bg, color: colors.text, fontSize: 10 }}
                    >
                      {r.sectorPrefix}
                    </span>
                    {r.facilityDistrict && (
                      <span className="record-badge" style={{ background: '#f3f4f6', color: '#4b5563', fontSize: 10 }}>
                        {districtLabel(r.facilityDistrict)}
                      </span>
                    )}
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
        )
      )}
    </div>
  )
}
