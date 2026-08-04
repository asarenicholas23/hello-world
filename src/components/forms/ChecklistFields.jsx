import PhotoCapture from '../PhotoCapture'
import GPSField from '../GPSField'
import { SV_CHECKLIST_OPTIONS } from '../../data/siteVerificationChecklists'

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
}) {
  function isVisible(item) {
    if (!item.conditional) return true
    return formData[item.conditional.key] === item.conditional.value
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
            {checklist.extraFields.map((field) => (
              <div key={field.key} className="form-group">
                <label>{field.label}</label>
                {field.type === 'select' ? (
                  <select className="select" value={formData[field.key] ?? ''} onChange={(e) => set(field.key, e.target.value)}>
                    {field.options.map((o) => <option key={o} value={o}>{o || '— Select —'}</option>)}
                  </select>
                ) : (
                  <input className="input" type="text" value={formData[field.key] ?? ''}
                    onChange={(e) => set(field.key, e.target.value)} />
                )}
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
                <div key={item.key} className="monitoring-checklist__row">
                  <span className="monitoring-checklist__label">{item.label}</span>
                  {item.type === 'text' ? (
                    <input className="input monitoring-checklist__input"
                      type="text"
                      value={formData[item.key] ?? ''}
                      onChange={(e) => set(item.key, e.target.value)}
                      placeholder="Enter…" />
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
              )
            })}
          </div>
        </div>
      ))}

      {/* ── Notes & Photos ── */}
      <div className="card form-card">
        <div className="form-section-title">Notes &amp; Photos</div>
        <div className="form-group">
          <label>General Comments &amp; Recommendations</label>
          <textarea className="input textarea" value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            rows={3} placeholder="Findings, observations and recommendations…" />
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
