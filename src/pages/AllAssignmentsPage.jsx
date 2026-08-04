import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { LayoutList, AlertCircle, UserCheck, Flag, ClipboardList, LayoutGrid } from 'lucide-react'
import { listFacilities } from '../firebase/facilities'
import { listFieldReports } from '../firebase/fieldReports'
import { listStaff } from '../firebase/staff'
import { useAuth } from '../context/AuthContext'
import { createTask, updateTaskAssignment, listAllTasks } from '../firebase/tasks'
import { createNotification } from '../firebase/notifications'
import { facilityPath } from '../utils/fileNumbers'
import Spinner from '../components/Spinner'
import AssignTaskDialog from '../components/AssignTaskDialog'
import TaskList from '../components/tasks/TaskList'

export default function AllAssignmentsPage() {
  const navigate = useNavigate()
  const { user, staff } = useAuth()

  const [viewMode, setViewMode]   = useState('assignments') // 'assignments' | 'tasks'
  const [records, setRecords]     = useState([])
  const [tasks, setTasks]         = useState([])
  const [allStaff, setAllStaff]   = useState([])
  const [allFacilities, setAllFacilities] = useState([])
  const [allFieldReports, setAllFieldReports] = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [editingTask, setEditingTask]       = useState(null)
  const [dialogSession, setDialogSession]   = useState(0)
  const [taskSuccess, setTaskSuccess]       = useState('')

  const [filterOfficer, setFilterOfficer]       = useState('')
  const [filterType, setFilterType]             = useState('')
  const [filterUnassigned, setFilterUnassigned] = useState(false)

  const [taskFilterOfficer, setTaskFilterOfficer] = useState('')
  const [taskFilterStatus, setTaskFilterStatus]   = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [facilities, reports, staffList, allTasks] = await Promise.all([
        listFacilities(), listFieldReports(), listStaff(), listAllTasks(),
      ])
      setAllStaff(staffList)
      setAllFacilities(facilities)
      setAllFieldReports(reports)
      setTasks(allTasks)
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

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (taskFilterOfficer && t.assigned_to !== taskFilterOfficer && t.assigned_to_2 !== taskFilterOfficer) return false
      if (taskFilterStatus && t.status !== taskFilterStatus) return false
      return true
    })
  }, [tasks, taskFilterOfficer, taskFilterStatus])

  const taskOfficers = useMemo(() => {
    const seen = new Set()
    const officers = []
    for (const t of tasks) {
      if (t.assigned_to && !seen.has(t.assigned_to)) { seen.add(t.assigned_to); officers.push({ uid: t.assigned_to, name: t.assigned_to_name ?? t.assigned_to }) }
      if (t.assigned_to_2 && !seen.has(t.assigned_to_2)) { seen.add(t.assigned_to_2); officers.push({ uid: t.assigned_to_2, name: t.assigned_to_2_name ?? t.assigned_to_2 }) }
    }
    return officers
  }, [tasks])

  async function handleAssignTask(data) {
    const taskId = await createTask({
      ...data,
      assignedByUid:  user.uid,
      assignedByName: staff?.name ?? '',
    })
    const message = `${staff?.name ?? 'A colleague'} assigned you a "${data.taskType.replace(/_/g, ' ')}" task for ${data.facilityName}.`
    createNotification(data.assignedToUid, 'task_assigned', message, { taskId }).catch(() => {})
    if (data.assignedTo2Uid) createNotification(data.assignedTo2Uid, 'task_assigned', message, { taskId }).catch(() => {})
    setTaskSuccess(`Task assigned to ${data.assignedToName}${data.assignedTo2Name ? ` and ${data.assignedTo2Name}` : ''}.`)
    setTimeout(() => setTaskSuccess(''), 3500)
    listAllTasks().then(setTasks).catch(() => {})
  }

  function handleEditTask(task) {
    setEditingTask(task)
    setDialogSession((n) => n + 1)
    setTaskDialogOpen(true)
  }

  async function handleSaveTaskEdit(taskId, data) {
    await updateTaskAssignment(taskId, data, user.uid)
    setTaskSuccess('Task updated.')
    setTimeout(() => setTaskSuccess(''), 3500)
    listAllTasks().then(setTasks).catch(() => {})
  }

  if (loading) return <div className="tab-loading"><Spinner size={24} /></div>
  if (error)   return <div className="login-error" style={{ margin: '12px 0' }}><AlertCircle size={14} /> {error}</div>

  return (
    <div className="page-inner">
      {taskSuccess && (
        <div className="assign-success-banner" style={{ marginBottom: 12 }}>
          <UserCheck size={14} /> {taskSuccess}
        </div>
      )}
      <div className="page-header">
        <div className="page-header__left">
          <LayoutList size={20} className="page-header__icon" />
          <div>
            <h1 className="page-title">All Assignments</h1>
            <p className="page-subtitle">{records.length} facilities · {unassignedCount} unassigned</p>
          </div>
        </div>
        <button className="btn btn--primary btn--sm" onClick={() => { setEditingTask(null); setDialogSession((n) => n + 1); setTaskDialogOpen(true) }}>
          <ClipboardList size={14} /> Assign Task
        </button>
      </div>

      <AssignTaskDialog
        key={dialogSession}
        open={taskDialogOpen}
        onClose={() => { setTaskDialogOpen(false); setEditingTask(null) }}
        onAssign={handleAssignTask}
        onSaveEdit={handleSaveTaskEdit}
        editTask={editingTask}
        allStaff={allStaff}
        allFacilities={allFacilities}
        allFieldReports={allFieldReports}
      />

      <div className="tab-bar" style={{ marginTop: 12, marginBottom: 12 }}>
        <button className={`tab${viewMode === 'assignments' ? ' tab--active' : ''}`} onClick={() => setViewMode('assignments')}>
          <LayoutGrid size={14} /> Facility Assignments ({records.length})
        </button>
        <button className={`tab${viewMode === 'tasks' ? ' tab--active' : ''}`} onClick={() => setViewMode('tasks')}>
          <ClipboardList size={14} /> Tasks ({tasks.length})
        </button>
      </div>

      {viewMode === 'tasks' ? (
        <div>
          <div className="filter-bar">
            <select className="select select--sm" value={taskFilterOfficer} onChange={(e) => setTaskFilterOfficer(e.target.value)}>
              <option value="">All officers</option>
              {taskOfficers.map((o) => (
                <option key={o.uid} value={o.uid}>{o.name}</option>
              ))}
            </select>
            <select className="select select--sm" value={taskFilterStatus} onChange={(e) => setTaskFilterStatus(e.target.value)}>
              <option value="">All statuses</option>
              <option value="assigned">Assigned</option>
              <option value="submitted">Submitted</option>
              <option value="changes_requested">Changes Requested</option>
              <option value="approved">Approved</option>
            </select>
            {(taskFilterOfficer || taskFilterStatus) && (
              <button className="btn btn--ghost btn--sm" onClick={() => { setTaskFilterOfficer(''); setTaskFilterStatus('') }}>
                Clear
              </button>
            )}
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#6b7280' }}>
              {filteredTasks.length} result{filteredTasks.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div style={{ marginTop: 12 }}>
            <TaskList tasks={filteredTasks} userUid={user.uid} navigate={navigate} emptyMessage="No tasks match this filter." onEdit={handleEditTask} />
          </div>
        </div>
      ) : (
      <>
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
              onClick={() => r.type === 'facility' ? navigate(facilityPath(r.id)) : navigate('/field-reports')}
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
      </>
      )}
    </div>
  )
}
