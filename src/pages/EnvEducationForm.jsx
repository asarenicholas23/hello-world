import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, WifiOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSync } from '../context/SyncContext'
import { getEnvEducation, createEnvEducation, updateEnvEducation } from '../firebase/envEducation'
import { ENV_ED_TYPES } from './EnvironmentalEducationPage'
import { DISTRICTS } from '../data/constants'
import { inputToTs, tsToInput } from '../utils/records'
import PhotoCapture from '../components/PhotoCapture'

const EMPTY = {
  date: '',
  title: '',
  type: 'workshop',
  location: '',
  district: '',
  participants_count: '',
  target_group: '',
  facilitator: '',
  notes: '',
}

export default function EnvEducationForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { user } = useAuth()
  const { isOnline } = useSync()

  const [form, setForm]       = useState(EMPTY)
  const [photos, setPhotos]   = useState([])
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => {
    if (!isEdit) return
    getEnvEducation(id)
      .then((data) => {
        if (!data) { navigate('/env-education'); return }
        setForm({
          date:               tsToInput(data.date),
          title:              data.title              ?? '',
          type:               data.type               ?? 'workshop',
          location:           data.location           ?? '',
          district:           data.district           ?? '',
          participants_count: data.participants_count != null ? String(data.participants_count) : '',
          target_group:       data.target_group       ?? '',
          facilitator:        data.facilitator        ?? '',
          notes:              data.notes              ?? '',
        })
        setPhotos(data.photos ?? [])
      })
      .catch(() => setError('Failed to load record.'))
      .finally(() => setLoading(false))
  }, [id, isEdit, navigate])

  function set(field, value) { setForm((f) => ({ ...f, [field]: value })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim()) { setError('Title is required.'); return }
    if (!form.date)         { setError('Date is required.'); return }
    setSaving(true)
    setError('')
    try {
      const payload = {
        date:               inputToTs(form.date),
        title:              form.title.trim(),
        type:               form.type,
        location:           form.location.trim(),
        district:           form.district,
        participants_count: form.participants_count ? Number(form.participants_count) : 0,
        target_group:       form.target_group.trim(),
        facilitator:        form.facilitator.trim(),
        notes:              form.notes.trim(),
        photos,
      }
      if (isEdit) await updateEnvEducation(id, payload, user.uid)
      else        await createEnvEducation(payload, user.uid)
      navigate('/env-education')
    } catch (err) {
      setError(err.message ?? 'Failed to save. Try again.')
    } finally { setSaving(false) }
  }

  if (loading) return <div className="page"><div className="empty-state">Loading…</div></div>

  return (
    <div className="page">
      <button className="btn btn--ghost btn--sm btn--back" onClick={() => navigate('/env-education')}>
        <ArrowLeft size={14} /> Back to Environmental Education
      </button>
      <div className="page-header" style={{ marginTop: 12 }}>
        <div className="page-title">{isEdit ? 'Edit Session' : 'Log Education Session'}</div>
      </div>
      {!isOnline && (
        <div className="offline-banner">
          <WifiOff size={15} style={{ flexShrink: 0 }} />
          You&apos;re offline — your submission will be saved locally and synced automatically when you reconnect.
        </div>
      )}

      {error && <div className="login-error">{error}</div>}

      <form className="card form-card" onSubmit={handleSubmit}>
        <div className="form-section-title">Session Details</div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Date *</label>
            <input className="form-input" type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Type</label>
            <select className="form-input" value={form.type} onChange={(e) => set('type', e.target.value)}>
              {ENV_ED_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Title / Topic *</label>
          <input className="form-input" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Waste Management Awareness Workshop" />
        </div>

        <div className="form-section-title" style={{ marginTop: 20 }}>Location & Attendance</div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Location</label>
            <input className="form-input" value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="Venue or community name" />
          </div>
          <div className="form-group">
            <label className="form-label">District</label>
            <select className="form-input" value={form.district} onChange={(e) => set('district', e.target.value)}>
              <option value="">Select district</option>
              {DISTRICTS.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">No. of Participants</label>
            <input className="form-input" type="number" min="0" value={form.participants_count} onChange={(e) => set('participants_count', e.target.value)} placeholder="0" />
          </div>
          <div className="form-group">
            <label className="form-label">Target Group</label>
            <input className="form-input" value={form.target_group} onChange={(e) => set('target_group', e.target.value)} placeholder="e.g. Community members, Students" />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Facilitator</label>
          <input className="form-input" value={form.facilitator} onChange={(e) => set('facilitator', e.target.value)} placeholder="Name of the lead facilitator" />
        </div>

        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea className="form-input" rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Key takeaways, outcomes, follow-ups…" />
        </div>

        <div className="form-section-title" style={{ marginTop: 20 }}>Event Photos</div>
        <PhotoCapture
          photos={photos}
          onPhotosChange={setPhotos}
          fileNumber="env-education"
          category="sessions"
          maxPhotos={5}
        />

        <div className="form-actions">
          <button type="button" className="btn btn--ghost" onClick={() => navigate('/env-education')}>Cancel</button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Log Session'}
          </button>
        </div>
      </form>
    </div>
  )
}
