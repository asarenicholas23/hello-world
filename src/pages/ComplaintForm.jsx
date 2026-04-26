import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, WifiOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSync } from '../context/SyncContext'
import { getComplaint, createComplaint, updateComplaint } from '../firebase/complaints'
import { COMPLAINT_STATUSES } from './ComplaintsPage'
import { inputToTs, tsToInput } from '../utils/records'

const EMPTY = {
  date: '',
  complainant_name: '',
  complainant_contact: '',
  file_number: '',
  facility_name: '',
  nature: '',
  status: 'open',
  action_taken: '',
  notes: '',
}

export default function ComplaintForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { user } = useAuth()
  const { isOnline } = useSync()

  const [form, setForm]       = useState(EMPTY)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => {
    if (!isEdit) return
    getComplaint(id)
      .then((data) => {
        if (!data) { navigate('/complaints'); return }
        setForm({
          date:                tsToInput(data.date),
          complainant_name:    data.complainant_name    ?? '',
          complainant_contact: data.complainant_contact ?? '',
          file_number:         data.file_number         ?? '',
          facility_name:       data.facility_name       ?? '',
          nature:              data.nature              ?? '',
          status:              data.status              ?? 'open',
          action_taken:        data.action_taken        ?? '',
          notes:               data.notes               ?? '',
        })
      })
      .catch(() => setError('Failed to load complaint.'))
      .finally(() => setLoading(false))
  }, [id, isEdit, navigate])

  function set(field, value) { setForm((f) => ({ ...f, [field]: value })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.nature.trim()) { setError('Nature of complaint is required.'); return }
    if (!form.date)          { setError('Date is required.'); return }
    setSaving(true)
    setError('')
    try {
      const payload = {
        date:                inputToTs(form.date),
        complainant_name:    form.complainant_name.trim(),
        complainant_contact: form.complainant_contact.trim(),
        file_number:         form.file_number.trim().toUpperCase(),
        facility_name:       form.facility_name.trim(),
        nature:              form.nature.trim(),
        status:              form.status,
        action_taken:        form.action_taken.trim(),
        notes:               form.notes.trim(),
      }
      if (isEdit) await updateComplaint(id, payload, user.uid)
      else        await createComplaint(payload, user.uid)
      navigate('/complaints')
    } catch (err) {
      setError(err.message ?? 'Failed to save. Try again.')
    } finally { setSaving(false) }
  }

  if (loading) return <div className="page"><div className="empty-state">Loading…</div></div>

  return (
    <div className="page">
      <button className="btn btn--ghost btn--sm btn--back" onClick={() => navigate('/complaints')}>
        <ArrowLeft size={14} /> Back to Complaints
      </button>
      <div className="page-header" style={{ marginTop: 12 }}>
        <div className="page-title">{isEdit ? 'Edit Complaint' : 'Log Complaint'}</div>
      </div>
      {!isOnline && (
        <div className="offline-banner">
          <WifiOff size={15} style={{ flexShrink: 0 }} />
          You&apos;re offline — your submission will be saved locally and synced automatically when you reconnect.
        </div>
      )}

      {error && <div className="login-error">{error}</div>}

      <form className="card form-card" onSubmit={handleSubmit}>
        <div className="form-section-title">Complaint Details</div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Date *</label>
            <input className="form-input" type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-input" value={form.status} onChange={(e) => set('status', e.target.value)}>
              {COMPLAINT_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Nature of Complaint *</label>
          <textarea
            className="form-input"
            rows={3}
            value={form.nature}
            onChange={(e) => set('nature', e.target.value)}
            placeholder="Describe the complaint…"
          />
        </div>

        <div className="form-section-title" style={{ marginTop: 20 }}>Complainant</div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Name</label>
            <input className="form-input" value={form.complainant_name} onChange={(e) => set('complainant_name', e.target.value)} placeholder="Complainant's full name" />
          </div>
          <div className="form-group">
            <label className="form-label">Contact</label>
            <input className="form-input" value={form.complainant_contact} onChange={(e) => set('complainant_contact', e.target.value)} placeholder="Phone or email" />
          </div>
        </div>

        <div className="form-section-title" style={{ marginTop: 20 }}>Facility (optional)</div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">File Number</label>
            <input className="form-input" value={form.file_number} onChange={(e) => set('file_number', e.target.value)} placeholder="e.g. CI42" />
          </div>
          <div className="form-group">
            <label className="form-label">Facility Name</label>
            <input className="form-input" value={form.facility_name} onChange={(e) => set('facility_name', e.target.value)} placeholder="If not registered" />
          </div>
        </div>

        <div className="form-section-title" style={{ marginTop: 20 }}>Response</div>

        <div className="form-group">
          <label className="form-label">Action Taken</label>
          <textarea
            className="form-input"
            rows={3}
            value={form.action_taken}
            onChange={(e) => set('action_taken', e.target.value)}
            placeholder="Steps taken to address the complaint…"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea
            className="form-input"
            rows={2}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Additional notes…"
          />
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn--ghost" onClick={() => navigate('/complaints')}>Cancel</button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Log Complaint'}
          </button>
        </div>
      </form>
    </div>
  )
}
