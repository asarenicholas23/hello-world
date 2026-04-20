import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, AlertCircle, Save, Loader, ChevronDown, ChevronUp } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useGPS } from '../hooks/useGPS'
import { createFieldReport } from '../firebase/fieldReports'
import { inputToTs } from '../utils/records'
import { SECTORS, DISTRICTS, ENFORCEMENT_ACTIONS, ADMIN_ROLES } from '../data/constants'
import PhotoCapture from '../components/PhotoCapture'
import GPSField from '../components/GPSField'

const EMPTY = {
  facility_name:        '',
  type_of_undertaking:  '',
  location:             '',
  district:             '',
  sector_prefix:        '',
  contact_person:       '',
  phone:                '',
  date:                 '',
  action_taken:         '',
  follow_up_date:       '',
  enforcement_location: '',
  notes:                '',
}

const SCREENING_EMPTY = { date: '', notes: '' }

export default function FieldReportForm() {
  const navigate = useNavigate()
  const { user, staff } = useAuth()
  const isAdmin = ADMIN_ROLES.has(staff?.role)

  const [reportType, setReportType] = useState(isAdmin ? 'walk_in' : 'enforcement')
  const [formData, setFormData]     = useState(EMPTY)
  const [photos, setPhotos]         = useState([])
  const { coordinates, loading: gpsLoading, error: gpsError, capture: captureGPS, clear: clearGPS } = useGPS()

  // Screening
  const [addScreening, setAddScreening] = useState(false)
  const [screening, setScreening]       = useState(SCREENING_EMPTY)
  const [screeningPhotos, setScreeningPhotos] = useState([])
  const {
    coordinates: screeningCoords,
    loading: sGpsLoading,
    error: sGpsError,
    capture: captureScreeningGPS,
    clear: clearScreeningGPS,
  } = useGPS()

  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState('')

  function handleChange(e) {
    const { name, value } = e.target
    setFormData((p) => ({ ...p, [name]: value }))
  }

  function validate() {
    if (!formData.facility_name.trim()) return 'Facility name is required.'
    if (reportType === 'enforcement') {
      if (!formData.date)         return 'Enforcement date is required.'
      if (!formData.action_taken) return 'Action Taken is required.'
    }
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const err = validate()
    if (err) { setError(err); window.scrollTo({ top: 0, behavior: 'smooth' }); return }

    setSubmitting(true)
    setError('')

    const payload = {
      report_type:          reportType,
      facility_name:        formData.facility_name.trim(),
      type_of_undertaking:  formData.type_of_undertaking.trim(),
      location:             formData.location.trim(),
      district:             formData.district,
      sector_prefix:        formData.sector_prefix,
      contact_person:       formData.contact_person.trim(),
      phone:                formData.phone.trim(),
      notes:                formData.notes.trim(),
      ...(reportType === 'enforcement' ? {
        date:                 inputToTs(formData.date),
        officer_id:           user.uid,
        officer_name:         staff?.name ?? '',
        action_taken:         formData.action_taken,
        follow_up_date:       inputToTs(formData.follow_up_date),
        enforcement_location: formData.enforcement_location.trim(),
        coordinates:          coordinates ?? null,
        photos,
      } : {}),
      ...(addScreening && screening.date ? {
        screening: {
          date:         inputToTs(screening.date),
          officer_id:   user.uid,
          officer_name: staff?.name ?? '',
          notes:        screening.notes.trim(),
          photos:       screeningPhotos,
          coordinates:  screeningCoords ?? null,
        },
      } : {}),
    }

    try {
      await createFieldReport(payload, user.uid)
      navigate(isAdmin ? '/field-reports' : '/enforcement')
    } catch (err) {
      setError(`Failed to save: ${err.message}`)
      setSubmitting(false)
    }
  }

  const backPath  = isAdmin ? '/field-reports' : '/enforcement'
  const backLabel = isAdmin ? 'Field Reports'  : 'Enforcement'

  return (
    <div className="page">
      <button className="btn btn--ghost btn--sm btn--back" onClick={() => navigate(backPath)}>
        <ArrowLeft size={14} /> {backLabel}
      </button>

      <div className="page-header" style={{ marginTop: 12 }}>
        <div>
          <div className="page-title">New Field Report</div>
          <div className="page-subtitle">Record details for a facility not yet registered in the system</div>
        </div>
      </div>

      {/* Report type toggle */}
      <div className="report-type-toggle">
        <button
          type="button"
          className={`report-type-btn${reportType === 'enforcement' ? ' report-type-btn--active' : ''}`}
          onClick={() => setReportType('enforcement')}
        >
          Enforcement Action
        </button>
        <button
          type="button"
          className={`report-type-btn${reportType === 'walk_in' ? ' report-type-btn--active' : ''}`}
          onClick={() => setReportType('walk_in')}
        >
          Walk-in / Self-reporting
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {error && (
          <div className="login-error" style={{ marginBottom: 16 }}>
            <AlertCircle size={15} style={{ flexShrink: 0 }} /> {error}
          </div>
        )}

        {/* Facility info */}
        <div className="form-card">
          <div className="form-section">
            <div className="form-section-title">Facility Information</div>

            <div className="form-group">
              <label>Facility Name <span style={{ color: '#ef4444' }}>*</span></label>
              <input className="input" name="facility_name" value={formData.facility_name}
                onChange={handleChange} placeholder="Name of the facility" />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Sector</label>
                <select className="select" name="sector_prefix" value={formData.sector_prefix} onChange={handleChange}>
                  <option value="">Select sector…</option>
                  {SECTORS.map((s) => (
                    <option key={s.prefix} value={s.prefix}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Type of Undertaking</label>
                <input className="input" name="type_of_undertaking" value={formData.type_of_undertaking}
                  onChange={handleChange} placeholder="e.g. Quarry, Clinic, Hotel" />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Location</label>
                <input className="input" name="location" value={formData.location}
                  onChange={handleChange} placeholder="Town / Area" />
              </div>
              <div className="form-group">
                <label>District</label>
                <select className="select" name="district" value={formData.district} onChange={handleChange}>
                  <option value="">Select district…</option>
                  {DISTRICTS.map((d) => (
                    <option key={d.code} value={d.code}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Contact Person</label>
                <input className="input" name="contact_person" value={formData.contact_person}
                  onChange={handleChange} placeholder="Name of person on site" />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input className="input" name="phone" value={formData.phone}
                  onChange={handleChange} placeholder="+233 …" />
              </div>
            </div>
          </div>
        </div>

        {/* Enforcement details — only when report_type === 'enforcement' */}
        {reportType === 'enforcement' && (
          <div className="form-card">
            <div className="form-section">
              <div className="form-section-title">Enforcement Details</div>

              <div className="form-row">
                <div className="form-group">
                  <label>Date <span style={{ color: '#ef4444' }}>*</span></label>
                  <input className="input" type="date" name="date" value={formData.date} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label>Action Taken <span style={{ color: '#ef4444' }}>*</span></label>
                  <select className="select" name="action_taken" value={formData.action_taken} onChange={handleChange}>
                    <option value="">Select action…</option>
                    {ENFORCEMENT_ACTIONS.map((a) => (
                      <option key={a.value} value={a.value}>{a.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Follow-up Date</label>
                  <input className="input" type="date" name="follow_up_date" value={formData.follow_up_date} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label>Location Description</label>
                  <input className="input" name="enforcement_location" value={formData.enforcement_location}
                    onChange={handleChange} placeholder="Specific location of violation" />
                </div>
              </div>

              <div className="form-group">
                <label>Officer</label>
                <input className="input" value={staff?.name ?? '—'} readOnly
                  style={{ background: '#f9fafb', color: '#6b7280', cursor: 'not-allowed' }} />
              </div>

              <GPSField coordinates={coordinates} loading={gpsLoading} error={gpsError}
                onCapture={captureGPS} onClear={clearGPS} />

              <div className="form-group">
                <label>Notes</label>
                <textarea className="input textarea" name="notes" value={formData.notes}
                  onChange={handleChange} rows={3} placeholder="Details of violation and action taken…" />
              </div>
            </div>
          </div>
        )}

        {/* Walk-in notes */}
        {reportType === 'walk_in' && (
          <div className="form-card">
            <div className="form-section">
              <div className="form-section-title">Notes</div>
              <div className="form-group">
                <textarea className="input textarea" name="notes" value={formData.notes}
                  onChange={handleChange} rows={3} placeholder="Reason for visit, documents provided, next steps…" />
              </div>
            </div>
          </div>
        )}

        {/* Enforcement photos */}
        {reportType === 'enforcement' && (
          <div className="form-card">
            <div className="form-section">
              <div className="form-section-title">Photos</div>
              <PhotoCapture photos={photos} onPhotosChange={setPhotos}
                fileNumber="field-reports" category="enforcement" />
            </div>
          </div>
        )}

        {/* Optional screening section */}
        <div className="form-card">
          <div className="form-section">
            <div
              className="screening-toggle-header"
              onClick={() => setAddScreening((v) => !v)}
            >
              <div>
                <div className="form-section-title" style={{ marginBottom: 2 }}>
                  Screening Details <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span>
                </div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>
                  Record a pre-permit screening at the same time
                </div>
              </div>
              {addScreening ? <ChevronUp size={16} color="#6b7280" /> : <ChevronDown size={16} color="#6b7280" />}
            </div>

            {addScreening && (
              <div style={{ marginTop: 14 }}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Screening Date</label>
                    <input className="input" type="date" value={screening.date}
                      onChange={(e) => setScreening((p) => ({ ...p, date: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Officer</label>
                    <input className="input" value={staff?.name ?? '—'} readOnly
                      style={{ background: '#f9fafb', color: '#6b7280', cursor: 'not-allowed' }} />
                  </div>
                </div>

                <GPSField coordinates={screeningCoords} loading={sGpsLoading} error={sGpsError}
                  onCapture={captureScreeningGPS} onClear={clearScreeningGPS} />

                <div className="form-group">
                  <label>Notes</label>
                  <textarea className="input textarea" value={screening.notes} rows={3}
                    onChange={(e) => setScreening((p) => ({ ...p, notes: e.target.value }))}
                    placeholder="Observations during the visit…" />
                </div>

                <div className="form-group" style={{ marginTop: 8 }}>
                  <label>Photos</label>
                  <PhotoCapture photos={screeningPhotos} onPhotosChange={setScreeningPhotos}
                    fileNumber="field-reports" category="screening" />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn--ghost" onClick={() => navigate(backPath)} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting
              ? <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</>
              : <><Save size={15} /> Submit Field Report</>
            }
          </button>
        </div>
      </form>
    </div>
  )
}
