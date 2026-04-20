import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Camera } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { createStaff, updateStaff, getStaffMember, uploadStaffPhoto } from '../firebase/staff'
import { ROLES as ROLE_DEFS } from '../data/constants'

const EMPTY = {
  name: '', email: '', password: '', role: 'officer', phone: '',
  designation: '', qualification: '',
  date_of_appointment: '', date_of_birth: '', address: '',
}

export default function StaffForm() {
  const { uid }  = useParams()
  const isEdit   = Boolean(uid)
  const navigate = useNavigate()
  const { user } = useAuth()

  const [form, setForm]         = useState(EMPTY)
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [existingPhotoUrl, setExistingPhotoUrl] = useState('')
  const [loading, setLoading]   = useState(isEdit)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const photoInputRef           = useRef()

  useEffect(() => {
    if (!isEdit) return
    getStaffMember(uid)
      .then((data) => {
        if (!data) { navigate('/staff'); return }
        setForm({
          name:                data.name ?? '',
          email:               data.email ?? '',
          password:            '',
          role:                data.role ?? 'officer',
          phone:               data.phone ?? '',
          designation:         data.designation ?? '',
          qualification:       data.qualification ?? '',
          date_of_appointment: data.date_of_appointment ?? '',
          date_of_birth:       data.date_of_birth ?? '',
          address:             data.address ?? '',
        })
        setExistingPhotoUrl(data.picture_url ?? '')
      })
      .catch(() => setError('Failed to load staff member.'))
      .finally(() => setLoading(false))
  }, [uid, isEdit, navigate])

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function handlePhotoSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!form.name.trim()) { setError('Name is required.'); return }
    if (!isEdit) {
      if (!form.email.trim())        { setError('Email is required.'); return }
      if (form.password.length < 6)  { setError('Password must be at least 6 characters.'); return }
    }

    setSaving(true)
    try {
      if (isEdit) {
        await updateStaff(uid, form)
        if (photoFile) await uploadStaffPhoto(uid, photoFile)
      } else {
        const newUid = await createStaff(form, user.uid)
        if (photoFile) await uploadStaffPhoto(newUid, photoFile)
      }
      navigate('/staff')
    } catch (err) {
      setError(err.message ?? 'An error occurred. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="page"><div className="empty-state">Loading…</div></div>

  const avatarSrc = photoPreview || existingPhotoUrl || null
  const initials  = form.name.trim().split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '?'

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

        {/* Photo */}
        <div className="form-section-title">Profile Photo</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <div
            className="profile-avatar profile-avatar--lg"
            style={{ cursor: 'pointer', position: 'relative', overflow: 'hidden', background: '#e5e7eb' }}
            onClick={() => photoInputRef.current?.click()}
            title="Click to change photo"
          >
            {avatarSrc ? (
              <img src={avatarSrc} alt="Staff photo" className="profile-avatar__img" />
            ) : (
              <span style={{ color: '#6b7280', fontSize: 22, fontWeight: 700 }}>{initials}</span>
            )}
            <div className="profile-avatar__overlay">
              <Camera size={16} color="#fff" />
            </div>
          </div>
          <div>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => photoInputRef.current?.click()}>
              <Camera size={13} /> {avatarSrc ? 'Change Photo' : 'Upload Photo'}
            </button>
            <div className="form-hint" style={{ marginTop: 4 }}>JPG or PNG, max 5 MB</div>
          </div>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
            onChange={handlePhotoSelect}
          />
        </div>

        {/* Personal details */}
        <div className="form-section-title">Personal Details</div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input className="form-input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Kofi Mensah" />
          </div>
          <div className="form-group">
            <label className="form-label">Date of Birth</label>
            <input className="form-input" type="date" value={form.date_of_birth} onChange={(e) => set('date_of_birth', e.target.value)} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Designation</label>
            <input className="form-input" value={form.designation} onChange={(e) => set('designation', e.target.value)} placeholder="e.g. Principal Environmental Officer" />
          </div>
          <div className="form-group">
            <label className="form-label">Qualification</label>
            <input className="form-input" value={form.qualification} onChange={(e) => set('qualification', e.target.value)} placeholder="e.g. BSc Environmental Science" />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Address</label>
          <input className="form-input" value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Residential address" />
        </div>

        {/* Account details */}
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
            {isEdit && <span className="form-hint">Email cannot be changed after account creation.</span>}
          </div>
          <div className="form-group">
            <label className="form-label">Contact / Phone</label>
            <input className="form-input" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+233 24 000 0000" />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Role *</label>
            <select className="form-input" value={form.role} onChange={(e) => set('role', e.target.value)}>
              {ROLE_DEFS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Date of Appointment</label>
            <input className="form-input" type="date" value={form.date_of_appointment} onChange={(e) => set('date_of_appointment', e.target.value)} />
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
          <button type="button" className="btn btn--ghost" onClick={() => navigate('/staff')}>Cancel</button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Account'}
          </button>
        </div>
      </form>
    </div>
  )
}
