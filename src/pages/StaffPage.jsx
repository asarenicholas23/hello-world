import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, UserPlus, Pencil, Trash2, Shield, Banknote, Briefcase, Star, Eye } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { listStaff, deleteStaff } from '../firebase/staff'

const ROLE_META = {
  director:          { label: 'Director',          icon: Eye,      bg: '#faf5ff', color: '#7c3aed' },
  admin:             { label: 'Admin',             icon: Shield,   bg: '#eff6ff', color: '#1d4ed8' },
  senior_officer:    { label: 'Senior Officer',    icon: Star,     bg: '#f0f9ff', color: '#0369a1' },
  officer:           { label: 'Officer',           icon: Briefcase,bg: '#fff7ed', color: '#c2410c' },
  assistant_officer: { label: 'Asst. Officer',     icon: Briefcase,bg: '#fffbeb', color: '#b45309' },
  junior_officer:    { label: 'Junior Officer',    icon: Briefcase,bg: '#f9fafb', color: '#6b7280' },
  finance:           { label: 'Finance',           icon: Banknote, bg: '#ecfdf5', color: '#065f46' },
}

export default function StaffPage() {
  const { staff: currentStaff } = useAuth()
  const navigate = useNavigate()

  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    listStaff()
      .then((data) => {
        data.sort((a, b) => (a.staff_id ?? '').localeCompare(b.staff_id ?? ''))
        setMembers(data)
      })
      .catch(() => setError('Failed to load staff. Check your connection.'))
      .finally(() => setLoading(false))
  }, [])

  async function handleDelete(member) {
    if (member.id === currentStaff?.uid) {
      alert('You cannot delete your own account.')
      return
    }
    if (!window.confirm(`Remove ${member.name} (${member.staff_id})? This cannot be undone.`)) return
    try {
      await deleteStaff(member.id)
      setMembers((prev) => prev.filter((m) => m.id !== member.id))
    } catch {
      alert('Failed to delete staff member.')
    }
  }

  return (
    <div className="page">
      <button className="btn btn--ghost btn--sm btn--back" onClick={() => navigate('/')}>
        <ArrowLeft size={14} /> Back to Dashboard
      </button>

      <div className="page-header" style={{ marginTop: 12 }}>
        <div>
          <div className="page-title">Staff</div>
          <div className="page-subtitle">Manage EPA Ashanti Regional Office staff accounts.</div>
        </div>
        <button className="btn btn--primary" onClick={() => navigate('/staff/new')}>
          <UserPlus size={14} /> Add Staff
        </button>
      </div>

      {error && <div className="login-error">{error}</div>}

      {loading ? (
        <div className="empty-state">Loading staff…</div>
      ) : members.length === 0 ? (
        <div className="empty-state">No staff found.</div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="staff-table">
            <thead>
              <tr>
                <th>Staff ID</th>
                <th>Name</th>
                <th>Role</th>
                <th>Email</th>
                <th>Phone</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const meta = ROLE_META[m.role] ?? ROLE_META.officer
                const RoleIcon = meta.icon
                const isSelf = m.id === currentStaff?.uid
                const avatarBg = m.picture_url ? 'transparent' : meta.color
                return (
                  <tr key={m.id} className={isSelf ? 'staff-table__self' : ''}>
                    <td className="staff-table__id">{m.staff_id}</td>
                    <td className="staff-table__name">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div
                          className="staff-table__avatar"
                          style={{ background: avatarBg }}
                        >
                          {m.picture_url
                            ? <img src={m.picture_url} alt={m.name} className="profile-avatar__img" />
                            : m.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
                          }
                        </div>
                        <div>
                          <div>{m.name}{isSelf && <span className="staff-self-badge">you</span>}</div>
                          {m.designation && <div style={{ fontSize: 11, color: '#9ca3af' }}>{m.designation}</div>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="staff-role-badge" style={{ background: meta.bg, color: meta.color }}>
                        <RoleIcon size={11} />
                        {meta.label}
                      </span>
                    </td>
                    <td className="staff-table__email">{m.email}</td>
                    <td>{m.phone || <span style={{ color: '#9ca3af' }}>—</span>}</td>
                    <td className="staff-table__actions">
                      <button
                        className="btn btn--ghost btn--sm"
                        onClick={() => navigate(`/staff/${m.id}/edit`)}
                        title="Edit"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        className="btn btn--ghost btn--sm"
                        onClick={() => handleDelete(m)}
                        title="Delete"
                        style={{ color: '#dc2626' }}
                        disabled={isSelf}
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
