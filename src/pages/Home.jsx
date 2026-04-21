import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  Building2, FileText, Banknote, Users,
  ClipboardList, Activity, ShieldAlert, ArrowRight,
  CheckSquare, AlertTriangle, XCircle, BarChart2, Clock,
  MessageSquare, GraduationCap, TrendingUp,
} from 'lucide-react'
import { getDashboardStats, getPermitStats, getFieldStats, getMyActivityStats, getFinanceStats } from '../firebase/dashboard'
import { SECTORS, SECTOR_COLORS, FIELD_ROLES, ADMIN_ROLES } from '../data/constants'

const ROLE_LABEL = {
  director:          'Regional Director',
  admin:             'Administrator',
  senior_officer:    'Senior Environmental Officer',
  officer:           'Environmental Officer',
  assistant_officer: 'Assistant Environmental Officer',
  junior_officer:    'Junior Environmental Officer',
  finance:           'Finance Officer',
}

const FIELD_CARDS = [
  { icon: Building2,    color: '#1d4ed8', bg: '#eff6ff', title: 'Facilities',        path: '/facilities',         desc: 'Browse registered facilities.' },
  { icon: ClipboardList,color: '#0369a1', bg: '#f0f9ff', title: 'Screening',         path: '/screening',          desc: 'Pre-permit inspection records with GPS and photos.' },
  { icon: Activity,     color: '#166534', bg: '#dcfce7', title: 'Monitoring',        path: '/monitoring',         desc: 'Sector-specific environmental monitoring visits.' },
  { icon: ShieldAlert,  color: '#c2410c', bg: '#fff7ed', title: 'Enforcement',       path: '/enforcement',        desc: 'Log warnings, notices, fines, and closures.' },
  { icon: CheckSquare,  color: '#0891b2', bg: '#f0fdfa', title: 'Site Verifications',path: '/site-verifications', desc: 'Pre-renewal site verification visits.' },
]

const ADMIN_CARDS = [
  { icon: Building2,    color: '#1d4ed8', bg: '#eff6ff', title: 'Facilities',        path: '/facilities',     desc: 'Manage entity profiles and file numbers.' },
  { icon: FileText,     color: '#7c3aed', bg: '#f5f3ff', title: 'Permits',           path: '/permits',        desc: 'All permits across all facilities.' },
  { icon: Banknote,     color: '#065f46', bg: '#f0fdf4', title: 'Finance',           path: '/finance',        desc: 'All fee payments across all facilities.' },
  { icon: ClipboardList,color: '#0369a1', bg: '#f0f9ff', title: 'Screening',         path: '/screening',      desc: 'All pre-permit screening records.' },
  { icon: Activity,     color: '#166534', bg: '#dcfce7', title: 'Monitoring',        path: '/monitoring',     desc: 'All monitoring visits and checklists.' },
  { icon: ShieldAlert,  color: '#c2410c', bg: '#fff7ed', title: 'Enforcement',       path: '/enforcement',    desc: 'All enforcement actions and follow-ups.' },
  { icon: Users,        color: '#b45309', bg: '#fffbeb', title: 'Staff Management',  path: '/staff',          desc: 'Manage staff accounts and roles.' },
]

const CARDS_BY_ROLE = {
  director: ADMIN_CARDS,
  admin: ADMIN_CARDS,
  finance: [
    { icon: Building2,    color: '#1d4ed8', bg: '#eff6ff', title: 'Facilities',        path: '/facilities',     desc: 'Browse registered facilities.' },
    { icon: Banknote,     color: '#065f46', bg: '#f0fdf4', title: 'Finance',           path: '/finance',        desc: 'Log and manage fee payments across all facilities.' },
    { icon: FileText,     color: '#7c3aed', bg: '#f5f3ff', title: 'Permits',           path: '/permits',        desc: 'View permits and expiry dates.' },
  ],
  senior_officer:    FIELD_CARDS,
  officer:           FIELD_CARDS,
  assistant_officer: FIELD_CARDS,
  junior_officer:    FIELD_CARDS,
}

export default function Home() {
  const { user, staff, role } = useAuth()
  const navigate = useNavigate()
  const cards = CARDS_BY_ROLE[role] ?? []

  const [stats, setStats]               = useState(null)
  const [permitStats, setPermitStats]   = useState(null)
  const [fieldStats, setFieldStats]     = useState(null)
  const [myStats, setMyStats]           = useState(null)
  const [financeStats, setFinanceStats] = useState(null)

  const [dateFrom, setDateFrom]     = useState('')
  const [dateTo, setDateTo]         = useState('')
  const [activeFrom, setActiveFrom] = useState(null)
  const [activeTo, setActiveTo]     = useState(null)

  function applyDateFilter() {
    setActiveFrom(dateFrom ? new Date(dateFrom).getTime() : null)
    setActiveTo(dateTo   ? new Date(dateTo + 'T23:59:59').getTime() : null)
  }
  function clearDateFilter() {
    setDateFrom(''); setDateTo('')
    setActiveFrom(null); setActiveTo(null)
  }

  useEffect(() => {
    getDashboardStats().then(setStats).catch(() => {})
    if (ADMIN_ROLES.has(role) || role === 'finance') {
      getPermitStats().then(setPermitStats).catch(() => {})
      getFinanceStats(activeFrom, activeTo).then(setFinanceStats).catch(() => {})
    }
    if (FIELD_ROLES.has(role)) {
      getFieldStats().then(setFieldStats).catch(() => {})
    }
    if (user?.uid && role !== 'finance') {
      getMyActivityStats(user.uid, activeFrom, activeTo).then(setMyStats).catch(() => {})
    }
  }, [role, user?.uid, activeFrom, activeTo])

  const sectorMax = stats
    ? Math.max(...Object.values(stats.bySector), 1)
    : 1
  const showFinanceOverview = ADMIN_ROLES.has(role) || role === 'finance'
  const showMyActivity = role !== 'finance'

  return (
    <div>
      {/* Welcome banner */}
      <div className="home-welcome">
        <div className="home-welcome__greeting">Welcome back</div>
        <div className="home-welcome__name">{staff?.name}</div>
        <div className="home-welcome__meta">
          <span className="home-welcome__badge">{ROLE_LABEL[role] ?? role}</span>
          <span className="home-welcome__badge">{staff?.staff_id}</span>
          {staff?.designation && <span className="home-welcome__badge">{staff.designation}</span>}
        </div>
      </div>

      {/* ── Date range filter ───────────────────────────── */}
      {(showMyActivity || showFinanceOverview) && (
        <div className="dash-date-filter">
          <span className="dash-date-filter__label">Period:</span>
          <input
            type="date" className="filter-select" style={{ width: 140 }}
            value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            title="From date"
          />
          <span style={{ color: '#9ca3af', fontSize: 13 }}>to</span>
          <input
            type="date" className="filter-select" style={{ width: 140 }}
            value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            title="To date"
          />
          <button className="btn btn--primary btn--sm" onClick={applyDateFilter} disabled={!dateFrom && !dateTo}>
            Apply
          </button>
          {(activeFrom || activeTo) && (
            <button className="btn btn--ghost btn--sm" onClick={clearDateFilter}>Clear</button>
          )}
        </div>
      )}

      {/* ── My Activity ─────────────────────────────────── */}
      {showMyActivity && myStats && (
        <>
          <div className="home-section-title">My Activity · {myStats.quarterLabel}</div>
          <div className="kpi-grid">
            <KpiCard
              icon={<Building2 size={20} color="#1d4ed8" />} bg="#eff6ff"
              value={myStats.assignedFacilities} label="Assigned Facilities"
              onClick={() => navigate('/facilities', { state: { officerUid: user.uid } })}
            />
            <KpiCard
              icon={<ClipboardList size={20} color="#0369a1" />} bg="#f0f9ff"
              value={myStats.screenings} label="Screenings"
              onClick={() => navigate('/screening', { state: { officerUid: user.uid } })}
            />
            <KpiCard
              icon={<Activity size={20} color="#166534" />} bg="#dcfce7"
              value={myStats.monitoring} label="Monitoring Visits"
              onClick={() => navigate('/monitoring', { state: { officerUid: user.uid } })}
            />
            <KpiCard
              icon={<ShieldAlert size={20} color="#c2410c" />} bg="#fff7ed"
              value={myStats.enforcement} label="Enforcement Actions"
              onClick={() => navigate('/enforcement', { state: { officerUid: user.uid } })}
            />
            <KpiCard
              icon={<CheckSquare size={20} color="#0891b2" />} bg="#f0fdfa"
              value={myStats.siteVerifications} label="Site Verifications"
              onClick={() => navigate('/site-verifications', { state: { officerUid: user.uid } })}
            />
            {(ADMIN_ROLES.has(role) || role === 'finance') && (
              <KpiCard
                icon={<FileText size={20} color="#7c3aed" />} bg="#f5f3ff"
                value={myStats.permits} label="Permits Issued"
                onClick={() => navigate('/permits', { state: { officerUid: user.uid } })}
              />
            )}
            <KpiCard
              icon={<MessageSquare size={20} color="#0891b2" />} bg="#f0fdfa"
              value={myStats.complaints} label="Complaints Logged"
              onClick={() => navigate('/complaints', { state: { officerUid: user.uid } })}
            />
            <KpiCard
              icon={<GraduationCap size={20} color="#166534" />} bg="#dcfce7"
              value={myStats.envEducation} label="Edu. Sessions"
              onClick={() => navigate('/env-education', { state: { officerUid: user.uid } })}
            />
          </div>
        </>
      )}

      {/* ── Office Overview ──────────────────────────────── */}
      <div className="home-section-title" style={{ marginTop: showMyActivity && myStats ? 24 : 0 }}>Office Overview</div>
      <div className="kpi-grid">
        <KpiCard
          icon={<Building2 size={20} color="#1d4ed8" />}
          bg="#eff6ff"
          value={stats?.total ?? '—'}
          label="Facilities"
          onClick={() => navigate('/facilities')}
        />
        {ADMIN_ROLES.has(role) && stats != null && (
          <KpiCard
            icon={<FileText size={20} color="#9ca3af" />}
            bg="#f9fafb"
            value={stats.withoutPermits ?? '—'}
            label="No Permit on File"
            onClick={() => navigate('/facilities')}
            highlight={stats.withoutPermits > 0}
          />
        )}
        {permitStats != null && (
          <>
            <KpiCard
              icon={<FileText size={20} color="#166534" />}
              bg="#dcfce7"
              value={permitStats.active}
              label="Active Permits"
              onClick={() => navigate('/permits', { state: { statusFilter: 'active' } })}
            />
            <KpiCard
              icon={<AlertTriangle size={20} color="#854d0e" />}
              bg="#fef9c3"
              value={permitStats.expiring}
              label="Expiring ≤60 days"
              onClick={() => navigate('/permits', { state: { statusFilter: 'expiring' } })}
              highlight={permitStats.expiring > 0}
            />
            <KpiCard
              icon={<XCircle size={20} color="#991b1b" />}
              bg="#fee2e2"
              value={permitStats.expired}
              label="Expired Permits"
              onClick={() => navigate('/permits', { state: { statusFilter: 'expired' } })}
              highlight={permitStats.expired > 0}
            />
            {stats?.stuckWorkflow > 0 && (
              <KpiCard
                icon={<Clock size={20} color="#b45309" />}
                bg="#fffbeb"
                value={stats.stuckWorkflow}
                label="Stuck Workflows"
                onClick={() => navigate('/all-assignments')}
                highlight
              />
            )}
          </>
        )}
        {FIELD_ROLES.has(role) && fieldStats && (
          <>
            <KpiCard
              icon={<ClipboardList size={20} color="#0369a1" />}
              bg="#f0f9ff"
              value={fieldStats.screenings}
              label="Screenings"
              onClick={() => navigate('/screening')}
            />
            <KpiCard
              icon={<Activity size={20} color="#166534" />}
              bg="#dcfce7"
              value={fieldStats.monitoring}
              label="Monitoring Visits"
              onClick={() => navigate('/monitoring')}
            />
            <KpiCard
              icon={<ShieldAlert size={20} color="#c2410c" />}
              bg="#fff7ed"
              value={fieldStats.enforcement}
              label="Enforcement Actions"
              onClick={() => navigate('/enforcement')}
            />
            <KpiCard
              icon={<CheckSquare size={20} color="#0891b2" />}
              bg="#f0fdfa"
              value={fieldStats.siteVerifications}
              label="Site Verifications"
              onClick={() => navigate('/site-verifications')}
            />
          </>
        )}
      </div>

      {showFinanceOverview && financeStats && (
        <>
          <div className="home-section-title" style={{ marginTop: 24 }}>Finance Overview</div>
          <div className="kpi-grid kpi-grid--finance">
            <KpiCard
              icon={<TrendingUp size={20} color="#166534" />}
              bg="#dcfce7"
              value={formatCompactCurrency(financeStats.revenue)}
              label="Total Revenue Generated"
              valueClassName="kpi-card__value--money"
              onClick={() => navigate('/finance')}
            />
            <KpiCard
              icon={<AlertTriangle size={20} color="#854d0e" />}
              bg="#fef9c3"
              value={formatCompactCurrency(financeStats.unpaid)}
              label="Unpaid Invoices Amount"
              valueClassName="kpi-card__value--money"
              onClick={() => navigate('/finance', { state: { paymentStatus: 'unpaid' } })}
              highlight={financeStats.unpaid > 0}
            />
            <KpiCard
              icon={<Building2 size={20} color="#1d4ed8" />}
              bg="#eff6ff"
              value={financeStats.facilitiesWithFinance}
              label="Facilities with Finance Records"
              onClick={() => navigate('/finance')}
            />
            <KpiCard
              icon={<Banknote size={20} color="#166534" />}
              bg="#f0fdf4"
              value={formatCompactCurrency(financeStats.processingFee.revenue)}
              label="Processing Fee Revenue"
              valueClassName="kpi-card__value--money"
              onClick={() => navigate('/finance', { state: { paymentType: 'Processing Fee' } })}
            />
            <KpiCard
              icon={<AlertTriangle size={20} color="#854d0e" />}
              bg="#fffbeb"
              value={formatCompactCurrency(financeStats.processingFee.unpaid)}
              label="Processing Fee Unpaid"
              valueClassName="kpi-card__value--money"
              onClick={() => navigate('/finance', { state: { paymentType: 'Processing Fee', paymentStatus: 'unpaid' } })}
              highlight={financeStats.processingFee.unpaid > 0}
            />
            <KpiCard
              icon={<Building2 size={20} color="#1d4ed8" />}
              bg="#eff6ff"
              value={financeStats.processingFee.facilities}
              label="Processing Fee Facilities"
              onClick={() => navigate('/finance', { state: { paymentType: 'Processing Fee' } })}
            />
            <KpiCard
              icon={<Banknote size={20} color="#7c3aed" />}
              bg="#f5f3ff"
              value={formatCompactCurrency(financeStats.permitFee.revenue)}
              label="Permit Fee Revenue"
              valueClassName="kpi-card__value--money"
              onClick={() => navigate('/finance', { state: { paymentType: 'Permit Fee' } })}
            />
            <KpiCard
              icon={<AlertTriangle size={20} color="#991b1b" />}
              bg="#fee2e2"
              value={formatCompactCurrency(financeStats.permitFee.unpaid)}
              label="Permit Fee Unpaid"
              valueClassName="kpi-card__value--money"
              onClick={() => navigate('/finance', { state: { paymentType: 'Permit Fee', paymentStatus: 'unpaid' } })}
              highlight={financeStats.permitFee.unpaid > 0}
            />
            <KpiCard
              icon={<Building2 size={20} color="#7c3aed" />}
              bg="#f5f3ff"
              value={financeStats.permitFee.facilities}
              label="Permit Fee Facilities"
              onClick={() => navigate('/finance', { state: { paymentType: 'Permit Fee' } })}
            />
          </div>
        </>
      )}

      {/* ── Sector breakdown ─────────────────────────────── */}
      {stats && Object.keys(stats.bySector).length > 0 && (
        <>
          <div className="home-section-title" style={{ marginTop: 24 }}>Facilities by Sector</div>
          <div className="card" style={{ padding: '16px 20px' }}>
            <div className="sector-chart">
              {SECTORS.filter((s) => stats.bySector[s.prefix]).map((s) => {
                const count = stats.bySector[s.prefix] ?? 0
                const pct = Math.round((count / sectorMax) * 100)
                const colors = SECTOR_COLORS[s.prefix] ?? { bg: '#f3f4f6', text: '#374151' }
                return (
                  <div key={s.prefix} className="sector-row">
                    <div className="sector-row__label">
                      <span className="sector-row__prefix" style={{ background: colors.bg, color: colors.text }}>
                        {s.prefix}
                      </span>
                      <span className="sector-row__name">{s.name}</span>
                    </div>
                    <div className="sector-row__bar-wrap">
                      <div
                        className="sector-row__bar"
                        style={{ width: `${pct}%`, background: colors.text }}
                      />
                    </div>
                    <span className="sector-row__count">{count}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* ── Recent facilities ────────────────────────────── */}
      {stats?.recent?.length > 0 && (
        <>
          <div className="home-section-title" style={{ marginTop: 24 }}>Recently Registered</div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {stats.recent.map((f, i) => {
              const colors = SECTOR_COLORS[f.sector_prefix] ?? { bg: '#f3f4f6', text: '#374151' }
              return (
                <div
                  key={f.file_number}
                  className="recent-facility-row"
                  onClick={() => navigate(`/facilities/${f.file_number}`)}
                  style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}
                >
                  <span className="file-num" style={{ fontSize: 12 }}>{f.file_number}</span>
                  <span className="recent-facility-row__name">{f.name}</span>
                  <span className="record-badge" style={{ background: colors.bg, color: colors.text, fontSize: 10 }}>
                    {f.sector_prefix}
                  </span>
                </div>
              )
            })}
            <div
              className="recent-facility-row recent-facility-row--more"
              onClick={() => navigate('/facilities')}
            >
              View all facilities →
            </div>
          </div>
        </>
      )}

      {/* ── Permit Analytics entry (admin only) ─────────── */}
      {ADMIN_ROLES.has(role) && (
        <div
          className="analytics-entry-card"
          onClick={() => navigate('/permit-analytics')}
        >
          <div className="analytics-entry-card__icon">
            <BarChart2 size={22} color="#7c3aed" />
          </div>
          <div className="analytics-entry-card__body">
            <div className="analytics-entry-card__title">Permit Analytics</div>
            <div className="analytics-entry-card__desc">
              Filter permits by sector, district, issue date range, or expiry window. Export results to CSV.
            </div>
          </div>
          <ArrowRight size={18} color="#7c3aed" style={{ flexShrink: 0 }} />
        </div>
      )}

      {/* ── Module cards ─────────────────────────────────── */}
      <div className="home-section-title" style={{ marginTop: 24 }}>Modules</div>
      <div className="action-grid">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <div
              key={card.title}
              className="action-card action-card--active"
              onClick={() => navigate(card.path)}
            >
              <div className="action-card__icon" style={{ background: card.bg }}>
                <Icon size={22} color={card.color} />
              </div>
              <div className="action-card__title">{card.title}</div>
              <div className="action-card__desc">{card.desc}</div>
              <div className="action-card__footer">
                <span className="phase-badge phase-badge--active">Active</span>
                <ArrowRight size={14} color="#16a34a" />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function KpiCard({ icon, bg, value, label, onClick, highlight, valueClassName = '' }) {
  return (
    <div
      className={`kpi-card${highlight ? ' kpi-card--highlight' : ''}`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className="kpi-card__icon" style={{ background: bg }}>{icon}</div>
      <div className="kpi-card__body">
        <div className={`kpi-card__value${valueClassName ? ` ${valueClassName}` : ''}`}>{value}</div>
        <div className="kpi-card__label">{label}</div>
      </div>
    </div>
  )
}

function formatCompactCurrency(amount) {
  const value = Number(amount) || 0
  const abs = Math.abs(value)

  if (abs < 10000) {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS',
      maximumFractionDigits: 0,
    }).format(value)
  }

  const units = [
    { threshold: 1_000_000_000, suffix: 'B' },
    { threshold: 1_000_000, suffix: 'M' },
    { threshold: 1_000, suffix: 'K' },
  ]

  for (const unit of units) {
    if (abs >= unit.threshold) {
      const compact = (value / unit.threshold).toFixed(abs >= unit.threshold * 10 ? 0 : 1)
      return `GH¢${compact.replace(/\.0$/, '')}${unit.suffix}`
    }
  }

  return `GH¢${value}`
}
