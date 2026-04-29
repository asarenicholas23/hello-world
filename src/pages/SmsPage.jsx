import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Send, Clock, CheckCircle, XCircle, Search, Plus, X, Users, Building2, ClipboardList } from 'lucide-react'
import { listFacilities } from '../firebase/facilities'
import { listFieldReports } from '../firebase/fieldReports'
import { getPermitStatusMap } from '../firebase/dashboard'
import { sendFacilitySms, getSmsLog, SMS_TEMPLATES, previewTemplate } from '../firebase/sms'
import { SECTORS, DISTRICTS } from '../data/constants'
import Spinner from '../components/Spinner'

function fmtTs(ts) {
  if (!ts) return '—'
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000)
    return d.toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' })
  } catch { return '—' }
}

const REPORTING_OPTIONS = [
  { value: 'pending',  label: 'Pending' },
  { value: 'reported', label: 'Reported' },
  { value: 'rejected', label: 'Rejected' },
]

function dateFromTs(ts) {
  if (!ts) return null
  if (ts.toDate) return ts.toDate()
  if (ts.seconds) return new Date(ts.seconds * 1000)
  const d = new Date(ts)
  return isNaN(d) ? null : d
}

function reportNoticeDate(report) {
  return dateFromTs(report.notice_issue_date ?? report.date_letter_served)
}

function reportName(report) {
  return report.name ?? report.facility_name ?? 'Unknown'
}

function recipientTypeLabel(source, count) {
  if (source === 'field_reports') return count === 1 ? 'contact' : 'contacts'
  return count === 1 ? 'facility' : 'facilities'
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
  const location   = useLocation()
  const preFilledFacilities  = location.state?.bulkFacilities ?? null
  const preFilledFieldReports = location.state?.bulkFieldReports ?? null

  const [facilities, setFacilities] = useState([])
  const [fieldReports, setFieldReports] = useState([])
  const [facilitiesLoading, setFacilitiesLoading] = useState(true)
  const [fieldReportsLoading, setFieldReportsLoading] = useState(true)
  const [mode, setMode]             = useState((preFilledFacilities || preFilledFieldReports) ? 'group' : 'single')
  const [groupSource, setGroupSource] = useState(location.state?.bulkSource === 'field_reports' || preFilledFieldReports ? 'field_reports' : 'facilities')

  // Single-mode state
  const [facSearch, setFacSearch]     = useState('')
  const [selectedFac, setSelectedFac] = useState(null)
  const [showFacList, setShowFacList] = useState(false)

  // Group-mode filter state
  const [groupSector, setGroupSector]     = useState('')
  const [groupDistrict, setGroupDistrict] = useState('')
  const [groupPermit, setGroupPermit]     = useState('')
  const [reportDateFrom, setReportDateFrom] = useState('')
  const [reportDateTo, setReportDateTo] = useState('')
  const [reportingStatus, setReportingStatus] = useState('')
  const [permitStatusMap, setPermitStatusMap] = useState(null)
  const [pmLoading, setPmLoading]             = useState(false)

  // Shared compose state
  const [template, setTemplate]     = useState('permit_expiry_60')
  const [customMsg, setCustomMsg]   = useState('')
  const [extraPhone, setExtraPhone] = useState('')
  const [extraPhones, setExtraPhones] = useState([])
  const [sending, setSending]         = useState(false)
  const [sendProgress, setSendProgress] = useState(null) // { done, total, failed }
  const [result, setResult]             = useState(null)

  useEffect(() => {
    listFacilities()
      .then(setFacilities)
      .catch(() => setFacilities([]))
      .finally(() => setFacilitiesLoading(false))
    listFieldReports()
      .then(setFieldReports)
      .catch(() => setFieldReports([]))
      .finally(() => setFieldReportsLoading(false))
  }, [])

  // Lazy-load permit status map when filtering by permit status in group mode
  useEffect(() => {
    if (mode !== 'group' || groupSource !== 'facilities' || !groupPermit || permitStatusMap !== null || pmLoading) return
    setPmLoading(true)
    getPermitStatusMap()
      .then(setPermitStatusMap)
      .catch(() => {})
      .finally(() => setPmLoading(false))
  }, [mode, groupSource, groupPermit, permitStatusMap, pmLoading])

  // Single-mode: live search dropdown
  const searchFiltered = useMemo(() => {
    const q = facSearch.trim().toLowerCase()
    if (!q) return []
    const facilityMatches = facilities
      .filter((f) =>
        f.name?.toLowerCase().includes(q) ||
        f.file_number?.toLowerCase().includes(q))
      .map((f) => ({ ...f, source: 'facility', key: `facility:${f.file_number}` }))

    const reportMatches = fieldReports
      .filter((r) => reportName(r).toLowerCase().includes(q))
      .map((r) => ({
        ...r,
        source: 'field_report',
        key: `field-report:${r.id}`,
        name: reportName(r),
        file_number: r.assigned_file_number ?? r.fileNumber ?? 'Field report',
      }))

    return [...facilityMatches, ...reportMatches]
  }, [facSearch, facilities, fieldReports])

  // Group-mode: recipient list
  const groupFacilities = useMemo(() => {
    if (mode !== 'group') return []
    if (groupSource === 'field_reports') {
      const sourceReports = preFilledFieldReports ?? fieldReports
      return sourceReports.filter((r) => {
        if (reportingStatus && r.reporting_status !== reportingStatus) return false

        if (reportDateFrom || reportDateTo) {
          const d = reportNoticeDate(r)
          if (reportDateFrom && (!d || d < new Date(reportDateFrom + 'T00:00:00'))) return false
          if (reportDateTo && (!d || d > new Date(reportDateTo + 'T23:59:59'))) return false
        }

        return true
      }).map((r) => ({
        ...r,
        source: 'field_report',
        key: `field-report:${r.id ?? r.fileNumber}`,
        name: reportName(r),
        file_number: r.assigned_file_number ?? r.fileNumber ?? 'Field report',
      }))
    }

    if (preFilledFacilities) return preFilledFacilities.map((f) => ({ ...f, source: 'facility', key: `facility:${f.file_number ?? f.fileNumber ?? f.name}` }))
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
  }, [mode, groupSource, preFilledFacilities, preFilledFieldReports, facilities, fieldReports, groupSector, groupDistrict, groupPermit, permitStatusMap, reportDateFrom, reportDateTo, reportingStatus])

  const recipientsWithPhone    = groupFacilities.filter((f) => f.phone?.trim())
  const recipientsWithoutPhone = groupFacilities.filter((f) => !f.phone?.trim())
  const selectedNeedsPhone = selectedFac?.source === 'field_report' && !selectedFac.phone?.trim() && !extraPhones.length

  const currentTemplate = SMS_TEMPLATES.find((t) => t.value === template)
  const preview = template === 'custom'
    ? customMsg
    : previewTemplate(template, mode === 'single' ? selectedFac : null)

  function addExtraPhone() {
    const n = extraPhone.trim()
    if (!n || extraPhones.includes(n)) return
    setExtraPhones((p) => [...p, n])
    setExtraPhone('')
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
      const res = await sendFacilitySms({
        facilityId:    selectedFac?.source === 'field_report' ? null : (selectedFac?.file_number ?? null),
        facilityName:  selectedFac?.source === 'field_report' ? selectedFac.name : undefined,
        template,
        customMessage: customMsg,
        extraPhones:   selectedFac?.source === 'field_report'
          ? [selectedFac.phone, ...extraPhones].filter(Boolean)
          : extraPhones,
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

  // ── Bulk send ─────────────────────────────────────────────
  async function handleBulkSend() {
    if (template === 'custom' && !customMsg.trim()) {
      setResult({ type: 'error', text: 'Type a message before sending.' }); return
    }
    if (!recipientsWithPhone.length) {
      setResult({ type: 'error', text: `No ${groupSource === 'field_reports' ? 'field reports' : 'facilities'} with phone numbers in this group.` }); return
    }
    setSending(true)
    setSendProgress({ done: 0, total: recipientsWithPhone.length, failed: 0 })
    setResult(null)

    let done = 0; let failed = 0
    for (const fac of recipientsWithPhone) {
      const isFieldReport = fac.source === 'field_report'
      const facId = isFieldReport ? null : (fac.file_number ?? null)
      try {
        await sendFacilitySms({
          facilityId:    facId,
          facilityName:  isFieldReport ? (fac.name ?? '') : undefined,
          template,
          customMessage: customMsg,
          extraPhones:   isFieldReport ? [fac.phone].filter(Boolean) : [],
        })
      } catch { failed++ }
      done++
      setSendProgress({ done, total: recipientsWithPhone.length, failed })
    }

    setSending(false)
    setSendProgress(null)
    const ok = done - failed
    const recipientLabel = recipientTypeLabel(groupSource, ok)
    setResult({
      type: ok > 0 ? 'ok' : 'error',
      text: failed === 0
        ? `Sent to ${ok} ${recipientLabel}.`
        : `Sent to ${ok} ${recipientLabel}. ${failed} failed — check the send log.`,
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
                placeholder="Search facilities by name/file number or field reports by name…"
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
                    {f.source === 'field_report' && (
                      <span className="record-badge" style={{ background: '#eef2ff', color: '#3730a3', marginLeft: 4 }}>Field report</span>
                    )}
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
              <XCircle size={13} /> This {selectedFac.source === 'field_report' ? 'field report' : 'facility'} has no phone number on record. Add a manual number below.
            </div>
          )}
        </>
      )}

      {/* ── Group mode ── */}
      {mode === 'group' && (
        <>
          <div className="sms-mode-toggle sms-source-toggle">
            <button
              type="button"
              className={`sms-mode-btn${groupSource === 'facilities' ? ' sms-mode-btn--active' : ''}`}
              onClick={() => setGroupSource('facilities')}
            >
              <Building2 size={13} /> Existing Facilities
            </button>
            <button
              type="button"
              className={`sms-mode-btn${groupSource === 'field_reports' ? ' sms-mode-btn--active' : ''}`}
              onClick={() => setGroupSource('field_reports')}
            >
              <ClipboardList size={13} /> Field Reports
            </button>
          </div>

          {((groupSource === 'facilities' && preFilledFacilities) || (groupSource === 'field_reports' && preFilledFieldReports)) && (
            <div className="sms-prefilled-banner">
              <Users size={13} />
              Pre-selected from {groupSource === 'field_reports' ? 'Field Reports' : 'Facilities'} filter — {groupFacilities.length} {recipientTypeLabel(groupSource, groupFacilities.length)}
            </div>
          )}

          {groupSource === 'facilities' && preFilledFacilities ? null : (
            <>
              <div className="form-section-title">Filter Recipients</div>
              {groupSource === 'facilities' ? (
                <>
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
                </>
              ) : (
                <div className="sms-group-filters">
                  <select className="select" value={reportingStatus} onChange={(e) => setReportingStatus(e.target.value)}>
                    <option value="">All reporting statuses</option>
                    {REPORTING_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <label className="sms-date-filter">
                    <span>Notice from</span>
                    <input className="input" type="date" value={reportDateFrom} onChange={(e) => setReportDateFrom(e.target.value)} />
                  </label>
                  <label className="sms-date-filter">
                    <span>Notice to</span>
                    <input className="input" type="date" value={reportDateTo} onChange={(e) => setReportDateTo(e.target.value)} />
                  </label>
                  {(reportDateFrom || reportDateTo || reportingStatus) && (
                    <button className="btn btn--ghost btn--sm" type="button" onClick={() => { setReportDateFrom(''); setReportDateTo(''); setReportingStatus('') }}>
                      Clear
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {/* Recipient list */}
          {groupFacilities.length > 0 ? (
            <>
              <div className="sms-recipient-list">
                {groupFacilities.map((f) => (
                  <div key={f.key ?? f.file_number} className="sms-recipient-row">
                    <span className="file-num" style={{ fontSize: 12, flexShrink: 0 }}>{f.file_number}</span>
                    <span className="sms-recipient-name">{f.name}</span>
                    {f.source === 'field_report' && (
                      <span className="sms-recipient-phone">{REPORTING_OPTIONS.find((o) => o.value === f.reporting_status)?.label ?? f.reporting_status ?? 'Pending'}</span>
                    )}
                    {f.phone?.trim()
                      ? <span className="sms-recipient-phone">{f.phone}</span>
                      : <span className="sms-no-phone">No phone</span>}
                  </div>
                ))}
              </div>
              <div className="sms-recipient-summary">
                <CheckCircle size={12} style={{ color: '#059669' }} />
                <span>
                  <strong>{recipientsWithPhone.length}</strong> will receive SMS
                  {recipientsWithoutPhone.length > 0 && (
                    <> · <span style={{ color: '#ef4444' }}>{recipientsWithoutPhone.length} skipped</span> (no phone number)</>
                  )}
                </span>
              </div>
            </>
          ) : (
            <div className="empty-state" style={{ padding: '20px 0' }}>
              {groupSource === 'field_reports'
                ? (fieldReportsLoading ? 'Loading field reports…' : 'No field reports match the selected filters.')
                : (facilitiesLoading ? 'Loading facilities…' : 'No facilities match the selected filters.')}
            </div>
          )}
        </>
      )}

      {/* ── Template (shared) ── */}
      <div className="form-section-title" style={{ marginTop: 16 }}>Message Template</div>
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
            {mode === 'group' && template !== 'custom' && (
              <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: 8, color: '#16a34a' }}>
                — personalized per facility
              </span>
            )}
          </div>
          <div style={{ fontSize: 13, color: '#111827', lineHeight: 1.6 }}>{preview}</div>
        </div>
      )}

      {/* Extra phones — single mode only */}
      {mode === 'single' && (
        <>
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
            disabled={sending || selectedNeedsPhone || (currentTemplate?.requiresFacility && !selectedFac && !extraPhones.length)}
          >
            {sending ? 'Sending…' : <><Send size={14} /> Send SMS</>}
          </button>
        ) : (
          <button
            className="btn btn--primary"
            onClick={handleBulkSend}
            disabled={sending || !recipientsWithPhone.length}
          >
            {sending
              ? `Sending ${sendProgress?.done ?? 0} / ${sendProgress?.total ?? recipientsWithPhone.length}…`
              : <><Send size={14} /> Send to {recipientsWithPhone.length} {recipientTypeLabel(groupSource, recipientsWithPhone.length)}</>
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
              <td className="facility-table__fileno">{log.facility_id || log.facility_name || '—'}</td>
              <td style={{ fontSize: 12 }}>{log.template}</td>
              <td style={{ fontSize: 12 }}>
                {(log.recipients ?? []).join(', ')}
                {log.recipient_statuses?.some((r) => r.status && r.status !== 'sent' && r.status !== 'success') && (
                  <div style={{ color: '#dc2626', fontSize: 11, marginTop: 2 }}>
                    {log.recipient_statuses
                      .filter((r) => r.status && r.status !== 'sent' && r.status !== 'success')
                      .map((r) => `${r.recipient}: ${r.status}${r.reason ? ` (${r.reason})` : ''}`)
                      .join(', ')
                    }
                  </div>
                )}
              </td>
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
