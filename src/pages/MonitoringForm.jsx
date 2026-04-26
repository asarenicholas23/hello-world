import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, AlertCircle, Save, Loader, WifiOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSync } from '../context/SyncContext'
import { getSubRecord, createSubRecord, updateSubRecord, listSubRecords } from '../firebase/subrecords'
import { tsToInput, inputToTs } from '../utils/records'
import { DISTRICTS } from '../data/constants'
import { MONITORING_CHECKLISTS, CHECKLIST_OPTIONS } from '../data/monitoringChecklists'
import PhotoCapture from '../components/PhotoCapture'
import GPSField from '../components/GPSField'
import Spinner from '../components/Spinner'

function buildDefaults(checklist) {
  const defaults = {}
  if (!checklist) return defaults
  for (const section of checklist.sections) {
    for (const item of section.items) {
      defaults[item.key] = ''
    }
  }
  for (const field of checklist.extraFields ?? []) {
    defaults[field.key] = ''
  }
  return defaults
}

export default function MonitoringForm() {
  const { fileNumber, recordId } = useParams()
  const isEditing = Boolean(recordId)
  const navigate = useNavigate()
  const { user, staff } = useAuth()
  const { isOnline } = useSync()

  const sectorPrefix = fileNumber.replace(/\d+$/, '')
  const checklist = MONITORING_CHECKLISTS[sectorPrefix] ?? MONITORING_CHECKLISTS.CI

  const [formData, setFormData] = useState({
    date: '',
    officer_name: '',
    notes: '',
    gps: null,
    ...buildDefaults(checklist),
  })
  const [photos, setPhotos] = useState([])
  const [monId, setMonId] = useState('')
  const [initialLoading, setInitialLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        if (isEditing) {
          const rec = await getSubRecord(fileNumber, 'monitoring', recordId)
          if (!rec) { setError('Record not found.'); return }
          setMonId(rec.mon_id ?? '')
          setPhotos(rec.photos ?? [])
          const defaults = buildDefaults(checklist)
          const merged = { ...defaults }
          for (const key of Object.keys(defaults)) {
            if (rec[key] !== undefined) merged[key] = rec[key]
          }
          setFormData({
            date:         tsToInput(rec.date),
            officer_name: rec.officer_name ?? '',
            notes:        rec.notes ?? '',
            gps:          rec.gps ?? null,
            ...merged,
          })
        } else {
          const existing = await listSubRecords(fileNumber, 'monitoring')
          const next = String(existing.length + 1).padStart(3, '0')
          setMonId(`MON-${fileNumber}-${next}`)
          setFormData((p) => ({ ...p, officer_name: staff?.name ?? '' }))
        }
      } catch {
        setError('Failed to load data.')
      } finally {
        setInitialLoading(false)
      }
    }
    load()
  }, [fileNumber, recordId, isEditing]) // eslint-disable-line react-hooks/exhaustive-deps

  function set(key, value) {
    setFormData((p) => ({ ...p, [key]: value }))
  }

  function isVisible(item) {
    if (!item.conditional) return true
    return formData[item.conditional.key] === item.conditional.value
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!formData.date) { setError('Date is required.'); return }

    setSubmitting(true)
    setError('')

    const payload = {
      mon_id:       monId,
      date:         inputToTs(formData.date),
      officer_id:   user.uid,
      officer_name: staff?.name ?? formData.officer_name,
      notes:        formData.notes.trim(),
      photos,
      sector_prefix: sectorPrefix,
    }

    if (formData.gps) payload.gps = formData.gps

    // Store all checklist and extra field values flat
    for (const section of checklist.sections) {
      for (const item of section.items) {
        if (isVisible(item)) {
          payload[item.key] = formData[item.key] ?? ''
        }
      }
    }
    for (const field of checklist.extraFields ?? []) {
      payload[field.key] = formData[field.key] ?? ''
    }

    try {
      if (isEditing) {
        await updateSubRecord(fileNumber, 'monitoring', recordId, payload, user.uid)
      } else {
        await createSubRecord(fileNumber, 'monitoring', payload, user.uid)
      }
      navigate(`/facilities/${fileNumber}`, { state: { tab: 'monitoring' } })
    } catch (err) {
      setError(`Failed to save: ${err.message}`)
      setSubmitting(false)
    }
  }

  if (initialLoading) return <Spinner size={40} />

  return (
    <div className="page">
      <button className="btn btn--ghost btn--sm btn--back"
        onClick={() => navigate(`/facilities/${fileNumber}`, { state: { tab: 'monitoring' } })}>
        <ArrowLeft size={14} /> Back to Facility
      </button>

      <div className="page-header" style={{ marginTop: 12 }}>
        <div className="page-title">{isEditing ? 'Edit Monitoring Visit' : 'New Monitoring Visit'}</div>
        <div className="page-subtitle">
          File Number: <span className="file-num">{fileNumber}</span>
          {monId && <span style={{ marginLeft: 10, color: '#6b7280', fontSize: 13 }}>{monId}</span>}
        </div>
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

        {/* ── Visit Details ── */}
        <div className="form-card">
          <div className="form-section">
            <div className="form-section-title">Visit Details</div>
            <div className="form-row">
              <div className="form-group">
                <label>Date <span style={{ color: '#ef4444' }}>*</span></label>
                <input className="input" type="date" value={formData.date}
                  onChange={(e) => set('date', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Officer</label>
                <input className="input" value={staff?.name ?? formData.officer_name ?? '—'} readOnly
                  style={{ background: '#f9fafb', color: '#6b7280', cursor: 'not-allowed' }} />
              </div>
            </div>
            <GPSField value={formData.gps} onChange={(v) => set('gps', v)} />
          </div>
        </div>

        {/* ── Extra Fields (sector-specific) ── */}
        {(checklist.extraFields?.length > 0) && (
          <div className="form-card">
            <div className="form-section">
              <div className="form-section-title">Facility Information</div>
              <div className="form-row form-row--wrap">
                {checklist.extraFields.map((field) => (
                  <div key={field.key} className="form-group">
                    <label>{field.label}</label>
                    {field.type === 'district' ? (
                      <select className="select" value={formData[field.key] ?? ''}
                        onChange={(e) => set(field.key, e.target.value)}>
                        <option value="">Select district…</option>
                        {DISTRICTS.map((d) => (
                          <option key={d.code} value={d.code}>{d.name}</option>
                        ))}
                      </select>
                    ) : (
                      <input className="input" type="text" value={formData[field.key] ?? ''}
                        onChange={(e) => set(field.key, e.target.value)} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Checklist Sections ── */}
        {checklist.sections.map((section) => (
          <div key={section.title} className="form-card">
            <div className="form-section">
              <div className="form-section-title">{section.title}</div>
              <div className="monitoring-checklist">
                {section.items.map((item) => {
                  if (!isVisible(item)) return null
                  return (
                    <div key={item.key} className="monitoring-checklist__row">
                      <span className="monitoring-checklist__label">{item.label}</span>
                      {item.type === 'text' ? (
                        <input className="input monitoring-checklist__input"
                          type="text"
                          value={formData[item.key] ?? ''}
                          onChange={(e) => set(item.key, e.target.value)}
                          placeholder="Enter…" />
                      ) : item.type === 'select' ? (
                        <select className="select monitoring-checklist__select"
                          value={formData[item.key] ?? ''}
                          onChange={(e) => set(item.key, e.target.value)}>
                          {(item.options ?? CHECKLIST_OPTIONS).map((o) => (
                            <option key={o} value={o}>{o || '— Select —'}</option>
                          ))}
                        </select>
                      ) : (
                        <select className="select monitoring-checklist__select"
                          value={formData[item.key] ?? ''}
                          onChange={(e) => set(item.key, e.target.value)}>
                          {CHECKLIST_OPTIONS.map((o) => (
                            <option key={o} value={o}>{o || '— Select —'}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ))}

        {/* ── Notes & Photos ── */}
        <div className="form-card">
          <div className="form-section">
            <div className="form-section-title">Notes &amp; Photos</div>
            <div className="form-group">
              <label>Overall Observations &amp; Recommendations</label>
              <textarea className="input textarea" value={formData.notes}
                onChange={(e) => set('notes', e.target.value)}
                rows={3} placeholder="Overall observations, findings and recommendations…" />
            </div>
            <PhotoCapture
              photos={photos}
              onPhotosChange={setPhotos}
              fileNumber={fileNumber}
              category="monitoring"
            />
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn--ghost"
            onClick={() => navigate(`/facilities/${fileNumber}`, { state: { tab: 'monitoring' } })}
            disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting
              ? <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</>
              : <><Save size={15} /> {isEditing ? 'Save Changes' : 'Add Visit'}</>
            }
          </button>
        </div>
      </form>
    </div>
  )
}
