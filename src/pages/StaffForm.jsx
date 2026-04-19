import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { createStaff, updateStaff, getStaffMember } from '../firebase/staff'

const ROLES = ['admin', 'finance', 'officer']

const EMPTY = { name: '', email: '', password: '', role: 'officer', phone: '' }

export default function StaffForm() {
  const { uid } = useParams()
  const isEdit  = Boolean(uid)
  const navigate = useNavigate()
  const { user } = useAuth()

  const [form, setForm]       = useState(EMPTY)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => {
    if (!isEdit) return
    getStaffMember(uid)
      .then((data) => {
        if (!data) { navigate('/staff'); return }
        setForm({ name: data.name, email: data.email, password: '', role: data.role, phone: data.phone ?? '' })
      })
      .catch(() => setError('Failed to load staff member.'))
      .finally(() => setLoading(false))
  }, [uid, isEdit, navigate])

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!form.name.trim())  { setError('Name is required.'); return }
    if (!isEdit) {
      if (!form.email.trim())    { setError('Email is required.'); return }
      if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return }
    }

    setSaving(true)
    try {
      if (isEdit) {
        await updateStaff(uid, { name: form.name, role: form.role, phone: form.phone })
      } else {
        await createStaff(
          { name: form.name, email: form.email, password: form.password, role: form.role, phone: form.phone },
          user.uid,
        )
      }
      navigate('/staff')
    } catch (err) {
      setError(err.message ?? 'An error occurred. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="page"><div className="empty-state">Loading…</div></div>

  return (
    <div className="page">
      <button className="btn btn--ghost btn--sm btn--back" onClick={() => navigate('/staff')}>
        <ArrowLeft size={14} /> Back to Staff
      </button>

      <div className="page-header" style={{ marginTop: 12 }}>
        <div className="page-title">{isEdit ? 'Edit Staff Member' : 'Add Staff Member'}</div>
      </div>

      {error && <div className="login-error">{error}</div>}

      <form className="card form-card" onSubmit={handleSubmit}>
        <div className="form-section-title">Personal Details</div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input
              className="form-input"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Kofi Mensah"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input
              className="form-input"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="+233 24 000 0000"
            />
          </div>
        </div>

        <div className="form-section-title" style={{ marginTop: 20 }}>Account Details</div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Email *</label>
            <input
              className="form-input"
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="staff@epa-ashanti.gh"
              disabled={isEdit}
              style={isEdit ? { background: '#f9fafb', color: '#9ca3af' } : {}}
            />
            {isEdit && (
              <span className="form-hint">Email cannot be changed after account creation.</span>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Role *</label>
            <select className="form-input" value={form.role} onChange={(e) => set('role', e.target.value)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>

        {!isEdit && (
          <div className="form-group">
            <label className="form-label">Temporary Password *</label>
            <input
              className="form-input"
              type="password"
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
              placeholder="Min. 6 characters"
              autoComplete="new-password"
            />
            <span className="form-hint">The staff member should change this after first login.</span>
          </div>
        )}

        <div className="form-actions">
          <button type="button" className="btn btn--ghost" onClick={() => navigate('/staff')}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Account'}
          </button>
        </div>
      </form>
    </div>
  )
}
