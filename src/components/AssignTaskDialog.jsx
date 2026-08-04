import { useMemo, useState } from 'react'
import { X, ClipboardList, Building2, Search, Flag } from 'lucide-react'
import { TASK_TYPES } from '../firebase/tasks'
import { DISTRICTS, ROLE_LABEL } from '../data/constants'

// PP (Agrochemical/Pesticide) facilities always use the Pesticides Checklist
// instead of the standard EA1 screening / site verification forms. Normally
// that's detected automatically from the facility's registered sector_prefix
// — but that detection has nothing to go on for a facility that isn't
// registered in the app yet ("Not Registered" mode has no sector_prefix at
// all), so a pesticide screening for a brand-new facility would silently
// fall back to the old EA1 form. These two options let the assigner force
// the Pesticides Checklist explicitly, regardless of facility registration.
const PESTICIDE_ACTION_TYPE = { pesticides_new: 'screening', pesticides_renewal: 'site_verification' }
const ACTION_OPTIONS = TASK_TYPES.flatMap((t) => {
  if (t.value === 'screening') return [t, { value: 'pesticides_new', label: 'Pesticides Checklist (New Facility)' }]
  if (t.value === 'site_verification') return [t, { value: 'pesticides_renewal', label: 'Pesticides Checklist (Renewal)' }]
  return [t]
})

function initialActionSelection(editTask) {
  if (!editTask) return 'screening'
  if (editTask.task_type === 'screening' && editTask.sector_prefix === 'PP') return 'pesticides_new'
  if (editTask.task_type === 'site_verification' && editTask.sector_prefix === 'PP') return 'pesticides_renewal'
  return editTask.task_type ?? 'screening'
}

// Initial facility selection when editing an existing task — mirrors the
// shape handleSave produces so re-saving without touching the facility
// field is a no-op. Callers should mount this component with a `key` that
// changes per edit target (see AllAssignmentsPage) so these lazy initial
// values are recomputed fresh instead of carrying over stale local state.
function initialSelectedFac(editTask) {
  if (!editTask) return null
  if (editTask.facility_mode === 'registered') {
    return { kind: 'facility', key: editTask.file_number, file_number: editTask.file_number, name: editTask.facility_name, sector_prefix: editTask.sector_prefix }
  }
  if (editTask.field_report_id) {
    return {
      kind: 'field_report', key: editTask.field_report_id, id: editTask.field_report_id,
      name: editTask.facility_name, ...(editTask.facility_details ?? {}), screening: null,
    }
  }
  return null
}

export default function AssignTaskDialog({ open, onClose, onAssign, onSaveEdit, allStaff, allFacilities, allFieldReports = [], editTask = null }) {
  const [assignedToUid, setAssignedToUid]   = useState(() => editTask?.assigned_to ?? '')
  const [assignedTo2Uid, setAssignedTo2Uid] = useState(() => editTask?.assigned_to_2 ?? '')
  const [actionSelection, setActionSelection] = useState(() => initialActionSelection(editTask))
  const taskType = PESTICIDE_ACTION_TYPE[actionSelection] ?? actionSelection
  const forcePesticideChecklist = Boolean(PESTICIDE_ACTION_TYPE[actionSelection])
  const [facilityMode, setFacilityMode]   = useState(() => (
    editTask && editTask.facility_mode !== 'registered' && !editTask.field_report_id ? 'unregistered' : 'registered'
  ))
  const [facSearch, setFacSearch]         = useState('')
  const [selectedFac, setSelectedFac]     = useState(() => initialSelectedFac(editTask))
  const [showFacList, setShowFacList]     = useState(false)
  const [freeName, setFreeName]           = useState(() => editTask?.facility_details?.name ?? '')
  const [freeDistrict, setFreeDistrict]   = useState(() => editTask?.facility_details?.district ?? '')
  const [freeLocation, setFreeLocation]   = useState(() => editTask?.facility_details?.location ?? '')
  const [freeContact, setFreeContact]     = useState(() => editTask?.facility_details?.contact_person ?? '')
  const [freePhone, setFreePhone]         = useState(() => editTask?.facility_details?.phone ?? '')
  const [dueDate, setDueDate]             = useState(() => editTask?.due_date ?? '')
  const [notes, setNotes]                 = useState(() => editTask?.notes ?? '')
  const [saving, setSaving]               = useState(false)
  const [error, setError]                 = useState('')

  // Field reports not yet linked to a registered facility can also be picked
  // as the task's facility — the officer gets the details (and any screening
  // already captured) already filled in, rather than retyping from scratch.
  const facilityOptions = useMemo(() => [
    ...allFacilities.map((f) => ({ kind: 'facility', key: f.file_number, file_number: f.file_number, name: f.name, sector_prefix: f.sector_prefix })),
    ...allFieldReports
      .filter((r) => !r.assigned_file_number)
      .map((r) => ({ kind: 'field_report', key: r.id, id: r.id, name: r.facility_name, district: r.district, location: r.location, contact_person: r.contact_person, phone: r.phone, screening: r.screening ?? null })),
  ], [allFacilities, allFieldReports])

  if (!open) return null

  const searchFiltered = facSearch.trim()
    ? facilityOptions.filter((f) =>
        f.name?.toLowerCase().includes(facSearch.trim().toLowerCase()) ||
        f.file_number?.toLowerCase().includes(facSearch.trim().toLowerCase()))
    : []

  const currentTaskType = TASK_TYPES.find((t) => t.value === taskType)

  function handleClose() {
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
      // A field report picked from the "In the App" search has no file
      // number of its own yet, so it's stored the same way a manually-typed
      // unregistered facility is — just with its already-captured details
      // (and screening, if any) carried over instead of retyped.
      const isFieldReportPick = facilityMode === 'registered' && selectedFac?.kind === 'field_report'
      const payload = {
        taskType,
        facilityMode:    isFieldReportPick ? 'unregistered' : facilityMode,
        fileNumber:      facilityMode === 'registered' && !isFieldReportPick ? selectedFac.file_number : null,
        facilityName:    facilityMode === 'registered' ? selectedFac.name : freeName.trim(),
        facilityDetails: facilityMode === 'unregistered'
          ? { name: freeName.trim(), district: freeDistrict, location: freeLocation.trim(), contact_person: freeContact.trim(), phone: freePhone.trim() }
          : isFieldReportPick
            ? { name: selectedFac.name, district: selectedFac.district ?? '', location: selectedFac.location ?? '', contact_person: selectedFac.contact_person ?? '', phone: selectedFac.phone ?? '' }
            : null,
        fieldReportId:     isFieldReportPick ? selectedFac.id : null,
        sectorPrefix:      forcePesticideChecklist
          ? 'PP'
          : (facilityMode === 'registered' && !isFieldReportPick ? (selectedFac.sector_prefix ?? null) : null),
        assignedToUid,
        assignedToName: officer?.name ?? '',
        assignedTo2Uid:  officer2?.id ?? null,
        assignedTo2Name: officer2?.name ?? '',
        dueDate:        dueDate || null,
        notes:          notes.trim(),
      }
      if (editTask) {
        // Editing never re-derives screeningPrefill/form_data — that would
        // risk clobbering a submission the assignee already made.
        await onSaveEdit(editTask.id, payload)
      } else {
        await onAssign({ ...payload, screeningPrefill: isFieldReportPick ? selectedFac.screening : null })
      }
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
          <span className="dialog__title"><ClipboardList size={16} /> {editTask ? 'Edit Task' : 'Assign Task'}</span>
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
            <select className="select" value={actionSelection} onChange={(e) => setActionSelection(e.target.value)}>
              {ACTION_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            {forcePesticideChecklist ? (
              <span className="form-hint">Uses the Pesticides Checklist regardless of the facility&apos;s registered sector — use this for pesticide/agrochemical facilities instead of the standard {actionSelection === 'pesticides_new' ? 'Screening' : 'Site Verification'} form.</span>
            ) : !currentTaskType?.formFlow && (
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
                    placeholder="Search facility or field report by name/file number…"
                    value={selectedFac ? (selectedFac.kind === 'field_report' ? selectedFac.name : `${selectedFac.file_number} — ${selectedFac.name}`) : facSearch}
                    onFocus={() => { setShowFacList(true); if (selectedFac) { setFacSearch(''); setSelectedFac(null) } }}
                    onChange={(e) => { setFacSearch(e.target.value); setShowFacList(true) }}
                  />
                </div>
                {showFacList && searchFiltered.length > 0 && (
                  <div className="sms-fac-dropdown">
                    {searchFiltered.slice(0, 8).map((f) => (
                      <div key={f.key} className="sms-fac-dropdown__item"
                        onMouseDown={() => { setSelectedFac(f); setFacSearch(''); setShowFacList(false) }}>
                        {f.kind === 'field_report' ? (
                          <span className="record-badge" style={{ background: '#fff7ed', color: '#c2410c', fontSize: 11 }}>
                            <Flag size={10} style={{ marginRight: 3 }} />Field Report
                          </span>
                        ) : (
                          <span className="file-num" style={{ fontSize: 12 }}>{f.file_number}</span>
                        )}
                        <span style={{ fontSize: 13 }}>{f.name}</span>
                        {f.kind === 'field_report' && f.screening && (
                          <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 4 }}>(screening on file)</span>
                        )}
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
            {saving ? 'Saving…' : editTask ? 'Save Changes' : 'Assign Task'}
          </button>
        </div>
      </div>
    </div>
  )
}
