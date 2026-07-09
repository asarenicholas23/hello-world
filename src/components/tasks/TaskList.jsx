import { taskTypeLabel, isTaskAssignee } from '../../firebase/tasks'
import { fmtDate } from '../../utils/records'
import TaskStatusBadge from './TaskStatusBadge'

function assignedToLabel(task) {
  return task.assigned_to_2_name ? `${task.assigned_to_name}, ${task.assigned_to_2_name}` : task.assigned_to_name
}

/**
 * Shared task list/card renderer used by both My Assignments (a user's own
 * tasks) and All Assignments (the org-wide management view) so the action
 * shown per task (fill / review / view) stays consistent everywhere.
 */
export default function TaskList({ tasks, userUid, navigate, emptyMessage = 'No tasks here yet.' }) {
  function primaryAction(task) {
    const isAssignee = isTaskAssignee(task, userUid)
    const isAssigner = task.assigned_by === userUid

    if (isAssignee && (task.status === 'assigned' || task.status === 'changes_requested')) {
      return {
        label: task.task_type === 'screening'
          ? (task.status === 'changes_requested' ? 'Revise & Resubmit' : 'Fill Screening Form')
          : (task.status === 'changes_requested' ? 'Re-upload File' : 'Upload File'),
        onClick: () => navigate(`/tasks/${task.id}/fill`),
        primary: true,
      }
    }
    if (isAssigner && task.status === 'submitted') {
      return { label: 'Review Submission', onClick: () => navigate(`/tasks/${task.id}/review`), primary: true }
    }
    return { label: 'View', onClick: () => navigate(`/tasks/${task.id}/review`), primary: false }
  }

  if (tasks.length === 0) return <div className="tab-empty">{emptyMessage}</div>

  return (
    <div className="record-list">
      {tasks.map((task) => {
        const action = primaryAction(task)
        return (
          <div key={task.id} className="record-item">
            <div className="record-item__header">
              <span className="record-item__title">
                {taskTypeLabel(task.task_type)} — {task.facility_name}
              </span>
              <TaskStatusBadge status={task.status} />
            </div>
            <div className="record-item__meta">
              <span>Assigned to: {assignedToLabel(task)}</span>
              <span>Assigned by: {task.assigned_by_name}</span>
              {task.facility_mode === 'unregistered' && <span>Not registered in app</span>}
              {task.due_date && <span>Due: {fmtDate(task.due_date)}</span>}
            </div>
            {task.notes && <div className="record-item__note">{task.notes}</div>}
            <div className="record-item__actions">
              <button className={`btn btn--${action.primary ? 'primary' : 'ghost'} btn--xs`} onClick={action.onClick}>
                {action.label}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
