import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Edit2, Trash2, MapPin, Phone, Mail, User,
  Building2, Hash, FileText, Banknote, ClipboardList,
  Activity, ShieldAlert, AlertCircle, ExternalLink, Construction,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getFacility, deleteFacility } from '../firebase/facilities'
import { SECTOR_COLORS, DISTRICTS } from '../data/constants'
import Spinner from '../components/Spinner'

const SUB_RECORD_TABS = [
  { key: 'permits',      label: 'Permits',          icon: FileText },
  { key: 'finance',      label: 'Finance',           icon: Banknote },
  { key: 'screening',    label: 'Screening',         icon: ClipboardList },
  { key: 'monitoring',   label: 'Monitoring',        icon: Activity },
  { key: 'enforcement',  label: 'Enforcement',       icon: ShieldAlert },
]

function formatTimestamp(ts) {
  if (!ts) return '—'
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })
}

function districtName(code) {
  return DISTRICTS.find((d) => d.code === code)?.name ?? code ?? '—'
}

export default function FacilityDetail() {
  const { fileNumber } = useParams()
  const { role } = useAuth()
  const navigate = useNavigate()

  const [facility, setFacility] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('permits')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    getFacility(fileNumber)
      .then((data) => {
        if (!data) setError('Facility not found.')
        else setFacility(data)
      })
      .catch(() => setError('Failed to load facility.'))
      .finally(() => setLoading(false))
  }, [fileNumber])

  async function handleDelete() {
    if (
      !window.confirm(
        `Delete "${facility.name}" (${facility.file_number})?\n\nThis is permanent and cannot be undone.`
      )
    )
      return

    setDeleting(true)
    try {
      await deleteFacility(fileNumber)
      navigate('/facilities', { replace: true })
    } catch {
      setError('Failed to delete facility. Try again.')
      setDeleting(false)
    }
  }

  if (loading) return <Spinner size={40} />

  if (error) {
    return (
      <div className="page">
        <button className="btn btn--ghost btn--sm btn--back" onClick={() => navigate('/facilities')}>
          <ArrowLeft size={14} /> Back
        </button>
        <div className="login-error" style={{ marginTop: 16 }}>
          <AlertCircle size={15} /> {error}
        </div>
      </div>
    )
  }

  const colors = SECTOR_COLORS[facility.sector_prefix] ?? { bg: '#f3f4f6', text: '#374151' }

  return (
    <div className="page">
      {/* Back */}
      <button className="btn btn--ghost btn--sm btn--back" onClick={() => navigate('/facilities')}>
        <ArrowLeft size={14} /> Back to Facilities
      </button>

      {/* Header */}
      <div className="detail-header">
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
            <span className="file-num" style={{ fontSize: 15 }}>{facility.file_number}</span>
            <span
              className="facility-sector-badge"
              style={{ background: colors.bg, color: colors.text, fontWeight: 700, fontSize: 12, padding: '2px 10px', borderRadius: 999 }}
            >
              {facility.sector}
            </span>
            <span className="badge badge--gray">{districtName(facility.district)}</span>
            <span className="badge badge--gray">{facility.region}</span>
          </div>
          <div className="page-title" style={{ fontSize: 20 }}>{facility.name}</div>
          {facility.type_of_undertaking && (
            <div className="page-subtitle">{facility.type_of_undertaking}</div>
          )}
        </div>

        {role === 'admin' && (
          <div className="action-buttons">
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => navigate(`/facilities/${fileNumber}/edit`)}
            >
              <Edit2 size={14} /> Edit
            </button>
            <button
              className="btn btn--ghost btn--sm"
              style={{ color: '#dc2626', borderColor: '#fecaca' }}
              onClick={handleDelete}
              disabled={deleting}
            >
              <Trash2 size={14} /> {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        )}
      </div>

      {/* Info grid */}
      <div className="detail-grid">
        {/* Location card */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Location</span>
          </div>
          <div className="info-list">
            <InfoRow icon={MapPin} label="Location" value={facility.location} />
            <InfoRow icon={Building2} label="District" value={districtName(facility.district)} />
            <InfoRow icon={Building2} label="Region" value={facility.region} />
            {facility.coordinates ? (
              <div className="info-item">
                <MapPin size={14} />
                <span>
                  {facility.coordinates.lat.toFixed(6)}, {facility.coordinates.lng.toFixed(6)}
                  <a
                    href={`https://www.google.com/maps?q=${facility.coordinates.lat},${facility.coordinates.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ marginLeft: 8, color: '#065f46', display: 'inline-flex', alignItems: 'center', gap: 3 }}
                  >
                    Maps <ExternalLink size={10} />
                  </a>
                </span>
              </div>
            ) : (
              <InfoRow icon={MapPin} label="GPS" value="Not captured" muted />
            )}
          </div>
        </div>

        {/* Contact card */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Contact</span>
          </div>
          <div className="info-list">
            <InfoRow icon={User}  label="Contact"     value={facility.contact_person} />
            <InfoRow icon={User}  label="Designation" value={facility.designation} />
            <InfoRow icon={Phone} label="Phone"       value={facility.phone} />
            <InfoRow icon={Mail}  label="Email"       value={facility.email} />
            <InfoRow icon={Hash}  label="TIN"         value={facility.entity_tin} />
            <InfoRow icon={MapPin} label="Address"    value={facility.address} />
          </div>
        </div>
      </div>

      {/* Record info */}
      <div style={{ fontSize: 12, color: '#9ca3af', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <span>Registered: {formatTimestamp(facility.created_at)}</span>
        {facility.updated_at && facility.updated_at !== facility.created_at && (
          <span>Last updated: {formatTimestamp(facility.updated_at)}</span>
        )}
      </div>

      {/* Sub-record tabs (Phase 5) */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Records</span>
          <span className="badge badge--gray" style={{ fontSize: 11 }}>Coming Phase 5</span>
        </div>

        <div className="tabs">
          {SUB_RECORD_TABS.map((tab) => {
            const TabIcon = tab.icon
            return (
              <button
                key={tab.key}
                className={`tab${activeTab === tab.key ? ' tab--active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                <TabIcon size={13} style={{ marginRight: 5 }} />
                {tab.label}
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 0', gap: 10, color: '#9ca3af', textAlign: 'center' }}>
          <Construction size={32} color="#d1d5db" />
          <div style={{ fontSize: 14, fontWeight: 600, color: '#6b7280' }}>
            {SUB_RECORD_TABS.find((t) => t.key === activeTab)?.label} records
          </div>
          <div style={{ fontSize: 13 }}>
            This module is coming in <strong>Phase 5</strong>.
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ icon, label, value, muted }) {
  const RowIcon = icon
  return (
    <div className="info-item">
      <RowIcon size={14} />
      <span style={muted ? { color: '#9ca3af' } : {}}>
        <span style={{ color: '#9ca3af', marginRight: 4 }}>{label}:</span>
        {value || <span style={{ color: '#d1d5db' }}>—</span>}
      </span>
    </div>
  )
}
