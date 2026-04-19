import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, MapPin, Loader, AlertCircle, Save, Crosshair, WifiOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSync } from '../context/SyncContext'
import { useGPS } from '../hooks/useGPS'
import { createFacility, updateFacility, getFacility } from '../firebase/facilities'
import { SECTORS, DISTRICTS, REGION } from '../data/constants'
import Spinner from '../components/Spinner'

const EMPTY_FORM = {
  name: '',
  sector: '',
  sector_prefix: '',
  type_of_undertaking: '',
  location: '',
  district: '',
  email: '',
  entity_tin: '',
  contact_person: '',
  designation: '',
  address: '',
  phone: '',
}

export default function FacilityForm() {
  const { fileNumber } = useParams()
  const isEditing = Boolean(fileNumber)
  const navigate = useNavigate()
  const { user } = useAuth()
  const { isOnline, addDraft } = useSync()

  const [formData, setFormData] = useState(EMPTY_FORM)
  const { coordinates, setCoordinates, loading: gpsLoading, error: gpsError, capture: handleCaptureGPS, clear: clearCoordinates } = useGPS()
  const [initialLoading, setInitialLoading] = useState(isEditing)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Load existing facility when editing
  useEffect(() => {
    if (!isEditing) return
    getFacility(fileNumber)
      .then((facility) => {
        if (!facility) {
          setError('Facility not found.')
          return
        }
        const { coordinates: coords, ...rest } = facility
        setFormData({
          name: rest.name ?? '',
          sector: rest.sector ?? '',
          sector_prefix: rest.sector_prefix ?? '',
          type_of_undertaking: rest.type_of_undertaking ?? '',
          location: rest.location ?? '',
          district: rest.district ?? '',
          email: rest.email ?? '',
          entity_tin: rest.entity_tin ?? '',
          contact_person: rest.contact_person ?? '',
          designation: rest.designation ?? '',
          address: rest.address ?? '',
          phone: rest.phone ?? '',
        })
        setCoordinates(coords ?? null)
      })
      .catch(() => setError('Failed to load facility data.'))
      .finally(() => setInitialLoading(false))
  }, [fileNumber, isEditing])

  function handleChange(e) {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  function handleSectorChange(e) {
    const name = e.target.value
    const sector = SECTORS.find((s) => s.name === name)
    setFormData((prev) => ({
      ...prev,
      sector: name,
      sector_prefix: sector?.prefix ?? '',
    }))
  }

  function validate() {
    if (!formData.name.trim()) return 'Name of Undertaking is required.'
    if (!formData.sector) return 'Sector is required.'
    if (!formData.type_of_undertaking.trim()) return 'Type of Undertaking is required.'
    if (!formData.location.trim()) return 'Location is required.'
    if (!formData.district) return 'District is required.'
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setSubmitting(true)
    setError('')

    const payload = { ...formData, coordinates: coordinates ?? null }

    // Offline create — file number transaction requires network
    if (!isEditing && !isOnline) {
      addDraft(payload, user.uid)
      navigate('/facilities', { state: { draftSaved: true } })
      return
    }

    try {
      if (isEditing) {
        await updateFacility(fileNumber, payload, user.uid)
        navigate(`/facilities/${fileNumber}`)
      } else {
        const newFileNumber = await createFacility(payload, user.uid)
        navigate(`/facilities/${newFileNumber}`)
      }
    } catch (err) {
      // Connection dropped mid-save — offer draft fallback for new facilities
      if (!isEditing && !navigator.onLine) {
        addDraft(payload, user.uid)
        navigate('/facilities', { state: { draftSaved: true } })
        return
      }
      setError(
        err.message.includes('Counter not found')
          ? 'Could not generate file number. Make sure sector counters are seeded.'
          : `Failed to save: ${err.message}`
      )
      setSubmitting(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  if (initialLoading) return <Spinner size={40} />

  return (
    <div className="page">
      {/* Header */}
      <div>
        <button className="btn btn--ghost btn--sm btn--back" onClick={() => navigate(-1)}>
          <ArrowLeft size={14} />
          Back
        </button>
        <div className="page-header" style={{ marginTop: 12 }}>
          <div>
            <div className="page-title">
              {isEditing ? 'Edit Facility' : 'New Facility'}
            </div>
            {isEditing && (
              <div className="page-subtitle">
                File Number: <span className="file-num">{fileNumber}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {!isOnline && !isEditing && (
          <div className="offline-banner">
            <WifiOff size={15} style={{ flexShrink: 0 }} />
            You&apos;re offline. Fill out the form and tap &quot;Save as Draft&quot; — it will sync
            automatically when you reconnect.
          </div>
        )}

        {error && (
          <div className="login-error" style={{ marginBottom: 16 }}>
            <AlertCircle size={15} style={{ flexShrink: 0 }} />
            {error}
          </div>
        )}

        {/* ── Basic Info ─────────────────────────── */}
        <div className="form-card">
          <div className="form-section">
            <div className="form-section-title">Basic Information</div>

            <div className="form-group">
              <label>Name of Undertaking <span style={{ color: '#ef4444' }}>*</span></label>
              <input
                className="input"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. Kumasi Water Treatment Plant"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Sector <span style={{ color: '#ef4444' }}>*</span></label>
                {isEditing ? (
                  <input
                    className="input"
                    value={`${formData.sector} (${formData.sector_prefix})`}
                    readOnly
                    style={{ background: '#f9fafb', color: '#6b7280', cursor: 'not-allowed' }}
                    title="Sector cannot be changed after creation"
                  />
                ) : (
                  <select
                    className="select"
                    name="sector"
                    value={formData.sector}
                    onChange={handleSectorChange}
                  >
                    <option value="">Select sector…</option>
                    {SECTORS.map((s) => (
                      <option key={s.prefix} value={s.name}>
                        {s.name} ({s.prefix})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="form-group">
                <label>File Number</label>
                <input
                  className="input"
                  value={
                    isEditing
                      ? fileNumber
                      : formData.sector_prefix
                      ? `Will be: ${formData.sector_prefix}[auto]`
                      : 'Select a sector first'
                  }
                  readOnly
                  style={{
                    background: '#f9fafb',
                    color: '#6b7280',
                    cursor: 'not-allowed',
                    fontFamily: formData.sector_prefix ? 'monospace' : 'inherit',
                  }}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Type of Undertaking <span style={{ color: '#ef4444' }}>*</span></label>
              <input
                className="input"
                name="type_of_undertaking"
                value={formData.type_of_undertaking}
                onChange={handleChange}
                placeholder="e.g. Water Treatment, Manufacturing Plant, Hospital"
              />
            </div>
          </div>
        </div>

        {/* ── Location ───────────────────────────── */}
        <div className="form-card">
          <div className="form-section">
            <div className="form-section-title">Location</div>

            <div className="form-group">
              <label>Location / Address Description <span style={{ color: '#ef4444' }}>*</span></label>
              <input
                className="input"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="e.g. Ahinsan Estate, off Accra Road"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>District <span style={{ color: '#ef4444' }}>*</span></label>
                <select
                  className="select"
                  name="district"
                  value={formData.district}
                  onChange={handleChange}
                >
                  <option value="">Select district…</option>
                  {DISTRICTS.map((d) => (
                    <option key={d.code} value={d.code}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Region</label>
                <input
                  className="input"
                  value={REGION}
                  readOnly
                  style={{ background: '#f9fafb', color: '#6b7280', cursor: 'not-allowed' }}
                />
              </div>
            </div>

            {/* GPS */}
            <div className="form-group">
              <label>GPS Coordinates</label>
              <div className="gps-row">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={handleCaptureGPS}
                  disabled={gpsLoading}
                  style={{ flexShrink: 0 }}
                >
                  {gpsLoading ? (
                    <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> Getting location…</>
                  ) : (
                    <><Crosshair size={15} /> Capture GPS</>
                  )}
                </button>

                {coordinates ? (
                  <div className="gps-coords">
                    <MapPin size={12} style={{ marginRight: 4, color: '#065f46' }} />
                    {coordinates.lat.toFixed(6)}, {coordinates.lng.toFixed(6)}
                    <a
                      href={`https://www.google.com/maps?q=${coordinates.lat},${coordinates.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ marginLeft: 10 }}
                    >
                      View in Maps ↗
                    </a>
                    <button
                      type="button"
                      onClick={clearCoordinates}
                      style={{ marginLeft: 10, background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 12 }}
                    >
                      ✕ Clear
                    </button>
                  </div>
                ) : (
                  <span style={{ fontSize: 13, color: '#9ca3af' }}>No coordinates captured</span>
                )}
              </div>

              {gpsError && (
                <div style={{ fontSize: 12, color: '#dc2626', marginTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <AlertCircle size={12} /> {gpsError}
                </div>
              )}

              {/* Map preview */}
              {coordinates && (
                <iframe
                  title="Location preview"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${coordinates.lng - 0.005},${coordinates.lat - 0.005},${coordinates.lng + 0.005},${coordinates.lat + 0.005}&layer=mapnik&marker=${coordinates.lat},${coordinates.lng}`}
                  style={{ width: '100%', height: 200, border: 0, borderRadius: 8, marginTop: 10 }}
                />
              )}
            </div>
          </div>
        </div>

        {/* ── Contact Info ───────────────────────── */}
        <div className="form-card">
          <div className="form-section">
            <div className="form-section-title">Contact Information</div>

            <div className="form-row">
              <div className="form-group">
                <label>Email</label>
                <input
                  className="input"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="facility@example.com"
                />
              </div>
              <div className="form-group">
                <label>Entity TIN</label>
                <input
                  className="input"
                  name="entity_tin"
                  value={formData.entity_tin}
                  onChange={handleChange}
                  placeholder="Taxpayer Identification Number"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Contact Person</label>
                <input
                  className="input"
                  name="contact_person"
                  value={formData.contact_person}
                  onChange={handleChange}
                  placeholder="Full name"
                />
              </div>
              <div className="form-group">
                <label>Designation</label>
                <input
                  className="input"
                  name="designation"
                  value={formData.designation}
                  onChange={handleChange}
                  placeholder="e.g. Plant Manager"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Mailing Address</label>
              <textarea
                className="textarea input"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="P.O. Box 123, Kumasi"
                rows={2}
              />
            </div>

            <div className="form-group">
              <label>Phone</label>
              <input
                className="input"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+233 24 000 0000"
              />
            </div>
          </div>
        </div>

        {/* ── Actions ────────────────────────────── */}
        <div className="form-actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => navigate(-1)}
            disabled={submitting}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting ? (
              <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</>
            ) : (
              <><Save size={15} /> {isEditing ? 'Save Changes' : isOnline ? 'Create Facility' : 'Save as Draft'}</>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
