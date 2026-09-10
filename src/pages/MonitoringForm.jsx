import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, AlertCircle, Save, Loader, WifiOff, X, Check, Plus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSync } from '../context/SyncContext'
import { getSubRecord, createSubRecord, updateSubRecord, listSubRecords } from '../firebase/subrecords'
import { linkPermitWorkflowRecord } from '../firebase/workflow'
import { getFacility } from '../firebase/facilities'
import { listStaff } from '../firebase/staff'
import { tsToInput, inputToTs } from '../utils/records'
import { decodeFileNumberParam, facilityPath } from '../utils/fileNumbers'
import { DISTRICTS } from '../data/constants'
import { MONITORING_CHECKLISTS, CHECKLIST_OPTIONS, computeCompliance, suggestedRecommendations } from '../data/monitoringChecklists'
import { useGPS } from '../hooks/useGPS'
import PhotoCapture from '../components/PhotoCapture'
import GPSField from '../components/GPSField'
import Spinner from '../components/Spinner'

function buildDefaults(checklist) {
  const defaults = {}
  if (!checklist) return defaults
  for (const section of checklist.sections) {
    for (const item of section.items) {
      defaults[item.key] = ''
      defaults[`${item.key}_remark`] = ''
    }
  }
  for (const field of checklist.extraFields ?? []) {
    defaults[field.key] = field.default ?? ''
  }
  return defaults
}

let RID = 0
const rid = () => `rec-${Date.now().toString(36)}-${RID++}`

// Normalise a stored `recommendations` value into editable list rows.
// Accepts the current array-of-objects shape, a legacy plain string, or null.
function normalizeRecs(v) {
  if (Array.isArray(v)) {
    return v.map((r) => ({
      id: rid(),
      text: typeof r === 'string' ? r : (r.text ?? ''),
      source: (typeof r === 'object' && r?.source) || 'manual',
      key: (typeof r === 'object' && r?.item_key) || null,
    }))
  }
  if (typeof v === 'string' && v.trim()) {
    return [{ id: rid(), text: v.trim(), source: 'manual', key: null }]
  }
  return []
}

// Pre-fill new-visit facility fields from the facility profile (+ latest permit)
function buildAutofill(checklist, facility, latestPermit) {
  const src = { ...(facility ?? {}), permit_number: latestPermit?.permit_number ?? '' }
  const out = {}
  for (const field of checklist?.extraFields ?? []) {
    if (!field.autofill) continue
    const v = src[field.autofill]
    if (v != null && v !== '') out[field.key] = v
  }
  return out
}

export default function MonitoringForm() {
  const params = useParams()
  const fileNumber = decodeFileNumberParam(params.fileNumber)
  const { recordId } = params
  const isEditing = Boolean(recordId)
  const navigate = useNavigate()
  const location = useLocation()
  const { user, staff } = useAuth()
  const { isOnline } = useSync()

  const [sectorPrefix, setSectorPrefix] = useState('CI')
  const checklist = MONITORING_CHECKLISTS[sectorPrefix] ?? MONITORING_CHECKLISTS.CI

  const [formData, setFormData] = useState({
    date: '',
    officer_name: '',
    notes: '',
    recommendations: [],
    dismissed_rec_keys: [],
    corrective_timeline: '',
    follow_up_date: '',
    officer_team: [],
    ...buildDefaults(checklist),
  })
  const { coordinates: gps, setCoordinates: setGps, loading: gpsLoading, error: gpsError, capture: captureGPS, clear: clearGPS } = useGPS(null)
  const [allStaff, setAllStaff] = useState([])
  const [permits, setPermits] = useState([])
  const [photos, setPhotos] = useState([])
  const [monId, setMonId] = useState('')
  const [initialLoading, setInitialLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const facility = await getFacility(fileNumber).catch(() => null)
        const prefix = facility?.sector_prefix ?? 'CI'
        const cl = MONITORING_CHECKLISTS[prefix] ?? MONITORING_CHECKLISTS.CI
        setSectorPrefix(prefix)
        listStaff().then(setAllStaff).catch(() => setAllStaff([]))
        const facilityPermits = (await listSubRecords(fileNumber, 'permits').catch(() => []))
          .filter((p) => p.permit_number)
        setPermits(facilityPermits)
        if (isEditing) {
          const rec = await getSubRecord(fileNumber, 'monitoring', recordId)
          if (!rec) { setError('Record not found.'); return }
          setMonId(rec.mon_id ?? '')
          setPhotos(rec.photos ?? [])
          if (rec.gps) setGps(rec.gps)
          const defaults = buildDefaults(cl)
          const merged = { ...defaults }
          for (const key of Object.keys(defaults)) {
            if (rec[key] !== undefined) merged[key] = rec[key]
          }
          setFormData({
            date:                tsToInput(rec.date),
            officer_name:        rec.officer_name ?? '',
            notes:               rec.notes ?? '',
            recommendations:     normalizeRecs(rec.recommendations),
            dismissed_rec_keys:  Array.isArray(rec.dismissed_rec_keys) ? rec.dismissed_rec_keys : [],
            corrective_timeline: rec.corrective_timeline ?? '',
            follow_up_date:      tsToInput(rec.follow_up_date),
            officer_team:        Array.isArray(rec.officer_team) ? rec.officer_team : [],
            ...merged,
          })
        } else {
          const existing = await listSubRecords(fileNumber, 'monitoring')
          const next = String(existing.length + 1).padStart(3, '0')
          setMonId(`MON-${fileNumber}-${next}`)
          if (facility?.coordinates) setGps(facility.coordinates)
          setFormData((p) => ({
            ...p,
            ...buildDefaults(cl),
            ...buildAutofill(cl, facility, facilityPermits[0]),
            officer_name: staff?.name ?? '',
          }))
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

  // Live Inspection Summary — Yes/No tally across all checklist sections
  const summary = useMemo(
    () => computeCompliance(checklist, formData, isVisible),
    [checklist, formData], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const teamOptions = allStaff.filter(
    (s) => s.id !== user.uid && !formData.officer_team.some((o) => o.uid === s.id),
  )

  function addTeamOfficer(uid) {
    const s = allStaff.find((x) => x.id === uid)
    if (!s) return
    setFormData((p) => ({ ...p, officer_team: [...p.officer_team, { uid: s.id, name: s.name }] }))
  }

  function removeTeamOfficer(uid) {
    setFormData((p) => ({ ...p, officer_team: p.officer_team.filter((o) => o.uid !== uid) }))
  }

  // Draft recommendations from "No" answers, minus ones already accepted/dismissed
  const pendingSuggestions = useMemo(() => {
    const accepted = new Set(formData.recommendations.map((r) => r.key).filter(Boolean))
    const dismissed = new Set(formData.dismissed_rec_keys)
    return suggestedRecommendations(checklist, formData, isVisible)
      .filter((s) => !accepted.has(s.key) && !dismissed.has(s.key))
  }, [checklist, formData]) // eslint-disable-line react-hooks/exhaustive-deps

  function acceptSuggestion(s) {
    setFormData((p) => ({
      ...p,
      recommendations: [...p.recommendations, { id: rid(), text: s.text, source: 'suggested', key: s.key }],
    }))
  }

  function acceptAllSuggestions() {
    setFormData((p) => ({
      ...p,
      recommendations: [
        ...p.recommendations,
        ...pendingSuggestions.map((s) => ({ id: rid(), text: s.text, source: 'suggested', key: s.key })),
      ],
    }))
  }

  function dismissSuggestion(s) {
    setFormData((p) => ({ ...p, dismissed_rec_keys: [...p.dismissed_rec_keys, s.key] }))
  }

  function addRecommendation() {
    setFormData((p) => ({
      ...p,
      recommendations: [...p.recommendations, { id: rid(), text: '', source: 'manual', key: null }],
    }))
  }

  function updateRecommendation(id, text) {
    setFormData((p) => ({
      ...p,
      recommendations: p.recommendations.map((r) => (r.id === id ? { ...r, text } : r)),
    }))
  }

  function removeRecommendation(id) {
    setFormData((p) => ({ ...p, recommendations: p.recommendations.filter((r) => r.id !== id) }))
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
      recommendations: formData.recommendations
        .map((r) => ({ text: r.text.trim(), source: r.source, item_key: r.key ?? null }))
        .filter((r) => r.text),
      dismissed_rec_keys:  formData.dismissed_rec_keys,
      corrective_timeline: formData.corrective_timeline.trim(),
      follow_up_date:      inputToTs(formData.follow_up_date),
      officer_team:        formData.officer_team,
      // Inspection Summary — snapshot of the computed compliance score
      compliance_applicable: summary.applicable,
      compliance_compliant:  summary.compliant,
      compliance_rate:       summary.rate,
      compliance_status:     summary.band?.label ?? '',
      photos,
      sector_prefix: sectorPrefix,
      linked_permit_id:
        location.state?.permitId ??
        permits.find((p) => p.permit_number === formData.epa_permit_number)?.id ??
        '',
    }

    if (gps) payload.gps = gps

    // Store all checklist and extra field values flat (answer + per-item remark)
    for (const section of checklist.sections) {
      for (const item of section.items) {
        if (isVisible(item)) {
          payload[item.key] = formData[item.key] ?? ''
          payload[`${item.key}_remark`] = formData[`${item.key}_remark`] ?? ''
        }
      }
    }
    for (const field of checklist.extraFields ?? []) {
      payload[field.key] = formData[field.key] ?? ''
    }

    try {
      let savedId = recordId
      if (isEditing) {
        await updateSubRecord(fileNumber, 'monitoring', recordId, payload, user.uid)
      } else {
        savedId = await createSubRecord(fileNumber, 'monitoring', payload, user.uid)
      }
      if (location.state?.fromWorkflow && location.state?.permitId) {
        await linkPermitWorkflowRecord({
          fileNumber,
          permitId: location.state.permitId,
          category: 'monitoring',
          recordId: savedId,
          uid: user.uid,
        })
      }
      navigate(facilityPath(fileNumber), { state: { tab: 'monitoring' } })
    } catch (err) {
      setError(`Failed to save: ${err.message}`)
      setSubmitting(false)
    }
  }

  if (initialLoading) return <Spinner size={40} />

  return (
    <div className="page">
      <button className="btn btn--ghost btn--sm btn--back"
        onClick={() => navigate(facilityPath(fileNumber), { state: { tab: 'monitoring' } })}>
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
            <GPSField
              coordinates={gps}
              loading={gpsLoading}
              error={gpsError}
              onCapture={captureGPS}
              onClear={clearGPS}
              onChange={setGps}
            />
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
                    ) : field.type === 'permit' ? (
                      permits.length > 0 ? (
                        <select className="select" value={formData[field.key] ?? ''}
                          onChange={(e) => set(field.key, e.target.value)}>
                          <option value="">Select permit…</option>
                          {permits.map((p) => (
                            <option key={p.id} value={p.permit_number}>{p.permit_number}</option>
                          ))}
                          {formData[field.key] && !permits.some((p) => p.permit_number === formData[field.key]) && (
                            <option value={formData[field.key]}>{formData[field.key]}</option>
                          )}
                        </select>
                      ) : (
                        <input className="input" type="text" value={formData[field.key] ?? ''}
                          onChange={(e) => set(field.key, e.target.value)}
                          placeholder="No permits on file — type the number" />
                      )
                    ) : field.type === 'select' ? (
                      <select className="select" value={formData[field.key] ?? ''}
                        onChange={(e) => set(field.key, e.target.value)}>
                        {field.options.map((o) => <option key={o} value={o}>{o || '— Select —'}</option>)}
                      </select>
                    ) : field.type === 'readonly' ? (
                      <input className="input" value={formData[field.key] || field.default || ''} readOnly
                        style={{ background: '#f9fafb', color: '#6b7280', cursor: 'not-allowed' }} />
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
                      <div className="monitoring-checklist__main">
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
                      <input className="input monitoring-checklist__remark"
                        type="text"
                        value={formData[`${item.key}_remark`] ?? ''}
                        onChange={(e) => set(`${item.key}_remark`, e.target.value)}
                        placeholder="Remarks…" />
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ))}

        {/* ── Inspection Summary ── */}
        <div className="form-card">
          <div className="form-section">
            <div className="form-section-title">Inspection Summary</div>
            <div className="monitoring-summary">
              <div className="monitoring-summary__stat">
                <span className="monitoring-summary__num">{summary.applicable}</span>
                <span className="monitoring-summary__lbl">Applicable</span>
              </div>
              <div className="monitoring-summary__stat">
                <span className="monitoring-summary__num">{summary.compliant}</span>
                <span className="monitoring-summary__lbl">Compliant</span>
              </div>
              <div className="monitoring-summary__stat">
                <span className="monitoring-summary__num">
                  {summary.rate == null ? '—' : `${summary.rate}%`}
                </span>
                <span className="monitoring-summary__lbl">Compliance rate</span>
              </div>
              <div className="monitoring-summary__stat">
                <span className="monitoring-summary__num"
                  style={{ color: summary.band?.color ?? '#6b7280' }}>
                  {summary.band?.label ?? 'Not rated'}
                </span>
                <span className="monitoring-summary__lbl">Overall status</span>
              </div>
            </div>
            <p className="monitoring-summary__note">
              Rate = compliant &divide; applicable (items marked Yes or No; N/A and blank excluded).
              Bands: Excellent &ge; 80%, Good 60&ndash;79%, Fair 40&ndash;59%, Poor &lt; 40%.
            </p>
            <div className="form-row">
              <div className="form-group">
                <label>Timeline for Corrective Action</label>
                <input className="input" type="text" value={formData.corrective_timeline}
                  onChange={(e) => set('corrective_timeline', e.target.value)}
                  placeholder="e.g. Within 30 days" />
              </div>
              <div className="form-group">
                <label>Follow-up Inspection Date</label>
                <input className="input" type="date" value={formData.follow_up_date}
                  onChange={(e) => set('follow_up_date', e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Recommendations ── */}
        <div className="form-card">
          <div className="form-section">
            <div className="form-section-title">Recommendations</div>

            {pendingSuggestions.length > 0 && (
              <div className="rec-suggestions">
                <div className="rec-suggestions__hd">
                  <span>Suggested from non-compliant items ({pendingSuggestions.length})</span>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={acceptAllSuggestions}>
                    Accept all
                  </button>
                </div>
                {pendingSuggestions.map((s) => (
                  <div key={s.key} className="rec-suggestion">
                    <span className="rec-suggestion__text">{s.text}</span>
                    <div className="rec-suggestion__actions">
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => acceptSuggestion(s)}>
                        <Check size={13} /> Accept
                      </button>
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => dismissSuggestion(s)}>
                        <X size={13} /> Dismiss
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {formData.recommendations.length > 0 ? (
              <ol className="rec-list">
                {formData.recommendations.map((r) => (
                  <li key={r.id} className="rec-list__item">
                    <input className="input" type="text" value={r.text}
                      onChange={(e) => updateRecommendation(r.id, e.target.value)}
                      placeholder="Recommendation…" />
                    {r.source === 'suggested' && <span className="rec-list__tag">auto</span>}
                    <button type="button" className="rec-list__remove"
                      onClick={() => removeRecommendation(r.id)} aria-label="Remove recommendation">
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="rec-list__empty">No recommendations yet — accept a suggestion above or add one.</p>
            )}

            <button type="button" className="btn btn--ghost btn--sm" onClick={addRecommendation}>
              <Plus size={14} /> Add recommendation
            </button>
          </div>
        </div>

        {/* ── Inspecting Officers ── */}
        <div className="form-card">
          <div className="form-section">
            <div className="form-section-title">Inspecting Officers</div>
            <div className="form-group">
              <label>Lead Officer</label>
              <input className="input" value={staff?.name ?? '—'} readOnly
                style={{ background: '#f9fafb', color: '#6b7280', cursor: 'not-allowed' }} />
            </div>
            {formData.officer_team.length > 0 && (
              <div className="officer-chips">
                {formData.officer_team.map((o) => (
                  <span key={o.uid} className="officer-chip">
                    {o.name}
                    <button type="button" onClick={() => removeTeamOfficer(o.uid)}
                      aria-label={`Remove ${o.name}`}>
                      <X size={13} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="form-group">
              <label>Add Officer</label>
              <select className="select" value=""
                onChange={(e) => { if (e.target.value) addTeamOfficer(e.target.value) }}>
                <option value="">Select officer…</option>
                {teamOptions.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ── Notes & Photos ── */}
        <div className="form-card">
          <div className="form-section">
            <div className="form-section-title">Notes &amp; Photos</div>
            <div className="form-group">
              <label>Overall Observations</label>
              <textarea className="input textarea" value={formData.notes}
                onChange={(e) => set('notes', e.target.value)}
                rows={3} placeholder="Overall observations and findings…" />
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
            onClick={() => navigate(facilityPath(fileNumber), { state: { tab: 'monitoring' } })}
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
