import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, AlertCircle, Save, Loader, WifiOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSync } from '../context/SyncContext'
import { useGPS } from '../hooks/useGPS'
import { getSubRecord, createSubRecord, updateSubRecord, listSubRecords } from '../firebase/subrecords'
import { tsToInput, inputToTs, fmtDate } from '../utils/records'
import PhotoCapture from '../components/PhotoCapture'
import GPSField from '../components/GPSField'
import Spinner from '../components/Spinner'

const EMPTY = { date: '', linked_permit_id: '', notes: '' }

export default function SiteVerificationForm() {
  const { fileNumber, recordId } = useParams()
  const isEditing = Boolean(recordId)
  const navigate = useNavigate()
  const { user, staff } = useAuth()
  const { isOnline } = useSync()

  const [formData, setFormData] = useState(EMPTY)
  const [photos, setPhotos] = useState([])
  const [permits, setPermits] = useState([])
  const { coordinates, setCoordinates, loading: gpsLoading, error: gpsError, capture: captureGPS, clear: clearGPS } = useGPS()
  const [initialLoading, setInitialLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const [permitList, rec] = await Promise.all([
          listSubRecords(fileNumber, 'permits'),
          isEditing ? getSubRecord(fileNumber, 'site_verifications', recordId) : Promise.resolve(null),
        ])
        setPermits(permitList)
        if (isEditing) {
          if (!rec) { setError('Record not found.'); return }
          setFormData({
            date:             tsToInput(rec.date),
            linked_permit_id: rec.linked_permit_id ?? '',
            notes:            rec.notes ?? '',
          })
          setPhotos(rec.photos ?? [])
          if (rec.coordinates) setCoordinates(rec.coordinates)
        }
      } catch {
        setError('Failed to load data.')
      } finally {
        setInitialLoading(false)
      }
    }
    load()
  }, [fileNumber, recordId, isEditing, setCoordinates])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!formData.date) { setError('Date is required.'); return }

    setSubmitting(true)
    setError('')

    const payload = {
      date:             inputToTs(formData.date),
      officer_id:       user.uid,
      officer_name:     staff?.name ?? '',
      linked_permit_id: formData.linked_permit_id,
      coordinates:      coordinates ?? null,
      photos,
      notes:            formData.notes.trim(),
    }

    try {
      if (isEditing) {
        await updateSubRecord(fileNumber, 'site_verifications', recordId, payload, user.uid)
      } else {
        await createSubRecord(fileNumber, 'site_verifications', payload, user.uid)
      }
      navigate(`/facilities/${fileNumber}`, { state: { tab: 'site_verifications' } })
    } catch (err) {
      setError(`Failed to save: ${err.message}`)
      setSubmitting(false)
    }
  }

  if (initialLoading) return <Spinner size={40} />

  return (
    <div className="page">
      <button className="btn btn--ghost btn--sm btn--back" onClick={() => navigate(`/facilities/${fileNumber}`, { state: { tab: 'site_verifications' } })}>
        <ArrowLeft size={14} /> Back to Facility
      </button>

      <div className="page-header" style={{ marginTop: 12 }}>
        <div className="page-title">{isEditing ? 'Edit Site Verification' : 'New Site Verification'}</div>
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
            <div className="form-section-title">Verification Details</div>

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

            <div className="form-group">
              <label>Linked Permit</label>
              <select className="select" name="linked_permit_id" value={formData.linked_permit_id}
                onChange={(e) => setFormData((p) => ({ ...p, linked_permit_id: e.target.value }))}>
                <option value="">None / Not linked</option>
                {permits.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.permit_number} — expires {fmtDate(p.expiry_date)}
                  </option>
                ))}
              </select>
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
                rows={3} placeholder="Findings and observations…" />
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
              category="site_verifications"
            />
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn--ghost" onClick={() => navigate(`/facilities/${fileNumber}`, { state: { tab: 'site_verifications' } })} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting
              ? <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</>
              : <><Save size={15} /> {isEditing ? 'Save Changes' : 'Add Verification'}</>
            }
          </button>
        </div>
      </form>
    </div>
  )
}
