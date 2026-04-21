import { useEffect, useState } from 'react'
import { MessageSquare, Send, Clock, CheckCircle, XCircle, Search, Plus, X } from 'lucide-react'
import { listFacilities } from '../firebase/facilities'
import { sendFacilitySms, getSmsLog, SMS_TEMPLATES, previewTemplate } from '../firebase/sms'
import Spinner from '../components/Spinner'

function fmtTs(ts) {
  if (!ts) return '—'
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000)
    return d.toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' })
  } catch { return '—' }
}

export default function SmsPage() {
  const [tab, setTab] = useState('compose')

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">SMS Notifications</div>
          <div className="page-subtitle">Send alerts to facilities and view delivery log</div>
        </div>
      </div>

      <div className="tab-bar" style={{ marginBottom: 20 }}>
        <button className={`tab-btn${tab === 'compose' ? ' tab-btn--active' : ''}`} onClick={() => setTab('compose')}>
          <Send size={14} /> Compose
        </button>
        <button className={`tab-btn${tab === 'log' ? ' tab-btn--active' : ''}`} onClick={() => setTab('log')}>
          <Clock size={14} /> Send Log
        </button>
      </div>

      {tab === 'compose' && <ComposeTab />}
      {tab === 'log'     && <LogTab />}
    </div>
  )
}

// ── Compose ──────────────────────────────────────────────────
function ComposeTab() {
  const [facilities, setFacilities]   = useState([])
  const [facSearch, setFacSearch]     = useState('')
  const [selectedFac, setSelectedFac] = useState(null)
  const [showFacList, setShowFacList] = useState(false)
  const [template, setTemplate]       = useState('permit_expiry_60')
  const [customMsg, setCustomMsg]     = useState('')
  const [extraPhone, setExtraPhone]   = useState('')
  const [extraPhones, setExtraPhones] = useState([])
  const [sending, setSending]         = useState(false)
  const [result, setResult]           = useState(null)

  useEffect(() => { listFacilities().then(setFacilities).catch(() => {}) }, [])

  const filtered = facSearch.trim()
    ? facilities.filter((f) =>
        f.name.toLowerCase().includes(facSearch.toLowerCase()) ||
        f.file_number.toLowerCase().includes(facSearch.toLowerCase()))
    : []

  const currentTemplate = SMS_TEMPLATES.find((t) => t.value === template)
  const preview = template === 'custom'
    ? customMsg
    : previewTemplate(template, selectedFac)

  function addExtraPhone() {
    const n = extraPhone.trim()
    if (!n || extraPhones.includes(n)) return
    setExtraPhones((p) => [...p, n])
    setExtraPhone('')
  }

  async function handleSend() {
    if (currentTemplate?.requiresFacility && !selectedFac) {
      setResult({ type: 'error', text: 'Select a facility first.' }); return
    }
    if (template === 'custom' && !customMsg.trim()) {
      setResult({ type: 'error', text: 'Type a message before sending.' }); return
    }
    setSending(true)
    setResult(null)
    try {
      const res = await sendFacilitySms({
        facilityId:    selectedFac?.file_number ?? null,
        template,
        customMessage: customMsg,
        extraPhones,
      })
      setResult({ type: 'ok', text: `Sent to ${res.recipients.length} recipient(s).` })
      setCustomMsg('')
      setExtraPhones([])
    } catch (err) {
      setResult({ type: 'error', text: err.message ?? 'Send failed. Try again.' })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="card form-card">
      {result && (
        <div
          className={result.type === 'ok' ? 'assign-success-banner' : 'login-error'}
          style={{ marginBottom: 16 }}
        >
          {result.type === 'ok' ? <CheckCircle size={14} /> : <XCircle size={14} />}
          {result.text}
        </div>
      )}

      {/* Facility picker */}
      <div className="form-section-title">Target Facility</div>
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <div className="search-box">
          <Search size={14} className="search-icon" />
          <input
            className="search-input"
            placeholder="Search by name or file number…"
            value={selectedFac ? `${selectedFac.file_number} — ${selectedFac.name}` : facSearch}
            onFocus={() => { setShowFacList(true); if (selectedFac) { setFacSearch(''); setSelectedFac(null) } }}
            onChange={(e) => { setFacSearch(e.target.value); setShowFacList(true) }}
          />
          {selectedFac && (
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 8px' }}
              onClick={() => { setSelectedFac(null); setFacSearch('') }}>
              <X size={14} color="#6b7280" />
            </button>
          )}
        </div>
        {showFacList && filtered.length > 0 && (
          <div className="sms-fac-dropdown">
            {filtered.slice(0, 8).map((f) => (
              <div key={f.file_number} className="sms-fac-dropdown__item"
                onMouseDown={() => { setSelectedFac(f); setFacSearch(''); setShowFacList(false) }}>
                <span className="file-num" style={{ fontSize: 12 }}>{f.file_number}</span>
                <span style={{ fontSize: 13 }}>{f.name}</span>
                {f.phone
                  ? <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 'auto' }}>{f.phone}</span>
                  : <span style={{ fontSize: 12, color: '#ef4444', marginLeft: 'auto' }}>No phone</span>}
              </div>
            ))}
          </div>
        )}
      </div>
      {selectedFac && !selectedFac.phone && (
        <div className="login-error" style={{ marginBottom: 12, fontSize: 13 }}>
          <XCircle size={13} /> This facility has no phone number on record. Add one in the facility profile, or add a manual number below.
        </div>
      )}

      {/* Template */}
      <div className="form-section-title" style={{ marginTop: 8 }}>Message Template</div>
      <select className="form-input" style={{ marginBottom: 16 }} value={template}
        onChange={(e) => setTemplate(e.target.value)}>
        {SMS_TEMPLATES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>

      {template === 'custom' && (
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label className="form-label">Message</label>
          <textarea
            className="form-input"
            rows={4}
            style={{ resize: 'vertical', fontFamily: 'inherit' }}
            placeholder="Type your message here…"
            value={customMsg}
            onChange={(e) => setCustomMsg(e.target.value)}
          />
          <span className="form-hint">{customMsg.length} chars · {Math.ceil(customMsg.length / 160) || 1} SMS part(s)</span>
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            Preview · {preview.length} chars · {Math.ceil(preview.length / 160)} SMS part(s)
          </div>
          <div style={{ fontSize: 13, color: '#111827', lineHeight: 1.6 }}>{preview}</div>
        </div>
      )}

      {/* Extra phones */}
      <div className="form-section-title">Additional Recipients <span style={{ fontWeight: 400, fontSize: 12, color: '#9ca3af' }}>(optional)</span></div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input
          className="form-input" style={{ flex: 1 }}
          placeholder="e.g. 024 000 0000"
          value={extraPhone}
          onChange={(e) => setExtraPhone(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addExtraPhone())}
        />
        <button className="btn btn--ghost btn--sm" type="button" onClick={addExtraPhone}>
          <Plus size={13} /> Add
        </button>
      </div>
      {extraPhones.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          {extraPhones.map((p) => (
            <span key={p} className="filter-pill">
              {p} <button onClick={() => setExtraPhones((arr) => arr.filter((x) => x !== p))}>✕</button>
            </span>
          ))}
        </div>
      )}

      <div className="form-actions" style={{ marginTop: 8 }}>
        <button
          className="btn btn--primary"
          onClick={handleSend}
          disabled={sending || (!selectedFac && currentTemplate?.requiresFacility && !extraPhones.length)}
        >
          {sending ? 'Sending…' : <><Send size={14} /> Send SMS</>}
        </button>
      </div>
    </div>
  )
}

// ── Log ─────────────────────────────────────────────────────
function LogTab() {
  const [logs, setLogs]       = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSmsLog(100)
      .then(setLogs)
      .catch(() => setLogs([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />
  if (!logs.length) return <div className="empty-state">No messages sent yet.</div>

  return (
    <div className="facility-table-wrap">
      <table className="facility-table">
        <thead>
          <tr>
            <th>Sent At</th>
            <th>Facility</th>
            <th>Template</th>
            <th>Recipients</th>
            <th>Status</th>
            <th>Triggered By</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="facility-table__row" title={log.message}>
              <td style={{ whiteSpace: 'nowrap', fontSize: 12, color: '#6b7280' }}>{fmtTs(log.sent_at)}</td>
              <td className="facility-table__fileno">{log.facility_id || '—'}</td>
              <td style={{ fontSize: 12 }}>{log.template}</td>
              <td style={{ fontSize: 12 }}>{(log.recipients ?? []).join(', ')}</td>
              <td>
                <span className="record-badge" style={
                  log.status === 'sent'
                    ? { background: '#dcfce7', color: '#166534' }
                    : { background: '#fee2e2', color: '#991b1b' }
                }>
                  {log.status === 'sent' ? <CheckCircle size={11} /> : <XCircle size={11} />}
                  {' '}{log.status}
                </span>
              </td>
              <td style={{ fontSize: 12, color: '#6b7280' }}>
                {log.triggered_by === 'scheduled' ? 'Scheduled' : log.triggered_by?.slice(0, 8) + '…'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
