import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Briefcase, AlertCircle, UserCheck, Users, Flag } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { listFacilities } from '../firebase/facilities'
import { listFieldReports } from '../firebase/fieldReports'
import { listStaff } from '../firebase/staff'
import { FIELD_ROLES } from '../data/constants'
import Spinner from '../components/Spinner'

export default function MyAssignmentsPage() {
  const { user, staff, role, roleLevel } = useAuth()
  const navigate = useNavigate()

  const [tab, setTab]                 = useState('mine')
  const [myRecords, setMyRecords]     = useState([])
  const [teamRecords, setTeamRecords] = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')

  const showTeamTab = FIELD_ROLES.has(role)

  useEffect(() => { load() }, [user?.uid])

  async function load() {
    if (!user?.uid) return
    setLoading(true)
    try {
      const [facilities, reports, allStaff] = await Promise.all([
        listFacilities(),
        listFieldReports(),
        showTeamTab ? listStaff() : Promise.resolve([]),
      ])

      const uid = user.uid

      const mine = [
        ...facilities
          .filter((f) => f.primary_officer === uid || (f.supporting_officers ?? []).includes(uid))
          .map((f) => ({
            id:       f.file_number,
            name:     f.name,
            sub:      f.district ?? '',
            isAssigned: f.primary_officer === uid,
            type:     'facility',
          })),
        ...reports
          .filter((r) => r.primary_officer === uid || (r.supporting_officers ?? []).includes(uid))
          .map((r) => ({
            id:       r.id,
            name:     r.facility_name,
            sub:      r.district ?? '',
            isAssigned: r.primary_officer === uid,
            type:     'field_report',
          })),
      ]
      setMyRecords(mine)

      if (showTeamTab && roleLevel != null) {
        const subUids = new Set(
          allStaff
            .filter((s) => s.role_level != null && s.role_level > roleLevel)
            .map((s) => s.id)
        )
        const team = [
          ...facilities
            .filter((f) => f.primary_officer && subUids.has(f.primary_officer))
            .map((f) => ({
              id:       f.file_number,
              name:     f.name,
              sub:      f.district ?? '',
              officerName: f.primary_officer_name,
              type:     'facility',
            })),
          ...reports
            .filter((r) => r.primary_officer && subUids.has(r.primary_officer))
            .map((r) => ({
              id:       r.id,
              name:     r.facility_name,
              sub:      r.district ?? '',
              officerName: r.primary_officer_name,
              type:     'field_report',
            })),
        ]
        setTeamRecords(team)
      }
    } catch {
      setError('Failed to load assignments.')
    } finally {
      setLoading(false)
    }
  }

  function navigate_to(item) {
    if (item.type === 'facility') navigate(`/facilities/${item.id}`)
    else navigate('/field-reports')
  }

  if (loading) return <div className="tab-loading"><Spinner size={24} /></div>
  if (error)   return <div className="login-error" style={{ margin: '12px 0' }}><AlertCircle size={14} /> {error}</div>

  const displayed = tab === 'team' ? teamRecords : myRecords

  return (
    <div className="page-inner">
      <div className="page-header">
        <div className="page-header__left">
          <Briefcase size={20} className="page-header__icon" />
          <div>
            <h1 className="page-title">My Assignments</h1>
            <p className="page-subtitle">{staff?.name} · {staff?.role?.replace(/_/g, ' ')}</p>
          </div>
        </div>
      </div>

      <div className="assignments-stats-row">
        <div className="assignments-stat">
          <span className="assignments-stat__num">
            {myRecords.filter((r) => r.isAssigned).length}
          </span>
          <span className="assignments-stat__label">Primary</span>
        </div>
        <div className="assignments-stat">
          <span className="assignments-stat__num">
            {myRecords.filter((r) => !r.isAssigned).length}
          </span>
          <span className="assignments-stat__label">Supporting</span>
        </div>
        {showTeamTab && (
          <div className="assignments-stat">
            <span className="assignments-stat__num">{teamRecords.length}</span>
            <span className="assignments-stat__label">Team</span>
          </div>
        )}
      </div>

      {showTeamTab && (
        <div className="tab-bar" style={{ marginBottom: 16 }}>
          <button className={`tab${tab === 'mine' ? ' tab--active' : ''}`} onClick={() => setTab('mine')}>
            <UserCheck size={14} /> My Facilities ({myRecords.length})
          </button>
          <button className={`tab${tab === 'team' ? ' tab--active' : ''}`} onClick={() => setTab('team')}>
            <Users size={14} /> Team ({teamRecords.length})
          </button>
        </div>
      )}

      {displayed.length === 0 ? (
        <div className="tab-empty">
          {tab === 'mine' ? 'No facilities assigned to you yet.' : 'No team assignments yet.'}
        </div>
      ) : (
        <div className="record-list">
          {displayed.map((item) => (
            <div
              key={`${item.type}-${item.id}`}
              className="record-item record-item--clickable"
              onClick={() => navigate_to(item)}
            >
              <div className="record-item__header">
                <span className="record-item__title">{item.name}</span>
                {item.type === 'field_report' && (
                  <span className="record-badge" style={{ background: '#fff7ed', color: '#c2410c' }}>
                    <Flag size={10} style={{ marginRight: 3 }} />Field Report
                  </span>
                )}
                {tab === 'mine' && (
                  <span className={`assignments-role-badge${item.isAssigned ? ' assignments-role-badge--primary' : ''}`}>
                    {item.isAssigned ? 'Primary' : 'Supporting'}
                  </span>
                )}
                {tab === 'team' && item.officerName && (
                  <span className="assignments-role-badge">{item.officerName}</span>
                )}
              </div>
              <div className="record-item__meta">
                <span>{item.id}</span>
                {item.sub && <span>{item.sub}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
