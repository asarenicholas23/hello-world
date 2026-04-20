import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, Search, ChevronDown, ChevronUp, Plus, Loader, UserCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { listFieldReports, updateFieldReport } from '../firebase/fieldReports'
import { getFacility, createFacilityWithId } from '../firebase/facilities'
import { createSubRecord } from '../firebase/subrecords'
import { assignRecord, unassignRecord, addSupportingOfficerToRecord } from '../firebase/assignments'
import { listStaff } from '../firebase/staff'
import { fmtDate, inputToTs } from '../utils/records'
import { SECTORS, DISTRICTS, ENFORCEMENT_ACTIONS, ADMIN_ROLES, FIELD_ROLES } from '../data/constants'
import AssignOfficerDialog from '../components/AssignOfficerDialog'
import Spinner from '../components/Spinner'

const REPORTING_OPTIONS = [
  { value: 'pending',  label: 'Pending',  color: '#854d0e', bg: '#fef9c3' },
  { value: 'reported', label: 'Reported', color: '#166534', bg: '#dcfce7' },
  { value: 'rejected', label: 'Rejected', color: '#991b1b', bg: '#fee2e2' },
]

const INVOICE_OPTIONS = [
  { value: 'pending',  label: 'Pending',  color: '#854d0e', bg: '#fef9c3' },
  { value: 'invoiced', label: 'Invoiced', color: '#1d4ed8', bg: '#dbeafe' },
  { value: 'paid',     label: 'Paid',     color: '#166534', bg: '#dcfce7' },
]

const TYPE_LABELS = { enforcement: 'Enforcement', walk_in: 'Walk-in' }
const TYPE_COLORS = {
  enforcement: { bg: '#fff7ed', color: '#c2410c' },
  walk_in:     { bg: '#f0fdf4', color: '#166534' },
}

function statusStyle(options, value) {
  const opt = options.find((o) => o.value === value)
  return opt ? { background: opt.bg, color: opt.color } : { background: '#f3f4f6', color: '#374151' }
}
function sectorName(prefix) { return SECTORS.find((s) => s.prefix === prefix)?.name ?? prefix }
function districtName(code)  { return DISTRICTS.find((d) => d.code === code)?.name ?? code }
function actionLabel(value)  { return ENFORCEMENT_ACTIONS.find((a) => a.value === value)?.label ?? value }

const FILE_NUM_RE = /^[A-Z]+\d+$/

export default function FieldReportsPage() {
  const { user, staff, role } = useAuth()
  const navigate = useNavigate()
  const isAdmin   = ADMIN_ROLES.has(staff?.role)
  const canAssign = ADMIN_ROLES.has(role) || FIELD_ROLES.has(role)

  const [reports, setReports]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [search, setSearch]     = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [saving, setSaving]     = useState({})

  // Assignment dialog state (one at a time)
  const [assignDialogReport, setAssignDialogReport] = useState(null)
  const [allStaff, setAllStaff]                     = useState(null)
  const [assignSuccess, setAssignSuccess]           = useState('')

  useEffect(() => {
    listFieldReports()
      .then(setReports)
      .catch((err) => setError(`Failed to load field reports: ${err.message}`))
      .finally(() => setLoading(false))
  }, [])

  const filtered = reports.filter((r) => {
    if (typeFilter && r.report_type !== typeFilter) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      r.facility_name?.toLowerCase().includes(q) ||
      r.officer_name?.toLowerCase().includes(q)  ||
      r.location?.toLowerCase().includes(q)      ||
      r.district?.toLowerCase().includes(q)
    )
  })

  function updateLocal(reportId, patch) {
    setReports((prev) => prev.map((r) => r.id === reportId ? { ...r, ...patch } : r))
  }

  async function handleStatusChange(reportId, field, value) {
    setSaving((p) => ({ ...p, [reportId]: true }))
    try {
      await updateFieldReport(reportId, { [field]: value }, user.uid)
      updateLocal(reportId, { [field]: value })
    } catch (err) {
      alert(`Failed to update: ${err.message}`)
    } finally {
      setSaving((p) => ({ ...p, [reportId]: false }))
    }
  }

  async function handleFileNumberAssign(reportId, fileNumber) {
    const trimmed = fileNumber.trim().toUpperCase()
    if (!trimmed) return
    if (!FILE_NUM_RE.test(trimmed)) {
      alert('Enter a valid file number like CI42 or CU100')
      return
    }

    const report = reports.find((r) => r.id === reportId)
    setSaving((p) => ({ ...p, [`fn-${reportId}`]: true }))

    try {
      const existing = await getFacility(trimmed)

      if (!existing) {
        const sector = SECTORS.find((s) => s.prefix === report.sector_prefix)
        await createFacilityWithId(trimmed, {
          name:                report.facility_name ?? '',
          sector_prefix:       report.sector_prefix ?? '',
          sector:              sector?.name ?? '',
          type_of_undertaking: report.type_of_undertaking ?? '',
          location:            report.location ?? '',
          district:            report.district ?? '',
          contact_person:      report.contact_person ?? '',
          phone:               report.phone ?? '',
        }, user.uid)

        // Copy screening to the new facility's screenings subcollection
        if (report.screening?.date) {
          await createSubRecord(trimmed, 'screenings', {
            date:         report.screening.date,
            officer_id:   report.screening.officer_id ?? user.uid,
            officer_name: report.screening.officer_name ?? '',
            notes:        report.screening.notes ?? '',
            photos:       report.screening.photos ?? [],
            coordinates:  report.screening.coordinates ?? null,
          }, user.uid)
        }
      }

      await updateFieldReport(reportId, { assigned_file_number: trimmed }, user.uid)
      updateLocal(reportId, { assigned_file_number: trimmed })
    } catch (err) {
      alert(`Failed: ${err.message}`)
    } finally {
      setSaving((p) => ({ ...p, [`fn-${reportId}`]: false }))
    }
  }

  async function openAssignDialog(report) {
    setAssignDialogReport(report)
    if (!allStaff) setAllStaff(await listStaff())
  }

  async function handleAssign({ toUid, toName, type }) {
    const report = assignDialogReport
    if (type === 'supporting') {
      await addSupportingOfficerToRecord({
        basePath: 'field_reports', recordId: report.id,
        officerUid: toUid, actorUid: user.uid, actorRole: role,
      })
      updateLocal(report.id, { supporting_officers: [...(report.supporting_officers ?? []), toUid] })
    } else {
      await assignRecord({
        basePath: 'field_reports', recordId: report.id,
        toUid, toName, actorUid: user.uid, actorRole: role,
        fromUid: report.primary_officer ?? null,
      })
      updateLocal(report.id, { primary_officer: toUid, primary_officer_name: toName })
    }
    flash(type === 'supporting' ? 'Supporting officer added.' : `Assigned to ${toName}.`)
  }

  async function handleUnassign() {
    const report = assignDialogReport
    await unassignRecord({
      basePath: 'field_reports', recordId: report.id,
      fromUid: report.primary_officer,
      actorUid: user.uid, actorRole: role,
    })
    updateLocal(report.id, { primary_officer: null, primary_officer_name: null })
    flash('Unassigned.')
  }

  function flash(msg) {
    setAssignSuccess(msg)
    setTimeout(() => setAssignSuccess(''), 3500)
  }

  async function handleAddScreening(reportId, screeningData) {
    setSaving((p) => ({ ...p, [`sc-${reportId}`]: true }))
    try {
      await updateFieldReport(reportId, { screening: screeningData }, user.uid)
      updateLocal(reportId, { screening: screeningData })
    } catch (err) {
      alert(`Failed to save screening: ${err.message}`)
    } finally {
      setSaving((p) => ({ ...p, [`sc-${reportId}`]: false }))
    }
  }

  if (loading) return <Spinner size={40} />

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Field Reports</div>
          <div className="page-subtitle">
            {filtered.length} of {reports.length} unregistered facility reports
          </div>
        </div>
        <button className="btn btn--primary" onClick={() => navigate('/field-reports/new')}>
          <Plus size={14} /> New Field Report
        </button>
      </div>

      <div className="filter-bar">
        <div className="search-box" style={{ flex: 1 }}>
          <Search size={15} className="search-icon" />
          <input
            className="search-input"
            placeholder="Search by facility, officer, location…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <select className="select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All types</option>
            <option value="enforcement">Enforcement</option>
            <option value="walk_in">Walk-in</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="login-error">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {!error && filtered.length === 0 && (
        <div className="empty-state">No field reports found.</div>
      )}

      {assignSuccess && (
        <div className="assign-success-banner" style={{ marginBottom: 8 }}>
          <UserCheck size={14} /> {assignSuccess}
        </div>
      )}

      <div className="field-report-list">
        {filtered.map((r) => {
          const isOpen    = expanded === r.id
          const isSaving  = saving[r.id]
          const isFnSaving = saving[`fn-${r.id}`]
          const isScSaving = saving[`sc-${r.id}`]
          const typeStyle = TYPE_COLORS[r.report_type] ?? TYPE_COLORS.enforcement
          const isAssigned = Boolean(r.primary_officer)

          return (
            <div key={r.id} className="field-report-card">
              <div
                className="field-report-card__header"
                onClick={() => setExpanded(isOpen ? null : r.id)}
              >
                <div className="field-report-card__main">
                  <span className="field-report-card__name">{r.facility_name}</span>
                  {r.report_type && (
                    <span className="record-badge" style={typeStyle}>
                      {TYPE_LABELS[r.report_type] ?? r.report_type}
                    </span>
                  )}
                  {r.sector_prefix && (
                    <span className="field-report-card__sector">{sectorName(r.sector_prefix)}</span>
                  )}
                  <span className="record-badge" style={statusStyle(REPORTING_OPTIONS, r.reporting_status)}>
                    {REPORTING_OPTIONS.find((o) => o.value === r.reporting_status)?.label ?? r.reporting_status}
                  </span>
                  <span className="record-badge" style={statusStyle(INVOICE_OPTIONS, r.invoice_status)}>
                    {INVOICE_OPTIONS.find((o) => o.value === r.invoice_status)?.label ?? r.invoice_status}
                  </span>
                  {r.assigned_file_number && (
                    <span className="record-badge" style={{ background: '#ede9fe', color: '#5b21b6' }}>
                      {r.assigned_file_number}
                    </span>
                  )}
                </div>
                <div className="field-report-card__meta">
                  <span>
                    {r.report_type === 'enforcement' && r.date
                      ? fmtDate(r.date)
                      : fmtDate(r.created_at)
                    } · {r.officer_name ?? '—'}
                  </span>
                  {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </div>

              {/* Assignment row — always visible */}
              <div className="field-report-assignment-row" onClick={(e) => e.stopPropagation()}>
                <UserCheck size={13} style={{ color: isAssigned ? '#1d4ed8' : '#9ca3af', flexShrink: 0 }} />
                {isAssigned ? (
                  <span className="permit-assignment-row__name">{r.primary_officer_name}</span>
                ) : (
                  <span className="permit-assignment-row__unassigned">Unassigned</span>
                )}
                {r.supporting_officers?.length > 0 && (
                  <span style={{ fontSize: 11, color: '#6b7280' }}>+{r.supporting_officers.length} supporting</span>
                )}
                {canAssign && (
                  <button
                    className="btn btn--ghost btn--xs"
                    style={{ marginLeft: 'auto' }}
                    onClick={() => openAssignDialog(r)}
                  >
                    {isAssigned ? 'Reassign' : 'Assign'}
                  </button>
                )}
              </div>

              {isOpen && (
                <div className="field-report-card__body">
                  {/* Facility details */}
                  <div className="field-report-section">
                    <div className="field-report-section__title">Facility Details</div>
                    <div className="field-report-grid">
                      {r.type_of_undertaking && <FieldRow label="Type"     value={r.type_of_undertaking} />}
                      {r.location            && <FieldRow label="Location"  value={r.location} />}
                      {r.district            && <FieldRow label="District"  value={districtName(r.district)} />}
                      {r.contact_person      && <FieldRow label="Contact"   value={r.contact_person} />}
                      {r.phone               && <FieldRow label="Phone"     value={r.phone} />}
                    </div>
                  </div>

                  {/* Enforcement details */}
                  {r.report_type === 'enforcement' && (
                    <div className="field-report-section">
                      <div className="field-report-section__title">Enforcement Details</div>
                      <div className="field-report-grid">
                        {r.action_taken        && <FieldRow label="Action"    value={actionLabel(r.action_taken)} />}
                        {r.follow_up_date      && <FieldRow label="Follow-up" value={fmtDate(r.follow_up_date)} />}
                        {r.enforcement_location && <FieldRow label="Location" value={r.enforcement_location} />}
                        {r.coordinates && (
                          <FieldRow label="GPS" value={`${r.coordinates.lat.toFixed(6)}, ${r.coordinates.lng.toFixed(6)}`} />
                        )}
                      </div>
                      {r.notes && <p className="field-report-notes">{r.notes}</p>}
                      {r.photos?.length > 0 && (
                        <div className="attachment-grid" style={{ marginTop: 8 }}>
                          {r.photos.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noreferrer" className="attachment-link">
                              Photo {i + 1}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Walk-in notes */}
                  {r.report_type === 'walk_in' && r.notes && (
                    <div className="field-report-section">
                      <div className="field-report-section__title">Notes</div>
                      <p className="field-report-notes">{r.notes}</p>
                    </div>
                  )}

                  {/* Screening section */}
                  <div className="field-report-section">
                    <div className="field-report-section__title">Screening Record</div>
                    {r.screening ? (
                      <div className="field-report-grid">
                        <FieldRow label="Date"    value={fmtDate(r.screening.date)} />
                        <FieldRow label="Officer" value={r.screening.officer_name} />
                        {r.screening.coordinates && (
                          <FieldRow label="GPS" value={`${r.screening.coordinates.lat.toFixed(6)}, ${r.screening.coordinates.lng.toFixed(6)}`} />
                        )}
                        {r.screening.notes && <p className="field-report-notes" style={{ gridColumn: '1/-1' }}>{r.screening.notes}</p>}
                        {r.screening.photos?.length > 0 && (
                          <div className="attachment-grid" style={{ gridColumn: '1/-1', marginTop: 4 }}>
                            {r.screening.photos.map((url, i) => (
                              <a key={i} href={url} target="_blank" rel="noreferrer" className="attachment-link">Photo {i + 1}</a>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <InlineScreeningForm
                        reportId={r.id}
                        staffName={staff?.name ?? ''}
                        userId={user.uid}
                        saving={isScSaving}
                        onSave={(data) => handleAddScreening(r.id, data)}
                      />
                    )}
                  </div>

                  {/* Admin actions */}
                  {isAdmin && (
                    <div className="field-report-section">
                      <div className="field-report-section__title">Admin Actions</div>
                      <div className="field-report-admin-row">
                        <div className="form-group" style={{ flex: 1 }}>
                          <label>Reporting Status</label>
                          <select className="select" value={r.reporting_status} disabled={isSaving}
                            onChange={(e) => handleStatusChange(r.id, 'reporting_status', e.target.value)}>
                            {REPORTING_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label>Invoice Status</label>
                          <select className="select" value={r.invoice_status} disabled={isSaving}
                            onChange={(e) => handleStatusChange(r.id, 'invoice_status', e.target.value)}>
                            {INVOICE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label>
                            Assign File Number
                            {r.assigned_file_number
                              ? <span style={{ color: '#16a34a', marginLeft: 6, fontWeight: 400 }}>✓ {r.assigned_file_number}</span>
                              : <span style={{ color: '#9ca3af', marginLeft: 6, fontWeight: 400 }}>— creates a new facility</span>
                            }
                          </label>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <input
                              className="input"
                              defaultValue={r.assigned_file_number ?? ''}
                              placeholder="e.g. CI42"
                              id={`fn-${r.id}`}
                              disabled={isFnSaving}
                              style={{ textTransform: 'uppercase' }}
                            />
                            <button
                              className="btn btn--primary btn--sm"
                              disabled={isFnSaving}
                              onClick={() => {
                                const el = document.getElementById(`fn-${r.id}`)
                                handleFileNumberAssign(r.id, el.value)
                              }}
                            >
                              {isFnSaving ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : 'Save'}
                            </button>
                          </div>
                          {r.assigned_file_number && (
                            <button
                              className="btn btn--ghost btn--sm"
                              style={{ marginTop: 4 }}
                              onClick={() => navigate(`/facilities/${r.assigned_file_number}`)}
                            >
                              Open Facility →
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <AssignOfficerDialog
        key={assignDialogReport?.id ?? 'none'}
        open={Boolean(assignDialogReport)}
        onClose={() => setAssignDialogReport(null)}
        onAssign={handleAssign}
        onUnassign={handleUnassign}
        record={assignDialogReport ? { ...assignDialogReport, label: assignDialogReport.facility_name } : null}
        currentUid={user?.uid}
        currentRole={role}
        allStaff={allStaff ?? []}
      />
    </div>
  )
}

function FieldRow({ label, value }) {
  return (
    <div className="field-report-row">
      <span className="field-report-row__label">{label}</span>
      <span className="field-report-row__value">{value}</span>
    </div>
  )
}

function InlineScreeningForm({ staffName, saving, onSave }) {
  const [open, setOpen]   = useState(false)
  const [date, setDate]   = useState('')
  const [notes, setNotes] = useState('')

  async function handleSave() {
    if (!date) { alert('Screening date is required.'); return }
    await onSave({
      date:         inputToTs(date),
      officer_name: staffName,
      notes:        notes.trim(),
      photos:       [],
      coordinates:  null,
    })
    setOpen(false)
  }

  if (!open) {
    return (
      <button className="btn btn--ghost btn--sm" onClick={() => setOpen(true)}>
        + Add Screening Record
      </button>
    )
  }

  return (
    <div className="inline-screening-form">
      <div className="form-row">
        <div className="form-group">
          <label>Date <span style={{ color: '#ef4444' }}>*</span></label>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Officer</label>
          <input className="input" value={staffName} readOnly
            style={{ background: '#f9fafb', color: '#6b7280', cursor: 'not-allowed' }} />
        </div>
      </div>
      <div className="form-group">
        <label>Notes</label>
        <textarea className="input textarea" rows={2} value={notes}
          onChange={(e) => setNotes(e.target.value)} placeholder="Observations during visit…" />
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button className="btn btn--primary btn--sm" disabled={saving} onClick={handleSave}>
          {saving ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : 'Save Screening'}
        </button>
        <button className="btn btn--ghost btn--sm" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  )
}
