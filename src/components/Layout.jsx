import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard, Building2, FileText, Banknote,
  Users, ClipboardList, Activity, ShieldAlert,
  LogOut, Menu, X, Leaf,
} from 'lucide-react'

const NAV_BY_ROLE = {
  admin: [
    { label: 'Dashboard',  icon: LayoutDashboard, path: '/' },
    { label: 'Facilities', icon: Building2,        path: '/facilities' },
    { label: 'Permits',    icon: FileText,         path: '/permits' },
    { label: 'Finance',    icon: Banknote,         path: '/finance' },
    { label: 'Staff',      icon: Users,            path: '/staff' },
  ],
  finance: [
    { label: 'Dashboard',  icon: LayoutDashboard, path: '/' },
    { label: 'Facilities', icon: Building2,        path: '/facilities' },
    { label: 'Finance',    icon: Banknote,         path: '/finance' },
  ],
  officer: [
    { label: 'Dashboard',   icon: LayoutDashboard, path: '/' },
    { label: 'Facilities',  icon: Building2,        path: '/facilities' },
    { label: 'Screening',   icon: ClipboardList,    path: '/screening' },
    { label: 'Monitoring',  icon: Activity,         path: '/monitoring' },
    { label: 'Enforcement', icon: ShieldAlert,      path: '/enforcement' },
  ],
}

const ROLE_COLOR = {
  admin:   '#1d4ed8',
  finance: '#065f46',
  officer: '#c2410c',
}

export default function Layout() {
  const { staff, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

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
              <NavLink
                key={item.path}
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
            )
          })}
        </nav>

        <div className="sidebar__footer">
          <div className="officer-badge">
            <div
              className="officer-avatar"
              style={{ background: ROLE_COLOR[staff?.role] ?? '#374151' }}
            >
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
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
