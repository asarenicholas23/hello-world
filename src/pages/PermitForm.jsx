import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, AlertCircle, Save, Loader, WifiOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSync } from '../context/SyncContext'
import { getSubRecord, createSubRecord, updateSubRecord } from '../firebase/subrecords'
import { uploadFile } from '../firebase/storage'
import { tsToInput, inputToTs } from '../utils/records'
import FileAttachmentField from '../components/FileAttachmentField'
import Spinner from '../components/Spinner'

const EMPTY = {
  permit_number: '',
  issue_date: '',
  effective_date: '',
  expiry_date: '',
  issue_location: '',
  notes: '',
}

const EMPTY_URLS = { permit_image_url: '', schedule_url: '' }
const EMPTY_FILES = { permit_image: null, schedule: null }

export default function PermitForm() {
  const { fileNumber, recordId } = useParams()
  const isEditing = Boolean(recordId)
  const navigate = useNavigate()
  const { user } = useAuth()
  const { isOnline } = useSync()

  const [formData, setFormData]       = useState(EMPTY)
  const [urls, setUrls]               = useState(EMPTY_URLS)
  const [files, setFiles]             = useState(EMPTY_FILES)
  const [initialLoading, setInitialLoading] = useState(isEditing)
  const [submitting, setSubmitting]   = useState(false)
  const [uploadingSlot, setUploadingSlot] = useState(null)
  const [error, setError]             = useState('')

  useEffect(() => {
    if (!isEditing) return
    getSubRecord(fileNumber, 'permits', recordId)
      .then((rec) => {
        if (!rec) { setError('Record not found.'); return }
        setFormData({
          permit_number:  rec.permit_number  ?? '',
          issue_date:     tsToInput(rec.issue_date),
          effective_date: tsToInput(rec.effective_date),
          expiry_date:    tsToInput(rec.expiry_date),
          issue_location: rec.issue_location ?? '',
          notes:          rec.notes          ?? '',
        })
        setUrls({
          permit_image_url: rec.permit_image_url ?? '',
          schedule_url:     rec.schedule_url     ?? '',
        })
      })
      .catch(() => setError('Failed to load record.'))
      .finally(() => setInitialLoading(false))
  }, [fileNumber, recordId, isEditing])

  function handleChange(e) {
    const { name, value } = e.target
    setFormData((p) => ({ ...p, [name]: value }))
  }

  function validate() {
    if (!formData.permit_number.trim()) return 'Permit Number is required.'
    if (!formData.issue_date)           return 'Issue Date is required.'
    if (!formData.effective_date)       return 'Effective Date is required.'
    if (!formData.expiry_date)          return 'Expiry Date is required.'
    return null
  }

  async function uploadAttachments(id) {
    const slots = [
      { key: 'permit_image', urlKey: 'permit_image_url' },
      { key: 'schedule',     urlKey: 'schedule_url'     },
    ]
    const updates = {}
    for (const { key, urlKey } of slots) {
      const file = files[key]
      if (file) {
        setUploadingSlot(key)
        const ext  = file.name.split('.').pop()
        const path = `facilities/${fileNumber}/permits/${id}/${key}.${ext}`
        updates[urlKey] = await uploadFile(file, path)
      } else if (urls[urlKey] === '') {
        updates[urlKey] = ''
      }
    }
    setUploadingSlot(null)
    if (Object.keys(updates).length > 0) {
      await updateSubRecord(fileNumber, 'permits', id, updates, user.uid)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const err = validate()
    if (err) { setError(err); window.scrollTo({ top: 0, behavior: 'smooth' }); return }

    setSubmitting(true)
    setError('')

    const payload = {
      permit_number:  formData.permit_number.trim(),
      issue_date:     inputToTs(formData.issue_date),
      effective_date: inputToTs(formData.effective_date),
      expiry_date:    inputToTs(formData.expiry_date),
      issue_location: formData.issue_location.trim(),
      notes:          formData.notes.trim(),
    }

    try {
      if (isEditing) {
        await updateSubRecord(fileNumber, 'permits', recordId, payload, user.uid)
        await uploadAttachments(recordId)
      } else {
        const newId = await createSubRecord(fileNumber, 'permits', payload, user.uid)
        await uploadAttachments(newId)
      }
      navigate(`/facilities/${fileNumber}`, { state: { tab: 'permits' } })
    } catch (err) {
      setError(`Failed to save: ${err.message}`)
      setSubmitting(false)
      setUploadingSlot(null)
    }
  }

  if (initialLoading) return <Spinner size={40} />

  return (
    <div className="page">
      <button className="btn btn--ghost btn--sm btn--back" onClick={() => navigate(`/facilities/${fileNumber}`, { state: { tab: 'permits' } })}>
        <ArrowLeft size={14} /> Back to Facility
      </button>

      <div className="page-header" style={{ marginTop: 12 }}>
        <div className="page-title">{isEditing ? 'Edit Permit' : 'New Permit'}</div>
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
            <AlertCircle size={15} style={{ flexShrink: 0 }} />
            {error}
          </div>
        )}

        <div className="form-card">
          <div className="form-section">
            <div className="form-section-title">Permit Details</div>

            <div className="form-group">
              <label>Permit Number <span style={{ color: '#ef4444' }}>*</span></label>
              <input
                className="input"
                name="permit_number"
                value={formData.permit_number}
                onChange={handleChange}
                placeholder="e.g. EPA/ASH/KON/EA1/CI266/25/00266"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Issue Date <span style={{ color: '#ef4444' }}>*</span></label>
                <input className="input" type="date" name="issue_date" value={formData.issue_date} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Effective Date <span style={{ color: '#ef4444' }}>*</span></label>
                <input className="input" type="date" name="effective_date" value={formData.effective_date} onChange={handleChange} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Expiry Date <span style={{ color: '#ef4444' }}>*</span></label>
                <input className="input" type="date" name="expiry_date" value={formData.expiry_date} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Issue Location</label>
                <input
                  className="input"
                  name="issue_location"
                  value={formData.issue_location}
                  onChange={handleChange}
                  placeholder="e.g. Kumasi"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Notes</label>
              <textarea
                className="input textarea"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                placeholder="Any additional notes…"
              />
            </div>
          </div>

          <div className="form-section" style={{ borderTop: '1px solid #f3f4f6', marginTop: 8, paddingTop: 20 }}>
            <div className="form-section-title">Attachments</div>
            <div className="attachment-grid">
              <FileAttachmentField
                label="Permit Image"
                existingUrl={urls.permit_image_url}
                selectedFile={files.permit_image}
                uploading={uploadingSlot === 'permit_image'}
                onSelect={(f) => setFiles((p) => ({ ...p, permit_image: f }))}
                onRemove={() => { setFiles((p) => ({ ...p, permit_image: null })); setUrls((p) => ({ ...p, permit_image_url: '' })) }}
              />
              <FileAttachmentField
                label="Schedule"
                existingUrl={urls.schedule_url}
                selectedFile={files.schedule}
                uploading={uploadingSlot === 'schedule'}
                onSelect={(f) => setFiles((p) => ({ ...p, schedule: f }))}
                onRemove={() => { setFiles((p) => ({ ...p, schedule: null })); setUrls((p) => ({ ...p, schedule_url: '' })) }}
              />
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn--ghost" onClick={() => navigate(`/facilities/${fileNumber}`, { state: { tab: 'permits' } })} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting
              ? <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> {uploadingSlot ? 'Uploading…' : 'Saving…'}</>
              : <><Save size={15} /> {isEditing ? 'Save Changes' : 'Add Permit'}</>
            }
          </button>
        </div>
      </form>
    </div>
  )
}
