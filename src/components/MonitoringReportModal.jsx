import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Printer, Copy, Check } from 'lucide-react'
import { getFacility } from '../firebase/facilities'
import { buildMonitoringReportDraft } from '../data/monitoringReportDraft'
import { fmtDate } from '../utils/records'

const LETTER_CSS = `
  *,*::before,*::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Times New Roman', Georgia, serif; font-size: 12pt; line-height: 1.5; color: #000; }
  @page { size: A4; margin: 22mm 20mm; }
  .lh { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 16px; }
  .lh__org { font-size: 12pt; font-weight: 700; text-transform: uppercase; letter-spacing: .3px; }
  .lh__office { font-size: 10pt; color: #333; margin-top: 2px; }
  h1.rt { font-size: 12.5pt; font-weight: 700; text-transform: uppercase; text-align: center; margin: 14px 0 4px; }
  .to { white-space: pre-line; margin: 14px 0; }
  h2.sh { font-size: 12pt; font-weight: 700; margin: 16px 0 6px; }
  h3.ssh { font-size: 11.5pt; font-weight: 700; margin: 10px 0 4px; }
  p { margin: 0 0 10px; text-align: justify; }
  ul { margin: 0 0 12px; padding-left: 22px; }
  li { margin-bottom: 8px; text-align: justify; }
  .sig { margin-top: 28px; white-space: pre-line; }
  .sig__name { font-weight: 700; margin-top: 22px; }
`

const NO_STRENGTHS_FALLBACK = 'No specific positive practices were separately recorded for this visit.'
const NO_CONCERNS_FALLBACK = 'No non-compliance issues were observed during this visit.'

function lines(text) {
  return String(text || '').split(/\n+/).map((s) => s.trim()).filter(Boolean)
}

function bulletList(text, fallback) {
  const items = lines(text)
  return items.length ? items : [fallback]
}

function reportHtml(f) {
  const strengths = bulletList(f.strengths, NO_STRENGTHS_FALLBACK).map((l) => `<li>${escapeHtml(l)}</li>`).join('')
  const concerns = bulletList(f.concerns, NO_CONCERNS_FALLBACK).map((l) => `<li>${escapeHtml(l)}</li>`).join('')
  const recs = lines(f.recommendations).map((l) => `<li>${escapeHtml(l)}</li>`).join('')
  const intro = [f.introduction, f.complianceLine].filter(Boolean)
    .map((p) => `<p>${escapeHtml(p)}</p>`).join('')
  const team = (f.team || []).filter((n) => n && n !== f.signatory)
  return `
  <div class="lh">
    <div class="lh__org">Environmental Protection Authority</div>
    <div class="lh__office">Konongo Area Office &middot; P. O. Box CG 317, Konongo &middot; Ashanti Region</div>
  </div>
  <h1 class="rt">${escapeHtml(f.title)}</h1>
  <div class="to">To: ${escapeHtml(f.recipient)}</div>
  <h2 class="sh">1.0&nbsp;&nbsp;Introduction</h2>
  ${intro}
  <h2 class="sh">2.0&nbsp;&nbsp;Observations</h2>
  ${f.notesParagraph ? `<p>${escapeHtml(f.notesParagraph)}</p>` : ''}
  <h3 class="ssh">2.1&nbsp;&nbsp;Positive Practices Observed</h3>
  <ul>${strengths}</ul>
  <h3 class="ssh">2.2&nbsp;&nbsp;Areas Requiring Attention</h3>
  <ul>${concerns}</ul>
  <h2 class="sh">3.0&nbsp;&nbsp;Recommendations</h2>
  <p>The following recommendations are to be implemented prior to the next monitoring visit:</p>
  <ul>${recs}</ul>
  <div class="sig">Signed:
<span class="sig__name">${escapeHtml(f.signatory || '.................................')}</span>
${escapeHtml(f.signatoryTitle)}
Environmental Protection Authority – Konongo Area Office${team.length ? `\n\nAccompanying officer(s): ${escapeHtml(team.join(', '))}` : ''}</div>
  `
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}

function plainText(f) {
  return [
    'ENVIRONMENTAL PROTECTION AUTHORITY – KONONGO AREA OFFICE',
    f.title,
    '',
    `To: ${f.recipient}`,
    '',
    '1.0 Introduction',
    f.introduction,
    f.complianceLine,
    '',
    '2.0 Observations',
    f.notesParagraph,
    '',
    '2.1 Positive Practices Observed',
    ...bulletList(f.strengths, NO_STRENGTHS_FALLBACK).map((l) => `• ${l}`),
    '',
    '2.2 Areas Requiring Attention',
    ...bulletList(f.concerns, NO_CONCERNS_FALLBACK).map((l) => `• ${l}`),
    '',
    '3.0 Recommendations',
    'The following recommendations are to be implemented prior to the next monitoring visit:',
    ...lines(f.recommendations).map((l) => `• ${l}`),
    '',
    'Signed:',
    f.signatory,
    f.signatoryTitle,
    'Environmental Protection Authority – Konongo Area Office',
  ].filter((l) => l !== undefined && l !== '').join('\n')
}

export default function MonitoringReportModal({ record, facility: facilityProp, fileNumber, onClose }) {
  const [facility, setFacility] = useState(facilityProp ?? null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  useEffect(() => {
    if (facilityProp || !fileNumber) return
    getFacility(fileNumber).then(setFacility).catch(() => {})
  }, [fileNumber, facilityProp])

  const draft = useMemo(() => buildMonitoringReportDraft(record, facility), [record, facility])

  // Re-seed the editable form whenever the generated draft changes — e.g. when
  // the facility record finishes loading and fills in name / location.
  const [form, setForm] = useState(draft)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setForm(draft) }, [draft])

  function set(key, value) { setForm((p) => ({ ...p, [key]: value })) }

  const toText = (v) => (Array.isArray(v) ? v.join('\n') : (v ?? ''))
  const printable = {
    ...form,
    strengths: toText(form.strengths),
    concerns: toText(form.concerns),
    recommendations: toText(form.recommendations),
  }

  function handlePrint() {
    const win = window.open('', '_blank', 'width=900,height=760')
    if (!win) { alert('Please allow pop-ups for this site to print.'); return }
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Compliance Monitoring Report — ${escapeHtml(facility?.name ?? fileNumber ?? '')}</title>
<style>${LETTER_CSS}</style></head><body>${reportHtml(printable)}</body></html>`)
    win.document.close()
    win.onload = () => setTimeout(() => win.print(), 200)
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(plainText(printable))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      alert('Could not copy to clipboard.')
    }
  }

  const strengthsText = toText(form.strengths)
  const concernsText = toText(form.concerns)
  const recText = toText(form.recommendations)

  return createPortal(
    <div className="doc-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="doc-modal" role="dialog" aria-modal="true">
        <div className="doc-modal-toolbar">
          <span className="doc-modal-toolbar__title">Generate Monitoring Report</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn--ghost btn--sm" onClick={handleCopy} title="Copy report text">
              {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy text</>}
            </button>
            <button className="btn btn--ghost btn--sm" onClick={handlePrint} title="Print or save as PDF">
              <Printer size={14} /> Print / PDF
            </button>
            <button className="btn btn--ghost btn--sm" onClick={onClose} title="Close">
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="doc-modal-scroll">
          <div className="doc-paper">
            <div className="doc-paper-header">
              <div className="doc-paper-header__org">ENVIRONMENTAL PROTECTION AUTHORITY</div>
              <div className="doc-paper-header__office">Konongo Area Office · Ashanti Region</div>
            </div>

            <p className="mrep-hint">
              Draft generated from the monitoring checklist — edit any section below, then Print / PDF or Copy text.
            </p>

            <label className="mrep-label">Report title</label>
            <input className="input" value={form.title ?? ''} onChange={(e) => set('title', e.target.value)} />

            <label className="mrep-label">To</label>
            <textarea className="input textarea" rows={2} value={form.recipient ?? ''}
              onChange={(e) => set('recipient', e.target.value)} />

            <div className="mrep-sec">1.0 Introduction</div>
            <textarea className="input textarea" rows={5} value={form.introduction ?? ''}
              onChange={(e) => set('introduction', e.target.value)} />
            <label className="mrep-label">Compliance summary line (optional)</label>
            <textarea className="input textarea" rows={2} value={form.complianceLine ?? ''}
              onChange={(e) => set('complianceLine', e.target.value)} />

            <div className="mrep-sec">2.0 Observations</div>
            <label className="mrep-label">General notes (optional lead-in paragraph)</label>
            <textarea className="input textarea" rows={2} value={form.notesParagraph ?? ''}
              onChange={(e) => set('notesParagraph', e.target.value)} />

            <label className="mrep-label">2.1 Positive Practices Observed <span className="mrep-label__hint">· one bullet per line · what the facility is doing well</span></label>
            <textarea className="input textarea mrep-textarea--good" rows={6} value={strengthsText}
              onChange={(e) => set('strengths', e.target.value)}
              placeholder="e.g. Waste bins were colour-coded and appropriately placed across the facility." />

            <label className="mrep-label">2.2 Areas Requiring Attention <span className="mrep-label__hint">· one bullet per line</span></label>
            <textarea className="input textarea mrep-textarea--bad" rows={6} value={concernsText}
              onChange={(e) => set('concerns', e.target.value)} />

            <div className="mrep-sec">3.0 Recommendations <span>· one bullet per line</span></div>
            <textarea className="input textarea" rows={8} value={recText}
              onChange={(e) => set('recommendations', e.target.value)} />

            <div className="mrep-sec">Signed</div>
            <div className="form-row">
              <div className="form-group">
                <label className="mrep-label">Name</label>
                <input className="input" value={form.signatory ?? ''} onChange={(e) => set('signatory', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="mrep-label">Title</label>
                <input className="input" value={form.signatoryTitle ?? ''} onChange={(e) => set('signatoryTitle', e.target.value)} />
              </div>
            </div>
            <div className="mrep-hint" style={{ marginTop: 4 }}>
              Environmental Protection Authority – Konongo Area Office · {fmtDate(record?.date)}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
