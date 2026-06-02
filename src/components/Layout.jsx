import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSync } from '../context/SyncContext'
import { ADMIN_VIEW_ROLES } from '../data/constants'
import NotificationBell from './NotificationBell'
import ChatWidget from './ChatWidget'
import { onForegroundMessage } from '../firebase/fcm'
import {
  LayoutDashboard, Building2, FileText, Banknote,
  Users, ClipboardList, Activity, CheckSquare,
  LogOut, Menu, X, Leaf, Upload, Flag, BarChart2,
  Briefcase, LayoutList, MessageSquare, GraduationCap, BellRing,
  WifiOff, RefreshCw, CheckCircle2,
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
  { label: 'SMS',              icon: BellRing,        path: '/sms',           dividerBefore: true },
  { label: 'Chat with Osei',   icon: MessageSquare,   path: '/chat' },
]

const FIELD_NAV = [
  { label: 'Dashboard',         icon: LayoutDashboard, path: '/' },
  { label: 'Facilities',        icon: Building2,       path: '/facilities' },
  { label: 'Screening',         icon: ClipboardList,   path: '/screening' },
  { label: 'Monitoring',        icon: Activity,        path: '/monitoring' },
  { label: 'Field Reports',     icon: Flag,            path: '/field-reports' },
  { label: 'Site Verifications',icon: CheckSquare,     path: '/site-verifications' },
  { label: 'My Assignments',    icon: Briefcase,       path: '/my-assignments', dividerBefore: true },
  { label: 'Complaints',        icon: MessageSquare,   path: '/complaints',     dividerBefore: true },
  { label: 'Env. Education',    icon: GraduationCap,   path: '/env-education' },
  { label: 'Chat with Osei',   icon: MessageSquare,   path: '/chat',          dividerBefore: true },
]

const NAV_BY_ROLE = {
  director:          ADMIN_NAV,
  admin:             ADMIN_NAV,
  senior_officer:    ADMIN_NAV,
  officer:           ADMIN_NAV,
  assistant_officer: FIELD_NAV,
  junior_officer:    FIELD_NAV,
  finance: [
    { label: 'Dashboard',  icon: LayoutDashboard, path: '/' },
    { label: 'Facilities', icon: Building2,       path: '/facilities' },
    { label: 'Finance',    icon: Banknote,        path: '/finance' },
    { label: 'Field Reports', icon: Flag,          path: '/field-reports' },
    { label: 'Chat with Osei', icon: MessageSquare, path: '/chat',          dividerBefore: true },
  ],
}

const PAGE_TITLE = {
  '/':                   'Dashboard',
  '/facilities':         'Facilities',
  '/permits':            'Permits',
  '/permit-analytics':   'Permit Analytics',
  '/finance':            'Finance',
  '/screening':          'Screening',
  '/monitoring':         'Monitoring',
  '/enforcement':        'Enforcement',
  '/site-verifications': 'Site Verifications',
  '/staff':              'Staff',
  '/all-assignments':    'All Assignments',
  '/my-assignments':     'My Assignments',
  '/import':             'Import Data',
  '/field-reports':      'Field Reports',
  '/complaints':         'Complaints',
  '/env-education':      'Environmental Education',
  '/chat':               'Chat with Osei',
  '/profile':            'My Profile',
  '/sms':               'SMS Notifications',
}

function usePageTitle() {
  const { pathname } = useLocation()
  if (PAGE_TITLE[pathname]) return PAGE_TITLE[pathname]
  if (pathname.endsWith('/edit')) return 'Edit Record'
  if (pathname.endsWith('/new')) return 'New Record'
  if (pathname.startsWith('/facilities/')) return 'Facility Detail'
  if (pathname.startsWith('/staff/')) return 'Edit Staff'
  return 'EPA Permit'
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

const DEFAULT_MOBILE_TAB_PATHS = ['/', '/facilities', '/field-reports', '/my-assignments']
const ADMIN_MOBILE_TAB_PATHS = ['/', '/facilities', '/finance', '/permits']

function pickMobileTabs(navItems, role) {
  const paths = role === 'admin' || role === 'director'
    ? ADMIN_MOBILE_TAB_PATHS
    : DEFAULT_MOBILE_TAB_PATHS
  const allKnownItems = [
    ...navItems,
    ...ADMIN_NAV,
    ...FIELD_NAV,
    ...(NAV_BY_ROLE.finance ?? []),
  ]
  const byPath = new Map(allKnownItems.map((item) => [item.path, item]))
  return paths.map((path) => byPath.get(path)).filter(Boolean)
}

export default function Layout() {
  const { staff, logout } = useAuth()
  const navigate = useNavigate()
  const pageTitle = usePageTitle()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const { syncStatus, toasts, dismissToast, pushToast } = useSync()

  useEffect(() => {
    return onForegroundMessage((payload) => {
      const title = payload.notification?.title ?? 'New notification'
      const body  = payload.notification?.body  ?? ''
      pushToast(`${title}${body ? ` — ${body}` : ''}`, 'success', 6000)
    })
  }, [pushToast])
  const navItems = ADMIN_VIEW_ROLES.has(staff?.role) ? ADMIN_NAV : (NAV_BY_ROLE[staff?.role] ?? [])
  const mobileTabItems = pickMobileTabs(navItems, staff?.role)
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

  function handleRefreshApp() {
    window.location.reload()
  }

  return (
    <div className={`app-shell${sidebarOpen ? ' app-shell--nav-open' : ''}`}>
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
          <span className="topbar__title">
            <span className="topbar__office">Konongo Area Office</span>
            <span className="topbar__page-title">{pageTitle}</span>
          </span>
          <SyncIndicator status={syncStatus} />
          <button className="topbar__icon-btn" onClick={handleRefreshApp} title="Refresh app" aria-label="Refresh app">
            <RefreshCw size={17} />
          </button>
          <NotificationBell uid={staff?.uid ?? staff?.id} />
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

      <nav className="mobile-tabbar" aria-label="Primary navigation">
        {mobileTabItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `mobile-tab${isActive ? ' mobile-tab--active' : ''}`
              }
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </nav>

      <ChatWidget />

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
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
        className={`sync-dot${status.type === 'offline' ? ' sync-dot--pulse' : ''}`}
        style={{ background: SYNC_DOT_COLOR[status.type] ?? '#9ca3af' }}
      />
      <span className="sync-label">{status.label}</span>
    </div>
  )
}

const TOAST_ICON = {
  offline: WifiOff,
  syncing: RefreshCw,
  success: CheckCircle2,
}

function ToastStack({ toasts, onDismiss }) {
  if (!toasts.length) return null
  return (
    <div className="toast-stack">
      {toasts.map((t) => {
        const Icon = TOAST_ICON[t.type] ?? WifiOff
        return (
          <div key={t.id} className={`toast toast--${t.type}`}>
            <Icon size={16} className={t.type === 'syncing' ? 'toast-spin' : ''} style={{ flexShrink: 0 }} />
            <span className="toast-msg">{t.message}</span>
            <button className="toast-close" onClick={() => onDismiss(t.id)} aria-label="Dismiss">
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
