import { useState } from 'react'
import { X, ClipboardList, Building2, Search } from 'lucide-react'
import { TASK_TYPES } from '../firebase/tasks'
import { DISTRICTS, ROLE_LABEL } from '../data/constants'

export default function AssignTaskDialog({ open, onClose, onAssign, allStaff, allFacilities }) {
  const [assignedToUid, setAssignedToUid]   = useState('')
  const [assignedTo2Uid, setAssignedTo2Uid] = useState('')
  const [taskType, setTaskType]           = useState('screening')
  const [facilityMode, setFacilityMode]   = useState('registered')
  const [facSearch, setFacSearch]         = useState('')
  const [selectedFac, setSelectedFac]     = useState(null)
  const [showFacList, setShowFacList]     = useState(false)
  const [freeName, setFreeName]           = useState('')
  const [freeDistrict, setFreeDistrict]   = useState('')
  const [freeLocation, setFreeLocation]   = useState('')
  const [freeContact, setFreeContact]     = useState('')
  const [freePhone, setFreePhone]         = useState('')
  const [dueDate, setDueDate]             = useState('')
  const [notes, setNotes]                 = useState('')
  const [saving, setSaving]               = useState(false)
  const [error, setError]                 = useState('')

  if (!open) return null

  const searchFiltered = facSearch.trim()
    ? allFacilities.filter((f) =>
        f.name?.toLowerCase().includes(facSearch.trim().toLowerCase()) ||
        f.file_number?.toLowerCase().includes(facSearch.trim().toLowerCase()))
    : []

  const currentTaskType = TASK_TYPES.find((t) => t.value === taskType)

  function reset() {
    setAssignedToUid(''); setAssignedTo2Uid(''); setTaskType('screening'); setFacilityMode('registered')
    setFacSearch(''); setSelectedFac(null); setShowFacList(false)
    setFreeName(''); setFreeDistrict(''); setFreeLocation(''); setFreeContact(''); setFreePhone('')
    setDueDate(''); setNotes(''); setError('')
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleSave() {
    setError('')
    if (!assignedToUid) { setError('Select an officer to assign this to.'); return }
    if (facilityMode === 'registered' && !selectedFac) { setError('Select a facility.'); return }
    if (facilityMode === 'unregistered' && !freeName.trim()) { setError('Enter a facility name.'); return }

    setSaving(true)
    try {
      const officer = allStaff.find((s) => s.id === assignedToUid)
      const officer2 = assignedTo2Uid ? allStaff.find((s) => s.id === assignedTo2Uid) : null
      await onAssign({
        taskType,
        facilityMode,
        fileNumber:      facilityMode === 'registered' ? selectedFac.file_number : null,
        facilityName:    facilityMode === 'registered' ? selectedFac.name : freeName.trim(),
        facilityDetails: facilityMode === 'unregistered'
          ? { name: freeName.trim(), district: freeDistrict, location: freeLocation.trim(), contact_person: freeContact.trim(), phone: freePhone.trim() }
          : null,
        assignedToUid,
        assignedToName: officer?.name ?? '',
        assignedTo2Uid:  officer2?.id ?? null,
        assignedTo2Name: officer2?.name ?? '',
        dueDate:        dueDate || null,
        notes:          notes.trim(),
      })
      handleClose()
    } catch (err) {
      setError(err.message ?? 'Failed to assign task.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="dialog-overlay" onClick={handleClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="dialog__header">
          <span className="dialog__title"><ClipboardList size={16} /> Assign Task</span>
          <button className="dialog__close" onClick={handleClose}><X size={16} /></button>
        </div>

        <div className="dialog__body">
          {error && <div className="login-error" style={{ marginBottom: 12, fontSize: 13 }}>{error}</div>}

          <div className="form-group">
            <label>Officer</label>
            <select className="select" value={assignedToUid} onChange={(e) => {
              setAssignedToUid(e.target.value)
              if (e.target.value && e.target.value === assignedTo2Uid) setAssignedTo2Uid('')
            }}>
              <option value="">Select officer…</option>
              {allStaff.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({ROLE_LABEL[s.role] ?? s.role})</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Second Officer <span style={{ fontWeight: 400, fontSize: 12, color: '#9ca3af' }}>(optional — e.g. for screenings, which are usually signed off by two officers)</span></label>
            <select className="select" value={assignedTo2Uid} onChange={(e) => setAssignedTo2Uid(e.target.value)}>
              <option value="">None</option>
              {allStaff.filter((s) => s.id !== assignedToUid).map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({ROLE_LABEL[s.role] ?? s.role})</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Action</label>
            <select className="select" value={taskType} onChange={(e) => setTaskType(e.target.value)}>
              {TASK_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            {!currentTaskType?.annotated && (
              <span className="form-hint">This task type uses a simple file upload + approve/request-changes review.</span>
            )}
          </div>

          <div className="form-group">
            <label>Facility</label>
            <div className="sms-mode-toggle" style={{ marginBottom: 8 }}>
              <button type="button"
                className={`sms-mode-btn${facilityMode === 'registered' ? ' sms-mode-btn--active' : ''}`}
                onClick={() => setFacilityMode('registered')}>
                <Building2 size={13} /> In the App
              </button>
              <button type="button"
                className={`sms-mode-btn${facilityMode === 'unregistered' ? ' sms-mode-btn--active' : ''}`}
                onClick={() => setFacilityMode('unregistered')}>
                Not Registered
              </button>
            </div>

            {facilityMode === 'registered' ? (
              <div style={{ position: 'relative' }}>
                <div className="search-box">
                  <Search size={14} className="search-icon" />
                  <input
                    className="search-input"
                    placeholder="Search facility by name or file number…"
                    value={selectedFac ? `${selectedFac.file_number} — ${selectedFac.name}` : facSearch}
                    onFocus={() => { setShowFacList(true); if (selectedFac) { setFacSearch(''); setSelectedFac(null) } }}
                    onChange={(e) => { setFacSearch(e.target.value); setShowFacList(true) }}
                  />
                </div>
                {showFacList && searchFiltered.length > 0 && (
                  <div className="sms-fac-dropdown">
                    {searchFiltered.slice(0, 8).map((f) => (
                      <div key={f.file_number} className="sms-fac-dropdown__item"
                        onMouseDown={() => { setSelectedFac(f); setFacSearch(''); setShowFacList(false) }}>
                        <span className="file-num" style={{ fontSize: 12 }}>{f.file_number}</span>
                        <span style={{ fontSize: 13 }}>{f.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="form-row form-row--wrap">
                <input className="form-input" placeholder="Facility name" value={freeName} onChange={(e) => setFreeName(e.target.value)} />
                <select className="form-input" value={freeDistrict} onChange={(e) => setFreeDistrict(e.target.value)}>
                  <option value="">Select district…</option>
                  {DISTRICTS.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
                </select>
                <input className="form-input" placeholder="Location" value={freeLocation} onChange={(e) => setFreeLocation(e.target.value)} />
                <input className="form-input" placeholder="Contact person" value={freeContact} onChange={(e) => setFreeContact(e.target.value)} />
                <input className="form-input" placeholder="Phone" value={freePhone} onChange={(e) => setFreePhone(e.target.value)} />
              </div>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Due date (optional)</label>
              <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label>Notes / instructions (optional)</label>
            <textarea className="input textarea" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="dialog__footer">
          <button className="btn btn--ghost btn--sm" onClick={handleClose} disabled={saving}>Cancel</button>
          <button className="btn btn--primary btn--sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Assigning…' : 'Assign Task'}
          </button>
        </div>
      </div>
    </div>
  )
}
