import { MessageSquare, Plus, Trash2 } from 'lucide-react'
import PhotoCapture from '../PhotoCapture'
import GPSField from '../GPSField'
import { SV_CHECKLIST_OPTIONS, WORKER_SEX_OPTIONS, EMPTY_WORKER } from '../../data/siteVerificationChecklists'

/** Editable list of workers: name, sex, age, position, academic qualification. */
function WorkersEditor({ label, value, onChange }) {
  const workers = Array.isArray(value) ? value : []
  const update = (idx, key, v) => onChange(workers.map((w, i) => (i === idx ? { ...w, [key]: v } : w)))
  const remove = (idx) => onChange(workers.filter((_, i) => i !== idx))
  const add = () => onChange([...workers, { ...EMPTY_WORKER }])

  return (
    <div className="form-group workers-editor">
      <label>{label}</label>
      {workers.length === 0 && (
        <div className="form-hint">No workers added yet.</div>
      )}
      {workers.map((w, idx) => (
        <div key={idx} className="workers-editor__row">
          <div className="workers-editor__head">
            <span>Worker {idx + 1}</span>
            <button type="button" className="btn btn--ghost btn--xs" onClick={() => remove(idx)} aria-label={`Remove worker ${idx + 1}`}>
              <Trash2 size={12} /> Remove
            </button>
          </div>
          <div className="form-row form-row--wrap">
            <div className="form-group">
              <label>Name</label>
              <input className="input" type="text" value={w.name ?? ''} onChange={(e) => update(idx, 'name', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Sex</label>
              <select className="select" value={w.sex ?? ''} onChange={(e) => update(idx, 'sex', e.target.value)}>
                {WORKER_SEX_OPTIONS.map((o) => <option key={o} value={o}>{o || '— Select —'}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Age</label>
              <input className="input" type="number" min="0" inputMode="numeric" value={w.age ?? ''} onChange={(e) => update(idx, 'age', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Position</label>
              <input className="input" type="text" value={w.position ?? ''} onChange={(e) => update(idx, 'position', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Academic Qualification</label>
              <input className="input" type="text" value={w.qualification ?? ''} onChange={(e) => update(idx, 'qualification', e.target.value)} />
            </div>
          </div>
        </div>
      ))}
      <div>
        <button type="button" className="btn btn--ghost btn--sm" onClick={add}>
          <Plus size={14} /> Add Worker
        </button>
      </div>
    </div>
  )
}

/**
 * Shared field-body for any sector checklist defined in
 * src/data/siteVerificationChecklists.js — extraFields + sections + notes +
 * photos, with a two-officer sign-off row matching ScreeningFields.jsx.
 *
 * Used by SiteVerificationForm.jsx (facility-scoped), TaskFillPage.jsx (task
 * fill flow, for both Site Verification tasks and PP/Pesticides Screening
 * tasks), and RecordDocumentModal read paths reuse the same checklist data —
 * this component is the one editable form body so field definitions live in
 * exactly one place.
 *
 * annotationsByField (optional): { [field_key]: { comment, field_label } } —
 * unresolved reviewer comments, rendered as an inline callout under the field
 * (matches ScreeningFields.jsx's FieldNote pattern).
 */
export default function ChecklistFields({
  checklist,
  detailsTitle = 'Verification Details',
  dateLabel = 'Date',
  date, onDateChange,
  officerName,
  secondOfficerUid = '', secondOfficerName = '', onSecondOfficerChange = null,
  staffOptions = [], secondOfficerLocked = false,
  permits = null, linkedPermitId = '', onLinkedPermitChange = null,
  coordinates, gpsLoading, gpsError, onCaptureGPS, onClearGPS, onManualCoordinates,
  formData, set,
  extraFieldsTitle = 'Facility Information',
  notes, onNotesChange,
  photos, onPhotosChange, photoFileNumber, photoCategory,
  annotationsByField = null,
  showReport = false,
}) {
  function isVisible(item) {
    if (!item.conditional) return true
    return formData[item.conditional.key] === item.conditional.value
  }

  function FieldNote({ fieldKey }) {
    const note = annotationsByField?.[fieldKey]
    if (!note) return null
    return (
      <div className="task-field-note">
        <MessageSquare size={12} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>{note.comment}</span>
      </div>
    )
  }

  return (
    <>
      {/* ── Details ── */}
      <div className="card form-card">
        <div className="form-section-title">{detailsTitle}</div>

        <div className="form-row">
          <div className="form-group">
            <label>{dateLabel} <span style={{ color: '#ef4444' }}>*</span></label>
            <input className="input" type="date" value={date} onChange={(e) => onDateChange(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Officer</label>
            <input className="input" value={officerName ?? '—'} readOnly
              style={{ background: '#f9fafb', color: '#6b7280', cursor: 'not-allowed' }} />
          </div>
        </div>

        <div className="form-group">
          <label>Second Officer <span style={{ fontWeight: 400, fontSize: 12, color: '#9ca3af' }}>(optional — usually signed off by two officers)</span></label>
          {secondOfficerLocked ? (
            <input className="input" value={secondOfficerName || '—'} readOnly
              style={{ background: '#f9fafb', color: '#6b7280', cursor: 'not-allowed' }} />
          ) : (
            <select className="select" value={secondOfficerUid} onChange={(e) => onSecondOfficerChange?.(e.target.value)}>
              <option value="">None</option>
              {staffOptions.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
        </div>

        {permits && (
          <div className="form-group">
            <label>Linked Permit</label>
            <select className="select" value={linkedPermitId} onChange={(e) => onLinkedPermitChange?.(e.target.value)}>
              <option value="">None / Not linked</option>
              {permits.map((p) => (
                <option key={p.id} value={p.id}>{p.permit_number}</option>
              ))}
            </select>
          </div>
        )}

        <GPSField
          coordinates={coordinates}
          loading={gpsLoading}
          error={gpsError}
          onCapture={onCaptureGPS}
          onClear={onClearGPS}
          onChange={onManualCoordinates}
        />
      </div>

      {/* ── Extra fields (sector-specific) ── */}
      {(checklist.extraFields?.length > 0) && (
        <div className="card form-card">
          <div className="form-section-title">{extraFieldsTitle}</div>
          <div className="form-row form-row--wrap">
            {checklist.extraFields.map((field) => field.type === 'workers' ? (
              <div key={field.key} className="workers-editor__wrap">
                <WorkersEditor label={field.label} value={formData[field.key]} onChange={(v) => set(field.key, v)} />
                <FieldNote fieldKey={field.key} />
              </div>
            ) : (
              <div key={field.key} className="form-group">
                <label>{field.label}</label>
                {field.type === 'select' ? (
                  <select className="select" value={formData[field.key] ?? ''} onChange={(e) => set(field.key, e.target.value)}>
                    {field.options.map((o) => <option key={o} value={o}>{o || '— Select —'}</option>)}
                  </select>
                ) : field.type === 'readonly' ? (
                  <input className="input" value={formData[field.key] ?? field.default ?? ''} readOnly
                    style={{ background: '#f9fafb', color: '#6b7280', cursor: 'not-allowed' }} />
                ) : (
                  <input className="input" type="text" value={formData[field.key] ?? ''}
                    onChange={(e) => set(field.key, e.target.value)} />
                )}
                <FieldNote fieldKey={field.key} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Checklist sections ── */}
      {checklist.sections.map((section) => (
        <div key={section.title} className="card form-card">
          <div className="form-section-title">{section.title}</div>
          <div className="monitoring-checklist">
            {section.items.map((item) => {
              if (!isVisible(item)) return null
              return (
                <div key={item.key}>
                  <div className="monitoring-checklist__row">
                    <span className="monitoring-checklist__label">{item.label}</span>
                    {item.type === 'text' ? (
                      <input className="input monitoring-checklist__input"
                        type="text"
                        value={formData[item.key] ?? ''}
                        onChange={(e) => set(item.key, e.target.value)}
                        placeholder="Enter…" />
                    ) : item.type === 'readonly' ? (
                      <input className="input monitoring-checklist__input"
                        value={formData[item.key] ?? item.default ?? ''} readOnly
                        style={{ background: '#f9fafb', color: '#6b7280', cursor: 'not-allowed' }} />
                    ) : (
                      <select className="select monitoring-checklist__select"
                        value={formData[item.key] ?? ''}
                        onChange={(e) => set(item.key, e.target.value)}>
                        {(item.options ?? SV_CHECKLIST_OPTIONS).map((o) => (
                          <option key={o} value={o}>{o || '— Select —'}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <FieldNote fieldKey={item.key} />
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* ── Written report (new pesticide inspections) ── */}
      {showReport && checklist.report && (
        <>
          <div className="checklist-report-banner">
            <div className="checklist-report-banner__title">{checklist.report.title}</div>
            <div className="form-hint">Report on inspection of the pesticides storage/retail premise. Company name, reference and license number are taken from Facility Information above.</div>
          </div>
          {checklist.report.sections.map((section) => (
            <div key={section.title} className="card form-card">
              <div className="form-section-title">{section.title}</div>
              <div className={section.items.every((i) => i.type === 'textarea') ? '' : 'form-row form-row--wrap'}>
                {section.items.map((item) => (
                  <div key={item.key} className="form-group">
                    <label>{item.label}</label>
                    {item.type === 'textarea' ? (
                      <textarea className="input textarea" rows={3} value={formData[item.key] ?? ''}
                        onChange={(e) => set(item.key, e.target.value)} placeholder="Describe findings…" />
                    ) : (
                      <input className="input" type={item.type ?? 'text'} value={formData[item.key] ?? ''}
                        onChange={(e) => set(item.key, e.target.value)} />
                    )}
                    <FieldNote fieldKey={item.key} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {/* ── Notes & Photos ── */}
      <div className="card form-card">
        <div className="form-section-title">Notes &amp; Photos</div>
        <div className="form-group">
          <label>General Comments &amp; Recommendations</label>
          <textarea className="input textarea" value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            rows={3} placeholder="Findings, observations and recommendations…" />
          <FieldNote fieldKey="notes" />
        </div>
        <PhotoCapture
          photos={photos}
          onPhotosChange={onPhotosChange}
          fileNumber={photoFileNumber}
          category={photoCategory}
        />
      </div>
    </>
  )
}
