import { Clock, Send, Edit3, CheckCircle } from 'lucide-react'

export const TASK_STATUS_META = {
  assigned:          { label: 'Assigned',          bg: '#e0f2fe', color: '#075985', icon: Clock },
  submitted:         { label: 'Submitted',         bg: '#fef9c3', color: '#854d0e', icon: Send },
  changes_requested: { label: 'Changes Requested', bg: '#fee2e2', color: '#991b1b', icon: Edit3 },
  approved:          { label: 'Approved',           bg: '#dcfce7', color: '#166534', icon: CheckCircle },
}

export default function TaskStatusBadge({ status }) {
  const meta = TASK_STATUS_META[status] ?? TASK_STATUS_META.assigned
  const Icon = meta.icon
  return (
    <span className="record-badge" style={{ background: meta.bg, color: meta.color }}>
      <Icon size={11} /> {meta.label}
    </span>
  )
}
