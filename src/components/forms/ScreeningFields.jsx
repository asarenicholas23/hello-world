import { MessageSquare } from 'lucide-react'
import PhotoCapture from '../PhotoCapture'
import GPSField from '../GPSField'
import { DISTRICTS } from '../../data/constants'

const YES_NO = ['', 'Yes', 'No']

/**
 * Shared field-section body for the Screening form. Used by both the
 * facility-scoped ScreeningForm and the standalone task fill/review flow —
 * keeps the ~35 field definitions in one place.
 *
 * annotationsByField (optional): { [field_key]: { comment, field_label } } —
 * unresolved reviewer comments, rendered as an inline callout under the field.
 */
export default function ScreeningFields({
  form, set, officerName,
  coordinates, gpsLoading, gpsError, onCaptureGPS, onClearGPS, onManualCoordinates,
  photos, onPhotosChange, photoFileNumber, photoCategory = 'screenings',
  annotationsByField = null,
  secondOfficerUid = '', secondOfficerName = '', onSecondOfficerChange = null,
  staffOptions = [], secondOfficerLocked = false,
}) {
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
      {/* ── 1. Inspection Details ── */}
      <div className="card form-card">
        <div className="form-section-title">Inspection Details</div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Date of Receipt of Form EA1</label>
            <input className="form-input" type="date" value={form.ea1_receipt_date}
              onChange={(e) => set('ea1_receipt_date', e.target.value)} />
            <FieldNote fieldKey="ea1_receipt_date" />
          </div>
          <div className="form-group">
            <label className="form-label">Inspection Date <span className="req">*</span></label>
            <input className="form-input" type="date" value={form.inspection_date}
              onChange={(e) => set('inspection_date', e.target.value)} />
            <FieldNote fieldKey="inspection_date" />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Name of Officer</label>
            <input className="form-input" value={officerName ?? '—'} readOnly
              style={{ background: '#f9fafb', color: '#6b7280' }} />
          </div>
          <div className="form-group">
            <label className="form-label">Second Officer <span style={{ fontWeight: 400, fontSize: 12, color: '#9ca3af' }}>(screenings are usually signed off by two officers)</span></label>
            {secondOfficerLocked ? (
              <input className="form-input" value={secondOfficerName || '—'} readOnly
                style={{ background: '#f9fafb', color: '#6b7280' }} />
            ) : (
              <select className="form-input" value={secondOfficerUid} onChange={(e) => onSecondOfficerChange?.(e.target.value)}>
                <option value="">None</option>
                {staffOptions.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* ── 2. Proponent Information ── */}
      <div className="card form-card">
        <div className="form-section-title">Proponent Information</div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Name of Proponent</label>
            <input className="form-input" value={form.proponent_name}
              onChange={(e) => set('proponent_name', e.target.value)}
              placeholder="Full name of applicant" />
            <FieldNote fieldKey="proponent_name" />
          </div>
          <div className="form-group">
            <label className="form-label">Company's Name</label>
            <input className="form-input" value={form.company_name}
              onChange={(e) => set('company_name', e.target.value)}
              placeholder="Registered company name" />
            <FieldNote fieldKey="company_name" />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Type of Undertaking</label>
          <input className="form-input" value={form.type_of_undertaking}
            onChange={(e) => set('type_of_undertaking', e.target.value)}
            placeholder="e.g. Manufacturing, Hospitality, Mining…" />
          <FieldNote fieldKey="type_of_undertaking" />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Components</label>
            <textarea className="form-input" rows={3} value={form.components}
              onChange={(e) => set('components', e.target.value)}
              placeholder="Main components of the project…" />
            <FieldNote fieldKey="components" />
          </div>
          <div className="form-group">
            <label className="form-label">Capacity</label>
            <textarea className="form-input" rows={3} value={form.capacity}
              onChange={(e) => set('capacity', e.target.value)}
              placeholder="Production/operational capacity…" />
            <FieldNote fieldKey="capacity" />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Land Take</label>
          <input className="form-input" value={form.land_take}
            onChange={(e) => set('land_take', e.target.value)}
            placeholder="e.g. 2.5 acres" />
          <FieldNote fieldKey="land_take" />
        </div>
      </div>

      {/* ── 3. Waste Profile ── */}
      <div className="card form-card">
        <div className="form-section-title">Waste Profile</div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Liquid Waste</label>
            <textarea className="form-input" rows={2} value={form.liquid_waste}
              onChange={(e) => set('liquid_waste', e.target.value)}
              placeholder="Types and volumes of liquid waste…" />
            <FieldNote fieldKey="liquid_waste" />
          </div>
          <div className="form-group">
            <label className="form-label">Solid Waste</label>
            <textarea className="form-input" rows={2} value={form.solid_waste}
              onChange={(e) => set('solid_waste', e.target.value)}
              placeholder="Types and volumes of solid waste…" />
            <FieldNote fieldKey="solid_waste" />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Gaseous Waste</label>
          <textarea className="form-input" rows={2} value={form.gaseous_waste}
            onChange={(e) => set('gaseous_waste', e.target.value)}
            placeholder="Emissions and gaseous discharges…" />
          <FieldNote fieldKey="gaseous_waste" />
        </div>
        <div className="form-group">
          <label className="form-label">Comments on Description of Undertaking</label>
          <textarea className="form-input" rows={3} value={form.description_comments}
            onChange={(e) => set('description_comments', e.target.value)} />
          <FieldNote fieldKey="description_comments" />
        </div>
      </div>

      {/* ── 4. Site Location ── */}
      <div className="card form-card">
        <div className="form-section-title">Site Location</div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Plot No.</label>
            <input className="form-input" value={form.plot_no}
              onChange={(e) => set('plot_no', e.target.value)} />
            <FieldNote fieldKey="plot_no" />
          </div>
          <div className="form-group">
            <label className="form-label">Street / Area Name</label>
            <input className="form-input" value={form.street_area}
              onChange={(e) => set('street_area', e.target.value)} />
            <FieldNote fieldKey="street_area" />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Town</label>
            <input className="form-input" value={form.town}
              onChange={(e) => set('town', e.target.value)} />
            <FieldNote fieldKey="town" />
          </div>
          <div className="form-group">
            <label className="form-label">District</label>
            <select className="form-input" value={form.district}
              onChange={(e) => set('district', e.target.value)}>
              <option value="">Select district…</option>
              {DISTRICTS.map((d) => (
                <option key={d.code} value={d.code}>{d.name}</option>
              ))}
            </select>
            <FieldNote fieldKey="district" />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Major Landmark</label>
          <input className="form-input" value={form.major_landmark}
            onChange={(e) => set('major_landmark', e.target.value)}
            placeholder="Nearest major landmark" />
          <FieldNote fieldKey="major_landmark" />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Current Zoning</label>
            <input className="form-input" value={form.current_zoning}
              onChange={(e) => set('current_zoning', e.target.value)}
              placeholder="e.g. Residential, Industrial, Mixed-use…" />
            <FieldNote fieldKey="current_zoning" />
          </div>
          <div className="form-group">
            <label className="form-label">Adjacent Land Use</label>
            <input className="form-input" value={form.adjacent_land_use}
              onChange={(e) => set('adjacent_land_use', e.target.value)}
              placeholder="e.g. Residential, Agricultural, Commercial…" />
            <FieldNote fieldKey="adjacent_land_use" />
          </div>
        </div>

        <div className="form-section-title" style={{ marginTop: 12, fontSize: 12 }}>Surrounding Land Use by Direction</div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">North</label>
            <input className="form-input" value={form.north}
              onChange={(e) => set('north', e.target.value)} />
            <FieldNote fieldKey="north" />
          </div>
          <div className="form-group">
            <label className="form-label">South</label>
            <input className="form-input" value={form.south}
              onChange={(e) => set('south', e.target.value)} />
            <FieldNote fieldKey="south" />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">East</label>
            <input className="form-input" value={form.east}
              onChange={(e) => set('east', e.target.value)} />
            <FieldNote fieldKey="east" />
          </div>
          <div className="form-group">
            <label className="form-label">West</label>
            <input className="form-input" value={form.west}
              onChange={(e) => set('west', e.target.value)} />
            <FieldNote fieldKey="west" />
          </div>
        </div>

        <div className="form-section-title" style={{ marginTop: 12, fontSize: 12 }}>GPS Coordinates</div>
        <GPSField
          coordinates={coordinates}
          loading={gpsLoading}
          error={gpsError}
          onCapture={onCaptureGPS}
          onClear={onClearGPS}
          onChange={onManualCoordinates}
        />
        <div className="form-row" style={{ marginTop: 8 }}>
          <div className="form-group">
            <label className="form-label">Latitude</label>
            <input className="form-input" type="number" step="any" value={form.latitude}
              onChange={(e) => set('latitude', e.target.value)}
              placeholder="e.g. 6.6667" />
          </div>
          <div className="form-group">
            <label className="form-label">Longitude</label>
            <input className="form-input" type="number" step="any" value={form.longitude}
              onChange={(e) => set('longitude', e.target.value)}
              placeholder="e.g. -1.6163" />
          </div>
        </div>
      </div>

      {/* ── 5. Site Assessment ── */}
      <div className="card form-card">
        <div className="form-section-title">Site Assessment</div>
        <div className="form-group">
          <label className="form-label">Existing Infrastructure and Facility on Site</label>
          <textarea className="form-input" rows={3} value={form.existing_infrastructure}
            onChange={(e) => set('existing_infrastructure', e.target.value)} />
          <FieldNote fieldKey="existing_infrastructure" />
        </div>
        <div className="form-group">
          <label className="form-label">Comment on Site Information <span style={{ fontWeight: 400, fontSize: 12, color: '#9ca3af' }}>(appropriateness, sensitivity, compatibility, etc.)</span></label>
          <textarea className="form-input" rows={3} value={form.site_information_comments}
            onChange={(e) => set('site_information_comments', e.target.value)} />
          <FieldNote fieldKey="site_information_comments" />
        </div>
        <div className="form-group">
          <label className="form-label">Construction Phase Impacts</label>
          <textarea className="form-input" rows={3} value={form.construction_impacts}
            onChange={(e) => set('construction_impacts', e.target.value)} />
          <FieldNote fieldKey="construction_impacts" />
        </div>
        <div className="form-group">
          <label className="form-label">Operational Phase Impacts</label>
          <textarea className="form-input" rows={3} value={form.operational_impacts}
            onChange={(e) => set('operational_impacts', e.target.value)} />
          <FieldNote fieldKey="operational_impacts" />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Impacts Addressed in EA1?</label>
            <select className="form-input" value={form.impacts_in_ea1}
              onChange={(e) => set('impacts_in_ea1', e.target.value)}>
              {YES_NO.map((v) => <option key={v} value={v}>{v || 'Select…'}</option>)}
            </select>
            <FieldNote fieldKey="impacts_in_ea1" />
          </div>
        </div>
        {form.impacts_in_ea1 === 'No' && (
          <div className="form-group">
            <label className="form-label">Mitigation Measures</label>
            <textarea className="form-input" rows={3} value={form.mitigation_measures}
              onChange={(e) => set('mitigation_measures', e.target.value)}
              placeholder="Proposed mitigation for unaddressed impacts…" />
            <FieldNote fieldKey="mitigation_measures" />
          </div>
        )}
      </div>

      {/* ── 6. Neighbour Information ── */}
      <div className="card form-card">
        <div className="form-section-title">Neighbour Information</div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Name of Neighbour</label>
            <input className="form-input" value={form.neighbour_name}
              onChange={(e) => set('neighbour_name', e.target.value)} />
            <FieldNote fieldKey="neighbour_name" />
          </div>
          <div className="form-group">
            <label className="form-label">Contact of Neighbour</label>
            <input className="form-input" value={form.neighbour_contact}
              onChange={(e) => set('neighbour_contact', e.target.value)} />
            <FieldNote fieldKey="neighbour_contact" />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Location in Relation to the Undertaking</label>
          <input className="form-input" value={form.neighbour_location}
            onChange={(e) => set('neighbour_location', e.target.value)}
            placeholder="e.g. North of the proposed facility" />
          <FieldNote fieldKey="neighbour_location" />
        </div>
        <div className="form-group">
          <label className="form-label">Their Comments</label>
          <textarea className="form-input" rows={3} value={form.neighbour_comments}
            onChange={(e) => set('neighbour_comments', e.target.value)} />
          <FieldNote fieldKey="neighbour_comments" />
        </div>
      </div>

      {/* ── 7. Observations & Comments ── */}
      <div className="card form-card">
        <div className="form-section-title">Observations & Comments</div>
        <div className="form-group">
          <label className="form-label">Observations</label>
          <textarea className="form-input" rows={4} value={form.observations}
            onChange={(e) => set('observations', e.target.value)} />
          <FieldNote fieldKey="observations" />
        </div>
        <div className="form-group">
          <label className="form-label">Comments</label>
          <textarea className="form-input" rows={3} value={form.comments}
            onChange={(e) => set('comments', e.target.value)} />
          <FieldNote fieldKey="comments" />
        </div>
      </div>

      {/* ── 8. Screening Decision ── */}
      <div className="card form-card">
        <div className="form-section-title">Screening Decision</div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Permit Recommended?</label>
            <select className="form-input" value={form.permit_recommended}
              onChange={(e) => set('permit_recommended', e.target.value)}>
              {YES_NO.map((v) => <option key={v} value={v}>{v || 'Select…'}</option>)}
            </select>
            <FieldNote fieldKey="permit_recommended" />
          </div>
          <div className="form-group">
            <label className="form-label">Additional Info Required?</label>
            <select className="form-input" value={form.additional_info_required}
              onChange={(e) => set('additional_info_required', e.target.value)}>
              {YES_NO.map((v) => <option key={v} value={v}>{v || 'Select…'}</option>)}
            </select>
            <FieldNote fieldKey="additional_info_required" />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">PER Recommended?</label>
            <select className="form-input" value={form.per_recommended}
              onChange={(e) => set('per_recommended', e.target.value)}>
              {YES_NO.map((v) => <option key={v} value={v}>{v || 'Select…'}</option>)}
            </select>
            <FieldNote fieldKey="per_recommended" />
          </div>
          <div className="form-group">
            <label className="form-label">EIA Recommended?</label>
            <select className="form-input" value={form.eia_recommended}
              onChange={(e) => set('eia_recommended', e.target.value)}>
              {YES_NO.map((v) => <option key={v} value={v}>{v || 'Select…'}</option>)}
            </select>
            <FieldNote fieldKey="eia_recommended" />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Permit Declined?</label>
            <select className="form-input" value={form.permit_declined}
              onChange={(e) => set('permit_declined', e.target.value)}>
              {YES_NO.map((v) => <option key={v} value={v}>{v || 'Select…'}</option>)}
            </select>
            <FieldNote fieldKey="permit_declined" />
          </div>
        </div>
        {form.permit_declined === 'Yes' && (
          <div className="form-group">
            <label className="form-label">Reason for Permit Declined</label>
            <textarea className="form-input" rows={3} value={form.permit_declined_reason}
              onChange={(e) => set('permit_declined_reason', e.target.value)} />
            <FieldNote fieldKey="permit_declined_reason" />
          </div>
        )}
      </div>

      {/* ── 9. Photos ── */}
      <div className="card form-card">
        <div className="form-section-title">Picture of Facility</div>
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
