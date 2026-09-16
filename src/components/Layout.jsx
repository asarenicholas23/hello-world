import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSync } from '../context/SyncContext'
import { ADMIN_VIEW_ROLES, ROLE_LABEL } from '../data/constants'
import NotificationBell from './NotificationBell'
import ChatWidget from './ChatWidget'
import { onForegroundMessage } from '../firebase/fcm'
import {
  LayoutDashboard, Building2, FileText, Banknote,
  Users, ClipboardList, Activity, CheckSquare,
  LogOut, Menu, X, Leaf, Upload, Flag, BarChart2, TrendingUp,
  Briefcase, LayoutList, MessageSquare, GraduationCap, BellRing, Mail, Gauge,
  WifiOff, RefreshCw, CheckCircle2, Clock, ChevronDown, Target,
} from 'lucide-react'

// Nav is organised into labelled, collapsible groups so the sidebar stays
// readable as items accumulate — see `nav-group` rendering below.
const ADMIN_NAV = [
  { section: 'Overview', items: [
    { label: 'Dashboard',        icon: LayoutDashboard, path: '/' },
    { label: 'Compliance',       icon: Target,          path: '/compliance' },
  ]},
  { section: 'Facilities & Records', items: [
    { label: 'Facilities',       icon: Building2,       path: '/facilities' },
    { label: 'Permits',          icon: FileText,        path: '/permits' },
    { label: 'Permit Analytics', icon: BarChart2,       path: '/permit-analytics' },
    { label: 'Finance',          icon: Banknote,        path: '/finance' },
  ]},
  { section: 'Staff', items: [
    { label: 'Staff',            icon: Users,           path: '/staff' },
    { label: 'All Assignments',  icon: LayoutList,      path: '/all-assignments' },
  ]},
  { section: 'Field Data', items: [
    { label: 'Import Data',      icon: Upload,          path: '/import' },
    { label: 'Field Reports',    icon: Flag,            path: '/field-reports' },
    { label: 'Visit Reports',    icon: TrendingUp,      path: '/visit-reports' },
    { label: 'Complaints',       icon: MessageSquare,   path: '/complaints' },
    { label: 'Env. Education',   icon: GraduationCap,   path: '/env-education' },
  ]},
  { section: 'Communications', items: [
    { label: 'SMS',              icon: BellRing,        path: '/sms' },
    { label: 'Email',            icon: Mail,            path: '/email' },
    { label: 'Chat with Osei',   icon: MessageSquare,   path: '/chat' },
  ]},
]

const FIELD_NAV = [
  { section: 'Overview', items: [
    { label: 'Dashboard',         icon: LayoutDashboard, path: '/' },
  ]},
  { section: 'Facilities & Field Work', items: [
    { label: 'Facilities',        icon: Building2,       path: '/facilities' },
    { label: 'Screening',         icon: ClipboardList,   path: '/screening' },
    { label: 'Monitoring',        icon: Activity,        path: '/monitoring' },
    { label: 'Site Verifications',icon: CheckSquare,     path: '/site-verifications' },
    { label: 'Field Reports',     icon: Flag,            path: '/field-reports' },
  ]},
  { section: 'My Work', items: [
    { label: 'My Assignments',    icon: Briefcase,       path: '/my-assignments' },
  ]},
  { section: 'Community', items: [
    { label: 'Complaints',        icon: MessageSquare,   path: '/complaints' },
    { label: 'Env. Education',    icon: GraduationCap,   path: '/env-education' },
  ]},
  { section: 'Support', items: [
    { label: 'Chat with Osei',    icon: MessageSquare,   path: '/chat' },
  ]},
]

// Shown to users granted `data_access` whose role alone wouldn't see ADMIN_NAV.
// Same tools as ADMIN_NAV minus staff account management, which stays
// Admin/Director-only.
const DATA_ACCESS_NAV = ADMIN_NAV
  .map((group) => ({
    ...group,
    items: group.items.filter((item) => item.path !== '/staff'),
  }))
  .filter((group) => group.items.length > 0)

// I.T is the only role with the clock-in flow (My Attendance / Attendance)
// and the Analytics dashboard — everyone else has those stripped out above.
const IT_NAV = [
  { section: 'Overview', items: [
    { label: 'Dashboard',        icon: LayoutDashboard, path: '/' },
    { label: 'Analytics',        icon: Gauge,           path: '/analytics' },
    { label: 'Compliance',       icon: Target,          path: '/compliance' },
  ]},
  { section: 'Facilities & Records', items: [
    { label: 'Facilities',       icon: Building2,       path: '/facilities' },
    { label: 'Permits',          icon: FileText,        path: '/permits' },
    { label: 'Permit Analytics', icon: BarChart2,       path: '/permit-analytics' },
    { label: 'Finance',          icon: Banknote,        path: '/finance' },
  ]},
  { section: 'Staff & Attendance', items: [
    { label: 'All Assignments',  icon: LayoutList,      path: '/all-assignments' },
    { label: 'My Attendance',    icon: Clock,           path: '/my-attendance' },
    { label: 'Attendance',       icon: ClipboardList,   path: '/attendance' },
  ]},
  { section: 'Field Data', items: [
    { label: 'Import Data',      icon: Upload,          path: '/import' },
    { label: 'Field Reports',    icon: Flag,            path: '/field-reports' },
    { label: 'Visit Reports',    icon: TrendingUp,      path: '/visit-reports' },
    { label: 'Complaints',       icon: MessageSquare,   path: '/complaints' },
    { label: 'Env. Education',   icon: GraduationCap,   path: '/env-education' },
  ]},
  { section: 'Communications', items: [
    { label: 'SMS',              icon: BellRing,        path: '/sms' },
    { label: 'Email',            icon: Mail,            path: '/email' },
    { label: 'Chat with Osei',   icon: MessageSquare,   path: '/chat' },
  ]},
]

const NAV_BY_ROLE = {
  director:          ADMIN_NAV,
  admin:             ADMIN_NAV,
  senior_officer:    ADMIN_NAV,
  officer:           ADMIN_NAV,
  assistant_officer: FIELD_NAV,
  junior_officer:    FIELD_NAV,
  it:                IT_NAV,
  finance: [
    { section: 'Overview', items: [
      { label: 'Dashboard',  icon: LayoutDashboard, path: '/' },
    ]},
    { section: 'Facilities & Finance', items: [
      { label: 'Facilities', icon: Building2,       path: '/facilities' },
      { label: 'Finance',    icon: Banknote,        path: '/finance' },
    ]},
    { section: 'My Work', items: [
      { label: 'Field Reports', icon: Flag,          path: '/field-reports' },
    ]},
    { section: 'Support', items: [
      { label: 'Chat with Osei', icon: MessageSquare, path: '/chat' },
    ]},
  ],
}

// Sections collapsed by default so the sidebar isn't overwhelming on first
// load — anything not the primary daily-use group. Persisted per-user once
// they expand/collapse a section themselves (see NAV_STORAGE_KEY below).
const DEFAULT_COLLAPSED_SECTIONS = [
  'Staff', 'Staff & Attendance', 'Field Data', 'Communications', 'My Work', 'Community', 'Support',
]

const NAV_STORAGE_KEY = 'epa_nav_collapsed_sections'

function loadCollapsedSections() {
  try {
    const raw = localStorage.getItem(NAV_STORAGE_KEY)
    if (raw) return new Set(JSON.parse(raw))
  } catch { /* ignore malformed/unavailable storage */ }
  return new Set(DEFAULT_COLLAPSED_SECTIONS)
}

function saveCollapsedSections(set) {
  try { localStorage.setItem(NAV_STORAGE_KEY, JSON.stringify([...set])) } catch { /* ignore */ }
}

function flattenNav(navGroups) {
  return navGroups.flatMap((group) => group.items)
}

const PAGE_TITLE = {
  '/':                   'Dashboard',
  '/analytics':          'Analytics',
  '/compliance':         'Compliance',
  '/facilities':         'Facilities',
  '/permits':            'Permits',
  '/permit-analytics':   'Permit Analytics',
  '/visit-reports':      'Visit Reports',
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
  '/my-attendance':      'My Attendance',
  '/attendance':         'Attendance',
  '/sms':               'SMS Notifications',
  '/email':             'Email Notifications',
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
  it:                '#0f766e',
}

const DEFAULT_MOBILE_TAB_PATHS = ['/', '/facilities', '/field-reports', '/my-assignments']
const ADMIN_MOBILE_TAB_PATHS = ['/', '/facilities', '/finance', '/permits']

function pickMobileTabs(navItems, role) {
  const paths = role === 'admin' || role === 'director'
    ? ADMIN_MOBILE_TAB_PATHS
    : role === 'it'
      ? ['/', '/analytics', '/facilities', '/visit-reports']
    : DEFAULT_MOBILE_TAB_PATHS
  const allKnownItems = [
    ...flattenNav(navItems),
    ...flattenNav(ADMIN_NAV),
    ...flattenNav(FIELD_NAV),
    ...flattenNav(NAV_BY_ROLE.finance ?? []),
    ...flattenNav(NAV_BY_ROLE.it ?? []),
  ]
  const byPath = new Map(allKnownItems.map((item) => [item.path, item]))
  return paths.map((path) => byPath.get(path)).filter(Boolean)
}

export default function Layout() {
  const { staff, logout } = useAuth()
  const navigate = useNavigate()
  const pageTitle = usePageTitle()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsedSections, setCollapsedSections] = useState(loadCollapsedSections)

  const { syncStatus, toasts, dismissToast, pushToast } = useSync()

  function toggleSection(section) {
    setCollapsedSections((prev) => {
      const next = new Set(prev)
      if (next.has(section)) next.delete(section)
      else next.add(section)
      saveCollapsedSections(next)
      return next
    })
  }

  useEffect(() => {
    return onForegroundMessage((payload) => {
      const title = payload.notification?.title ?? 'New notification'
      const body  = payload.notification?.body  ?? ''
      pushToast(`${title}${body ? ` — ${body}` : ''}`, 'success', 6000)
    })
  }, [pushToast])
  const navItems = staff?.role === 'it'
    ? IT_NAV
    : ADMIN_VIEW_ROLES.has(staff?.role)
      ? ADMIN_NAV
      : staff?.data_access
        ? DATA_ACCESS_NAV
        : (NAV_BY_ROLE[staff?.role] ?? [])
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
          {navItems.map((group) => {
            const collapsed = collapsedSections.has(group.section)
            return (
              <div className="nav-group" key={group.section}>
                <button
                  type="button"
                  className="nav-group__header"
                  onClick={() => toggleSection(group.section)}
                  aria-expanded={!collapsed}
                >
                  <span>{group.section}</span>
                  <ChevronDown size={13} className={`nav-group__chevron${collapsed ? ' nav-group__chevron--collapsed' : ''}`} />
                </button>
                {!collapsed && group.items.map((item) => {
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
              <span className="officer-role">
                {ROLE_LABEL[staff?.role] ?? staff?.role}{staff?.staff_id ? ` · ${staff.staff_id}` : ''}
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
            {(ROLE_LABEL[staff?.role] ?? staff?.role ?? '').toUpperCase()}
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
