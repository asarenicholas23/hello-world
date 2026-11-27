import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import {
  ArrowLeft, Banknote, BookOpen, Building2, CalendarDays, Download, FileText,
  Gavel, Plus, RefreshCw, Search, ShieldCheck, TrendingUp, WalletCards,
} from 'lucide-react'
import { buildFacilityMap, getCrossRecords } from '../firebase/dashboard'
import { listEnvEducation } from '../firebase/envEducation'
import { listFieldReports } from '../firebase/fieldReports'
import { buildVisitRows } from './VisitReportsPage'
import {
  COMPLIANCE_STATUS, DISTRICTS, ENFORCEMENT_ACTIONS,
  PAYMENT_TYPES, SECTOR_COLORS, SECTORS,
} from '../data/constants'
import { useAuth } from '../context/AuthContext'
import { facilityPath } from '../utils/fileNumbers'
import { fmtDate, permitStatus } from '../utils/records'
import Spinner from '../components/Spinner'
import { buildCapacityIndex } from '../utils/capacity'
import { buildFeeContext, buildRevenueForecast, SOURCE_NAMES } from '../utils/revenueForecast'

const TABS = [
  { key: 'finance', label: 'Finance', icon: Banknote, route: '/finance' },
  { key: 'permits', label: 'Permits', icon: FileText, route: '/permits' },
  { key: 'enforcement', label: 'Enforcement', icon: Gavel, route: '/enforcement' },
  { key: 'education', label: 'Education', icon: BookOpen, route: '/env-education' },
  { key: 'monitoring', label: 'Monitoring', icon: ShieldCheck, route: '/monitoring' },
]

const PERIODS = [
  { value: 'all', label: 'All' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
]

const FINANCE_MODES = [
  { value: 'forecast', label: 'Forecast' },
  { value: 'historical', label: 'Historical' },
]

const STATUS_LABELS = { active: 'Active', expiring: 'Expiring', expired: 'Expired' }
const STREAM_LABELS = { renewal: 'Renewals due', backlog: 'Backlog', unpaid: 'Unpaid invoices', new: 'New applications' }
const PALETTE = ['#111827', '#737373', '#0891b2', '#16a34a', '#d97706', '#7c3aed', '#be123c']
const ANALYTICS_LOAD_TIMEOUT_MS = 18000

function tsToMs(ts) {
  if (!ts) return null
  if (typeof ts.toMillis === 'function') return ts.toMillis()
  if (ts._seconds != null) return ts._seconds * 1000
  if (ts.seconds != null) return ts.seconds * 1000
  const parsed = new Date(ts).getTime()
  return Number.isNaN(parsed) ? null : parsed
}

function inputToStartMs(value) {
  return value ? new Date(`${value}T00:00:00`).getTime() : null
}

function inputToEndMs(value) {
  return value ? new Date(`${value}T23:59:59`).getTime() : null
}

function dateInput(ms) {
  return ms ? new Date(ms).toISOString().slice(0, 10) : ''
}

function getPeriodRange(period) {
  const now = new Date()
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  if (period === 'month') return { from: new Date(now.getFullYear(), now.getMonth(), 1).getTime(), to: end.getTime() }
  if (period === 'quarter') {
    const q = Math.floor(now.getMonth() / 3)
    return { from: new Date(now.getFullYear(), q * 3, 1).getTime(), to: end.getTime() }
  }
  if (period === 'year') return { from: new Date(now.getFullYear(), 0, 1).getTime(), to: end.getTime() }
  return { from: null, to: null }
}

function getFuturePeriodRange(period) {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const to = new Date(from)
  if (period === 'month') to.setMonth(to.getMonth() + 1)
  else if (period === 'quarter') to.setMonth(to.getMonth() + 3)
  else if (period === 'year') to.setFullYear(to.getFullYear() + 1)
  else return { from: null, to: null }
  to.setHours(23, 59, 59, 999)
  return { from: from.getTime(), to: to.getTime() }
}

function currency(amount) {
  return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS', maximumFractionDigits: 0 }).format(Number(amount) || 0)
}

function compactCurrency(amount) {
  const value = Number(amount) || 0
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `GH¢${(value / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')}M`
  if (abs >= 1_000) return `GH¢${(value / 1_000).toFixed(abs >= 10_000 ? 0 : 1).replace(/\.0$/, '')}K`
  return currency(value)
}

function pct(n, d) {
  return d ? `${Math.round((n / d) * 100)}%` : '0%'
}

function esc(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

function sectorLabel(prefix) {
  return SECTORS.find((s) => s.prefix === prefix)?.name ?? prefix ?? 'Unknown'
}

function districtLabel(code) {
  return DISTRICTS.find((d) => d.code === code)?.name ?? code ?? 'Unknown'
}

const PERMIT_OUTCOME_LABELS = {
  enforcement_issued: 'Enforcement → issued/renewed',
  walk_in_issued: 'Walk-in → issued/renewed',
  enforcement_renewed: 'Enforcement → renewed',
  walk_in_renewed: 'Walk-in → renewed',
}

function describeExtraFilter(extraFilter) {
  if (!extraFilter) return ''
  const { field, value } = extraFilter
  if (field === 'statusFilter') return `Status: ${STATUS_LABELS[value] ?? value}`
  if (field === 'actionFilter') return `Action: ${ENFORCEMENT_ACTIONS.find((a) => a.value === value)?.label ?? value ?? 'Other'}`
  if (field === 'complianceFilter') return `Compliance: ${COMPLIANCE_STATUS.find((c) => c.value === value)?.label ?? value ?? 'Unknown'}`
  if (field === 'typeFilter') return `Type: ${value}`
  if (field === 'paymentType') return `Payment type: ${value}`
  if (field === 'visitType') return `Visit type: ${value === 'walk_in' ? 'Walk-in' : 'Enforcement'}`
  if (field === 'permitOutcome') return `Outcome: ${PERMIT_OUTCOME_LABELS[value] ?? value}`
  if (field === 'stream') return `Forecast: ${STREAM_LABELS[value] ?? value}`
  return `${field}: ${value}`
}

function paymentStatus(record) {
  return (record.payment_status ?? 'paid') === 'unpaid' ? 'unpaid' : 'paid'
}

function withTimeout(promise, label) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = window.setTimeout(() => reject(new Error(`${label} timed out`)), ANALYTICS_LOAD_TIMEOUT_MS)
  })
  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timer))
}

function recordDateMs(record, tab) {
  if (tab === 'finance') return tsToMs(record.date) ?? tsToMs(record.created_at)
  if (tab === 'permits') return tsToMs(record.issue_date) ?? tsToMs(record.effective_date) ?? tsToMs(record.created_at)
  return tsToMs(record.date) ?? tsToMs(record.created_at)
}

function currentPermitPerFacility(records) {
  const rank = { active: 3, expiring: 2, expired: 1 }
  const best = new Map()
  for (const record of records) {
    const status = permitStatus(record.expiry_date) ?? 'active'
    const recency = tsToMs(record.issue_date) ?? tsToMs(record.effective_date) ?? 0
    const existing = best.get(record.fileNumber)
    if (!existing || (rank[status] ?? 0) > (rank[existing.currentStatus] ?? 0) || ((rank[status] ?? 0) === (rank[existing.currentStatus] ?? 0) && recency > existing.recency)) {
      best.set(record.fileNumber, { ...record, currentStatus: status, recency })
    }
  }
  return Array.from(best.values())
}

function group(rows, keyFn, valueFn = () => 1) {
  const map = new Map()
  rows.forEach((row) => {
    const item = keyFn(row)
    const key = typeof item === 'object' ? item.key : item
    const label = typeof item === 'object' ? item.label : item
    const existing = map.get(key || 'unknown') ?? { key: key || 'unknown', name: label || 'Unknown', value: 0 }
    existing.value += valueFn(row)
    map.set(existing.key, existing)
  })
  return Array.from(map.values()).sort((a, b) => b.value - a.value)
}

function financeCsv(rows) {
  const headers = ['Facility', 'File No.', 'Sector', 'District', 'Payment Type', 'Payment Status', 'Amount', 'Currency', 'Date', 'Permit No.']
  return [
    headers.map(esc).join(','),
    ...rows.map((r) => [
      r.facilityName, r.fileNumber, sectorLabel(r.sectorPrefix), districtLabel(r.facilityDistrict),
      r.payment_type, paymentStatus(r), r.amount, r.currency ?? 'GHS', fmtDate(r.date), r.permit_number,
    ].map(esc).join(',')),
  ].join('\n')
}

function forecastCsv(rows) {
  const headers = ['Facility', 'File No.', 'Sector', 'District', 'Type of Undertaking', 'Stream', 'Permit Expiry', 'Permit No.',
    'Processing Fee', 'Permit Fee', 'Penalty', 'Estimated Total', 'Estimate Basis', 'Act 1080 Line', 'Act 1080 Total', 'Capacity Used']
  return [
    headers.map(esc).join(','),
    ...rows.map((r) => [
      r.facilityName,
      r.fileNumber,
      sectorLabel(r.sectorPrefix),
      districtLabel(r.facilityDistrict),
      r.typeOfUndertaking,
      STREAM_LABELS[r.stream] ?? r.stream,
      r.expiryMs ? fmtDate(new Date(r.expiryMs)) : '',
      r.permitNumber,
      r.processing,
      r.permit,
      r.penalty,
      r.total,
      r.sourceLabel,
      r.act ? `${r.act.lineId} ${r.act.lineLabel}` : '',
      r.act?.total ?? '',
      (r.act?.parts ?? []).filter((x) => x.qty).map((x) => `${x.qty.value} ${x.qty.unit.replace(/_/g, ' ')} (${x.qty.source})`).join('; '),
    ].map(esc).join(',')),
  ].join('\n')
}

function exportAnalyticsCsv(activeTab, financeMode, analytics, rows) {
  if (activeTab === 'finance' && financeMode === 'forecast') return forecastCsv(analytics.exportRows ?? [])
  if (activeTab === 'finance') return financeCsv(analytics.exportRows ?? rows)
  return genericCsv(activeTab, analytics.exportRows ?? rows)
}

function download(content, filename, type = 'text/plain') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function AnalyticsDashboardPage() {
  const navigate = useNavigate()
  const { role } = useAuth()
  const canView = role === 'it'

  const [facilities, setFacilities] = useState([])
  const [records, setRecords] = useState({ finance: [], permits: [], enforcement: [], education: [], monitoring: [], walkIns: [], enforcementVisits: [], visitOutcomes: [], screenings: [], siteVerifications: [], feeTable: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [warnings, setWarnings] = useState([])

  const [activeTab, setActiveTab] = useState('finance')
  const [financeMode, setFinanceMode] = useState('forecast')
  const [period, setPeriod] = useState('year')
  const initialRange = useMemo(() => getFuturePeriodRange('year'), [])
  const [dateFrom, setDateFrom] = useState(dateInput(initialRange.from))
  const [dateTo, setDateTo] = useState(dateInput(initialRange.to))
  const [sector, setSector] = useState('')
  const [district, setDistrict] = useState('')
  const [search, setSearch] = useState('')
  const [extraFilter, setExtraFilter] = useState(null)
  const [includeBacklog, setIncludeBacklog] = useState(true)
  const [includePenalty, setIncludePenalty] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      setWarnings([])
      try {
        const facilityMap = await withTimeout(buildFacilityMap(), 'Facilities')
        const loaders = {
          finance: getCrossRecords('finance', facilityMap),
          permits: getCrossRecords('permits', facilityMap),
          enforcement: getCrossRecords('enforcement', facilityMap),
          monitoring: getCrossRecords('monitoring', facilityMap),
          screenings: getCrossRecords('screenings', facilityMap),
          siteVerifications: getCrossRecords('site_verifications', facilityMap),
          feeTable: import('../data/act1080Fees.json').then((m) => m.default),
          education: listEnvEducation(),
          walkIns: listFieldReports(),
          enforcementVisits: listFieldReports(),
          visitOutcomes: Promise.all([
            listFieldReports(),
            getCrossRecords('enforcement', facilityMap),
            getCrossRecords('permits', facilityMap),
          ]).then(([fieldReports, enforcement, permits]) => buildVisitRows({
            fieldReports,
            subrecordsByCategory: { enforcement },
            permits,
          })),
        }
        const settled = await Promise.allSettled(
          Object.entries(loaders).map(([key, promise]) => withTimeout(promise, key).then((value) => [key, value]))
        )
        if (cancelled) return
        const nextRecords = { finance: [], permits: [], enforcement: [], education: [], monitoring: [], walkIns: [], enforcementVisits: [], visitOutcomes: [], screenings: [], siteVerifications: [], feeTable: null }
        const nextWarnings = []
        settled.forEach((result) => {
          if (result.status === 'fulfilled') {
            const [key, value] = result.value
            nextRecords[key] = value
          } else {
            nextWarnings.push(result.reason?.message ?? 'A dataset could not be loaded')
          }
        })
        setFacilities(Object.values(facilityMap))
        setRecords(nextRecords)
        setWarnings(nextWarnings)
      } catch (err) {
        if (!cancelled) setError(`Failed to load analytics data: ${err.message}`)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    if (canView) load()
    return () => { cancelled = true }
  }, [canView])

  function applyPeriod(nextPeriod) {
    const nextRange = activeTab === 'finance' && financeMode === 'forecast'
      ? getFuturePeriodRange(nextPeriod)
      : getPeriodRange(nextPeriod)
    setPeriod(nextPeriod)
    setDateFrom(dateInput(nextRange.from))
    setDateTo(dateInput(nextRange.to))
  }

  function selectTab(nextTab) {
    const nextRange = nextTab === 'finance' ? getFuturePeriodRange('year') : getPeriodRange('year')
    setActiveTab(nextTab)
    setPeriod('year')
    setDateFrom(dateInput(nextRange.from))
    setDateTo(dateInput(nextRange.to))
    setSector('')
    setDistrict('')
    setExtraFilter(null)
  }

  function selectFinanceMode(nextMode) {
    const nextRange = nextMode === 'forecast' ? getFuturePeriodRange('year') : getPeriodRange('year')
    setFinanceMode(nextMode)
    setPeriod('year')
    setDateFrom(dateInput(nextRange.from))
    setDateTo(dateInput(nextRange.to))
    setExtraFilter(null)
  }

  const range = useMemo(() => ({
    from: inputToStartMs(dateFrom),
    to: inputToEndMs(dateTo),
  }), [dateFrom, dateTo])

  const currentPermits = useMemo(() => currentPermitPerFacility(records.permits), [records.permits])

  const walkInRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return records.walkIns.filter((record) => {
      if (record.report_type !== 'walk_in') return false
      if (sector && record.sector_prefix !== sector) return false
      if (district && record.district !== district) return false
      const ms = recordDateMs(record, 'walk_in')
      if (range.from != null && (!ms || ms < range.from)) return false
      if (range.to != null && (!ms || ms > range.to)) return false
      if (q && ![record.facility_name, record.location, record.district, record.sector_prefix]
        .some((value) => String(value ?? '').toLowerCase().includes(q))) return false
      return true
    })
  }, [records.walkIns, sector, district, search, range])

  const enforcementVisitRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return records.enforcementVisits.filter((record) => {
      if (record.report_type !== 'enforcement') return false
      if (sector && record.sector_prefix !== sector) return false
      if (district && record.district !== district) return false
      const ms = recordDateMs(record, 'enforcement')
      if (range.from != null && (!ms || ms < range.from)) return false
      if (range.to != null && (!ms || ms > range.to)) return false
      if (q && ![record.facility_name, record.location, record.district, record.sector_prefix]
        .some((value) => String(value ?? '').toLowerCase().includes(q))) return false
      return true
    })
  }, [records.enforcementVisits, sector, district, search, range])

  const scopedVisitOutcomes = useMemo(() => {
    const q = search.trim().toLowerCase()
    return records.visitOutcomes.filter((record) => {
      if (!record.visitTypes.includes('enforcement') && !record.visitTypes.includes('walk_in')) return false
      if (sector && record.sectorPrefix !== sector) return false
      if (district && record.district !== district) return false
      if (range.from != null && (record.firstVisitMs == null || record.firstVisitMs < range.from)) return false
      if (range.to != null && (record.firstVisitMs == null || record.firstVisitMs > range.to)) return false
      if (q && ![record.name, record.fileNumber, record.typeOfUndertaking]
        .some((value) => String(value ?? '').toLowerCase().includes(q))) return false
      return true
    })
  }, [records.visitOutcomes, sector, district, search, range])

  const filteredFacilities = useMemo(() => {
    const q = search.trim().toLowerCase()
    return facilities.filter((facility) => {
      if (sector && facility.sector_prefix !== sector) return false
      if (district && facility.district !== district) return false
      if (!q) return true
      return [facility.name, facility.file_number, facility.type_of_undertaking, facility.location]
        .some((value) => String(value ?? '').toLowerCase().includes(q))
    })
  }, [facilities, sector, district, search])

  const visibleFiles = useMemo(() => new Set(filteredFacilities.map((facility) => facility.file_number)), [filteredFacilities])

  const scopedPermitRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return records.permits.filter((record) => {
      if (!visibleFiles.has(record.fileNumber)) return false
      if (sector && record.sectorPrefix !== sector) return false
      if (district && record.facilityDistrict !== district) return false
      const ms = recordDateMs(record, 'permits')
      if (range.from != null && (!ms || ms < range.from)) return false
      if (range.to != null && (!ms || ms > range.to)) return false
      if (q && ![record.facilityName, record.fileNumber, record.facilityDistrict, record.permit_number]
        .some((value) => String(value ?? '').toLowerCase().includes(q))) return false
      return true
    })
  }, [records.permits, visibleFiles, sector, district, search, range])

  const domainRows = useMemo(() => {
    const rows = records[activeTab] ?? []
    const q = search.trim().toLowerCase()
    return rows.filter((record) => {
      if (activeTab !== 'education' && !visibleFiles.has(record.fileNumber)) return false
      if (activeTab === 'education') {
        if (district && record.district !== district) return false
        if (q && ![record.title, record.location, record.facilitator, record.target_group].some((value) => String(value ?? '').toLowerCase().includes(q))) return false
      }
      if (activeTab !== 'finance') {
        const ms = recordDateMs(record, activeTab)
        if (range.from != null && (!ms || ms < range.from)) return false
        if (range.to != null && (!ms || ms > range.to)) return false
      }
      return true
    })
  }, [records, activeTab, visibleFiles, district, search, range])

  // Cross-filter: clicking a bar/slice/list-row narrows every chart, KPI and
  // table on the page instead of navigating away. `extraFilter` holds the one
  // non sector/district selection active at a time (e.g. a permit status, an
  // enforcement action, a visit-outcome cohort) - it always resets on tab change.
  function filterKeyFor(dimension, key, extra = {}) {
    if (dimension === 'sector') return ['sector', key]
    if (dimension === 'district') return ['district', key]
    const { __route, dateFrom: _df, dateTo: _dt, sectorPrefix: _sp, district: _ds, permitDateField: _pdf, ...rest } = extra
    const entry = Object.entries(rest)[0]
    return entry ?? [dimension, key]
  }

  function handlePointClick(dimension, key, extra = {}) {
    if (dimension === 'facility' && key) {
      navigate(facilityPath(key), { state: { tab: activeTab === 'finance' ? 'finance' : 'permits' } })
      return
    }
    const [field, value] = filterKeyFor(dimension, key, extra)
    if (!field || value == null) return
    if (field === 'sector') { setSector((prev) => (prev === value ? '' : value)); return }
    if (field === 'district') { setDistrict((prev) => (prev === value ? '' : value)); return }
    setExtraFilter((prev) => (prev && prev.field === field && prev.value === value ? null : { field, value }))
  }

  function isSelected(dimension, key, extra = {}) {
    if (!key) return false
    const [field, value] = filterKeyFor(dimension, key, extra)
    if (field === 'sector') return sector === value
    if (field === 'district') return district === value
    return extraFilter?.field === field && extraFilter?.value === value
  }

  // Facilities visited under the enforcement/walk-in cohort the user clicked into
  // (only meaningful on the Enforcement tab, for the visitType / permitOutcome charts).
  const cohortFileNumbers = useMemo(() => {
    if (activeTab !== 'enforcement' || !extraFilter) return null
    if (extraFilter.field === 'visitType') {
      return new Set(scopedVisitOutcomes.filter((row) => row.visitTypes.includes(extraFilter.value)).map((row) => row.fileNumber))
    }
    if (extraFilter.field === 'permitOutcome') {
      const cohorts = {
        enforcement_issued: (row) => row.visitTypes.includes('enforcement') && row.permitOutcome === 'after_visit',
        walk_in_issued: (row) => row.visitTypes.includes('walk_in') && row.permitOutcome === 'after_visit',
        enforcement_renewed: (row) => row.visitTypes.includes('enforcement') && row.permitOutcome === 'renewed_after_visit',
        walk_in_renewed: (row) => row.visitTypes.includes('walk_in') && row.permitOutcome === 'renewed_after_visit',
      }
      const test = cohorts[extraFilter.value]
      return new Set(test ? scopedVisitOutcomes.filter(test).map((row) => row.fileNumber) : [])
    }
    return null
  }, [activeTab, extraFilter, scopedVisitOutcomes])

  const filteredDomainRows = useMemo(() => {
    if (!extraFilter && !cohortFileNumbers) return domainRows
    return domainRows.filter((row) => {
      if (activeTab === 'permits' && extraFilter?.field === 'statusFilter' && (permitStatus(row.expiry_date) ?? 'active') !== extraFilter.value) return false
      if (activeTab === 'enforcement' && extraFilter?.field === 'actionFilter' && (row.action_taken || 'other') !== extraFilter.value) return false
      if (activeTab === 'monitoring' && extraFilter?.field === 'complianceFilter' && (row.compliance_status || 'unknown') !== extraFilter.value) return false
      if (activeTab === 'education' && extraFilter?.field === 'typeFilter' && (row.type || 'Other') !== extraFilter.value) return false
      if (activeTab === 'finance' && extraFilter?.field === 'paymentType' && row.payment_type !== extraFilter.value) return false
      if (cohortFileNumbers && !cohortFileNumbers.has(row.fileNumber)) return false
      return true
    })
  }, [domainRows, activeTab, extraFilter, cohortFileNumbers])

  const filteredCurrentPermits = useMemo(() => {
    if (activeTab === 'permits' && extraFilter?.field === 'statusFilter') {
      return currentPermits.filter((row) => (permitStatus(row.expiry_date) ?? 'active') === extraFilter.value)
    }
    return currentPermits
  }, [currentPermits, activeTab, extraFilter])

  const filteredWalkInRows = useMemo(() => {
    if (!cohortFileNumbers) return walkInRows
    return walkInRows.filter((row) => cohortFileNumbers.has(walkInKey(row)))
  }, [walkInRows, cohortFileNumbers])

  const filteredEnforcementVisitRows = useMemo(() => {
    if (!cohortFileNumbers) return enforcementVisitRows
    return enforcementVisitRows.filter((row) => cohortFileNumbers.has(row.assigned_file_number))
  }, [enforcementVisitRows, cohortFileNumbers])

  const filteredVisitOutcomes = useMemo(() => {
    if (!cohortFileNumbers) return scopedVisitOutcomes
    return scopedVisitOutcomes.filter((row) => cohortFileNumbers.has(row.fileNumber))
  }, [scopedVisitOutcomes, cohortFileNumbers])

  // Fee context: capacities from screenings / site verifications, paid history and
  // the Act 1080 table. Built from all records so medians don't shift with filters.
  const feeCtx = useMemo(() => {
    if (!records.feeTable) return null
    const capacityIndex = buildCapacityIndex({
      screenings: records.screenings,
      siteVerifications: records.siteVerifications,
      fieldReports: records.walkIns,
    })
    return buildFeeContext({ feeTable: records.feeTable, facilities, finance: records.finance, capacityIndex })
  }, [records.feeTable, records.screenings, records.siteVerifications, records.walkIns, records.finance, facilities])

  const forecast = useMemo(() => {
    if (activeTab !== 'finance' || financeMode !== 'forecast' || !feeCtx) return null
    const result = buildRevenueForecast({
      facilities: filteredFacilities,
      permits: records.permits,
      finance: records.finance,
      ctx: feeCtx,
      range,
      includeBacklog,
      includePenalty,
    })
    const stream = extraFilter?.field === 'stream' ? extraFilter.value : null
    return { ...result, stream, viewRows: stream ? result.rows.filter((r) => r.stream === stream) : result.rows }
  }, [activeTab, financeMode, feeCtx, filteredFacilities, records.permits, records.finance, range, includeBacklog, includePenalty, extraFilter])

  const analytics = useMemo(
    () => buildAnalytics(activeTab, filteredDomainRows, filteredFacilities, filteredCurrentPermits, range, financeMode, filteredWalkInRows, scopedPermitRows, filteredEnforcementVisitRows, filteredVisitOutcomes, forecast, records.permits),
    [activeTab, filteredDomainRows, filteredFacilities, filteredCurrentPermits, range, financeMode, filteredWalkInRows, scopedPermitRows, filteredEnforcementVisitRows, filteredVisitOutcomes, forecast, records.permits]
  )

  if (!canView) {
    return <div className="empty-state">Analytics access is available to I.T accounts only.</div>
  }

  const dateLabel = dateFrom || dateTo
    ? `${dateFrom || 'Start'} - ${dateTo || 'Today'}`
    : 'All dates'

  return (
    <div className="analytics-studio">
      <div className="analytics-studio__header">
        <button className="analytics-back-btn" onClick={() => navigate('/')}>
          <ArrowLeft size={16} /> Dashboard
        </button>
        <button className="analytics-back-btn" onClick={() => navigate('/compliance')}>
          <ShieldCheck size={16} /> Compliance Scorecard
        </button>
        <div className="analytics-studio__search">
          <Search size={14} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search source data..." />
        </div>
      </div>

      <div className="analytics-tab-island">
        {TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <button key={tab.key} className={activeTab === tab.key ? 'is-active' : ''} onClick={() => selectTab(tab.key)}>
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {activeTab === 'finance' && (
        <div className="analytics-subtab-island">
          {FINANCE_MODES.map((mode) => (
            <button key={mode.value} className={financeMode === mode.value ? 'is-active' : ''} onClick={() => selectFinanceMode(mode.value)}>
              {mode.label}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'finance' && financeMode === 'forecast' && (
        <div className="forecast-toggles" role="group" aria-label="Forecast options">
          <label className={`forecast-toggle${includeBacklog ? ' is-on' : ''}`}>
            <input type="checkbox" checked={includeBacklog} onChange={(e) => setIncludeBacklog(e.target.checked)} />
            <span>Include backlog</span>
            <small>Expired permits and facilities with no permit</small>
          </label>
          <label className={`forecast-toggle${includePenalty ? ' is-on' : ''}${includeBacklog ? '' : ' is-disabled'}`}>
            <input type="checkbox" checked={includePenalty} disabled={!includeBacklog} onChange={(e) => setIncludePenalty(e.target.checked)} />
            <span>Add ×3 penalty to backlog</span>
            <small>3 × permit fee, for operating without a valid permit</small>
          </label>
        </div>
      )}

      <div className="analytics-studio__title-row">
        <div>
          <h1>{TABS.find((tab) => tab.key === activeTab)?.label} Analytics</h1>
          <p>{analytics.subtitle}</p>
        </div>
        <div className="analytics-studio__tools">
          <div className="period-tabs">
            {PERIODS.map((item) => (
              <button key={item.value} className={period === item.value ? 'is-active' : ''} onClick={() => applyPeriod(item.value)}>
                {activeTab === 'finance' && financeMode === 'forecast' && item.value !== 'all' ? `Next ${item.label}` : item.label}
              </button>
            ))}
          </div>
          <div className="date-chip"><CalendarDays size={14} /> {dateLabel}</div>
        </div>
      </div>

      <div className="analytics-studio__filters">
        <select value={sector} onChange={(e) => setSector(e.target.value)} disabled={activeTab === 'education'}>
          <option value="">All sectors</option>
          {SECTORS.map((item) => <option key={item.prefix} value={item.prefix}>{item.name}</option>)}
        </select>
        <select value={district} onChange={(e) => setDistrict(e.target.value)}>
          <option value="">All districts</option>
          {DISTRICTS.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={(e) => { setPeriod('custom'); setDateFrom(e.target.value) }} />
        <input type="date" value={dateTo} onChange={(e) => { setPeriod('custom'); setDateTo(e.target.value) }} />
        <button onClick={() => { setPeriod('all'); setDateFrom(''); setDateTo('') }}>Clear Dates</button>
        <button onClick={() => download(exportAnalyticsCsv(activeTab, financeMode, analytics, filteredDomainRows), `epa-${activeTab}-${financeMode ?? 'analytics'}-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv')}>
          <Download size={14} /> Export
        </button>
      </div>

      {(sector || district || extraFilter) && (
        <div className="analytics-crossfilter-bar">
          <span>Filtered by click:</span>
          {sector && (
            <span className="filter-pill">{sectorLabel(sector)}<button onClick={() => setSector('')}>✕</button></span>
          )}
          {district && (
            <span className="filter-pill">{districtLabel(district)}<button onClick={() => setDistrict('')}>✕</button></span>
          )}
          {extraFilter && (
            <span className="filter-pill">{describeExtraFilter(extraFilter)}<button onClick={() => setExtraFilter(null)}>✕</button></span>
          )}
          <button className="analytics-crossfilter-clear" onClick={() => { setSector(''); setDistrict(''); setExtraFilter(null) }}>Clear all</button>
        </div>
      )}

      {loading && <Spinner />}
      {error && <div className="login-error" style={{ marginTop: 12 }}>{error}</div>}
      {!loading && !error && warnings.length > 0 && (
        <div className="analytics-warning">
          Showing partial analytics. Could not load: {warnings.join(', ')}.
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="studio-kpis">
            {analytics.kpis.map((kpi, index) => (
              <StudioKpi key={kpi.label} featured={index === 0} icon={kpi.icon} label={kpi.label} value={kpi.value} note={kpi.note} />
            ))}
          </div>

          <div className="studio-main-grid">
            <ChartCard title={analytics.primary.title} action={analytics.primary.action}>
              <ResponsiveContainer width="100%" height={286}>
                <BarChart data={analytics.primary.data.slice(0, 8)}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={analytics.primary.formatAxis} allowDecimals={false} />
                  <Tooltip formatter={analytics.primary.formatTooltip} />
                  <Bar dataKey="value" radius={[12, 12, 0, 0]} onClick={(point) => handlePointClick(analytics.primary.dimension, point.key, analytics.primary.extraState?.(point) ?? {})}>
                    {analytics.primary.data.slice(0, 8).map((point, index) => {
                      const active = isSelected(analytics.primary.dimension, point.key, analytics.primary.extraState?.(point) ?? {})
                      const anySelected = analytics.primary.data.some((p) => isSelected(analytics.primary.dimension, p.key, analytics.primary.extraState?.(p) ?? {}))
                      return <Cell key={index} fill={active || (!anySelected && index === 0) ? '#111827' : '#8b8b8b'} opacity={anySelected && !active ? 0.35 : 1} cursor="pointer" />
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <section className="studio-card studio-card--answers">
              <CardHeader title="Key Answers" action="Live" />
              <div className="answer-stack">
                {analytics.answers.map((item) => (
                  <button className="answer-row" key={item.question} onClick={() => item.onClick?.(handlePointClick)}>
                    <span>{item.question}</span>
                    <strong>{item.answer}</strong>
                    {item.detail && <small>{item.detail}</small>}
                  </button>
                ))}
              </div>
              <div className="coverage-ring">
                <div className="coverage-ring__circle" style={{ background: `conic-gradient(#111827 0 ${analytics.ringValue}%, #e5e7eb ${analytics.ringValue}% 100%)` }}>{analytics.ringLabel}</div>
                <div>
                  <strong>{analytics.ringTitle}</strong>
                  <span>{analytics.ringNote}</span>
                </div>
              </div>
            </section>
          </div>

          <div className="studio-secondary-grid">
            <ChartCard title={analytics.secondary.title}>
              <ResponsiveContainer width="100%" height={230}>
                <PieChart>
                  <Pie data={analytics.secondary.data} dataKey="value" nameKey="name" innerRadius={48} outerRadius={82} onClick={(point) => handlePointClick(analytics.secondary.dimension, point.key, analytics.secondary.extraState?.(point) ?? {})}>
                    {analytics.secondary.data.map((point, index) => {
                      const active = isSelected(analytics.secondary.dimension, point.key, analytics.secondary.extraState?.(point) ?? {})
                      const anySelected = analytics.secondary.data.some((p) => isSelected(analytics.secondary.dimension, p.key, analytics.secondary.extraState?.(p) ?? {}))
                      return <Cell key={index} fill={PALETTE[index % PALETTE.length]} opacity={anySelected && !active ? 0.3 : 1} stroke={active ? '#111827' : 'none'} strokeWidth={active ? 2 : 0} cursor="pointer" />
                    })}
                  </Pie>
                  <Tooltip formatter={analytics.secondary.formatTooltip} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title={analytics.tertiary.title}>
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={analytics.tertiary.data.slice(0, 7)} layout="vertical" margin={{ left: 14 }}>
                  <XAxis type="number" tickFormatter={analytics.tertiary.formatAxis} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={108} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={analytics.tertiary.formatTooltip} />
                  <Bar dataKey="value" fill="#111827" radius={[0, 10, 10, 0]} onClick={(point) => handlePointClick(analytics.tertiary.dimension, point.key, analytics.tertiary.extraState?.(point) ?? {})} cursor="pointer">
                    {analytics.tertiary.data.slice(0, 7).map((point, index) => {
                      const active = isSelected(analytics.tertiary.dimension, point.key, analytics.tertiary.extraState?.(point) ?? {})
                      const anySelected = analytics.tertiary.data.slice(0, 7).some((p) => isSelected(analytics.tertiary.dimension, p.key, analytics.tertiary.extraState?.(p) ?? {}))
                      return <Cell key={index} fill="#111827" opacity={anySelected && !active ? 0.3 : 1} cursor="pointer" />
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <section className="studio-card">
              <CardHeader title={analytics.listTitle} />
              <div className="mini-list">
                {analytics.listRows.map((item) => (
                  <button
                    className={`mini-list__row${item.onClick && extraFilter?.value === item.key ? ' mini-list__row--active' : ''}`}
                    key={item.name}
                    onClick={() => item.onClick?.(handlePointClick)}
                  >
                    <span>{item.name}</span>
                    <strong>{item.valueLabel ?? item.value}</strong>
                  </button>
                ))}
              </div>
            </section>
            <section className="studio-card">
              <CardHeader title="Source Totals" />
              <div className="mini-list">
                {analytics.sourceTotals.map((item) => (
                  <div className="mini-list__row" key={item.name}>
                    <span>{item.name}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="studio-card studio-table-card">
            <CardHeader title={analytics.tableTitle} action="Click row to open source" />
            <div className="studio-table-wrap">
              <table className="studio-table">
                <thead>
                  <tr>{analytics.columns.map((col) => <th key={col}>{col}</th>)}</tr>
                </thead>
                <tbody>
                  {analytics.tableRows.map((row) => (
                    <tr key={row.key} onClick={() => row.onClick(navigate)}>
                      {row.cells.map((cell, index) => <td key={index}>{cell}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function buildAnalytics(tab, rows, facilities, currentPermits, range, financeMode, walkInRows, permitRows, enforcementVisitRows, visitOutcomes, forecast, allPermits = []) {
  if (tab === 'finance') return buildFinanceAnalytics(rows, facilities, currentPermits, range, financeMode, forecast)
  if (tab === 'permits') return buildPermitAnalytics(rows, facilities, currentPermits, allPermits)
  if (tab === 'enforcement') return buildEnforcementAnalytics(rows, currentPermits, walkInRows, permitRows, enforcementVisitRows, visitOutcomes)
  if (tab === 'education') return buildEducationAnalytics(rows)
  return buildMonitoringAnalytics(rows)
}

function filterFinanceByRange(rows, range) {
  return rows.filter((row) => {
    const ms = recordDateMs(row, 'finance')
    if (range.from != null && (!ms || ms < range.from)) return false
    if (range.to != null && (!ms || ms > range.to)) return false
    return true
  })
}

function buildFinanceAnalytics(rows, facilities, currentPermits, range, financeMode, forecast) {
  if (financeMode === 'historical') return buildHistoricalFinanceAnalytics(rows, facilities, currentPermits, range)
  return buildForecastFinanceAnalytics(forecast, facilities)
}

function emptyForecastAnalytics() {
  return {
    subtitle: 'Loading the Act 1080 fee table and field records...',
    kpis: [], answers: [],
    primary: chart('Forecast By District', '', [], 'district'),
    secondary: chart('Forecast By Stream', '', [], 'stream'),
    tertiary: chart('Highest Revenue Targets', '', [], 'facility'),
    listTitle: 'Estimate Basis', listRows: [], sourceTotals: [], exportRows: [],
    ringValue: 0, ringLabel: '0%', ringTitle: 'Backlog', ringNote: '',
    tableTitle: 'Revenue Targets', columns: [], tableRows: [],
  }
}

function buildForecastFinanceAnalytics(forecast, facilities) {
  if (!forecast) return emptyForecastAnalytics()
  const { streams, viewRows: rows, collectionRate } = forecast
  const ratePct = collectionRate != null ? Math.round(collectionRate * 100) : 100
  const total = (list) => list.reduce((sum, row) => sum + row.total, 0)
  const viewTotal = total(rows) + (!forecast.stream || forecast.stream === 'new' ? streams.new.total : 0)
  const backlogRows = forecast.rows.filter((row) => row.stream === 'backlog')
  const penaltyPotential = backlogRows.reduce((sum, row) => sum + row.permit, 0) * 3

  const byDistrict = group(rows, (row) => ({ key: row.facilityDistrict, label: districtLabel(row.facilityDistrict) }), (row) => row.total)
  const bySector = group(rows, (row) => ({ key: row.sectorPrefix, label: sectorLabel(row.sectorPrefix) }), (row) => row.total)
  const byFacility = group(rows, (row) => ({ key: row.fileNumber, label: row.facilityName }), (row) => row.total)
  const byStream = ['renewal', 'backlog', 'unpaid', 'new']
    .map((key) => ({ key, name: STREAM_LABELS[key], value: streams[key].total }))
    .filter((item) => item.value > 0)
  const bySource = group(rows, (row) => SOURCE_NAMES[row.source] ?? row.source)
  const streamState = (point) => ({ stream: point.key })

  return {
    subtitle: `Revenue the office can expect in the selected window: renewals due, ${streams.backlog.count ? 'the backlog of expired and unpermitted facilities, ' : ''}unpaid invoices and new applications. Estimates use what each facility paid before, else the Act 1080 fee for its type and capacity.`,
    kpis: [
      { icon: <TrendingUp size={18} />, label: 'Possible Revenue', value: compactCurrency(viewTotal), note: `${compactCurrency(viewTotal * ratePct / 100)} expected at the ${ratePct}% collection rate` },
      { icon: <FileText size={18} />, label: 'Renewals Due', value: compactCurrency(streams.renewal.total), note: `${streams.renewal.count} permits expire in the window` },
      { icon: <Gavel size={18} />, label: 'Backlog', value: compactCurrency(streams.backlog.total), note: streams.backlog.count ? `${streams.backlog.count} facilities${streams.backlog.penalty ? `, incl. ${compactCurrency(streams.backlog.penalty)} penalty` : ''}` : 'Turned off' },
      { icon: <WalletCards size={18} />, label: 'Unpaid + New', value: compactCurrency(streams.unpaid.total + streams.new.total), note: `${compactCurrency(streams.unpaid.total)} invoiced, ${compactCurrency(streams.new.total)} new (${streams.new.perMonth}/month)` },
    ],
    answers: [
      answer('Which district has the most revenue to collect?', byDistrict[0], currency, (drill) => drill('district', byDistrict[0]?.key)),
      answer('Which sector has the most revenue to collect?', bySector[0], currency, (drill) => drill('sector', bySector[0]?.key)),
      answer('Which facility is the highest-value target?', byFacility[0], currency, (drill) => drill('facility', byFacility[0]?.key)),
      {
        question: 'What would the ×3 penalty add to the backlog?',
        answer: backlogRows.length ? currency(penaltyPotential) : 'Backlog is turned off',
        detail: backlogRows.length ? `3 × permit fee for ${backlogRows.length} facilities${forecast.streams.backlog.penalty ? ' (included above)' : ' (not included above)'}` : '',
        onClick: null,
      },
    ],
    primary: chart('Revenue To Collect By District', 'Estimated total per facility', byDistrict, 'district', (v) => `${v / 1000}K`, (v) => currency(v)),
    secondary: chart('Forecast By Stream', '', byStream, 'stream', null, (v) => currency(v), streamState),
    tertiary: chart('Highest Revenue Targets', '', byFacility, 'facility', (v) => `${v / 1000}K`, (v) => currency(v)),
    listTitle: 'Estimate Basis',
    listRows: bySource.map((item) => ({ name: item.name, value: item.value, valueLabel: `${item.value} facilities` })),
    sourceTotals: [
      { name: 'Collection rate (paid ÷ billed)', value: `${ratePct}%` },
      { name: 'New applications', value: `${streams.new.count} at ${currency(streams.new.fee)}` },
      { name: 'Their Act 1080 value', value: currency(forecast.actCoverage.actTotal) },
      { name: 'Facilities with an Act 1080 line', value: forecast.actCoverage.facilities },
    ],
    exportRows: rows,
    ringValue: facilities.length ? Math.round((streams.backlog.count / facilities.length) * 100) : 0,
    ringLabel: pct(streams.backlog.count, facilities.length),
    ringTitle: 'Backlog',
    ringNote: `${streams.backlog.count} of ${facilities.length} facilities have an expired permit or none, with no payment since`,
    tableTitle: 'Revenue Targets',
    columns: ['Facility', 'File No.', 'Sector', 'Stream', 'Expiry', 'Estimate', 'Basis'],
    tableRows: [...rows].sort((a, b) => b.total - a.total).slice(0, 15).map((item) => ({
      key: `${item.stream}-${item.fileNumber}`,
      cells: [
        item.facilityName, fileBadge(item.fileNumber), sectorBadge(item.sectorPrefix),
        STREAM_LABELS[item.stream] + (item.backlogReason ? ` (${item.backlogReason})` : ''),
        item.expiryMs ? fmtDate(new Date(item.expiryMs)) : '—',
        currency(item.total) + (item.penalty ? ` incl. ${currency(item.penalty)} penalty` : ''),
        item.sourceLabel + (item.act?.qtyText ? ` · ${item.act.qtyText}` : item.act?.qty ? ` · ${item.act.qty.value} ${item.act.qty.unit.replace(/_/g, ' ')}` : ''),
      ],
      onClick: (navigate) => navigate(facilityPath(item.fileNumber), { state: { tab: 'finance' } }),
    })),
  }
}

function buildHistoricalFinanceAnalytics(rows, facilities, currentPermits, range) {
  const rangedRows = filterFinanceByRange(rows, range)
  const paid = rangedRows.filter((row) => paymentStatus(row) === 'paid')
  const unpaid = rangedRows.filter((row) => paymentStatus(row) === 'unpaid')
  const paidRevenue = paid.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
  const unpaidRevenue = unpaid.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
  const byDistrict = group(paid, (row) => ({ key: row.facilityDistrict, label: districtLabel(row.facilityDistrict) }), (row) => Number(row.amount) || 0)
  const bySector = group(paid, (row) => ({ key: row.sectorPrefix, label: sectorLabel(row.sectorPrefix) }), (row) => Number(row.amount) || 0)
  const byType = group(rangedRows, (row) => row.payment_type || 'Other', (row) => Number(row.amount) || 0)
  const facilityRevenue = group(paid, (row) => ({ key: row.fileNumber, label: row.facilityName }), (row) => Number(row.amount) || 0)
  const visibleFiles = new Set(facilities.map((facility) => facility.file_number))
  const facilitiesWithPermit = new Set(currentPermits.filter((permit) => visibleFiles.has(permit.fileNumber)).map((permit) => permit.fileNumber))

  return {
    subtitle: 'Historical revenue collected from finance records in the selected period',
    kpis: [
      { icon: <Banknote size={18} />, label: 'Paid Revenue', value: compactCurrency(paidRevenue), note: `${currency(unpaidRevenue)} outstanding` },
      { icon: <WalletCards size={18} />, label: 'Total Billed', value: compactCurrency(paidRevenue + unpaidRevenue), note: `${rangedRows.length} finance records` },
      { icon: <Building2 size={18} />, label: 'Facilities Paid', value: new Set(paid.map((row) => row.fileNumber)).size, note: `${facilities.length} facilities in scope` },
      { icon: <FileText size={18} />, label: 'Permit Coverage', value: pct(facilitiesWithPermit.size, facilities.length), note: `${facilitiesWithPermit.size} facilities permitted` },
    ],
    answers: [
      answer('Which district gave the most income?', byDistrict[0], currency, (drill) => drill('district', byDistrict[0]?.key)),
      answer('Which sector gave the most income?', bySector[0], currency, (drill) => drill('sector', bySector[0]?.key)),
      answer('Which facility gave the most income?', facilityRevenue[0], currency, (drill) => drill('facility', facilityRevenue[0]?.key)),
    ],
    primary: chart('Historical Income By District', 'Paid revenue', byDistrict, 'district', (v) => `${v / 1000}K`, (v) => currency(v)),
    secondary: chart('Historical Income By Sector', '', bySector, 'sector', null, (v) => currency(v)),
    tertiary: chart('Highest Income Facilities', '', facilityRevenue, 'facility', (v) => `${v / 1000}K`, (v) => currency(v)),
    listTitle: 'Payment Type Mix',
    listRows: PAYMENT_TYPES.map((type) => {
      const item = byType.find((row) => row.name === type)
      return { name: type, value: item?.value ?? 0, valueLabel: currency(item?.value ?? 0), onClick: (drill) => drill(null, null, { paymentType: type }) }
    }),
    sourceTotals: [
      { name: 'Paid records', value: paid.length },
      { name: 'Unpaid records', value: unpaid.length },
      { name: 'Paid revenue', value: currency(paidRevenue) },
      { name: 'Outstanding', value: currency(unpaidRevenue) },
    ],
    exportRows: rangedRows,
    ringValue: facilities.length ? Math.round((new Set(rangedRows.map((row) => row.fileNumber)).size / facilities.length) * 100) : 0,
    ringLabel: pct(new Set(rangedRows.map((row) => row.fileNumber)).size, facilities.length),
    ringTitle: 'Finance coverage',
    ringNote: `${new Set(rangedRows.map((row) => row.fileNumber)).size} of ${facilities.length} facilities`,
    tableTitle: 'Highest Income Facilities',
    columns: ['Facility', 'File No.', 'Sector', 'District', 'Revenue', 'Permit'],
    tableRows: facilityRevenue.slice(0, 10).map((item) => {
      const source = rangedRows.find((row) => row.fileNumber === item.key)
      const permit = currentPermits.find((row) => row.fileNumber === item.key)
      return {
        key: item.key,
        cells: [item.name, fileBadge(item.key), sectorBadge(source?.sectorPrefix), districtLabel(source?.facilityDistrict), currency(item.value), permit ? `${STATUS_LABELS[permit.currentStatus]} | ${fmtDate(permit.expiry_date)}` : 'No permit'],
        onClick: (navigate) => navigate(facilityPath(item.key), { state: { tab: 'finance' } }),
      }
    }),
  }
}

// A permit is a renewal when the facility already had a permit issued before it (from
// the facility's whole permit history, not only the selected period); otherwise it is new.
function classifyPermits(rows, allPermits) {
  const earliest = new Map()
  for (const p of allPermits) {
    const ms = recordDateMs(p, 'permits')
    if (ms == null) continue
    const list = earliest.get(p.fileNumber) ?? []
    list.push({ ms, id: p.id })
    earliest.set(p.fileNumber, list)
  }
  return rows.map((row) => {
    const ms = recordDateMs(row, 'permits')
    const history = earliest.get(row.fileNumber) ?? []
    const earlier = ms != null && history.some((h) => h.id !== row.id && h.ms < ms)
    return { ...row, permit_kind: earlier ? 'Renewal' : 'New' }
  })
}

function buildPermitAnalytics(periodRows, facilities, currentPermits, allPermits = []) {
  const rows = classifyPermits(periodRows, allPermits)
  const renewed = rows.filter((row) => row.permit_kind === 'Renewal').length
  const fresh = rows.length - renewed
  const visibleFiles = new Set(facilities.map((facility) => facility.file_number))
  const visibleCurrentPermits = currentPermits.filter((row) => visibleFiles.has(row.fileNumber))
  const byDistrict = group(rows, (row) => ({ key: row.facilityDistrict, label: districtLabel(row.facilityDistrict) }))
  const bySector = group(rows, (row) => ({ key: row.sectorPrefix, label: sectorLabel(row.sectorPrefix) }))
  const status = group(visibleCurrentPermits, (row) => permitStatus(row.expiry_date) ?? 'unknown')
  const permittedFacilities = new Set(visibleCurrentPermits.map((row) => row.fileNumber))

  return {
    subtitle: 'Permits issued in the period, new against renewed, and coverage',
    kpis: [
      { icon: <FileText size={18} />, label: 'Permits issued', value: rows.length, note: `${fresh} new · ${renewed} renewed` },
      { icon: <Plus size={18} />, label: 'New permits', value: fresh, note: `${pct(fresh, rows.length)} of issued · first permit for the facility` },
      { icon: <RefreshCw size={18} />, label: 'Renewals', value: renewed, note: `${pct(renewed, rows.length)} of issued · facility had an earlier permit` },
      { icon: <CalendarDays size={18} />, label: 'Expired', value: visibleCurrentPermits.filter((row) => permitStatus(row.expiry_date) === 'expired').length, note: 'need renewal attention' },
    ],
    answers: [
      answer('New or renewed: which is more of the period\'s permits?', { name: renewed >= fresh ? 'Renewals' : 'New permits', value: Math.max(renewed, fresh) }, (v) => `${v} of ${rows.length} permits`),
      answer('What share of facilities has a permit?', { name: pct(permittedFacilities.size, facilities.length), value: permittedFacilities.size }, (v) => `${v} facilities · ${facilities.length - permittedFacilities.size} without`),
      answer('Which district has the most permits?', byDistrict[0], (v) => `${v} permits`, (drill) => drill('district', byDistrict[0]?.key)),
      answer('Which sector has the most permits?', bySector[0], (v) => `${v} permits`, (drill) => drill('sector', bySector[0]?.key)),
      answer('How many facilities have at least one permit?', { name: `${permittedFacilities.size} facilities`, value: permittedFacilities.size }, (v) => `${v} total`),
    ],
    primary: chart('Permits By District', 'Permit count', byDistrict, 'district'),
    secondary: chart('Permits By Sector', '', bySector, 'sector'),
    tertiary: chart('Current Permit Status', '', status, 'status', null, (v) => `${v} facilities`, (point) => ({ statusFilter: point.key })),
    listTitle: 'Permit Status',
    listRows: status.map((item) => ({ ...item, valueLabel: `${item.value}`, onClick: (drill) => drill(null, null, { statusFilter: item.key }) })),
    sourceTotals: [
      { name: 'Permit records', value: rows.length },
      { name: 'New permits', value: fresh },
      { name: 'Renewals', value: renewed },
      { name: 'Active (current)', value: visibleCurrentPermits.filter((row) => permitStatus(row.expiry_date) === 'active').length },
      { name: 'Permitted facilities', value: permittedFacilities.size },
      { name: 'Facilities in scope', value: facilities.length },
      { name: 'Without permit', value: Math.max(facilities.length - permittedFacilities.size, 0) },
    ],
    exportRows: rows,
    ringValue: facilities.length ? Math.round((permittedFacilities.size / facilities.length) * 100) : 0,
    ringLabel: pct(permittedFacilities.size, facilities.length),
    ringTitle: 'Permit coverage',
    ringNote: `${permittedFacilities.size} of ${facilities.length} facilities`,
    tableTitle: 'Recent Permit Records',
    columns: ['Facility', 'File No.', 'Sector', 'District', 'Permit No.', 'Issued', 'Status'],
    tableRows: rows.slice().sort((a, b) => (recordDateMs(b, 'permits') ?? 0) - (recordDateMs(a, 'permits') ?? 0)).slice(0, 10).map((row) => ({
      key: `${row.fileNumber}-${row.id}`,
      cells: [row.facilityName, fileBadge(row.fileNumber), sectorBadge(row.sectorPrefix), districtLabel(row.facilityDistrict), row.permit_number || '-', fmtDate(row.issue_date), STATUS_LABELS[permitStatus(row.expiry_date)] ?? '-'],
      onClick: (navigate) => navigate(facilityPath(row.fileNumber), { state: { tab: 'permits' } }),
    })),
  }
}

function buildEnforcementAnalytics(rows, currentPermits, walkInRows, permitRows, enforcementVisitRows, visitOutcomes) {
  const enforcementFacilities = new Set(enforcementVisitRows.map((row) => row.assigned_file_number).filter(Boolean))
  const walkInFacilities = new Set(walkInRows.map((row) => walkInKey(row)))
  const outcomes = (visitType) => {
    const cohort = visitOutcomes.filter((row) => row.visitTypes.includes(visitType))
    return {
      facilities: cohort.length,
      issuance: cohort.filter((row) => row.permitOutcome === 'after_visit').length,
      renewal: cohort.filter((row) => row.permitOutcome === 'renewed_after_visit').length,
    }
  }
  const enforcementOutcome = outcomes('enforcement')
  const walkInOutcome = outcomes('walk_in')
  const byDistrict = group(rows, (row) => ({ key: row.facilityDistrict, label: districtLabel(row.facilityDistrict) }))
  const bySector = group(rows, (row) => ({ key: row.sectorPrefix, label: sectorLabel(row.sectorPrefix) }))
  const byAction = group(rows, (row) => ({ key: row.action_taken || 'other', label: ENFORCEMENT_ACTIONS.find((item) => item.value === row.action_taken)?.label ?? 'Other' }))
  const followUps = rows.filter((row) => row.follow_up_date)

  const result = sharedRecordAnalytics({
    subtitle: 'Facility outcomes after enforcement visits compared with walk-in and self-reporting cases',
    rows,
    byDistrict,
    bySector,
    byType: byAction,
    kpi1: { icon: <Gavel size={18} />, label: 'Enforcement Visits', value: enforcementVisitRows.length, note: `${enforcementFacilities.size} facilities visited` },
    kpi2: { icon: <Building2 size={18} />, label: 'Walk-in Facilities', value: walkInFacilities.size, note: 'walk-in / self-reporting cases' },
    primaryTitle: 'Enforcement By District',
    secondaryTitle: 'Enforcement By Sector',
    tertiaryTitle: 'Action Types',
    listTitle: 'Action Mix',
    rowLabel: 'Enforcement',
    routeTab: 'enforcement',
    columns: ['Facility', 'File No.', 'Sector', 'District', 'Action', 'Date'],
    rowCells: (row) => [row.facilityName, fileBadge(row.fileNumber), sectorBadge(row.sectorPrefix), districtLabel(row.facilityDistrict), ENFORCEMENT_ACTIONS.find((item) => item.value === row.action_taken)?.label ?? row.action_taken ?? '-', fmtDate(row.date)],
  })
  result.kpis[2] = { icon: <TrendingUp size={18} />, label: 'Visit Permit Rate', value: pct(enforcementOutcome.issuance, enforcementOutcome.facilities), note: `${enforcementOutcome.issuance} issued or renewed` }
  result.kpis[3] = { icon: <FileText size={18} />, label: 'Walk-in Permit Rate', value: pct(walkInOutcome.issuance, walkInFacilities.size), note: `${walkInOutcome.issuance} issued or renewed` }
  result.answers = [
    answer('What is the permit issuance rate after enforcement visits?', { name: pct(enforcementOutcome.issuance, enforcementOutcome.facilities), value: enforcementOutcome.issuance }, (v) => `${v} of ${enforcementOutcome.facilities} visited facilities`),
    answer('What is the permit renewal rate after enforcement visits?', { name: pct(enforcementOutcome.renewal, enforcementOutcome.facilities), value: enforcementOutcome.renewal }, (v) => `${v} facilities with multiple permit records`),
    answer('How do walk-ins compare?', { name: pct(walkInOutcome.issuance, walkInFacilities.size), value: walkInOutcome.issuance }, (v) => `${v} of ${walkInFacilities.size} walk-in facilities received a permit`),
  ]
  result.primary = chart('Facilities By Visit Type', 'Facility count', [
    { key: 'enforcement', name: 'Enforcement visits', value: enforcementVisitRows.length },
    { key: 'walk_in', name: 'Walk-ins', value: walkInFacilities.size },
  ], 'visitType')
  result.secondary = chart('Permit Outcomes By Cohort', 'Facility count', [
    { key: 'enforcement_issued', name: 'Enforcement issued/renewed', value: enforcementOutcome.issuance },
    { key: 'walk_in_issued', name: 'Walk-in issued/renewed', value: walkInOutcome.issuance },
    { key: 'enforcement_renewed', name: 'Enforcement renewed', value: enforcementOutcome.renewal },
    { key: 'walk_in_renewed', name: 'Walk-in renewed', value: walkInOutcome.renewal },
  ], 'permitOutcome', null, (v) => `${v} facilities`)
  result.ringValue = enforcementOutcome.facilities ? Math.round((enforcementOutcome.issuance / enforcementOutcome.facilities) * 100) : 0
  result.ringLabel = pct(enforcementOutcome.issuance, enforcementOutcome.facilities)
  result.ringTitle = 'Enforcement permit rate'
  result.ringNote = `${enforcementOutcome.issuance} of ${enforcementOutcome.facilities} visited facilities`
  result.sourceTotals = [
    { name: 'Actions taken', value: rows.length },
    { name: 'Enforcement visits', value: enforcementVisitRows.length },
    { name: 'Visited facilities', value: enforcementFacilities.size },
    { name: 'Walk-in facilities', value: walkInFacilities.size },
    { name: 'Visit renewals', value: enforcementOutcome.renewal },
    { name: 'Walk-in renewals', value: walkInOutcome.renewal },
    { name: 'Follow-up actions', value: followUps.length },
  ]
  result.tertiary.extraState = (point) => ({ actionFilter: point.key })
  result.listRows = result.listRows.map((item) => ({ ...item, onClick: (drill) => drill(null, null, { actionFilter: item.key }) }))
  return result
}

function walkInKey(row) {
  return row.assigned_file_number || `${String(row.facility_name ?? '').trim().toLowerCase()}::${row.district ?? ''}`
}

function buildMonitoringAnalytics(rows) {
  const byDistrict = group(rows, (row) => ({ key: row.facilityDistrict, label: districtLabel(row.facilityDistrict) }))
  const bySector = group(rows, (row) => ({ key: row.sectorPrefix, label: sectorLabel(row.sectorPrefix) }))
  const byCompliance = group(rows, (row) => ({ key: row.compliance_status || 'unknown', label: COMPLIANCE_STATUS.find((item) => item.value === row.compliance_status)?.label ?? 'Unknown' }))
  const compliant = rows.filter((row) => row.compliance_status === 'compliant').length

  const result = sharedRecordAnalytics({
    subtitle: 'Monitoring visits and compliance condition',
    rows,
    byDistrict,
    bySector,
    byType: byCompliance,
    kpi1: { icon: <ShieldCheck size={18} />, label: 'Monitoring Visits', value: rows.length, note: `${pct(compliant, rows.length)} compliant` },
    kpi2: { icon: <TrendingUp size={18} />, label: 'Compliant', value: compliant, note: 'records marked compliant' },
    primaryTitle: 'Monitoring By District',
    secondaryTitle: 'Monitoring By Sector',
    tertiaryTitle: 'Compliance Status',
    listTitle: 'Compliance Mix',
    rowLabel: 'Monitoring',
    routeTab: 'monitoring',
    columns: ['Facility', 'File No.', 'Sector', 'District', 'Compliance', 'Date'],
    rowCells: (row) => [row.facilityName, fileBadge(row.fileNumber), sectorBadge(row.sectorPrefix), districtLabel(row.facilityDistrict), COMPLIANCE_STATUS.find((item) => item.value === row.compliance_status)?.label ?? row.compliance_status ?? '-', fmtDate(row.date)],
  })
  result.tertiary.extraState = (point) => ({ complianceFilter: point.key })
  result.listRows = result.listRows.map((item) => ({ ...item, onClick: (drill) => drill(null, null, { complianceFilter: item.key }) }))
  return result
}

function buildEducationAnalytics(rows) {
  const byDistrict = group(rows, (row) => ({ key: row.district, label: districtLabel(row.district) }), (row) => Number(row.participants_count) || 0)
  const byType = group(rows, (row) => row.type || 'Other')
  const participants = rows.reduce((sum, row) => sum + (Number(row.participants_count) || 0), 0)

  return {
    subtitle: 'Environmental education sessions and participant reach',
    kpis: [
      { icon: <BookOpen size={18} />, label: 'Sessions', value: rows.length, note: `${participants} participants` },
      { icon: <TrendingUp size={18} />, label: 'Participants', value: participants, note: 'people reached' },
      { icon: <CalendarDays size={18} />, label: 'Avg Attendance', value: rows.length ? Math.round(participants / rows.length) : 0, note: 'participants per session' },
      { icon: <ShieldCheck size={18} />, label: 'Districts', value: new Set(rows.map((row) => row.district).filter(Boolean)).size, note: 'districts reached' },
    ],
    answers: [
      answer('Which district had the highest education reach?', byDistrict[0], (v) => `${v} participants`, (drill) => drill('district', byDistrict[0]?.key)),
      answer('Which education type was used most?', byType[0], (v) => `${v} sessions`, (drill) => drill(null, null, { typeFilter: byType[0]?.key })),
    ],
    primary: chart('Participants By District', 'Participant count', byDistrict, 'district'),
    secondary: chart('Session Type Mix', '', byType, 'type', null, (v) => `${v} sessions`, (point) => ({ typeFilter: point.key })),
    tertiary: chart('Sessions By Type', '', byType, 'type', null, (v) => `${v} sessions`, (point) => ({ typeFilter: point.key })),
    listTitle: 'Session Types',
    listRows: byType.map((item) => ({ ...item, valueLabel: `${item.value}`, onClick: (drill) => drill(null, null, { typeFilter: item.key }) })),
    sourceTotals: [
      { name: 'Sessions', value: rows.length },
      { name: 'Participants', value: participants },
      { name: 'Districts reached', value: new Set(rows.map((row) => row.district).filter(Boolean)).size },
      { name: 'Avg attendance', value: rows.length ? Math.round(participants / rows.length) : 0 },
    ],
    ringValue: rows.length ? Math.min(Math.round((participants / Math.max(rows.length * 50, 1)) * 100), 100) : 0,
    ringLabel: rows.length ? Math.round(participants / rows.length) : 0,
    ringTitle: 'Average attendance',
    ringNote: `${participants} participants over ${rows.length} sessions`,
    tableTitle: 'Recent Education Sessions',
    columns: ['Title', 'Type', 'District', 'Participants', 'Date'],
    tableRows: rows.slice().sort((a, b) => (recordDateMs(b, 'education') ?? 0) - (recordDateMs(a, 'education') ?? 0)).slice(0, 10).map((row) => ({
      key: row.id,
      cells: [row.title, row.type, districtLabel(row.district), Number(row.participants_count) || 0, fmtDate(row.date)],
      onClick: (navigate) => navigate(`/env-education/${row.id}/edit`),
    })),
  }
}

function sharedRecordAnalytics({ subtitle, rows, byDistrict, bySector, byType, kpi1, kpi2, primaryTitle, secondaryTitle, tertiaryTitle, listTitle, rowLabel, routeTab, columns, rowCells }) {
  return {
    subtitle,
    kpis: [
      kpi1,
      kpi2,
      { icon: <Building2 size={18} />, label: 'Districts', value: byDistrict.length, note: 'districts represented' },
      { icon: <FileText size={18} />, label: 'Top Sector', value: bySector[0]?.name ?? '-', note: `${bySector[0]?.value ?? 0} records` },
    ],
    answers: [
      answer(`Which district has the most ${rowLabel.toLowerCase()} records?`, byDistrict[0], (v) => `${v} records`, (drill) => drill('district', byDistrict[0]?.key)),
      answer(`Which sector has the most ${rowLabel.toLowerCase()} records?`, bySector[0], (v) => `${v} records`, (drill) => drill('sector', bySector[0]?.key)),
    ],
    primary: chart(primaryTitle, 'Record count', byDistrict, 'district'),
    secondary: chart(secondaryTitle, '', bySector, 'sector'),
    tertiary: chart(tertiaryTitle, '', byType, 'type'),
    listTitle,
    listRows: byType.map((item) => ({ ...item, valueLabel: `${item.value}` })),
    sourceTotals: [
      { name: 'Records', value: rows.length },
      { name: 'Districts', value: byDistrict.length },
      { name: 'Sectors', value: bySector.length },
      { name: 'Top district', value: byDistrict[0]?.name ?? '-' },
    ],
    ringValue: rows.length ? Math.min(byDistrict.length * 12, 100) : 0,
    ringLabel: byDistrict.length,
    ringTitle: 'District spread',
    ringNote: `${byDistrict.length} districts represented`,
    tableTitle: `Recent ${rowLabel} Records`,
    columns,
    tableRows: rows.slice().sort((a, b) => (recordDateMs(b, routeTab) ?? 0) - (recordDateMs(a, routeTab) ?? 0)).slice(0, 10).map((row) => ({
      key: `${row.fileNumber}-${row.id}`,
      cells: rowCells(row),
      onClick: (navigate) => navigate(facilityPath(row.fileNumber), { state: { tab: routeTab } }),
    })),
  }
}

function answer(question, item, formatter, onClick) {
  return {
    question,
    answer: item?.name ?? 'No records in this filter',
    detail: item ? formatter(item.value) : '',
    onClick: item ? onClick : null,
  }
}

function chart(title, action, data, dimension, formatAxis = (v) => v, formatTooltip = (v) => `${v}`, extraState = null) {
  return {
    title,
    action,
    data,
    dimension,
    formatAxis: formatAxis ?? ((v) => v),
    formatTooltip: formatTooltip ?? ((v) => `${v}`),
    extraState,
  }
}

function genericCsv(tab, rows) {
  const headers = ['Facility', 'File No.', 'Sector', 'District', 'Date', 'Value']
  return [
    headers.map(esc).join(','),
    ...rows.map((row) => [
      row.facilityName ?? row.title,
      row.fileNumber ?? '',
      sectorLabel(row.sectorPrefix),
      districtLabel(row.facilityDistrict ?? row.district),
      fmtDate(row.date ?? row.issue_date),
      row.permit_number ?? row.action_taken ?? row.compliance_status ?? row.type ?? tab,
    ].map(esc).join(',')),
  ].join('\n')
}

function fileBadge(fileNumber) {
  return <span className="file-num">{fileNumber}</span>
}

function sectorBadge(prefix) {
  const colors = SECTOR_COLORS[prefix] ?? { bg: '#f3f4f6', text: '#374151' }
  return <span className="record-badge" style={{ background: colors.bg, color: colors.text }}>{sectorLabel(prefix)}</span>
}

function StudioKpi({ icon, label, value, note, featured = false }) {
  return (
    <div className={`studio-kpi${featured ? ' studio-kpi--featured' : ''}`}>
      <div className="studio-kpi__label">{icon}{label}</div>
      <strong>{value}</strong>
      <small><TrendingUp size={12} /> {note}</small>
    </div>
  )
}

function ChartCard({ title, action = '', children }) {
  return (
    <section className="studio-card">
      <CardHeader title={title} action={action} />
      {children}
    </section>
  )
}

function CardHeader({ title, action = '' }) {
  return (
    <div className="studio-card__header">
      <h3>{title}</h3>
      {action && <span>{action}</span>}
    </div>
  )
}
