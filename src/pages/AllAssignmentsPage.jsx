import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { LayoutList, AlertCircle, UserCheck, Flag } from 'lucide-react'
import { listFacilities } from '../firebase/facilities'
import { listFieldReports } from '../firebase/fieldReports'
import { listStaff } from '../firebase/staff'
import Spinner from '../components/Spinner'

export default function AllAssignmentsPage() {
  const navigate = useNavigate()

  const [records, setRecords]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')

  const [filterOfficer, setFilterOfficer]       = useState('')
  const [filterType, setFilterType]             = useState('')
  const [filterUnassigned, setFilterUnassigned] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [facilities, reports] = await Promise.all([listFacilities(), listFieldReports()])
      const combined = [
        ...facilities.map((f) => ({
          id:                  f.file_number,
          name:                f.name,
          sub:                 f.district ?? '',
          primary_officer:     f.primary_officer ?? null,
          primary_officer_name: f.primary_officer_name ?? null,
          supporting_officers: f.supporting_officers ?? [],
          type:                'facility',
        })),
        ...reports.map((r) => ({
          id:                  r.id,
          name:                r.facility_name,
          sub:                 r.district ?? '',
          primary_officer:     r.primary_officer ?? null,
          primary_officer_name: r.primary_officer_name ?? null,
          supporting_officers: r.supporting_officers ?? [],
          type:                'field_report',
        })),
      ]
      setRecords(combined)
    } catch {
      setError('Failed to load assignments.')
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (filterUnassigned && r.primary_officer) return false
      if (!filterUnassigned && filterOfficer && r.primary_officer !== filterOfficer) return false
      if (filterType && r.type !== filterType) return false
      return true
    })
  }, [records, filterOfficer, filterType, filterUnassigned])

  const workload = useMemo(() => {
    const map = {}
    records.forEach((r) => {
      if (!r.primary_officer) return
      const key = r.primary_officer
      if (!map[key]) map[key] = { uid: key, name: r.primary_officer_name ?? key, count: 0 }
      map[key].count++
    })
    return Object.values(map).sort((a, b) => b.count - a.count)
  }, [records])

  const assignedOfficers = useMemo(() => {
    const seen = new Set()
    return records
      .filter((r) => r.primary_officer && !seen.has(r.primary_officer) && seen.add(r.primary_officer))
      .map((r) => ({ uid: r.primary_officer, name: r.primary_officer_name ?? r.primary_officer }))
  }, [records])

  const unassignedCount = records.filter((r) => !r.primary_officer).length

  if (loading) return <div className="tab-loading"><Spinner size={24} /></div>
  if (error)   return <div className="login-error" style={{ margin: '12px 0' }}><AlertCircle size={14} /> {error}</div>

  return (
    <div className="page-inner">
      <div className="page-header">
        <div className="page-header__left">
          <LayoutList size={20} className="page-header__icon" />
          <div>
            <h1 className="page-title">All Assignments</h1>
            <p className="page-subtitle">{records.length} facilities · {unassignedCount} unassigned</p>
          </div>
        </div>
      </div>

      {workload.length > 0 && (
        <div className="workload-row">
          {workload.map((w) => (
            <button
              key={w.uid}
              className={`workload-chip${filterOfficer === w.uid ? ' workload-chip--active' : ''}`}
              onClick={() => {
                setFilterUnassigned(false)
                setFilterOfficer(filterOfficer === w.uid ? '' : w.uid)
              }}
            >
              <UserCheck size={12} />
              <span className="workload-chip__name">{w.name}</span>
              <span className="workload-chip__count">{w.count}</span>
            </button>
          ))}
        </div>
      )}

      <div className="filter-bar" style={{ marginTop: 12 }}>
        <select className="select select--sm" value={filterOfficer} disabled={filterUnassigned}
          onChange={(e) => setFilterOfficer(e.target.value)}>
          <option value="">All officers</option>
          {assignedOfficers.map((o) => (
            <option key={o.uid} value={o.uid}>{o.name}</option>
          ))}
        </select>

        <select className="select select--sm" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="">All types</option>
          <option value="facility">Facilities</option>
          <option value="field_report">Field Reports</option>
        </select>

        <label className="checkbox-label" style={{ marginLeft: 4 }}>
          <input type="checkbox" checked={filterUnassigned}
            onChange={(e) => { setFilterUnassigned(e.target.checked); if (e.target.checked) setFilterOfficer('') }} />
          Unassigned only
        </label>

        {(filterOfficer || filterType || filterUnassigned) && (
          <button className="btn btn--ghost btn--sm"
            onClick={() => { setFilterOfficer(''); setFilterType(''); setFilterUnassigned(false) }}>
            Clear
          </button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#6b7280' }}>
          {filtered.length} result{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="tab-empty">No records match this filter.</div>
      ) : (
        <div className="record-list" style={{ marginTop: 12 }}>
          {filtered.map((r) => (
            <div
              key={`${r.type}-${r.id}`}
              className="record-item record-item--clickable"
              onClick={() => r.type === 'facility' ? navigate(`/facilities/${r.id}`) : navigate('/field-reports')}
            >
              <div className="record-item__header">
                <span className="record-item__title">{r.name}</span>
                {r.type === 'field_report' && (
                  <span className="record-badge" style={{ background: '#fff7ed', color: '#c2410c' }}>
                    <Flag size={10} style={{ marginRight: 3 }} />Field Report
                  </span>
                )}
                {r.primary_officer ? (
                  <span className="record-badge" style={{ background: '#dbeafe', color: '#1d4ed8' }}>Assigned</span>
                ) : (
                  <span className="record-badge" style={{ background: '#f3f4f6', color: '#6b7280' }}>Unassigned</span>
                )}
              </div>
              <div className="permit-assignment-row" style={{ marginTop: 4 }}>
                <UserCheck size={13} style={{ flexShrink: 0, color: r.primary_officer ? '#1d4ed8' : '#9ca3af' }} />
                {r.primary_officer ? (
                  <span className="permit-assignment-row__name">{r.primary_officer_name}</span>
                ) : (
                  <span className="permit-assignment-row__unassigned">Unassigned</span>
                )}
                {r.supporting_officers.length > 0 && (
                  <span style={{ fontSize: 11, color: '#6b7280' }}>+{r.supporting_officers.length} supporting</span>
                )}
              </div>
              <div className="record-item__meta" style={{ marginTop: 4 }}>
                <span>{r.id}</span>
                {r.sub && <span>{r.sub}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
