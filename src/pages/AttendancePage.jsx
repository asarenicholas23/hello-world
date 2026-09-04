import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ClipboardList, AlertCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { listAllAttendance } from '../firebase/attendance'
import { listStaff } from '../firebase/staff'
import { getAttendanceStatus, ATTENDANCE_STATUS_LABEL } from '../utils/attendance'
import { fmtTime, dateStr } from '../utils/records'
import { ROLE_LABEL, hasFullDataAccess } from '../data/constants'

const STATUS_STYLE = {
  on_time:      { bg: '#ecfdf5', color: '#166534' },
  late:         { bg: '#fff7ed', color: '#c2410c' },
  in_progress:  { bg: '#eff6ff', color: '#1d4ed8' },
  no_clock_out: { bg: '#fef2f2', color: '#dc2626' },
}

function weekStart() {
  const d = new Date()
  const day = d.getDay() // 0=Sun
  const diff = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - diff)
  return dateStr(d)
}

// Weekdays (Mon–Fri) in [from, to], inclusive, not after today.
function weekdaysInRange(from, to) {
  const days = []
  const start = new Date(from + 'T00:00:00')
  const end = new Date(Math.min(new Date(to + 'T00:00:00').getTime(), new Date(dateStr() + 'T00:00:00').getTime()))
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) days.push(dateStr(new Date(d)))
  }
  return days
}

export default function AttendancePage() {
  const { role, dataAccess } = useAuth()
  const navigate = useNavigate()

  const [rows, setRows]     = useState([])
  const [staff, setStaff]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  const [dateFrom, setDateFrom]     = useState(weekStart())
  const [dateTo, setDateTo]         = useState(dateStr())
  const [activeFrom, setActiveFrom] = useState(weekStart())
  const [activeTo, setActiveTo]     = useState(dateStr())
  const [staffFilter, setStaffFilter] = useState('')
  const [onlyIssues, setOnlyIssues]   = useState(false)

  const canView = hasFullDataAccess(role, dataAccess)

  useEffect(() => {
    if (!canView) return
    Promise.all([listAllAttendance({ from: activeFrom, to: activeTo }), listStaff()])
      .then(([attendance, staffList]) => {
        setRows(attendance)
        setStaff(staffList)
      })
      .catch(() => setError('Failed to load attendance records.'))
      .finally(() => setLoading(false))
  }, [canView, activeFrom, activeTo])

  function applyDateFilter() { setActiveFrom(dateFrom || null); setActiveTo(dateTo || null) }
  function clearDateFilter() {
    setDateFrom(weekStart()); setDateTo(dateStr())
    setActiveFrom(weekStart()); setActiveTo(dateStr())
    setStaffFilter(''); setOnlyIssues(false)
  }

  const displayed = rows
    .filter((r) => !staffFilter || r.staff_uid === staffFilter)
    .filter((r) => !onlyIssues || ['late', 'no_clock_out'].includes(getAttendanceStatus(r)))
    .sort((a, b) => b.date.localeCompare(a.date) || a.staff_name.localeCompare(b.staff_name))

  const missing = useMemo(() => {
    if (!activeFrom || !activeTo || staff.length === 0) return []
    const days = weekdaysInRange(activeFrom, activeTo)
    const present = new Set(rows.map((r) => `${r.staff_uid}_${r.date}`))
    const out = []
    for (const day of days) {
      for (const s of staff) {
        if (staffFilter && s.id !== staffFilter) continue
        if (!present.has(`${s.id}_${day}`)) out.push({ date: day, staffName: s.name })
      }
    }
    return out
  }, [rows, staff, activeFrom, activeTo, staffFilter])

  if (!canView) {
    return (
      <div className="page">
        <div className="empty-state">You don&apos;t have access to this page.</div>
      </div>
    )
  }

  return (
    <div className="page studio-skin">
      <button className="btn btn--ghost btn--sm btn--back" onClick={() => navigate('/')}>
        <ArrowLeft size={14} /> Back to Dashboard
      </button>

      <div className="page-header" style={{ marginTop: 12 }}>
        <div>
          <div className="page-title">Attendance</div>
          <div className="page-subtitle">{displayed.length} records · {activeFrom}–{activeTo}</div>
        </div>
      </div>

      <div className="dash-date-filter" style={{ marginBottom: 12 }}>
        <span className="dash-date-filter__label">Period:</span>
        <input type="date" className="filter-select" style={{ width: 140 }} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <span style={{ color: '#9ca3af', fontSize: 13 }}>to</span>
        <input type="date" className="filter-select" style={{ width: 140 }} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        <button className="btn btn--primary btn--sm" onClick={applyDateFilter}>Apply</button>
      </div>

      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <select className="select select--sm" value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}>
          <option value="">All staff</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <label className="checkbox-label" style={{ marginLeft: 4 }}>
          <input type="checkbox" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} />
          Show only late / missing clock-out
        </label>
        {(staffFilter || onlyIssues || activeFrom !== weekStart() || activeTo !== dateStr()) && (
          <button className="btn btn--ghost btn--sm" onClick={clearDateFilter}>Clear</button>
        )}
      </div>

      {error && <div className="login-error"><AlertCircle size={14} /> {error}</div>}

      {missing.length > 0 && (
        <div className="card" style={{ marginBottom: 16, borderColor: '#fecaca', background: '#fef2f2' }}>
          <div className="card-title" style={{ color: '#dc2626', marginBottom: 8 }}>
            <ClipboardList size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
            {missing.length} staff-day{missing.length === 1 ? '' : 's'} with no clock-in on record
          </div>
          <div style={{ fontSize: 12.5, color: '#7f1d1d', lineHeight: 1.7 }}>
            {missing.slice(0, 20).map((m, i) => (
              <span key={i}>{m.staffName} ({m.date}){i < Math.min(missing.length, 20) - 1 ? ', ' : ''}</span>
            ))}
            {missing.length > 20 && <span> and {missing.length - 20} more…</span>}
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
            Weekdays only — does not account for approved leave or days off.
          </div>
        </div>
      )}

      {loading ? (
        <div className="empty-state">Loading attendance…</div>
      ) : displayed.length === 0 ? (
        <div className="empty-state">No attendance records match these filters.</div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="staff-table">
            <thead>
              <tr>
                <th>Staff</th>
                <th>Role</th>
                <th>Date</th>
                <th>Clock In</th>
                <th>Clock Out</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((r) => {
                const status = getAttendanceStatus(r)
                const style = STATUS_STYLE[status] ?? {}
                return (
                  <tr key={r.id}>
                    <td>{r.staff_name}</td>
                    <td>{ROLE_LABEL[r.staff_role] ?? r.staff_role}</td>
                    <td>{r.date}</td>
                    <td>{fmtTime(r.clock_in_at)} <span style={{ color: '#9ca3af', fontSize: 11 }}>({r.clock_in_distance_m}m)</span></td>
                    <td>
                      {r.clock_out_at
                        ? <>{fmtTime(r.clock_out_at)} <span style={{ color: '#9ca3af', fontSize: 11 }}>({r.clock_out_distance_m}m)</span></>
                        : <span style={{ color: '#9ca3af' }}>—</span>
                      }
                    </td>
                    <td>
                      <span className="staff-role-badge" style={{ background: style.bg, color: style.color }}>
                        {ATTENDANCE_STATUS_LABEL[status] ?? status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
