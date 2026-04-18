import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  ClipboardList,
  AlertTriangle,
  FileBarChart2,
  Menu,
  X,
  Leaf,
  Bell,
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/firms", label: "Firms", icon: Building2 },
  { to: "/inspections", label: "Inspections", icon: ClipboardList },
  { to: "/violations", label: "Violations", icon: AlertTriangle },
  { to: "/reports", label: "Reports", icon: FileBarChart2 },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-shell">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? "sidebar--open" : ""}`}>
        <div className="sidebar__brand">
          <Leaf size={22} className="brand-icon" />
          <span className="brand-text">EnvGuard</span>
          <button className="sidebar__close" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>
        <nav className="sidebar__nav">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) => `nav-item ${isActive ? "nav-item--active" : ""}`}
              onClick={() => setSidebarOpen(false)}
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar__footer">
          <div className="officer-badge">
            <div className="officer-avatar">AO</div>
            <div className="officer-info">
              <span className="officer-name">Amina Odhiambo</span>
              <span className="officer-role">Field Officer · NEMA-0041</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="main-area">
        <header className="topbar">
          <button className="topbar__menu-btn" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>
          <div className="topbar__title">Environmental Compliance System</div>
          <div className="topbar__actions">
            <button className="topbar__icon-btn">
              <Bell size={18} />
            </button>
          </div>
        </header>
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
