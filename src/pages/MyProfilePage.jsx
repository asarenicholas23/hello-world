import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { updateOwnProfile, changeOwnPassword, uploadStaffPhoto } from '../firebase/staff'
import { getMyActivityStats } from '../firebase/dashboard'
import { ADMIN_ROLES } from '../data/constants'
import {
  Mail, Phone, Hash, Calendar, MapPin, BookOpen, Briefcase,
  Edit2, Lock, Check, AlertCircle, Camera,
  Building2, ClipboardList, Activity, ShieldAlert, CheckSquare, FileText,
  MessageSquare, GraduationCap,
} from 'lucide-react'

const ROLE_META = {
  director:          { label: 'Regional Director',            color: '#7c3aed', bg: '#faf5ff' },
  admin:             { label: 'Administrator',                color: '#1d4ed8', bg: '#eff6ff' },
  senior_officer:    { label: 'Senior Environmental Officer', color: '#0369a1', bg: '#f0f9ff' },
  officer:           { label: 'Environmental Officer',        color: '#c2410c', bg: '#fff7ed' },
  assistant_officer: { label: 'Asst. Environmental Officer',  color: '#b45309', bg: '#fffbeb' },
  junior_officer:    { label: 'Junior Environmental Officer', color: '#6b7280', bg: '#f9fafb' },
  finance:           { label: 'Finance Officer',              color: '#065f46', bg: '#ecfdf5' },
}

function fmtDate(val) {
  if (!val) return '—'
  try {
    // stored as "YYYY-MM-DD" string
    const [y, m, d] = val.split('-')
    return new Date(+y, +m - 1, +d).toLocaleDateString('en-GH', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch { return val }
}

function fmtJoined(ts) {
  if (!ts) return '—'
  try {
    const d = ts.toDate ? ts.toDate() : ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts)
    return d.toLocaleDateString('en-GH', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch { return '—' }
}

export default function MyProfilePage() {
  const { user, staff, role, refreshStaff } = useAuth()
  const navigate = useNavigate()
  const meta = ROLE_META[role] ?? ROLE_META.officer
  const photoInputRef = useRef()

  const [editMode, setEditMode]           = useState(false)
  const [form, setForm]                   = useState({})
  const [photoFile, setPhotoFile]         = useState(null)
  const [photoPreview, setPhotoPreview]   = useState(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg, setProfileMsg]       = useState(null)

  const [pwOpen, setPwOpen]       = useState(false)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw]         = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [savingPw, setSavingPw]   = useState(false)
  const [pwMsg, setPwMsg]         = useState(null)

  const [stats, setStats]               = useState(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [dateFrom, setDateFrom]     = useState('')
  const [dateTo, setDateTo]         = useState('')
  const [activeFrom, setActiveFrom] = useState(null)
  const [activeTo, setActiveTo]     = useState(null)

  useEffect(() => {
    if (staff) resetForm()
  }, [staff])

  useEffect(() => {
    if (!user) return
    loadStats(activeFrom, activeTo)
  }, [user?.uid, activeFrom, activeTo])

  function applyDateFilter() {
    setActiveFrom(dateFrom ? new Date(dateFrom).getTime() : null)
    setActiveTo(dateTo   ? new Date(dateTo + 'T23:59:59').getTime() : null)
  }
  function clearDateFilter() {
    setDateFrom(''); setDateTo('')
    setActiveFrom(null); setActiveTo(null)
  }

  function resetForm() {
    setForm({
      name:          staff.name ?? '',
      phone:         staff.phone ?? '',
      designation:   staff.designation ?? '',
      qualification: staff.qualification ?? '',
      date_of_birth: staff.date_of_birth ?? '',
      address:       staff.address ?? '',
    })
    setPhotoFile(null)
    setPhotoPreview(null)
  }

  async function loadStats(startMs, endMs) {
    setStatsLoading(true)
    try {
      setStats(await getMyActivityStats(user.uid, startMs, endMs))
    } catch {
      setStats(null)
    } finally {
      setStatsLoading(false)
    }
  }

  function handlePhotoSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function handleQuickPhotoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    try {
      const url = await uploadStaffPhoto(user.uid, file)
      await updateOwnProfile(user.uid, { ...form, picture_url: url })
      await refreshStaff()
      setPhotoPreview(url)
      flash(setProfileMsg, { type: 'ok', text: 'Photo updated.' })
    } catch {
      flash(setProfileMsg, { type: 'err', text: 'Photo upload failed. Try again.' })
    } finally {
      setUploadingPhoto(false)
    }
  }

  async function handleSaveProfile(e) {
    e.preventDefault()
    if (!form.name.trim()) { setProfileMsg({ type: 'err', text: 'Name is required.' }); return }
    setSavingProfile(true)
    try {
      let picture_url
      if (photoFile) {
        picture_url = await uploadStaffPhoto(user.uid, photoFile)
        setPhotoPreview(picture_url)
      }
      await updateOwnProfile(user.uid, { ...form, name: form.name.trim(), picture_url })
      await refreshStaff()
      setEditMode(false)
      flash(setProfileMsg, { type: 'ok', text: 'Profile updated.' })
    } catch (err) {
      console.error('Profile save error:', err)
      setProfileMsg({ type: 'err', text: 'Failed to save. Try again.' })
    } finally { setSavingProfile(false) }
  }

  async function handleChangePassword(e) {
    e.preventDefault()
    if (newPw.length < 6)    { setPwMsg({ type: 'err', text: 'New password must be at least 6 characters.' }); return }
    if (newPw !== confirmPw) { setPwMsg({ type: 'err', text: 'Passwords do not match.' }); return }
    setSavingPw(true)
    try {
      await changeOwnPassword(currentPw, newPw)
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
      setPwOpen(false)
      flash(setProfileMsg, { type: 'ok', text: 'Password changed successfully.' })
    } catch (err) {
      const isWrongPw = err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential'
      setPwMsg({ type: 'err', text: isWrongPw ? 'Current password is incorrect.' : 'Failed to change password. Try again.' })
    } finally { setSavingPw(false) }
  }

  function flash(setter, val) {
    setter(val)
    setTimeout(() => setter(null), 4000)
  }

  if (!staff) return null

  const initials   = staff.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() ?? '?'
  const currentPhotoUrl = photoPreview || staff.picture_url || null

  return (
    <div className="page">
      <div className="page-title" style={{ marginBottom: 20 }}>My Profile</div>

      {profileMsg && (
        <div
          className={profileMsg.type === 'ok' ? 'assign-success-banner' : 'login-error'}
          style={{ marginBottom: 12 }}
        >
          {profileMsg.type === 'ok' ? <Check size={14} /> : <AlertCircle size={14} />}
          {profileMsg.text}
        </div>
      )}

      {/* Profile header */}
      <div className="card profile-header-card">
        {/* Avatar / photo */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div
            className="profile-avatar profile-avatar--lg"
            style={{ background: currentPhotoUrl ? 'transparent' : meta.color }}
            title="Click to change photo"
            onClick={() => photoInputRef.current?.click()}
          >
            {currentPhotoUrl
              ? <img src={currentPhotoUrl} alt="Profile" className="profile-avatar__img" />
              : initials
            }
            <div className="profile-avatar__overlay">
              {uploadingPhoto ? '…' : <Camera size={16} color="#fff" />}
            </div>
          </div>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
            onChange={handleQuickPhotoUpload}
          />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="profile-name">{staff.name}</div>
          <span
            className="staff-role-badge"
            style={{ background: meta.bg, color: meta.color, marginBottom: 8, display: 'inline-flex' }}
          >
            {meta.label}
          </span>
          {staff.designation && (
            <div style={{ fontSize: 13, color: '#374151', marginBottom: 6 }}>{staff.designation}</div>
          )}
          <div className="profile-info-grid">
            <InfoItem icon={Hash}     label="Staff ID"    value={staff.staff_id} />
            <InfoItem icon={Mail}     label="Email"       value={staff.email} />
            {staff.phone      && <InfoItem icon={Phone}     label="Contact"     value={staff.phone} />}
            {staff.address    && <InfoItem icon={MapPin}    label="Address"     value={staff.address} />}
            {staff.qualification && <InfoItem icon={BookOpen} label="Qualification" value={staff.qualification} />}
            {staff.date_of_birth && <InfoItem icon={Calendar} label="Date of Birth" value={fmtDate(staff.date_of_birth)} />}
            {staff.date_of_appointment && <InfoItem icon={Briefcase} label="Appointed" value={fmtDate(staff.date_of_appointment)} />}
            <InfoItem icon={Calendar} label="Joined" value={fmtJoined(staff.created_at)} />
          </div>
        </div>

        {!editMode && (
          <button
            className="btn btn--ghost btn--sm"
            style={{ flexShrink: 0, alignSelf: 'flex-start' }}
            onClick={() => { setEditMode(true); setPwOpen(false) }}
          >
            <Edit2 size={13} /> Edit
          </button>
        )}
      </div>

      {/* Edit form */}
      {editMode && (
        <form className="card" style={{ padding: '20px 24px' }} onSubmit={handleSaveProfile}>
          <div className="form-section-title">Edit Profile</div>

          {/* Photo in edit mode */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
            <div
              className="profile-avatar"
              style={{ background: (photoPreview || staff.picture_url) ? 'transparent' : meta.color, cursor: 'pointer' }}
              onClick={() => document.getElementById('edit-photo-input').click()}
            >
              {(photoPreview || staff.picture_url)
                ? <img src={photoPreview || staff.picture_url} alt="Profile" className="profile-avatar__img" />
                : initials
              }
              <div className="profile-avatar__overlay"><Camera size={14} color="#fff" /></div>
            </div>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => document.getElementById('edit-photo-input').click()}>
              <Camera size={13} /> {(photoPreview || staff.picture_url) ? 'Change Photo' : 'Upload Photo'}
            </button>
            <input
              id="edit-photo-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
              onChange={handlePhotoSelect}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input className="form-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Contact / Phone</label>
              <input className="form-input" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+233 24 000 0000" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Designation</label>
              <input className="form-input" value={form.designation} onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))} placeholder="e.g. Principal Environmental Officer" />
            </div>
            <div className="form-group">
              <label className="form-label">Qualification</label>
              <input className="form-input" value={form.qualification} onChange={(e) => setForm((f) => ({ ...f, qualification: e.target.value }))} placeholder="e.g. BSc Environmental Science" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Date of Birth</label>
              <input className="form-input" type="date" value={form.date_of_birth} onChange={(e) => setForm((f) => ({ ...f, date_of_birth: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Address</label>
              <input className="form-input" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="Residential address" />
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn--ghost" onClick={() => { setEditMode(false); resetForm() }}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={savingProfile}>
              {savingProfile ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      )}

      {/* Change password */}
      <div className="card" style={{ padding: '16px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14, color: '#374151' }}>
            <Lock size={15} color="#6b7280" /> Change Password
          </div>
          <button className="btn btn--ghost btn--sm" onClick={() => { setPwOpen((o) => !o); setPwMsg(null) }}>
            {pwOpen ? 'Cancel' : 'Change'}
          </button>
        </div>

        {pwOpen && (
          <form style={{ marginTop: 16 }} onSubmit={handleChangePassword}>
            {pwMsg && (
              <div className={pwMsg.type === 'ok' ? 'assign-success-banner' : 'login-error'} style={{ marginBottom: 10 }}>
                {pwMsg.text}
              </div>
            )}
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label">Current Password</label>
              <input className="form-input" type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} autoComplete="current-password" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input className="form-input" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" placeholder="Min. 6 characters" />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <input className="form-input" type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password" />
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn--primary" disabled={savingPw}>
                {savingPw ? 'Updating…' : 'Update Password'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Activity stats */}
      <div className="home-section-title" style={{ marginTop: 24 }}>
        My Activity {stats ? `· ${stats.quarterLabel}` : ''}
      </div>

      <div className="dash-date-filter" style={{ marginBottom: 12 }}>
        <span className="dash-date-filter__label">Period:</span>
        <input
          type="date" className="filter-select" style={{ width: 140 }}
          value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
          title="From date"
        />
        <span style={{ color: '#9ca3af', fontSize: 13 }}>to</span>
        <input
          type="date" className="filter-select" style={{ width: 140 }}
          value={dateTo} onChange={(e) => setDateTo(e.target.value)}
          title="To date"
        />
        <button className="btn btn--primary btn--sm" onClick={applyDateFilter} disabled={!dateFrom && !dateTo}>
          Apply
        </button>
        {(activeFrom || activeTo) && (
          <button className="btn btn--ghost btn--sm" onClick={clearDateFilter}>Clear</button>
        )}
      </div>

      {statsLoading ? (
        <div className="empty-state" style={{ padding: '16px 0', fontSize: 13 }}>Loading stats…</div>
      ) : stats ? (
        <div className="kpi-grid">
          <StatCard icon={<Building2 size={18} color="#1d4ed8" />} bg="#eff6ff" value={stats.assignedFacilities} label="Assigned Facilities" note="current"
            onClick={() => navigate('/facilities', { state: { officerUid: user.uid } })} />
          <StatCard icon={<ClipboardList size={18} color="#0369a1" />} bg="#f0f9ff" value={stats.screenings} label="Screenings"
            onClick={() => navigate('/screening', { state: { officerUid: user.uid } })} />
          <StatCard icon={<Activity size={18} color="#166534" />} bg="#dcfce7" value={stats.monitoring} label="Monitoring Visits"
            onClick={() => navigate('/monitoring', { state: { officerUid: user.uid } })} />
          <StatCard icon={<ShieldAlert size={18} color="#c2410c" />} bg="#fff7ed" value={stats.enforcement} label="Enforcement Actions"
            onClick={() => navigate('/enforcement', { state: { officerUid: user.uid } })} />
          <StatCard icon={<CheckSquare size={18} color="#0891b2" />} bg="#f0fdfa" value={stats.siteVerifications} label="Site Verifications"
            onClick={() => navigate('/site-verifications', { state: { officerUid: user.uid } })} />
          {(ADMIN_ROLES.has(role) || role === 'finance') && (
            <StatCard icon={<FileText size={18} color="#7c3aed" />} bg="#f5f3ff" value={stats.permits} label="Permits Issued"
              onClick={() => navigate('/permits', { state: { officerUid: user.uid } })} />
          )}
          <StatCard icon={<MessageSquare size={18} color="#0891b2" />} bg="#f0fdfa" value={stats.complaints} label="Complaints Logged"
            onClick={() => navigate('/complaints', { state: { officerUid: user.uid } })} />
          <StatCard icon={<GraduationCap size={18} color="#166534" />} bg="#dcfce7" value={stats.envEducation} label="Edu. Sessions"
            onClick={() => navigate('/env-education', { state: { officerUid: user.uid } })} />
        </div>
      ) : (
        <div className="empty-state">Could not load activity stats.</div>
      )}
    </div>
  )
}

function StatCard({ icon, bg, value, label, note, onClick }) {
  return (
    <div className={`kpi-card${onClick ? ' kpi-card--clickable' : ''}`} onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <div className="kpi-card__icon" style={{ background: bg }}>{icon}</div>
      <div className="kpi-card__body">
        <div className="kpi-card__value">{value}</div>
        <div className="kpi-card__label">
          {label}
          {note && <span style={{ color: '#9ca3af', fontWeight: 400 }}> · {note}</span>}
        </div>
      </div>
    </div>
  )
}

function InfoItem({ icon, label, value }) {
  const Icon = icon
  return (
    <div className="profile-info-item">
      <Icon size={12} style={{ flexShrink: 0, color: '#9ca3af' }} />
      <span style={{ color: '#9ca3af' }}>{label}:</span>
      <span style={{ color: '#374151' }}>{value}</span>
    </div>
  )
}
