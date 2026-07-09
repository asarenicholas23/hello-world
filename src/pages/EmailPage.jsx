import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Send, Clock, CheckCircle, XCircle, Search, Plus, X, Users, Building2, Paperclip, Upload, FileCheck } from 'lucide-react'
import { listFacilities } from '../firebase/facilities'
import { getPermitStatusMap } from '../firebase/dashboard'
import { sendFacilityEmail, getEmailLog, EMAIL_TEMPLATES, previewTemplate, previewSubject } from '../firebase/email'
import { listMonitoringReports, markReportSent } from '../firebase/monitoringReports'
import { uploadFile } from '../firebase/storage'
import { SECTORS, DISTRICTS } from '../data/constants'
import Spinner from '../components/Spinner'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function fmtTs(ts) {
  if (!ts) return '—'
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000)
    return d.toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' })
  } catch { return '—' }
}

export default function EmailPage() {
  const [tab, setTab] = useState('compose')

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Email Notifications</div>
          <div className="page-subtitle">Send reports, schedules and permit notices to facilities</div>
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
  const location = useLocation()
  const prefillFacility   = location.state?.prefillFacility ?? null
  const prefillAttachment = location.state?.prefillAttachment ?? null

  const [facilities, setFacilities] = useState([])
  const [facilitiesLoading, setFacilitiesLoading] = useState(true)
  const [mode, setMode] = useState('single')

  // Single-mode state
  const [facSearch, setFacSearch]     = useState('')
  const [selectedFac, setSelectedFac] = useState(null)
  const [showFacList, setShowFacList] = useState(false)

  // Group-mode filter state
  const [groupSector, setGroupSector]     = useState('')
  const [groupDistrict, setGroupDistrict] = useState('')
  const [groupPermit, setGroupPermit]     = useState('')
  const [permitStatusMap, setPermitStatusMap] = useState(null)
  const [pmLoading, setPmLoading]             = useState(false)

  // Shared compose state
  const [template, setTemplate]       = useState(prefillAttachment ? 'monitoring_report' : 'permit_expiry_60')
  const [customSubject, setCustomSubject] = useState('')
  const [customMsg, setCustomMsg]     = useState('')
  const [extraEmail, setExtraEmail]   = useState('')
  const [extraEmails, setExtraEmails] = useState([])
  const [attachments, setAttachments] = useState(prefillAttachment ? [{ ...prefillAttachment }] : [])
  const [approvedReports, setApprovedReports] = useState([])
  const [uploadingFile, setUploadingFile] = useState(false)
  const [sending, setSending]         = useState(false)
  const [sendProgress, setSendProgress] = useState(null)
  const [result, setResult]           = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    listFacilities()
      .then((facs) => {
        setFacilities(facs)
        if (prefillFacility) {
          const match = facs.find((f) => f.file_number === prefillFacility)
          if (match) setSelectedFac({ ...match, source: 'facility', key: `facility:${match.file_number}` })
        }
      })
      .catch(() => setFacilities([]))
      .finally(() => setFacilitiesLoading(false))
  }, [prefillFacility])

  // Lazy-load permit status map when filtering by permit status in group mode
  useEffect(() => {
    if (mode !== 'group' || !groupPermit || permitStatusMap !== null || pmLoading) return
    setPmLoading(true)
    getPermitStatusMap()
      .then(setPermitStatusMap)
      .catch(() => setPermitStatusMap({}))
      .finally(() => setPmLoading(false))
  }, [mode, groupPermit, permitStatusMap, pmLoading])

  // Load this facility's approved monitoring reports (single mode only)
  useEffect(() => {
    if (mode !== 'single' || !selectedFac?.file_number) { setApprovedReports([]); return }
    listMonitoringReports(selectedFac.file_number)
      .then((reports) => setApprovedReports(reports.filter((r) => r.status === 'approved')))
      .catch(() => setApprovedReports([]))
  }, [mode, selectedFac])

  // Single-mode: live search dropdown
  const searchFiltered = useMemo(() => {
    const q = facSearch.trim().toLowerCase()
    if (!q) return []
    return facilities
      .filter((f) => f.name?.toLowerCase().includes(q) || f.file_number?.toLowerCase().includes(q))
      .map((f) => ({ ...f, source: 'facility', key: `facility:${f.file_number}` }))
  }, [facSearch, facilities])

  // Group-mode: recipient list
  const groupFacilities = useMemo(() => {
    if (mode !== 'group') return []
    return facilities.filter((f) => {
      const matchSector   = !groupSector   || f.sector_prefix === groupSector
      const matchDistrict = !groupDistrict || f.district      === groupDistrict
      let matchPermit = true
      if (groupPermit && permitStatusMap !== null) {
        const status = permitStatusMap[f.file_number] ?? 'none'
        matchPermit  = status === groupPermit
      }
      return matchSector && matchDistrict && matchPermit
    }).map((f) => ({ ...f, source: 'facility', key: `facility:${f.file_number}` }))
  }, [mode, facilities, groupSector, groupDistrict, groupPermit, permitStatusMap])

  const recipientsWithEmail    = groupFacilities.filter((f) => f.email?.trim())
  const recipientsWithoutEmail = groupFacilities.filter((f) => !f.email?.trim())
  const selectedNeedsEmail = mode === 'single' && !selectedFac?.email?.trim() && !extraEmails.length

  const currentTemplate = EMAIL_TEMPLATES.find((t) => t.value === template)
  const preview = template === 'custom'
    ? customMsg
    : previewTemplate(template, mode === 'single' ? selectedFac : null)
  const previewSubjectText = template === 'custom' ? (customSubject || `Notice from EPA Konongo Area Office`) : previewSubject(template)

  function addExtraEmail() {
    const n = extraEmail.trim()
    if (!n) return
    if (!EMAIL_RE.test(n)) { setResult({ type: 'error', text: 'Enter a valid email address.' }); return }
    if (extraEmails.includes(n)) return
    setExtraEmails((p) => [...p, n])
    setExtraEmail('')
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingFile(true)
    setResult(null)
    try {
      const path = `email_attachments/${Date.now()}_${Math.random().toString(36).slice(2)}_${file.name}`
      const url = await uploadFile(file, path)
      setAttachments((p) => [...p, { filename: file.name, url }])
    } catch (err) {
      setResult({ type: 'error', text: `Upload failed: ${err.message}` })
    } finally {
      setUploadingFile(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function attachReport(report) {
    if (attachments.some((a) => a.reportId === report.id)) return
    setAttachments((p) => [...p, {
      filename: report.file_name, url: report.file_url,
      reportId: report.id, fileNumber: selectedFac?.file_number,
    }])
  }

  function removeAttachment(idx) {
    setAttachments((p) => p.filter((_, i) => i !== idx))
  }

  async function markSentReports(recipient) {
    for (const a of attachments) {
      if (!a.reportId) continue
      try { await markReportSent(a.fileNumber, a.reportId, { sentTo: recipient }) } catch { /* best-effort */ }
    }
  }

  // ── Single send ───────────────────────────────────────────
  async function handleSingleSend() {
    if (currentTemplate?.requiresFacility && !selectedFac) {
      setResult({ type: 'error', text: 'Select a facility first.' }); return
    }
    if (template === 'custom' && !customMsg.trim()) {
      setResult({ type: 'error', text: 'Type a message before sending.' }); return
    }
    setSending(true)
    setResult(null)
    try {
      const res = await sendFacilityEmail({
        facilityId:    selectedFac?.file_number ?? null,
        template,
        customSubject,
        customMessage: customMsg,
        extraEmails,
        attachments:   attachments.map((a) => ({ filename: a.filename, url: a.url })),
      })
      await markSentReports(res.recipients?.[0])
      setResult({ type: 'ok', text: `Sent to ${res.recipients.length} recipient(s).` })
      setCustomMsg('')
      setCustomSubject('')
      setExtraEmails([])
      setAttachments([])
    } catch (err) {
      setResult({ type: 'error', text: err.message ?? 'Send failed. Try again.' })
    } finally {
      setSending(false)
    }
  }

  // ── Bulk send ─────────────────────────────────────────────
  async function handleBulkSend() {
    if (template === 'custom' && !customMsg.trim()) {
      setResult({ type: 'error', text: 'Type a message before sending.' }); return
    }
    if (!recipientsWithEmail.length) {
      setResult({ type: 'error', text: 'No facilities with an email address in this group.' }); return
    }
    setSending(true)
    setSendProgress({ done: 0, total: recipientsWithEmail.length, failed: 0 })
    setResult(null)

    let done = 0; let failed = 0
    for (const fac of recipientsWithEmail) {
      try {
        await sendFacilityEmail({
          facilityId:    fac.file_number,
          template,
          customSubject,
          customMessage: customMsg,
          extraEmails:   [],
          attachments:   attachments.map((a) => ({ filename: a.filename, url: a.url })),
        })
      } catch { failed++ }
      done++
      setSendProgress({ done, total: recipientsWithEmail.length, failed })
    }

    setSending(false)
    setSendProgress(null)
    const ok = done - failed
    setResult({
      type: ok > 0 ? 'ok' : 'error',
      text: failed === 0
        ? `Sent to ${ok} facilit${ok === 1 ? 'y' : 'ies'}.`
        : `Sent to ${ok} facilit${ok === 1 ? 'y' : 'ies'}. ${failed} failed — check the send log.`,
    })
    if (template === 'custom') setCustomMsg('')
  }

  return (
    <div className="card form-card">
      {/* Mode toggle */}
      <div className="sms-mode-toggle">
        <button
          type="button"
          className={`sms-mode-btn${mode === 'single' ? ' sms-mode-btn--active' : ''}`}
          onClick={() => setMode('single')}
        >
          <Building2 size={13} /> Single Facility
        </button>
        <button
          type="button"
          className={`sms-mode-btn${mode === 'group' ? ' sms-mode-btn--active' : ''}`}
          onClick={() => setMode('group')}
        >
          <Users size={13} /> Group / Bulk
        </button>
      </div>

      {result && (
        <div
          className={result.type === 'ok' ? 'assign-success-banner' : 'login-error'}
          style={{ marginBottom: 16 }}
        >
          {result.type === 'ok' ? <CheckCircle size={14} /> : <XCircle size={14} />}
          {result.text}
        </div>
      )}

      {/* ── Single mode ── */}
      {mode === 'single' && (
        <>
          <div className="form-section-title">Target Recipient</div>
          <div style={{ position: 'relative', marginBottom: 16 }}>
            <div className="search-box">
              <Search size={14} className="search-icon" />
              <input
                className="search-input"
                placeholder="Search facilities by name or file number…"
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
            {showFacList && searchFiltered.length > 0 && (
              <div className="sms-fac-dropdown">
                {searchFiltered.slice(0, 8).map((f) => (
                  <div key={f.key} className="sms-fac-dropdown__item"
                    onMouseDown={() => { setSelectedFac(f); setFacSearch(''); setShowFacList(false) }}>
                    <span className="file-num" style={{ fontSize: 12 }}>{f.file_number}</span>
                    <span style={{ fontSize: 13 }}>{f.name}</span>
                    {f.email
                      ? <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 'auto' }}>{f.email}</span>
                      : <span style={{ fontSize: 12, color: '#ef4444', marginLeft: 'auto' }}>No email</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
          {selectedFac && !selectedFac.email && (
            <div className="login-error" style={{ marginBottom: 12, fontSize: 13 }}>
              <XCircle size={13} /> This facility has no email address on record. Add a manual address below.
            </div>
          )}
        </>
      )}

      {/* ── Group mode ── */}
      {mode === 'group' && (
        <>
          <div className="form-section-title">Filter Recipients</div>
          <div className="sms-group-filters">
            <select className="select" value={groupSector} onChange={(e) => setGroupSector(e.target.value)}>
              <option value="">All sectors</option>
              {SECTORS.map((s) => (
                <option key={s.prefix} value={s.prefix}>{s.name} ({s.prefix})</option>
              ))}
            </select>
            <select className="select" value={groupDistrict} onChange={(e) => setGroupDistrict(e.target.value)}>
              <option value="">All districts</option>
              {DISTRICTS.map((d) => (
                <option key={d.code} value={d.code}>{d.name}</option>
              ))}
            </select>
            <select className="select" value={groupPermit} onChange={(e) => setGroupPermit(e.target.value)}>
              <option value="">All permit statuses</option>
              <option value="active">Active permit</option>
              <option value="expiring">Expiring ≤60 days</option>
              <option value="expired">Expired permit</option>
              <option value="none">No permit on file</option>
            </select>
          </div>
          {pmLoading && (
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Loading permit data…</div>
          )}

          {/* Recipient list */}
          {groupFacilities.length > 0 ? (
            <>
              <div className="sms-recipient-list">
                {groupFacilities.map((f) => (
                  <div key={f.key ?? f.file_number} className="sms-recipient-row">
                    <span className="file-num" style={{ fontSize: 12, flexShrink: 0 }}>{f.file_number}</span>
                    <span className="sms-recipient-name">{f.name}</span>
                    {f.email?.trim()
                      ? <span className="sms-recipient-phone">{f.email}</span>
                      : <span className="sms-no-phone">No email</span>}
                  </div>
                ))}
              </div>
              <div className="sms-recipient-summary">
                <CheckCircle size={12} style={{ color: '#059669' }} />
                <span>
                  <strong>{recipientsWithEmail.length}</strong> will receive an email
                  {recipientsWithoutEmail.length > 0 && (
                    <> · <span style={{ color: '#ef4444' }}>{recipientsWithoutEmail.length} skipped</span> (no email address)</>
                  )}
                </span>
              </div>
            </>
          ) : (
            <div className="empty-state" style={{ padding: '20px 0' }}>
              {facilitiesLoading ? 'Loading facilities…' : 'No facilities match the selected filters.'}
            </div>
          )}
        </>
      )}

      {/* ── Template (shared) ── */}
      <div className="form-section-title" style={{ marginTop: 16 }}>Message Template</div>
      <select className="form-input" style={{ marginBottom: 16 }} value={template}
        onChange={(e) => setTemplate(e.target.value)}>
        {EMAIL_TEMPLATES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>

      {template === 'custom' && (
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label className="form-label">Subject</label>
          <input
            className="form-input" style={{ marginBottom: 10 }}
            placeholder="Email subject…"
            value={customSubject}
            onChange={(e) => setCustomSubject(e.target.value)}
          />
          <label className="form-label">Message</label>
          <textarea
            className="form-input"
            rows={5}
            style={{ resize: 'vertical', fontFamily: 'inherit' }}
            placeholder="Type your message here…"
            value={customMsg}
            onChange={(e) => setCustomMsg(e.target.value)}
          />
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            Preview
            {mode === 'group' && template !== 'custom' && (
              <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: 8, color: '#16a34a' }}>
                — personalized per facility
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#374151', fontWeight: 600, marginBottom: 4 }}>Subject: {previewSubjectText}</div>
          <div style={{ fontSize: 13, color: '#111827', lineHeight: 1.6 }}>{preview}</div>
        </div>
      )}

      {/* Attachments */}
      <div className="form-section-title">Attachments <span style={{ fontWeight: 400, fontSize: 12, color: '#9ca3af' }}>(optional)</span></div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileUpload} />
        <button className="btn btn--ghost btn--sm" type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingFile}>
          <Upload size={13} /> {uploadingFile ? 'Uploading…' : 'Upload File'}
        </button>
      </div>
      {mode === 'single' && approvedReports.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Approved monitoring reports for this facility:</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {approvedReports.map((r) => (
              <button
                key={r.id}
                type="button"
                className="btn btn--ghost btn--xs"
                disabled={attachments.some((a) => a.reportId === r.id)}
                onClick={() => attachReport(r)}
              >
                <FileCheck size={12} /> {r.file_name}
              </button>
            ))}
          </div>
        </div>
      )}
      {attachments.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          {attachments.map((a, i) => (
            <span key={i} className="filter-pill">
              <Paperclip size={11} /> {a.filename} <button onClick={() => removeAttachment(i)}>✕</button>
            </span>
          ))}
        </div>
      )}

      {/* Extra emails — single mode only */}
      {mode === 'single' && (
        <>
          <div className="form-section-title">Additional Recipients <span style={{ fontWeight: 400, fontSize: 12, color: '#9ca3af' }}>(optional)</span></div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              className="form-input" style={{ flex: 1 }}
              placeholder="e.g. name@example.com"
              value={extraEmail}
              onChange={(e) => setExtraEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addExtraEmail())}
            />
            <button className="btn btn--ghost btn--sm" type="button" onClick={addExtraEmail}>
              <Plus size={13} /> Add
            </button>
          </div>
          {extraEmails.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
              {extraEmails.map((p) => (
                <span key={p} className="filter-pill">
                  {p} <button onClick={() => setExtraEmails((arr) => arr.filter((x) => x !== p))}>✕</button>
                </span>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Bulk send progress ── */}
      {sendProgress && (
        <div className="sms-bulk-progress">
          <div className="sms-bulk-progress__label">
            Sending {sendProgress.done} of {sendProgress.total}…
            {sendProgress.failed > 0 && <span style={{ color: '#dc2626', marginLeft: 8 }}>{sendProgress.failed} failed</span>}
          </div>
          <div className="import-progress-bar-wrap">
            <div
              className="import-progress-bar"
              style={{ width: `${Math.round((sendProgress.done / sendProgress.total) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Send button ── */}
      <div className="form-actions" style={{ marginTop: 8 }}>
        {mode === 'single' ? (
          <button
            className="btn btn--primary"
            onClick={handleSingleSend}
            disabled={sending || selectedNeedsEmail || (currentTemplate?.requiresFacility && !selectedFac && !extraEmails.length)}
          >
            {sending ? 'Sending…' : <><Send size={14} /> Send Email</>}
          </button>
        ) : (
          <button
            className="btn btn--primary"
            onClick={handleBulkSend}
            disabled={sending || !recipientsWithEmail.length}
          >
            {sending
              ? `Sending ${sendProgress?.done ?? 0} / ${sendProgress?.total ?? recipientsWithEmail.length}…`
              : <><Send size={14} /> Send to {recipientsWithEmail.length} facilit{recipientsWithEmail.length === 1 ? 'y' : 'ies'}</>
            }
          </button>
        )}
      </div>
    </div>
  )
}

// ── Log ─────────────────────────────────────────────────────
function LogTab() {
  const [logs, setLogs]       = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getEmailLog(100)
      .then(setLogs)
      .catch(() => setLogs([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />
  if (!logs.length) return <div className="empty-state">No emails sent yet.</div>

  return (
    <div className="facility-table-wrap">
      <table className="facility-table">
        <thead>
          <tr>
            <th>Sent At</th>
            <th>Facility</th>
            <th>Subject</th>
            <th>Recipients</th>
            <th>Attachments</th>
            <th>Status</th>
            <th>Triggered By</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="facility-table__row" title={log.message}>
              <td style={{ whiteSpace: 'nowrap', fontSize: 12, color: '#6b7280' }}>{fmtTs(log.sent_at)}</td>
              <td className="facility-table__fileno">{log.facility_id || log.facility_name || '—'}</td>
              <td style={{ fontSize: 12 }}>{log.subject || log.template}</td>
              <td style={{ fontSize: 12 }}>{(log.recipients ?? []).join(', ')}</td>
              <td style={{ fontSize: 12 }}>{log.attachments?.length ? log.attachments.join(', ') : '—'}</td>
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
                {log.triggered_by?.slice(0, 8)}…
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
