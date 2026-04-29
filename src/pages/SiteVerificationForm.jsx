import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, AlertCircle, Save, Loader, WifiOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSync } from '../context/SyncContext'
import { useGPS } from '../hooks/useGPS'
import { getSubRecord, createSubRecord, updateSubRecord, listSubRecords } from '../firebase/subrecords'
import { tsToInput, inputToTs, fmtDate } from '../utils/records'
import { SITE_VERIFICATION_CHECKLISTS, SV_CHECKLIST_OPTIONS } from '../data/siteVerificationChecklists'
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

export default function SiteVerificationForm() {
  const { fileNumber, recordId } = useParams()
  const isEditing = Boolean(recordId)
  const navigate = useNavigate()
  const { user, staff } = useAuth()
  const { isOnline } = useSync()

  const sectorPrefix = fileNumber.replace(/\d+$/, '')
  const [subType, setSubType] = useState(sectorPrefix === 'CE' ? 'CE' : sectorPrefix)
  const checklistKey = sectorPrefix === 'CE' ? subType : sectorPrefix
  const checklist = SITE_VERIFICATION_CHECKLISTS[checklistKey] ?? SITE_VERIFICATION_CHECKLISTS.CI

  const [formData, setFormData] = useState({
    date: '',
    linked_permit_id: '',
    notes: '',
    ...buildDefaults(checklist),
  })
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
          const loadedSubType = sectorPrefix === 'CE'
            ? (rec.facility_sub_type ?? 'CE')
            : (rec.facility_sub_type ?? sectorPrefix)
          if (sectorPrefix === 'CE') setSubType(loadedSubType)
          const loadedChecklist = SITE_VERIFICATION_CHECKLISTS[loadedSubType] ?? SITE_VERIFICATION_CHECKLISTS.CI
          const defaults = buildDefaults(loadedChecklist)
          const merged = { ...defaults }
          for (const key of Object.keys(defaults)) {
            if (rec[key] !== undefined) merged[key] = rec[key]
          }
          setFormData({
            date:             tsToInput(rec.date),
            linked_permit_id: rec.linked_permit_id ?? '',
            notes:            rec.notes ?? '',
            ...merged,
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
  }, [fileNumber, recordId, isEditing, setCoordinates]) // eslint-disable-line react-hooks/exhaustive-deps

  function set(key, value) {
    setFormData((p) => ({ ...p, [key]: value }))
  }

  function handleSubTypeChange(newSubType) {
    const newChecklist = SITE_VERIFICATION_CHECKLISTS[newSubType] ?? SITE_VERIFICATION_CHECKLISTS.CI
    setSubType(newSubType)
    setFormData((prev) => ({
      date:             prev.date,
      linked_permit_id: prev.linked_permit_id,
      notes:            prev.notes,
      ...buildDefaults(newChecklist),
    }))
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
      date:             inputToTs(formData.date),
      officer_id:       user.uid,
      officer_name:     staff?.name ?? '',
      linked_permit_id: formData.linked_permit_id,
      coordinates:      coordinates ?? null,
      photos,
      notes:            formData.notes.trim(),
      sector_prefix:    sectorPrefix,
      facility_sub_type: checklistKey,
    }

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

        {/* ── Verification Details ── */}
        <div className="form-card">
          <div className="form-section">
            <div className="form-section-title">Verification Details</div>

            <div className="form-row">
              <div className="form-group">
                <label>Date <span style={{ color: '#ef4444' }}>*</span></label>
                <input className="input" type="date" value={formData.date}
                  onChange={(e) => set('date', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Officer</label>
                <input className="input" value={staff?.name ?? '—'} readOnly
                  style={{ background: '#f9fafb', color: '#6b7280', cursor: 'not-allowed' }} />
              </div>
            </div>

            <div className="form-group">
              <label>Linked Permit</label>
              <select className="select" value={formData.linked_permit_id}
                onChange={(e) => set('linked_permit_id', e.target.value)}>
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
          </div>
        </div>

        {/* ── CE Sub-type selector ── */}
        {sectorPrefix === 'CE' && (
          <div className="form-card">
            <div className="form-section">
              <div className="form-section-title">Facility Sub-type</div>
              <div className="form-group">
                <label>Select facility type <span style={{ color: '#ef4444' }}>*</span></label>
                <select className="select" value={subType} onChange={(e) => handleSubTypeChange(e.target.value)} disabled={isEditing}>
                  <option value="CE">Car Washing Bay</option>
                  <option value="CE_FUEL_STATION">Fuel / Filling Station</option>
                </select>
                {isEditing && (
                  <p style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Sub-type cannot be changed when editing.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Extra Fields (sector-specific) ── */}
        {(checklist.extraFields?.length > 0) && (
          <div className="form-card">
            <div className="form-section">
              <div className="form-section-title">Facility Information</div>
              <div className="form-row form-row--wrap">
                {checklist.extraFields.map((field) => (
                  <div key={field.key} className="form-group">
                    <label>{field.label}</label>
                    <input className="input" type="text" value={formData[field.key] ?? ''}
                      onChange={(e) => set(field.key, e.target.value)} />
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
                          {(item.options ?? SV_CHECKLIST_OPTIONS).map((o) => (
                            <option key={o} value={o}>{o || '— Select —'}</option>
                          ))}
                        </select>
                      ) : (
                        <select className="select monitoring-checklist__select"
                          value={formData[item.key] ?? ''}
                          onChange={(e) => set(item.key, e.target.value)}>
                          {SV_CHECKLIST_OPTIONS.map((o) => (
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
              <label>General Comments &amp; Recommendations</label>
              <textarea className="input textarea" value={formData.notes}
                onChange={(e) => set('notes', e.target.value)}
                rows={3} placeholder="Findings, observations and recommendations…" />
            </div>
            <PhotoCapture
              photos={photos}
              onPhotosChange={setPhotos}
              fileNumber={fileNumber}
              category="site_verifications"
            />
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn--ghost"
            onClick={() => navigate(`/facilities/${fileNumber}`, { state: { tab: 'site_verifications' } })}
            disabled={submitting}>
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
