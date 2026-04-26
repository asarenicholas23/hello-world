import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, AlertCircle, Save, Loader, WifiOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSync } from '../context/SyncContext'
import { useGPS } from '../hooks/useGPS'
import { getSubRecord, createSubRecord, updateSubRecord } from '../firebase/subrecords'
import { tsToInput, inputToTs } from '../utils/records'
import { ENFORCEMENT_ACTIONS } from '../data/constants'
import PhotoCapture from '../components/PhotoCapture'
import GPSField from '../components/GPSField'
import Spinner from '../components/Spinner'

const EMPTY = {
  date:           '',
  location:       '',
  contact_person: '',
  action_taken:   '',
  follow_up_date: '',
  notes:          '',
}

export default function EnforcementForm() {
  const { fileNumber, recordId } = useParams()
  const isEditing = Boolean(recordId)
  const navigate = useNavigate()
  const { user, staff } = useAuth()
  const { isOnline } = useSync()

  const [formData, setFormData] = useState(EMPTY)
  const [photos, setPhotos] = useState([])
  const { coordinates, setCoordinates, loading: gpsLoading, error: gpsError, capture: captureGPS, clear: clearGPS } = useGPS()
  const [initialLoading, setInitialLoading] = useState(isEditing)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isEditing) return
    getSubRecord(fileNumber, 'enforcement', recordId)
      .then((rec) => {
        if (!rec) { setError('Record not found.'); return }
        setFormData({
          date:           tsToInput(rec.date),
          location:       rec.location       ?? '',
          contact_person: rec.contact_person ?? '',
          action_taken:   rec.action_taken   ?? '',
          follow_up_date: tsToInput(rec.follow_up_date),
          notes:          rec.notes          ?? '',
        })
        setPhotos(rec.photos ?? [])
        if (rec.coordinates) setCoordinates(rec.coordinates)
      })
      .catch(() => setError('Failed to load record.'))
      .finally(() => setInitialLoading(false))
  }, [fileNumber, recordId, isEditing, setCoordinates])

  function handleChange(e) {
    const { name, value } = e.target
    setFormData((p) => ({ ...p, [name]: value }))
  }

  function validate() {
    if (!formData.date)         return 'Date is required.'
    if (!formData.action_taken) return 'Action Taken is required.'
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const err = validate()
    if (err) { setError(err); window.scrollTo({ top: 0, behavior: 'smooth' }); return }

    setSubmitting(true)
    setError('')

    const payload = {
      date:           inputToTs(formData.date),
      officer_id:     user.uid,
      officer_name:   staff?.name ?? '',
      location:       formData.location.trim(),
      contact_person: formData.contact_person.trim(),
      action_taken:   formData.action_taken,
      follow_up_date: inputToTs(formData.follow_up_date),
      coordinates:    coordinates ?? null,
      photos,
      notes:          formData.notes.trim(),
    }

    try {
      if (isEditing) {
        await updateSubRecord(fileNumber, 'enforcement', recordId, payload, user.uid)
      } else {
        await createSubRecord(fileNumber, 'enforcement', payload, user.uid)
      }
      navigate(`/facilities/${fileNumber}`, { state: { tab: 'enforcement' } })
    } catch (err) {
      setError(`Failed to save: ${err.message}`)
      setSubmitting(false)
    }
  }

  if (initialLoading) return <Spinner size={40} />

  return (
    <div className="page">
      <button className="btn btn--ghost btn--sm btn--back" onClick={() => navigate(`/facilities/${fileNumber}`, { state: { tab: 'enforcement' } })}>
        <ArrowLeft size={14} /> Back to Facility
      </button>

      <div className="page-header" style={{ marginTop: 12 }}>
        <div className="page-title">{isEditing ? 'Edit Enforcement Action' : 'New Enforcement Action'}</div>
        <div className="page-subtitle">File Number: <span className="file-num">{fileNumber}</span></div>
      </div>

      <form onSubmit={handleSubmit}>
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
                <label>Contact Person</label>
                <input className="input" name="contact_person" value={formData.contact_person}
                  onChange={handleChange} placeholder="Name of person on site" />
              </div>
              <div className="form-group">
                <label>Follow-up Date</label>
                <input className="input" type="date" name="follow_up_date" value={formData.follow_up_date} onChange={handleChange} />
              </div>
            </div>

            <div className="form-group">
              <label>Location Description</label>
              <input className="input" name="location" value={formData.location}
                onChange={handleChange} placeholder="Specific location of violation" />
            </div>

            <div className="form-group">
              <label>Officer</label>
              <input className="input" value={staff?.name ?? '—'} readOnly
                style={{ background: '#f9fafb', color: '#6b7280', cursor: 'not-allowed' }} />
            </div>

            <GPSField
              coordinates={coordinates}
              loading={gpsLoading}
              error={gpsError}
              onCapture={captureGPS}
              onClear={clearGPS}
            />

            <div className="form-group">
              <label>Notes</label>
              <textarea className="input textarea" name="notes" value={formData.notes}
                onChange={handleChange} rows={3} placeholder="Details of violation and action taken…" />
            </div>
          </div>
        </div>

        <div className="form-card">
          <div className="form-section">
            <div className="form-section-title">Photos</div>
            <PhotoCapture
              photos={photos}
              onPhotosChange={setPhotos}
              fileNumber={fileNumber}
              category="enforcement"
            />
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn--ghost" onClick={() => navigate(`/facilities/${fileNumber}`, { state: { tab: 'enforcement' } })} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting
              ? <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</>
              : <><Save size={15} /> {isEditing ? 'Save Changes' : 'Add Action'}</>
            }
          </button>
        </div>
      </form>
    </div>
  )
}
