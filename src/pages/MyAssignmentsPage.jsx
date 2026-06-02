import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Briefcase, AlertCircle, UserCheck, Users, Flag, CheckSquare } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { listFacilities } from '../firebase/facilities'
import { listFieldReports } from '../firebase/fieldReports'
import { listStaff } from '../firebase/staff'
import { markAssignmentStatus } from '../firebase/assignments'
import { FIELD_ROLES } from '../data/constants'
import { facilityPath } from '../utils/fileNumbers'
import Spinner from '../components/Spinner'
import WorkflowPanel from '../components/WorkflowPanel'

export default function MyAssignmentsPage() {
  const { user, staff, role, roleLevel } = useAuth()
  const navigate = useNavigate()

  const [tab, setTab]                 = useState('mine')
  const [statusTab, setStatusTab]     = useState('active')
  const [myRecords, setMyRecords]     = useState([])
  const [teamRecords, setTeamRecords] = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const [savingStatusId, setSavingStatusId] = useState('')
  const [workflowFacility, setWorkflowFacility] = useState(null)

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
            id:              f.file_number,
            name:            f.name,
            sub:             f.district ?? '',
            isAssigned:      f.primary_officer === uid,
            type:            'facility',
            facility:        f,
            assignment_status: f.assignment_status ?? 'active',
          })),
        ...reports
          .filter((r) => r.primary_officer === uid || (r.supporting_officers ?? []).includes(uid))
          .map((r) => ({
            id:              r.id,
            name:            r.facility_name,
            sub:             r.district ?? '',
            isAssigned:      r.primary_officer === uid,
            type:            'field_report',
            assignment_status: r.assignment_status ?? 'active',
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
              id:              f.file_number,
              name:            f.name,
              sub:             f.district ?? '',
              officerName:     f.primary_officer_name,
              type:            'facility',
              facility:        f,
              assignment_status: f.assignment_status ?? 'active',
            })),
          ...reports
            .filter((r) => r.primary_officer && subUids.has(r.primary_officer))
            .map((r) => ({
              id:              r.id,
              name:            r.facility_name,
              sub:             r.district ?? '',
              officerName:     r.primary_officer_name,
              type:            'field_report',
              assignment_status: r.assignment_status ?? 'active',
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
    if (item.type === 'facility') navigate(facilityPath(item.id))
    else navigate('/field-reports')
  }

  function openWorkflow(e, item) {
    e.stopPropagation()
    if (item.type === 'facility') setWorkflowFacility(item.facility)
  }

  function handleWorkflowUpdated(nextFacility) {
    setWorkflowFacility(nextFacility)
    const patch = (item) => item.type === 'facility' && item.id === nextFacility.file_number
      ? { ...item, facility: nextFacility }
      : item
    setMyRecords((items) => items.map(patch))
    setTeamRecords((items) => items.map(patch))
  }

  function isCompletedAssignment(item) {
    return item.assignment_status === 'completed'
  }

  async function handleToggleAssignmentStatus(e, item, completed) {
    e.stopPropagation()
    const savingKey = `${item.type}-${item.id}`
    setSavingStatusId(savingKey)
    setError('')
    try {
      const status = completed ? 'completed' : 'active'
      const basePath = item.type === 'facility' ? 'facilities' : 'field_reports'
      await markAssignmentStatus({ basePath, recordId: item.id, status, uid: user?.uid })
      const patch = (record) => record.id === item.id
        ? { ...record, assignment_status: status }
        : record
      setMyRecords((items) => items.map(patch))
      setTeamRecords((items) => items.map(patch))
    } catch (err) {
      console.error('Failed to update assignment status', err)
      setError('Failed to update assignment status.')
    } finally {
      setSavingStatusId('')
    }
  }

  if (loading) return <div className="tab-loading"><Spinner size={24} /></div>
  if (error)   return <div className="login-error" style={{ margin: '12px 0' }}><AlertCircle size={14} /> {error}</div>

  const displayed = (tab === 'team' ? teamRecords : myRecords).filter((item) =>
    statusTab === 'completed' ? isCompletedAssignment(item) : !isCompletedAssignment(item)
  )
  const currentRecords = tab === 'team' ? teamRecords : myRecords
  const activeCount = currentRecords.filter((item) => item.assignment_status !== 'completed').length
  const completedCount = currentRecords.filter((item) => item.assignment_status === 'completed').length

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

      <div className="tab-bar" style={{ marginBottom: 16 }}>
        <button className={`tab${statusTab === 'active' ? ' tab--active' : ''}`} onClick={() => setStatusTab('active')}>
          <CheckSquare size={14} /> Active Assignments ({activeCount})
        </button>
        <button className={`tab${statusTab === 'completed' ? ' tab--active' : ''}`} onClick={() => setStatusTab('completed')}>
          <CheckSquare size={14} /> Completed Assignments ({completedCount})
        </button>
      </div>

      {displayed.length === 0 ? (
        <div className="tab-empty">
          {statusTab === 'completed'
            ? `No completed ${tab === 'team' ? 'team' : 'my'} assignments yet.`
            : `No active ${tab === 'team' ? 'team' : 'my'} assignments yet.`}
        </div>
      ) : (
        <div className="record-list">
          {displayed.map((item) => {
            const completed = item.assignment_status === 'completed'
            const saving = savingStatusId === `${item.type}-${item.id}`
            return (
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
                  {completed && (
                    <span className="record-badge" style={{ background: '#ecfdf5', color: '#166534' }}>
                      Completed
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
                <div className="record-item__actions">
                  {item.type === 'facility' && (
                    <button className="btn btn--primary btn--xs" onClick={(e) => openWorkflow(e, item)}>
                      <CheckSquare size={12} /> Open Workflow
                    </button>
                  )}
                  <button
                    className={`btn btn--${completed ? 'secondary' : 'success'} btn--xs`}
                    style={{ marginLeft: item.type === 'facility' ? 8 : 0 }}
                    onClick={(e) => handleToggleAssignmentStatus(e, item, !completed)}
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : completed ? 'Reopen' : 'Mark complete'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {workflowFacility && (
        <WorkflowPanel
          facility={workflowFacility}
          onClose={() => setWorkflowFacility(null)}
          onUpdated={handleWorkflowUpdated}
        />
      )}
    </div>
  )
}
