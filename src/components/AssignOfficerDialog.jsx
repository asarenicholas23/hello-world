import { useState } from 'react'
import { X, UserCheck } from 'lucide-react'
import { FIELD_ROLES, ADMIN_ROLES, ROLE_LEVEL } from '../data/constants'

function getEligibleOfficers(allStaff, currentRole, currentUid) {
  if (ADMIN_ROLES.has(currentRole)) {
    return allStaff.filter((s) => FIELD_ROLES.has(s.role))
  }
  const level = ROLE_LEVEL[currentRole] ?? 99
  return allStaff.filter((s) => {
    if (s.id === currentUid) return true
    return s.role_level !== null && s.role_level > level
  })
}

export default function AssignOfficerDialog({
  open, onClose, onAssign, onUnassign,
  record, currentUid, currentRole, allStaff,
}) {
  const [selectedUid, setSelectedUid] = useState(record?.primary_officer ?? '')
  const [assignType, setAssignType]   = useState('primary')
  const [saving, setSaving]           = useState(false)

  if (!open) return null

  const eligible   = getEligibleOfficers(allStaff, currentRole, currentUid)
  const isAssigned = Boolean(record?.primary_officer)
  const isSelfOnly = eligible.length === 1 && eligible[0].id === currentUid
  const displayLabel = record?.label ?? record?.permit_number ?? '—'

  async function handleSave() {
    if (!selectedUid) return
    const officer = allStaff.find((s) => s.id === selectedUid)
    if (!officer) return
    setSaving(true)
    try {
      await onAssign({ toUid: selectedUid, toName: officer.name, type: assignType })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  async function handleUnassign() {
    if (!window.confirm('Remove assignment from this facility?')) return
    setSaving(true)
    try {
      await onUnassign()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog__header">
          <span className="dialog__title">
            <UserCheck size={16} /> {isAssigned ? 'Reassign' : 'Assign Officer'}
          </span>
          <button className="dialog__close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="dialog__body">
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
            Facility: <strong>{displayLabel}</strong>
            {isAssigned && (
              <span style={{ marginLeft: 8 }}>
                · Currently: <strong>{record.primary_officer_name}</strong>
              </span>
            )}
          </div>

          {isSelfOnly && (
            <div className="dialog__hint">You can only assign this facility to yourself.</div>
          )}

          <div className="form-group">
            <label>Officer</label>
            <select
              className="select"
              value={selectedUid}
              onChange={(e) => setSelectedUid(e.target.value)}
            >
              <option value="">Select officer…</option>
              {eligible.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.role.replace(/_/g, ' ')}) · {s.staff_id}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Assignment type</label>
            <div className="radio-group">
              <label className="radio-label">
                <input type="radio" value="primary" checked={assignType === 'primary'}
                  onChange={() => setAssignType('primary')} />
                Primary officer
              </label>
              <label className="radio-label">
                <input type="radio" value="supporting" checked={assignType === 'supporting'}
                  onChange={() => setAssignType('supporting')} />
                Supporting officer
              </label>
            </div>
          </div>
        </div>

        <div className="dialog__footer">
          {isAssigned && (
            <button className="btn btn--ghost btn--sm" style={{ color: '#dc2626' }}
              onClick={handleUnassign} disabled={saving}>
              Unassign
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button className="btn btn--ghost btn--sm" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn--primary btn--sm" onClick={handleSave}
            disabled={saving || !selectedUid}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
