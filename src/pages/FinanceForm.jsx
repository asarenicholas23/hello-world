import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, AlertCircle, Save, Loader } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getSubRecord, createSubRecord, updateSubRecord } from '../firebase/subrecords'
import { uploadFile } from '../firebase/storage'
import { tsToInput, inputToTs } from '../utils/records'
import { PAYMENT_TYPES } from '../data/constants'
import FileAttachmentField from '../components/FileAttachmentField'
import Spinner from '../components/Spinner'

const EMPTY = {
  date: '',
  payment_type: '',
  payment_status: 'paid',
  amount: '',
  currency: 'GHS',
  reference_number: '',
  notes: '',
}

const EMPTY_URLS  = { invoice_url: '', receipt_url: '' }
const EMPTY_FILES = { invoice: null, receipt: null }

export default function FinanceForm() {
  const { fileNumber, recordId } = useParams()
  const isEditing = Boolean(recordId)
  const navigate = useNavigate()
  const { user } = useAuth()

  const [formData, setFormData]           = useState(EMPTY)
  const [urls, setUrls]                   = useState(EMPTY_URLS)
  const [files, setFiles]                 = useState(EMPTY_FILES)
  const [initialLoading, setInitialLoading] = useState(isEditing)
  const [submitting, setSubmitting]       = useState(false)
  const [uploadingSlot, setUploadingSlot] = useState(null)
  const [error, setError]                 = useState('')

  useEffect(() => {
    if (!isEditing) return
    getSubRecord(fileNumber, 'finance', recordId)
      .then((rec) => {
        if (!rec) { setError('Record not found.'); return }
        setFormData({
          date:             tsToInput(rec.date),
          payment_type:     rec.payment_type     ?? '',
          payment_status:   rec.payment_status   ?? 'paid',
          amount:           rec.amount != null   ? String(rec.amount) : '',
          currency:         rec.currency         ?? 'GHS',
          reference_number: rec.reference_number ?? '',
          notes:            rec.notes            ?? '',
        })
        setUrls({
          invoice_url: rec.invoice_url ?? '',
          receipt_url: rec.receipt_url ?? '',
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
    if (!formData.date)         return 'Date is required.'
    if (!formData.payment_type) return 'Payment Type is required.'
    if (!formData.amount || isNaN(Number(formData.amount)) || Number(formData.amount) <= 0)
      return 'A valid Amount is required.'
    return null
  }

  async function uploadAttachments(id) {
    const slots = [
      { key: 'invoice', urlKey: 'invoice_url' },
      { key: 'receipt', urlKey: 'receipt_url' },
    ]
    const updates = {}
    for (const { key, urlKey } of slots) {
      const file = files[key]
      if (file) {
        setUploadingSlot(key)
        const ext  = file.name.split('.').pop()
        const path = `facilities/${fileNumber}/finance/${id}/${key}.${ext}`
        updates[urlKey] = await uploadFile(file, path)
      } else if (urls[urlKey] === '') {
        updates[urlKey] = ''
      }
    }
    setUploadingSlot(null)
    if (Object.keys(updates).length > 0) {
      await updateSubRecord(fileNumber, 'finance', id, updates, user.uid)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const err = validate()
    if (err) { setError(err); window.scrollTo({ top: 0, behavior: 'smooth' }); return }

    setSubmitting(true)
    setError('')

    const payload = {
      date:             inputToTs(formData.date),
      payment_type:     formData.payment_type,
      payment_status:   formData.payment_status,
      amount:           Number(formData.amount),
      currency:         formData.currency,
      reference_number: formData.reference_number.trim(),
      notes:            formData.notes.trim(),
    }

    try {
      if (isEditing) {
        await updateSubRecord(fileNumber, 'finance', recordId, payload, user.uid)
        await uploadAttachments(recordId)
      } else {
        const newId = await createSubRecord(fileNumber, 'finance', payload, user.uid)
        await uploadAttachments(newId)
      }
      navigate(`/facilities/${fileNumber}`, { state: { tab: 'finance' } })
    } catch (err) {
      setError(`Failed to save: ${err.message}`)
      setSubmitting(false)
      setUploadingSlot(null)
    }
  }

  if (initialLoading) return <Spinner size={40} />

  return (
    <div className="page">
      <button className="btn btn--ghost btn--sm btn--back" onClick={() => navigate(`/facilities/${fileNumber}`, { state: { tab: 'finance' } })}>
        <ArrowLeft size={14} /> Back to Facility
      </button>

      <div className="page-header" style={{ marginTop: 12 }}>
        <div className="page-title">{isEditing ? 'Edit Finance Record' : 'New Finance Record'}</div>
        <div className="page-subtitle">File Number: <span className="file-num">{fileNumber}</span></div>
      </div>

      <form onSubmit={handleSubmit}>
        {error && (
          <div className="login-error" style={{ marginBottom: 16 }}>
            <AlertCircle size={15} style={{ flexShrink: 0 }} />
            {error}
          </div>
        )}

        <div className="form-card">
          <div className="form-section">
            <div className="form-section-title">Payment Details</div>

            <div className="form-row">
              <div className="form-group">
                <label>Date <span style={{ color: '#ef4444' }}>*</span></label>
                <input className="input" type="date" name="date" value={formData.date} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Payment Type <span style={{ color: '#ef4444' }}>*</span></label>
                <select className="select" name="payment_type" value={formData.payment_type} onChange={handleChange}>
                  <option value="">Select type…</option>
                  {PAYMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Payment Status</label>
                <select className="select" name="payment_status" value={formData.payment_status} onChange={handleChange}>
                  <option value="paid">Paid</option>
                  <option value="unpaid">Unpaid / Outstanding</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Amount <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.01"
                  name="amount"
                  value={formData.amount}
                  onChange={handleChange}
                  placeholder="0.00"
                />
              </div>
              <div className="form-group">
                <label>Currency</label>
                <select className="select" name="currency" value={formData.currency} onChange={handleChange}>
                  <option value="GHS">GHS</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Reference Number</label>
              <input
                className="input"
                name="reference_number"
                value={formData.reference_number}
                onChange={handleChange}
                placeholder="Receipt or transaction reference"
              />
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
                label="Invoice"
                existingUrl={urls.invoice_url}
                selectedFile={files.invoice}
                uploading={uploadingSlot === 'invoice'}
                onSelect={(f) => setFiles((p) => ({ ...p, invoice: f }))}
                onRemove={() => { setFiles((p) => ({ ...p, invoice: null })); setUrls((p) => ({ ...p, invoice_url: '' })) }}
              />
              <FileAttachmentField
                label="Receipt"
                existingUrl={urls.receipt_url}
                selectedFile={files.receipt}
                uploading={uploadingSlot === 'receipt'}
                onSelect={(f) => setFiles((p) => ({ ...p, receipt: f }))}
                onRemove={() => { setFiles((p) => ({ ...p, receipt: null })); setUrls((p) => ({ ...p, receipt_url: '' })) }}
              />
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn--ghost" onClick={() => navigate(`/facilities/${fileNumber}`, { state: { tab: 'finance' } })} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting
              ? <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> {uploadingSlot ? 'Uploading…' : 'Saving…'}</>
              : <><Save size={15} /> {isEditing ? 'Save Changes' : 'Add Record'}</>
            }
          </button>
        </div>
      </form>
    </div>
  )
}
