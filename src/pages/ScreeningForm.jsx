import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, AlertCircle, Save, Loader, WifiOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSync } from '../context/SyncContext'
import { useGPS } from '../hooks/useGPS'
import { getSubRecord, createSubRecord, updateSubRecord, listSubRecords } from '../firebase/subrecords'
import { tsToInput, inputToTs } from '../utils/records'
import PhotoCapture from '../components/PhotoCapture'
import Spinner from '../components/Spinner'
import GPSField from '../components/GPSField'
import { DISTRICTS } from '../data/constants'

const YES_NO = ['', 'Yes', 'No']

const EMPTY = {
  inspection_date:        '',
  proponent_name:         '',
  company_name:           '',
  type_of_undertaking:    '',
  components:             '',
  capacity:               '',
  liquid_waste:           '',
  solid_waste:            '',
  gaseous_waste:          '',
  description_comments:   '',
  street_area:            '',
  town:                   '',
  district:               '',
  major_landmark:         '',
  adjacent_land_use:      '',
  north:                  '',
  south:                  '',
  east:                   '',
  west:                   '',
  latitude:               '',
  longitude:              '',
  existing_infrastructure:'',
  construction_impacts:   '',
  operational_impacts:    '',
  impacts_in_ea1:         '',
  mitigation_measures:    '',
  neighbour_name:         '',
  neighbour_contact:      '',
  neighbour_location:     '',
  neighbour_comments:     '',
  observations:           '',
  comments:               '',
  permit_recommended:     '',
  additional_info_required:'',
  per_recommended:        '',
  eia_recommended:        '',
  permit_declined:        '',
  permit_declined_reason: '',
}

export default function ScreeningForm() {
  const { fileNumber, recordId } = useParams()
  const isEditing = Boolean(recordId)
  const navigate  = useNavigate()
  const { user, staff } = useAuth()
  const { isOnline } = useSync()

  const [form, setForm]               = useState(EMPTY)
  const [screeningId, setScreeningId] = useState('')
  const [photos, setPhotos]           = useState([])
  const { coordinates, setCoordinates, loading: gpsLoading, error: gpsError, capture: captureGPS, clear: clearGPS } = useGPS()
  const [initialLoading, setInitialLoading] = useState(isEditing)
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState('')

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }))

  useEffect(() => {
    if (isEditing) {
      getSubRecord(fileNumber, 'screenings', recordId)
        .then((rec) => {
          if (!rec) { setError('Record not found.'); return }
          setForm({
            inspection_date:         tsToInput(rec.inspection_date ?? rec.date) ?? '',
            proponent_name:          rec.proponent_name         ?? '',
            company_name:            rec.company_name           ?? '',
            type_of_undertaking:     rec.type_of_undertaking    ?? '',
            components:              rec.components             ?? '',
            capacity:                rec.capacity               ?? '',
            liquid_waste:            rec.liquid_waste           ?? '',
            solid_waste:             rec.solid_waste            ?? '',
            gaseous_waste:           rec.gaseous_waste          ?? '',
            description_comments:    rec.description_comments   ?? '',
            street_area:             rec.street_area            ?? '',
            town:                    rec.town                   ?? '',
            district:                rec.district               ?? '',
            major_landmark:          rec.major_landmark         ?? '',
            adjacent_land_use:       rec.adjacent_land_use      ?? '',
            north:                   rec.north                  ?? '',
            south:                   rec.south                  ?? '',
            east:                    rec.east                   ?? '',
            west:                    rec.west                   ?? '',
            latitude:                rec.latitude               ?? '',
            longitude:               rec.longitude              ?? '',
            existing_infrastructure: rec.existing_infrastructure?? '',
            construction_impacts:    rec.construction_impacts   ?? '',
            operational_impacts:     rec.operational_impacts    ?? '',
            impacts_in_ea1:          rec.impacts_in_ea1         ?? '',
            mitigation_measures:     rec.mitigation_measures    ?? '',
            neighbour_name:          rec.neighbour_name         ?? '',
            neighbour_contact:       rec.neighbour_contact      ?? '',
            neighbour_location:      rec.neighbour_location     ?? '',
            neighbour_comments:      rec.neighbour_comments     ?? '',
            observations:            rec.observations           ?? '',
            comments:                rec.comments               ?? '',
            permit_recommended:      rec.permit_recommended     ?? '',
            additional_info_required:rec.additional_info_required ?? '',
            per_recommended:         rec.per_recommended        ?? '',
            eia_recommended:         rec.eia_recommended        ?? '',
            permit_declined:         rec.permit_declined        ?? '',
            permit_declined_reason:  rec.permit_declined_reason ?? '',
          })
          setScreeningId(rec.screening_id ?? rec.id)
          setPhotos(rec.photos ?? [])
          if (rec.coordinates) setCoordinates(rec.coordinates)
        })
        .catch(() => setError('Failed to load record.'))
        .finally(() => setInitialLoading(false))
    } else {
      // Generate screening_id: SCR-{fileNumber}-{padded count}
      listSubRecords(fileNumber, 'screenings')
        .then((existing) => {
          const next = String(existing.length + 1).padStart(3, '0')
          setScreeningId(`SCR-${fileNumber}-${next}`)
        })
        .catch(() => setScreeningId(`SCR-${fileNumber}-001`))
    }
  }, [fileNumber, recordId, isEditing, setCoordinates])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.inspection_date) { setError('Inspection date is required.'); return }

    setSubmitting(true)
    setError('')

    const payload = {
      screening_id:            screeningId,
      date:                    inputToTs(form.inspection_date),
      inspection_date:         inputToTs(form.inspection_date),
      proponent_name:          form.proponent_name.trim(),
      company_name:            form.company_name.trim(),
      type_of_undertaking:     form.type_of_undertaking.trim(),
      components:              form.components.trim(),
      capacity:                form.capacity.trim(),
      liquid_waste:            form.liquid_waste.trim(),
      solid_waste:             form.solid_waste.trim(),
      gaseous_waste:           form.gaseous_waste.trim(),
      description_comments:    form.description_comments.trim(),
      street_area:             form.street_area.trim(),
      town:                    form.town.trim(),
      district:                form.district,
      major_landmark:          form.major_landmark.trim(),
      adjacent_land_use:       form.adjacent_land_use.trim(),
      north:                   form.north.trim(),
      south:                   form.south.trim(),
      east:                    form.east.trim(),
      west:                    form.west.trim(),
      latitude:                form.latitude,
      longitude:               form.longitude,
      coordinates:             coordinates ?? null,
      existing_infrastructure: form.existing_infrastructure.trim(),
      construction_impacts:    form.construction_impacts.trim(),
      operational_impacts:     form.operational_impacts.trim(),
      impacts_in_ea1:          form.impacts_in_ea1,
      mitigation_measures:     form.mitigation_measures.trim(),
      neighbour_name:          form.neighbour_name.trim(),
      neighbour_contact:       form.neighbour_contact.trim(),
      neighbour_location:      form.neighbour_location.trim(),
      neighbour_comments:      form.neighbour_comments.trim(),
      observations:            form.observations.trim(),
      comments:                form.comments.trim(),
      permit_recommended:      form.permit_recommended,
      additional_info_required:form.additional_info_required,
      per_recommended:         form.per_recommended,
      eia_recommended:         form.eia_recommended,
      permit_declined:         form.permit_declined,
      permit_declined_reason:  form.permit_declined_reason.trim(),
      officer_id:              user.uid,
      officer_name:            staff?.name ?? '',
      photos,
    }

    try {
      if (isEditing) {
        await updateSubRecord(fileNumber, 'screenings', recordId, payload, user.uid)
      } else {
        await createSubRecord(fileNumber, 'screenings', payload, user.uid)
      }
      navigate(`/facilities/${fileNumber}`, { state: { tab: 'screenings' } })
    } catch (err) {
      setError(`Failed to save: ${err.message}`)
      setSubmitting(false)
    }
  }

  if (initialLoading) return <Spinner size={40} />

  return (
    <div className="page">
      <button className="btn btn--ghost btn--sm btn--back"
        onClick={() => navigate(`/facilities/${fileNumber}`, { state: { tab: 'screenings' } })}>
        <ArrowLeft size={14} /> Back to Facility
      </button>

      <div className="page-header" style={{ marginTop: 12 }}>
        <div>
          <div className="page-title">{isEditing ? 'Edit Screening' : 'New Screening'}</div>
          <div className="page-subtitle">
            File: <span className="file-num">{fileNumber}</span>
            {screeningId && <> · ID: <span className="file-num">{screeningId}</span></>}
          </div>
        </div>
      </div>

      {!isOnline && (
        <div className="offline-banner">
          <WifiOff size={15} style={{ flexShrink: 0 }} />
          You&apos;re offline — your submission will be saved locally and synced automatically when you reconnect.
        </div>
      )}

      {error && (
        <div className="login-error" style={{ marginBottom: 16 }}>
          <AlertCircle size={15} style={{ flexShrink: 0 }} /> {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>

        {/* ── 1. Inspection Details ── */}
        <div className="card form-card">
          <div className="form-section-title">Inspection Details</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Inspection Date <span className="req">*</span></label>
              <input className="form-input" type="date" value={form.inspection_date}
                onChange={(e) => set('inspection_date', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Name of Officer</label>
              <input className="form-input" value={staff?.name ?? '—'} readOnly
                style={{ background: '#f9fafb', color: '#6b7280' }} />
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
            </div>
            <div className="form-group">
              <label className="form-label">Company's Name</label>
              <input className="form-input" value={form.company_name}
                onChange={(e) => set('company_name', e.target.value)}
                placeholder="Registered company name" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Type of Undertaking</label>
            <input className="form-input" value={form.type_of_undertaking}
              onChange={(e) => set('type_of_undertaking', e.target.value)}
              placeholder="e.g. Manufacturing, Hospitality, Mining…" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Components</label>
              <textarea className="form-input" rows={3} value={form.components}
                onChange={(e) => set('components', e.target.value)}
                placeholder="Main components of the project…" />
            </div>
            <div className="form-group">
              <label className="form-label">Capacity</label>
              <textarea className="form-input" rows={3} value={form.capacity}
                onChange={(e) => set('capacity', e.target.value)}
                placeholder="Production/operational capacity…" />
            </div>
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
            </div>
            <div className="form-group">
              <label className="form-label">Solid Waste</label>
              <textarea className="form-input" rows={2} value={form.solid_waste}
                onChange={(e) => set('solid_waste', e.target.value)}
                placeholder="Types and volumes of solid waste…" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Gaseous Waste</label>
            <textarea className="form-input" rows={2} value={form.gaseous_waste}
              onChange={(e) => set('gaseous_waste', e.target.value)}
              placeholder="Emissions and gaseous discharges…" />
          </div>
          <div className="form-group">
            <label className="form-label">Comments on Description of Undertaking</label>
            <textarea className="form-input" rows={3} value={form.description_comments}
              onChange={(e) => set('description_comments', e.target.value)} />
          </div>
        </div>

        {/* ── 4. Site Location ── */}
        <div className="card form-card">
          <div className="form-section-title">Site Location</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Street / Area Name</label>
              <input className="form-input" value={form.street_area}
                onChange={(e) => set('street_area', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Town</label>
              <input className="form-input" value={form.town}
                onChange={(e) => set('town', e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">District</label>
              <select className="form-input" value={form.district}
                onChange={(e) => set('district', e.target.value)}>
                <option value="">Select district…</option>
                {DISTRICTS.map((d) => (
                  <option key={d.code} value={d.code}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Major Landmark</label>
              <input className="form-input" value={form.major_landmark}
                onChange={(e) => set('major_landmark', e.target.value)}
                placeholder="Nearest major landmark" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Adjacent Land Use</label>
            <input className="form-input" value={form.adjacent_land_use}
              onChange={(e) => set('adjacent_land_use', e.target.value)}
              placeholder="e.g. Residential, Agricultural, Commercial…" />
          </div>

          <div className="form-section-title" style={{ marginTop: 12, fontSize: 12 }}>Surrounding Land Use by Direction</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">North</label>
              <input className="form-input" value={form.north}
                onChange={(e) => set('north', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">South</label>
              <input className="form-input" value={form.south}
                onChange={(e) => set('south', e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">East</label>
              <input className="form-input" value={form.east}
                onChange={(e) => set('east', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">West</label>
              <input className="form-input" value={form.west}
                onChange={(e) => set('west', e.target.value)} />
            </div>
          </div>

          <div className="form-section-title" style={{ marginTop: 12, fontSize: 12 }}>GPS Coordinates</div>
          <GPSField
            coordinates={coordinates}
            loading={gpsLoading}
            error={gpsError}
            onCapture={captureGPS}
            onClear={clearGPS}
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
          </div>
          <div className="form-group">
            <label className="form-label">Construction Phase Impacts</label>
            <textarea className="form-input" rows={3} value={form.construction_impacts}
              onChange={(e) => set('construction_impacts', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Operational Phase Impacts</label>
            <textarea className="form-input" rows={3} value={form.operational_impacts}
              onChange={(e) => set('operational_impacts', e.target.value)} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Impacts Addressed in EA1?</label>
              <select className="form-input" value={form.impacts_in_ea1}
                onChange={(e) => set('impacts_in_ea1', e.target.value)}>
                {YES_NO.map((v) => <option key={v} value={v}>{v || 'Select…'}</option>)}
              </select>
            </div>
          </div>
          {form.impacts_in_ea1 === 'No' && (
            <div className="form-group">
              <label className="form-label">Mitigation Measures</label>
              <textarea className="form-input" rows={3} value={form.mitigation_measures}
                onChange={(e) => set('mitigation_measures', e.target.value)}
                placeholder="Proposed mitigation for unaddressed impacts…" />
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
            </div>
            <div className="form-group">
              <label className="form-label">Contact of Neighbour</label>
              <input className="form-input" value={form.neighbour_contact}
                onChange={(e) => set('neighbour_contact', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Location in Relation to the Undertaking</label>
            <input className="form-input" value={form.neighbour_location}
              onChange={(e) => set('neighbour_location', e.target.value)}
              placeholder="e.g. North of the proposed facility" />
          </div>
          <div className="form-group">
            <label className="form-label">Their Comments</label>
            <textarea className="form-input" rows={3} value={form.neighbour_comments}
              onChange={(e) => set('neighbour_comments', e.target.value)} />
          </div>
        </div>

        {/* ── 7. Observations & Comments ── */}
        <div className="card form-card">
          <div className="form-section-title">Observations & Comments</div>
          <div className="form-group">
            <label className="form-label">Observations</label>
            <textarea className="form-input" rows={4} value={form.observations}
              onChange={(e) => set('observations', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Comments</label>
            <textarea className="form-input" rows={3} value={form.comments}
              onChange={(e) => set('comments', e.target.value)} />
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
            </div>
            <div className="form-group">
              <label className="form-label">Additional Info Required?</label>
              <select className="form-input" value={form.additional_info_required}
                onChange={(e) => set('additional_info_required', e.target.value)}>
                {YES_NO.map((v) => <option key={v} value={v}>{v || 'Select…'}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">PER Recommended?</label>
              <select className="form-input" value={form.per_recommended}
                onChange={(e) => set('per_recommended', e.target.value)}>
                {YES_NO.map((v) => <option key={v} value={v}>{v || 'Select…'}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">EIA Recommended?</label>
              <select className="form-input" value={form.eia_recommended}
                onChange={(e) => set('eia_recommended', e.target.value)}>
                {YES_NO.map((v) => <option key={v} value={v}>{v || 'Select…'}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Permit Declined?</label>
              <select className="form-input" value={form.permit_declined}
                onChange={(e) => set('permit_declined', e.target.value)}>
                {YES_NO.map((v) => <option key={v} value={v}>{v || 'Select…'}</option>)}
              </select>
            </div>
          </div>
          {form.permit_declined === 'Yes' && (
            <div className="form-group">
              <label className="form-label">Reason for Permit Declined</label>
              <textarea className="form-input" rows={3} value={form.permit_declined_reason}
                onChange={(e) => set('permit_declined_reason', e.target.value)} />
            </div>
          )}
        </div>

        {/* ── 9. Photos ── */}
        <div className="card form-card">
          <div className="form-section-title">Picture of Facility</div>
          <PhotoCapture
            photos={photos}
            onPhotosChange={setPhotos}
            fileNumber={fileNumber}
            category="screenings"
          />
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn--ghost"
            onClick={() => navigate(`/facilities/${fileNumber}`, { state: { tab: 'screenings' } })}
            disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting
              ? <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</>
              : <><Save size={15} /> {isEditing ? 'Save Changes' : 'Add Screening'}</>
            }
          </button>
        </div>
      </form>
    </div>
  )
}
