import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, AlertCircle, Save, Loader } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useGPS } from '../hooks/useGPS'
import { getSubRecord, createSubRecord, updateSubRecord } from '../firebase/subrecords'
import { tsToInput, inputToTs } from '../utils/records'
import PhotoCapture from '../components/PhotoCapture'
import Spinner from '../components/Spinner'
import GPSField from '../components/GPSField'

const EMPTY = { date: '', notes: '' }

export default function ScreeningForm() {
  const { fileNumber, recordId } = useParams()
  const isEditing = Boolean(recordId)
  const navigate = useNavigate()
  const { user, staff } = useAuth()

  const [formData, setFormData] = useState(EMPTY)
  const [photos, setPhotos] = useState([])
  const { coordinates, setCoordinates, loading: gpsLoading, error: gpsError, capture: captureGPS, clear: clearGPS } = useGPS()
  const [initialLoading, setInitialLoading] = useState(isEditing)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isEditing) return
    getSubRecord(fileNumber, 'screenings', recordId)
      .then((rec) => {
        if (!rec) { setError('Record not found.'); return }
        setFormData({ date: tsToInput(rec.date), notes: rec.notes ?? '' })
        setPhotos(rec.photos ?? [])
        if (rec.coordinates) setCoordinates(rec.coordinates)
      })
      .catch(() => setError('Failed to load record.'))
      .finally(() => setInitialLoading(false))
  }, [fileNumber, recordId, isEditing, setCoordinates])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!formData.date) { setError('Date is required.'); return }

    setSubmitting(true)
    setError('')

    const payload = {
      date:         inputToTs(formData.date),
      officer_id:   user.uid,
      officer_name: staff?.name ?? '',
      coordinates:  coordinates ?? null,
      photos,
      notes:        formData.notes.trim(),
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
      <button className="btn btn--ghost btn--sm btn--back" onClick={() => navigate(`/facilities/${fileNumber}`, { state: { tab: 'screenings' } })}>
        <ArrowLeft size={14} /> Back to Facility
      </button>

      <div className="page-header" style={{ marginTop: 12 }}>
        <div className="page-title">{isEditing ? 'Edit Screening' : 'New Screening'}</div>
        <div className="page-subtitle">File Number: <span className="file-num">{fileNumber}</span></div>
      </div>

      <form onSubmit={handleSubmit}>
        {error && (
          <div className="login-error" style={{ marginBottom: 16 }}>
            <AlertCircle size={15} style={{ flexShrink: 0 }} /> {error}
          </div>
        )}

        <div className="form-card">
          <div className="form-section">
            <div className="form-section-title">Screening Details</div>

            <div className="form-row">
              <div className="form-group">
                <label>Date <span style={{ color: '#ef4444' }}>*</span></label>
                <input className="input" type="date" name="date" value={formData.date}
                  onChange={(e) => setFormData((p) => ({ ...p, date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Officer</label>
                <input className="input" value={staff?.name ?? '—'} readOnly
                  style={{ background: '#f9fafb', color: '#6b7280', cursor: 'not-allowed' }} />
              </div>
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
                onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
                rows={3} placeholder="Observations and findings…" />
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
              category="screenings"
            />
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn--ghost" onClick={() => navigate(`/facilities/${fileNumber}`, { state: { tab: 'screenings' } })} disabled={submitting}>
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
