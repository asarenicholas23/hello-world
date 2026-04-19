import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  Building2, FileText, Banknote, Users,
  ClipboardList, Activity, ShieldAlert, ArrowRight,
  CheckSquare, AlertTriangle, XCircle, TrendingUp,
} from 'lucide-react'
import { getDashboardStats, getPermitStats } from '../firebase/dashboard'
import { SECTORS, SECTOR_COLORS } from '../data/constants'

const ROLE_LABEL = {
  admin:   'Administrator',
  finance: 'Finance Officer',
  officer: 'Field Officer',
}

const CARDS_BY_ROLE = {
  admin: [
    { icon: Building2,    color: '#1d4ed8', bg: '#eff6ff', title: 'Facilities',        path: '/facilities',     desc: 'Manage entity profiles and file numbers.' },
    { icon: FileText,     color: '#7c3aed', bg: '#f5f3ff', title: 'Permits',           path: '/permits',        desc: 'All permits across all facilities.' },
    { icon: Banknote,     color: '#065f46', bg: '#f0fdf4', title: 'Finance',           path: '/finance',        desc: 'All fee payments across all facilities.' },
    { icon: ClipboardList,color: '#0369a1', bg: '#f0f9ff', title: 'Screening',         path: '/screening',      desc: 'All pre-permit screening records.' },
    { icon: Activity,     color: '#166534', bg: '#dcfce7', title: 'Monitoring',        path: '/monitoring',     desc: 'All monitoring visits and checklists.' },
    { icon: ShieldAlert,  color: '#c2410c', bg: '#fff7ed', title: 'Enforcement',       path: '/enforcement',    desc: 'All enforcement actions and follow-ups.' },
    { icon: Users,        color: '#b45309', bg: '#fffbeb', title: 'Staff Management', path: '/staff',          desc: 'Manage staff accounts and roles.' },
  ],
  finance: [
    { icon: Building2,    color: '#1d4ed8', bg: '#eff6ff', title: 'Facilities',        path: '/facilities',     desc: 'Browse registered facilities.' },
    { icon: Banknote,     color: '#065f46', bg: '#f0fdf4', title: 'Finance',           path: '/finance',        desc: 'Log and manage fee payments across all facilities.' },
    { icon: FileText,     color: '#7c3aed', bg: '#f5f3ff', title: 'Permits',           path: '/permits',        desc: 'View permits and expiry dates.' },
  ],
  officer: [
    { icon: Building2,    color: '#1d4ed8', bg: '#eff6ff', title: 'Facilities',        path: '/facilities',     desc: 'Browse registered facilities.' },
    { icon: ClipboardList,color: '#0369a1', bg: '#f0f9ff', title: 'Screening',         path: '/screening',      desc: 'Pre-permit inspection records with GPS and photos.' },
    { icon: Activity,     color: '#166534', bg: '#dcfce7', title: 'Monitoring',        path: '/monitoring',     desc: 'Sector-specific environmental monitoring visits.' },
    { icon: ShieldAlert,  color: '#c2410c', bg: '#fff7ed', title: 'Enforcement',       path: '/enforcement',    desc: 'Log warnings, notices, fines, and closures.' },
    { icon: CheckSquare,  color: '#0891b2', bg: '#f0fdfa', title: 'Site Verifications',path: '/site-verifications', desc: 'Pre-renewal site verification visits.' },
  ],
}

export default function Home() {
  const { staff, role } = useAuth()
  const navigate = useNavigate()
  const cards = CARDS_BY_ROLE[role] ?? []

  const [stats, setStats] = useState(null)
  const [permitStats, setPermitStats] = useState(null)

  useEffect(() => {
    getDashboardStats().then(setStats).catch(() => {})
    // Permit stats only for admin and finance (most relevant)
    if (role === 'admin' || role === 'finance') {
      getPermitStats().then(setPermitStats).catch(() => {})
    }
  }, [role])

  const sectorMax = stats
    ? Math.max(...Object.values(stats.bySector), 1)
    : 1

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

      {/* ── KPI row ─────────────────────────────────────── */}
      <div className="home-section-title">Overview</div>
      <div className="kpi-grid">
        <KpiCard
          icon={<Building2 size={20} color="#1d4ed8" />}
          bg="#eff6ff"
          value={stats?.total ?? '—'}
          label="Facilities"
          onClick={() => navigate('/facilities')}
        />
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
          </>
        )}
        {role === 'officer' && stats && (
          <KpiCard
            icon={<TrendingUp size={20} color="#1d4ed8" />}
            bg="#eff6ff"
            value={stats.total}
            label="Registered Facilities"
            onClick={() => navigate('/facilities')}
          />
        )}
      </div>

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

function KpiCard({ icon, bg, value, label, onClick, highlight }) {
  return (
    <div
      className={`kpi-card${highlight ? ' kpi-card--highlight' : ''}`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className="kpi-card__icon" style={{ background: bg }}>{icon}</div>
      <div className="kpi-card__body">
        <div className="kpi-card__value">{value}</div>
        <div className="kpi-card__label">{label}</div>
      </div>
    </div>
  )
}
