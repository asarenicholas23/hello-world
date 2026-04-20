import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSync } from '../context/SyncContext'
import {
  LayoutDashboard, Building2, FileText, Banknote,
  Users, ClipboardList, Activity, ShieldAlert,
  LogOut, Menu, X, Leaf, Upload, Flag, BarChart2,
  Briefcase, LayoutList, MessageSquare, GraduationCap,
} from 'lucide-react'

const ADMIN_NAV = [
  { label: 'Dashboard',        icon: LayoutDashboard, path: '/' },
  { label: 'Facilities',       icon: Building2,       path: '/facilities' },
  { label: 'Permits',          icon: FileText,        path: '/permits' },
  { label: 'Permit Analytics', icon: BarChart2,       path: '/permit-analytics' },
  { label: 'Finance',          icon: Banknote,        path: '/finance' },
  { label: 'Staff',            icon: Users,           path: '/staff' },
  { label: 'All Assignments',  icon: LayoutList,      path: '/all-assignments' },
  { label: 'Import Data',      icon: Upload,          path: '/import',        dividerBefore: true },
  { label: 'Field Reports',    icon: Flag,            path: '/field-reports' },
  { label: 'Complaints',       icon: MessageSquare,   path: '/complaints',    dividerBefore: true },
  { label: 'Env. Education',   icon: GraduationCap,   path: '/env-education' },
]

const FIELD_NAV = [
  { label: 'Dashboard',     icon: LayoutDashboard, path: '/' },
  { label: 'Facilities',    icon: Building2,       path: '/facilities' },
  { label: 'Screening',     icon: ClipboardList,   path: '/screening' },
  { label: 'Monitoring',    icon: Activity,        path: '/monitoring' },
  { label: 'Enforcement',   icon: ShieldAlert,     path: '/enforcement' },
  { label: 'My Assignments', icon: Briefcase,       path: '/my-assignments', dividerBefore: true },
  { label: 'Field Reports',  icon: Flag,            path: '/field-reports' },
  { label: 'Complaints',     icon: MessageSquare,   path: '/complaints',     dividerBefore: true },
  { label: 'Env. Education', icon: GraduationCap,   path: '/env-education' },
]

const NAV_BY_ROLE = {
  director:          ADMIN_NAV,
  admin:             ADMIN_NAV,
  senior_officer:    FIELD_NAV,
  officer:           FIELD_NAV,
  assistant_officer: FIELD_NAV,
  junior_officer:    FIELD_NAV,
  finance: [
    { label: 'Dashboard',  icon: LayoutDashboard, path: '/' },
    { label: 'Facilities', icon: Building2,       path: '/facilities' },
    { label: 'Finance',    icon: Banknote,        path: '/finance' },
  ],
}

const ROLE_COLOR = {
  director:          '#7c3aed',
  admin:             '#1d4ed8',
  senior_officer:    '#0369a1',
  officer:           '#c2410c',
  assistant_officer: '#b45309',
  junior_officer:    '#6b7280',
  finance:           '#065f46',
}

export default function Layout() {
  const { staff, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const { syncStatus } = useSync()
  const navItems = NAV_BY_ROLE[staff?.role] ?? []
  const initials = staff?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() ?? '?'

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-shell">
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`sidebar${sidebarOpen ? ' sidebar--open' : ''}`}>
        <div className="sidebar__brand">
          <Leaf size={22} className="brand-icon" />
          <span className="brand-text">EPA Permit</span>
          <button className="sidebar__close" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar__nav">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <div key={item.path}>
                {item.dividerBefore && <hr className="nav-divider" />}
                <NavLink
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    `nav-item${isActive ? ' nav-item--active' : ''}`
                  }
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon size={17} />
                  {item.label}
                </NavLink>
              </div>
            )
          })}
        </nav>

        <div className="sidebar__footer">
          <div className="officer-badge">
            <div
              className="officer-avatar"
              style={{ background: ROLE_COLOR[staff?.role] ?? '#374151', cursor: 'pointer' }}
              onClick={() => { navigate('/profile'); setSidebarOpen(false) }}
              title="My Profile"
            >
              {initials}
            </div>
            <div
              style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
              onClick={() => { navigate('/profile'); setSidebarOpen(false) }}
            >
              <span className="officer-name">{staff?.name}</span>
              <span className="officer-role" style={{ textTransform: 'capitalize' }}>
                {staff?.role} · {staff?.staff_id}
              </span>
            </div>
            <button
              onClick={handleLogout}
              title="Sign out"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#64748b', padding: 4, display: 'flex',
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <div className="main-area">
        <div className="topbar">
          <button className="topbar__menu-btn" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>
          <span className="topbar__title">Ashanti Regional Office</span>
          <SyncIndicator status={syncStatus} />
          <span
            className="badge"
            style={{
              background: ROLE_COLOR[staff?.role] ?? '#374151',
              color: '#fff',
              fontSize: 11,
            }}
          >
            {staff?.role?.toUpperCase()}
          </span>
        </div>

        <div className="page-content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

const SYNC_DOT_COLOR = {
  synced:  '#16a34a',
  syncing: '#f59e0b',
  pending: '#f59e0b',
  offline: '#ef4444',
}

function SyncIndicator({ status }) {
  return (
    <div className="sync-indicator">
      <span
        className="sync-dot"
        style={{ background: SYNC_DOT_COLOR[status.type] ?? '#9ca3af' }}
      />
      <span className="sync-label">{status.label}</span>
    </div>
  )
}
