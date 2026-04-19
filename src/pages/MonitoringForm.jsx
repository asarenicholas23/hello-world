import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, AlertCircle, Save, Loader } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getSubRecord, createSubRecord, updateSubRecord } from '../firebase/subrecords'
import { tsToInput, inputToTs } from '../utils/records'
import { MONITORING_CHECKLIST, COMPLIANCE_STATUS } from '../data/constants'
import PhotoCapture from '../components/PhotoCapture'
import Spinner from '../components/Spinner'

const EMPTY_FORM = { date: '', compliance_status: '', notes: '' }

function buildEmptyChecklist(items) {
  return Object.fromEntries(items.map((item) => [item.key, { ok: false, note: '' }]))
}

export default function MonitoringForm() {
  const { fileNumber, recordId } = useParams()
  const isEditing = Boolean(recordId)
  const navigate = useNavigate()
  const { user, staff } = useAuth()

  const [formData, setFormData] = useState(EMPTY_FORM)
  const [checklist, setChecklist] = useState({})
  const [photos, setPhotos] = useState([])
  const [sectorPrefix, setSectorPrefix] = useState('')
  const [initialLoading, setInitialLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        // Derive sector prefix from fileNumber (leading letters)
        const prefix = fileNumber.replace(/\d+$/, '')
        setSectorPrefix(prefix)
        const items = MONITORING_CHECKLIST[prefix] ?? []

        if (isEditing) {
          const rec = await getSubRecord(fileNumber, 'monitoring', recordId)
          if (!rec) { setError('Record not found.'); return }
          setFormData({
            date:              tsToInput(rec.date),
            compliance_status: rec.compliance_status ?? '',
            notes:             rec.notes ?? '',
          })
          setPhotos(rec.photos ?? [])
          // Merge saved checklist over empty defaults so new items get defaults
          setChecklist({ ...buildEmptyChecklist(items), ...(rec.checklist ?? {}) })
        } else {
          setChecklist(buildEmptyChecklist(items))
        }
      } catch {
        setError('Failed to load data.')
      } finally {
        setInitialLoading(false)
      }
    }
    load()
  }, [fileNumber, recordId, isEditing])

  function toggleCheck(key) {
    setChecklist((p) => ({ ...p, [key]: { ...p[key], ok: !p[key].ok } }))
  }

  function setCheckNote(key, note) {
    setChecklist((p) => ({ ...p, [key]: { ...p[key], note } }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!formData.date) { setError('Date is required.'); return }
    if (!formData.compliance_status) { setError('Compliance Status is required.'); return }

    setSubmitting(true)
    setError('')

    const payload = {
      date:              inputToTs(formData.date),
      officer_id:        user.uid,
      officer_name:      staff?.name ?? '',
      compliance_status: formData.compliance_status,
      checklist,
      photos,
      notes:             formData.notes.trim(),
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

  const checklistItems = MONITORING_CHECKLIST[sectorPrefix] ?? []

  return (
    <div className="page">
      <button className="btn btn--ghost btn--sm btn--back" onClick={() => navigate(`/facilities/${fileNumber}`, { state: { tab: 'monitoring' } })}>
        <ArrowLeft size={14} /> Back to Facility
      </button>

      <div className="page-header" style={{ marginTop: 12 }}>
        <div className="page-title">{isEditing ? 'Edit Monitoring Visit' : 'New Monitoring Visit'}</div>
        <div className="page-subtitle">File Number: <span className="file-num">{fileNumber}</span></div>
      </div>

      <form onSubmit={handleSubmit}>
        {error && (
          <div className="login-error" style={{ marginBottom: 16 }}>
            <AlertCircle size={15} style={{ flexShrink: 0 }} /> {error}
          </div>
        )}

        <div className="form-card">
          <div className="form-section">
            <div className="form-section-title">Visit Details</div>

            <div className="form-row">
              <div className="form-group">
                <label>Date <span style={{ color: '#ef4444' }}>*</span></label>
                <input className="input" type="date" name="date" value={formData.date}
                  onChange={(e) => setFormData((p) => ({ ...p, date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Officer</label>
                <input className="input" value={staff?.name ?? '—'} readOnly
                  style={{ background: '#f9fafb', color: '#6b7280', cursor: 'not-allowed' }} />
              </div>
            </div>

            <div className="form-group">
              <label>Compliance Status <span style={{ color: '#ef4444' }}>*</span></label>
              <select className="select" name="compliance_status" value={formData.compliance_status}
                onChange={(e) => setFormData((p) => ({ ...p, compliance_status: e.target.value }))}>
                <option value="">Select status…</option>
                {COMPLIANCE_STATUS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {checklistItems.length > 0 && (
          <div className="form-card">
            <div className="form-section">
              <div className="form-section-title">Environmental Checklist</div>
              <div className="checklist">
                {checklistItems.map((item) => (
                  <div key={item.key} className="checklist-item">
                    <label className="checklist-item__label">
                      <input
                        type="checkbox"
                        checked={checklist[item.key]?.ok ?? false}
                        onChange={() => toggleCheck(item.key)}
                        className="checklist-item__checkbox"
                      />
                      <span>{item.label}</span>
                    </label>
                    <input
                      className="input checklist-item__note"
                      placeholder="Note (optional)"
                      value={checklist[item.key]?.note ?? ''}
                      onChange={(e) => setCheckNote(item.key, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="form-card">
          <div className="form-section">
            <div className="form-section-title">Additional Notes &amp; Photos</div>
            <div className="form-group">
              <label>Notes</label>
              <textarea className="input textarea" name="notes" value={formData.notes}
                onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
                rows={3} placeholder="Overall observations and recommendations…" />
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
          <button type="button" className="btn btn--ghost" onClick={() => navigate(`/facilities/${fileNumber}`, { state: { tab: 'monitoring' } })} disabled={submitting}>
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
