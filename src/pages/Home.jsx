import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  Building2, FileText, Banknote, Users,
  ClipboardList, Activity, ShieldAlert, ArrowRight,
} from 'lucide-react'

const CARDS_BY_ROLE = {
  admin: [
    {
      icon: Building2, color: '#1d4ed8', bg: '#eff6ff',
      title: 'Facilities',
      desc: 'Register facilities, auto-generate file numbers (CI266, CU42), manage entity profiles.',
      phase: 'Phase 2', path: '/facilities',
    },
    {
      icon: FileText, color: '#7c3aed', bg: '#f5f3ff',
      title: 'Permits',
      desc: 'Record permit numbers, issue/expiry dates. Flag permits expiring within 90 days.',
      phase: 'Phase 5',
    },
    {
      icon: Banknote, color: '#065f46', bg: '#f0fdf4',
      title: 'Finance',
      desc: 'Log fees and payments (GHS/USD) per facility. View financial history.',
      phase: 'Phase 5',
    },
    {
      icon: Users, color: '#b45309', bg: '#fffbeb',
      title: 'Staff Management',
      desc: 'Manage staff accounts, assign roles (Admin / Finance / Officer).',
      phase: 'Phase 2',
    },
  ],
  finance: [
    {
      icon: Building2, color: '#1d4ed8', bg: '#eff6ff',
      title: 'Facilities',
      desc: 'Browse registered facilities and their file numbers.',
      phase: 'Phase 2', path: '/facilities',
    },
    {
      icon: Banknote, color: '#065f46', bg: '#f0fdf4',
      title: 'Finance Records',
      desc: 'Log and manage fee payments per facility. GHS and USD supported.',
      phase: 'Phase 5',
    },
  ],
  officer: [
    {
      icon: Building2, color: '#1d4ed8', bg: '#eff6ff',
      title: 'Facilities',
      desc: 'Browse registered facilities and their permit status.',
      phase: 'Phase 2', path: '/facilities',
    },
    {
      icon: ClipboardList, color: '#0369a1', bg: '#f0f9ff',
      title: 'Screening',
      desc: 'Pre-permit inspection forms with GPS capture and photo upload.',
      phase: 'Phase 5',
    },
    {
      icon: Activity, color: '#065f46', bg: '#f0fdf4',
      title: 'Monitoring',
      desc: 'Sector-specific checklist inspections. Different forms per sector.',
      phase: 'Phase 5',
    },
    {
      icon: ShieldAlert, color: '#c2410c', bg: '#fff7ed',
      title: 'Enforcement',
      desc: 'Log enforcement actions: warnings, notices, fines, closures. Attach photos.',
      phase: 'Phase 5',
    },
  ],
}

const ROLE_LABEL = {
  admin: 'Administrator',
  finance: 'Finance Officer',
  officer: 'Field Officer',
}

export default function Home() {
  const { staff, role } = useAuth()
  const navigate = useNavigate()
  const cards = CARDS_BY_ROLE[role] ?? []

  return (
    <div>
      {/* Welcome banner */}
      <div className="home-welcome">
        <div className="home-welcome__greeting">Welcome back</div>
        <div className="home-welcome__name">{staff?.name}</div>
        <div className="home-welcome__meta">
          <span className="home-welcome__badge">{ROLE_LABEL[role] ?? role}</span>
          <span className="home-welcome__badge">{staff?.staff_id}</span>
          <span className="home-welcome__badge">{staff?.designation}</span>
        </div>
      </div>

      {/* Action cards */}
      <div className="home-section-title">Modules</div>
      <div className="action-grid">
        {cards.map((card) => {
          const Icon = card.icon
          const isActive = Boolean(card.path)
          return (
            <div
              key={card.title}
              className={`action-card${isActive ? ' action-card--active' : ''}`}
              onClick={() => isActive && navigate(card.path)}
            >
              <div
                className="action-card__icon"
                style={{ background: card.bg }}
              >
                <Icon size={22} color={card.color} />
              </div>
              <div className="action-card__title">{card.title}</div>
              <div className="action-card__desc">{card.desc}</div>
              <div className="action-card__footer">
                <span className={`phase-badge${isActive ? ' phase-badge--active' : ''}`}>
                  {isActive ? 'Active' : card.phase}
                </span>
                {isActive && (
                  <ArrowRight size={14} color="#16a34a" />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
