import { useEffect, useState } from 'react'
import { Clock, CheckCircle2, AlertCircle, XCircle, CalendarCheck, AlertTriangle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { listAttendanceForStaff } from '../firebase/attendance'
import { getAttendanceStatus, ATTENDANCE_STATUS_LABEL } from '../utils/attendance'
import { fmtDate, fmtTime, dateStr } from '../utils/records'
import { ROLE_LABEL } from '../data/constants'
import Spinner from '../components/Spinner'

const STATUS_STYLE = {
  on_time:      { bg: '#ecfdf5', color: '#166534' },
  late:         { bg: '#fff7ed', color: '#c2410c' },
  in_progress:  { bg: '#eff6ff', color: '#1d4ed8' },
  no_clock_out: { bg: '#fef2f2', color: '#dc2626' },
}

function monthStart() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export default function MyAttendancePage() {
  const { user, staff, role } = useAuth()
  const canView = role === 'it'

  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [dateFrom, setDateFrom]     = useState(monthStart())
  const [dateTo, setDateTo]         = useState(dateStr())
  const [activeFrom, setActiveFrom] = useState(monthStart())
  const [activeTo, setActiveTo]     = useState(dateStr())

  useEffect(() => {
    if (!canView) return
    listAttendanceForStaff(user.uid, { from: activeFrom, to: activeTo })
      .then(setRows)
      .catch(() => setError('Failed to load attendance history.'))
      .finally(() => setLoading(false))
  }, [canView, user.uid, activeFrom, activeTo])

  function applyDateFilter() { setActiveFrom(dateFrom || null); setActiveTo(dateTo || null) }
  function clearDateFilter() {
    setDateFrom(monthStart()); setDateTo(dateStr())
    setActiveFrom(monthStart()); setActiveTo(dateStr())
  }

  const daysPresent   = rows.length
  const lateCount     = rows.filter((r) => getAttendanceStatus(r) === 'late').length
  const missedCount   = rows.filter((r) => getAttendanceStatus(r) === 'no_clock_out').length

  if (!canView) {
    return (
      <div className="page-inner studio-skin">
        <div className="empty-state">You don&apos;t have access to this page.</div>
      </div>
    )
  }

  return (
    <div className="page-inner studio-skin">
      <div className="page-header">
        <div className="page-header__left">
          <Clock size={20} className="page-header__icon" />
          <div>
            <h1 className="page-title">My Attendance</h1>
            <p className="page-subtitle">{staff?.name} · {ROLE_LABEL[staff?.role] ?? staff?.role}</p>
          </div>
        </div>
      </div>

      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <StatCard icon={<CalendarCheck size={18} color="#1d4ed8" />} bg="#eff6ff" value={daysPresent} label="Days Present" />
        <StatCard icon={<AlertTriangle size={18} color="#c2410c" />} bg="#fff7ed" value={lateCount}   label="Late Arrivals" />
        <StatCard icon={<XCircle size={18} color="#dc2626" />}       bg="#fef2f2" value={missedCount} label="Missed Clock-outs" />
      </div>

      <div className="dash-date-filter" style={{ marginBottom: 16 }}>
        <span className="dash-date-filter__label">Period:</span>
        <input type="date" className="filter-select" style={{ width: 140 }} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <span style={{ color: '#9ca3af', fontSize: 13 }}>to</span>
        <input type="date" className="filter-select" style={{ width: 140 }} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        <button className="btn btn--primary btn--sm" onClick={applyDateFilter}>Apply</button>
        <button className="btn btn--ghost btn--sm" onClick={clearDateFilter}>Clear</button>
      </div>

      {loading ? (
        <div className="tab-loading"><Spinner size={24} /></div>
      ) : error ? (
        <div className="login-error"><AlertCircle size={14} /> {error}</div>
      ) : rows.length === 0 ? (
        <div className="tab-empty">No attendance records in this period.</div>
      ) : (
        <div className="record-list">
          {rows.map((r) => {
            const status = getAttendanceStatus(r)
            const style = STATUS_STYLE[status] ?? {}
            return (
              <div key={r.id} className="record-item">
                <div className="record-item__header">
                  <span className="record-item__title">{fmtDate(new Date(r.date + 'T00:00:00'))}</span>
                  <span className="record-badge" style={style}>{ATTENDANCE_STATUS_LABEL[status] ?? status}</span>
                </div>
                <div className="record-item__meta">
                  <span><CheckCircle2 size={12} style={{ marginRight: 3, verticalAlign: -2 }} />In: {fmtTime(r.clock_in_at)} ({r.clock_in_distance_m}m)</span>
                  <span>
                    {r.clock_out_at
                      ? <><CheckCircle2 size={12} style={{ marginRight: 3, verticalAlign: -2 }} />Out: {fmtTime(r.clock_out_at)} ({r.clock_out_distance_m}m)</>
                      : <><XCircle size={12} style={{ marginRight: 3, verticalAlign: -2, color: '#dc2626' }} />Not clocked out</>
                    }
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StatCard({ icon, bg, value, label }) {
  return (
    <div className="kpi-card">
      <div className="kpi-card__icon" style={{ background: bg }}>{icon}</div>
      <div className="kpi-card__body">
        <div className="kpi-card__value">{value}</div>
        <div className="kpi-card__label">{label}</div>
      </div>
    </div>
  )
}
