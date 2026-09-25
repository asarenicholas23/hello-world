import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Printer, Copy, Check, Plus, Trash2 } from 'lucide-react'
import { getFacility } from '../firebase/facilities'
import { listSubRecords } from '../firebase/subrecords'
import { buildScheduleDraft } from '../data/scheduleDraft'
import { fmtDate } from '../utils/records'

const SCHEDULE_CSS = `
  *,*::before,*::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; line-height: 1.5; color: #000; }
  @page { size: A4; margin: 20mm 18mm; }
  h1.rt { font-size: 14pt; font-weight: 700; text-align: center; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 18px; }
  h2.sh { font-size: 11.5pt; font-weight: 700; margin: 16px 0 6px; }
  h3.ssh { font-size: 11pt; font-weight: 700; margin: 10px 0 4px; }
  p { margin: 0 0 8px; text-align: justify; }
  ul { margin: 0 0 8px; padding-left: 20px; }
  li { margin-bottom: 4px; text-align: justify; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0 14px; font-size: 10pt; }
  th, td { border: 1px solid #999; padding: 5px 7px; vertical-align: top; text-align: left; }
  th { background: #f2f2f2; font-weight: 700; }
  .kv { margin-bottom: 10px; }
  .kv-row { display: flex; margin-bottom: 3px; }
  .kv-label { width: 190px; font-weight: 700; flex-shrink: 0; }
`

const NO_ROWS_FALLBACK = { impact: '—', source: '', management: [], remarks: '' }

function lines(text) {
  return String(text || '').split(/\n+/).map((s) => s.trim()).filter(Boolean)
}

function toText(arr) {
  return Array.isArray(arr) ? arr.join('\n') : (arr ?? '')
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}

function nl2br(s) {
  return escapeHtml(s).replace(/\n/g, '<br/>')
}

function bulletsHtml(items) {
  const list = (Array.isArray(items) ? items : lines(items)).filter(Boolean)
  if (!list.length) return ''
  return `<ul>${list.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>`
}

function kvHtml(rows) {
  return `<div class="kv">${rows.filter(([, v]) => v).map(([label, value]) =>
    `<div class="kv-row"><div class="kv-label">${escapeHtml(label)}</div><div>${escapeHtml(value)}</div></div>`).join('')}</div>`
}

function impactTableHtml(rows) {
  const body = (rows.length ? rows : [NO_ROWS_FALLBACK]).map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(r.impact)}</td>
      <td>${nl2br(r.source)}</td>
      <td>${bulletsHtml(r.management)}</td>
      <td>${escapeHtml(r.remarks)}</td>
    </tr>`).join('')
  return `<table><thead><tr><th>No.</th><th>Impact</th><th>Source</th><th>Management</th><th>Remarks / Timeline</th></tr></thead><tbody>${body}</tbody></table>`
}

function monitoringTableHtml(rows) {
  const body = rows.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(r.indicator)}</td>
      <td>${bulletsHtml(r.parameter)}</td>
      <td>${escapeHtml(r.frequency)}</td>
      <td>${escapeHtml(r.responsibility)}</td>
    </tr>`).join('')
  return `<table><thead><tr><th>No.</th><th>Indicator</th><th>Parameter</th><th>Frequency</th><th>Responsibility</th></tr></thead><tbody>${body}</tbody></table>`
}

function scheduleHtml(f) {
  return `
  <h1 class="rt">Schedule to the Environmental Permit</h1>

  <h2 class="sh">1.0&nbsp;&nbsp;Entity Profile</h2>
  ${kvHtml([
    ['Name of Entity', f.entityProfile.name],
    ['Address', f.entityProfile.address],
    ['Email Address', f.entityProfile.email],
    ['Contact No.', f.entityProfile.contactNo],
    ['Entity TIN', f.entityProfile.tin],
    ['Contact Person', f.entityProfile.contactPerson],
    ['Designation', f.entityProfile.designation],
    ['Type of Undertaking', f.entityProfile.typeOfUndertaking],
  ])}

  <h2 class="sh">2.0&nbsp;&nbsp;Permit Identification Details</h2>
  ${kvHtml([
    ['File No.', f.permitDetails.fileNo],
    ['Permit No.', f.permitDetails.permitNo],
    ['Date of Issue', f.permitDetails.dateOfIssue],
    ['Date of Expiry', f.permitDetails.dateOfExpiry],
    ['Effective Date', f.permitDetails.effectiveDate],
    ['Place of Issue', f.permitDetails.placeOfIssue],
  ])}

  <h2 class="sh">3.0&nbsp;&nbsp;Legal Basis for the Environmental Permit</h2>
  <p>${escapeHtml(f.legalBasis)}</p>

  <h2 class="sh">4.0&nbsp;&nbsp;Project Description</h2>
  <p>${escapeHtml(f.projectDescription)}</p>
  <h3 class="ssh">4.1&nbsp;&nbsp;Activity</h3>
  <p>${escapeHtml(f.activity)}</p>
  <h3 class="ssh">4.2&nbsp;&nbsp;Facilities</h3>
  ${bulletsHtml(f.facilitiesList) || '<p>—</p>'}
  <h3 class="ssh">4.3&nbsp;&nbsp;Location</h3>
  ${kvHtml([
    ['Location', f.location.line],
    ['Town', f.location.town],
    ['Landmark', f.location.landmark],
    ['District', f.location.district],
    ['Region', f.location.region],
    ['Geographical Coordinates', f.location.coordinates],
  ])}

  <h2 class="sh">5.0&nbsp;&nbsp;Environmental Impact and Management</h2>
  <p>Commit and comply with all mitigation/management measures identified in Form EA1 for the operational phase, as listed in table 5.1.1.</p>
  <h3 class="ssh">5.1.1&nbsp;&nbsp;Operational Phase</h3>
  ${impactTableHtml(f.impactRows)}
  ${f.additionalDirectives.length ? `<h3 class="ssh">Additional Directives</h3>${bulletsHtml(f.additionalDirectives)}` : ''}

  <h2 class="sh">6.0&nbsp;&nbsp;EPA Legal Requirements</h2>
  ${bulletsHtml(f.legalRequirements)}

  <h2 class="sh">7.0&nbsp;&nbsp;Compliance with Other Relevant Regulatory Requirements</h2>
  <h3 class="ssh">7.1&nbsp;&nbsp;Acts of Parliament</h3>
  ${bulletsHtml(f.actsOfParliament)}
  <h3 class="ssh">7.2&nbsp;&nbsp;Regulations</h3>
  ${bulletsHtml(f.regulationsList)}
  <h3 class="ssh">7.3&nbsp;&nbsp;Standards</h3>
  ${bulletsHtml(f.standardsList)}

  <h2 class="sh">8.0&nbsp;&nbsp;Environmental Monitoring</h2>
  <h3 class="ssh">8.1&nbsp;&nbsp;Operational Phase</h3>
  ${monitoringTableHtml(f.monitoringRows)}

  <h2 class="sh">9.0&nbsp;&nbsp;Environmental Reporting</h2>
  <p>${escapeHtml(f.environmentalReporting)}</p>

  <h2 class="sh">10.0&nbsp;&nbsp;Right of Entry</h2>
  <p>${escapeHtml(f.rightOfEntry)}</p>

  <h2 class="sh">11.0&nbsp;&nbsp;Notification</h2>
  <p>${escapeHtml(f.notificationChanges)}</p>

  <h2 class="sh">12.0&nbsp;&nbsp;Validity Period</h2>
  <p>${escapeHtml(f.validityPeriodText)}</p>
  <h3 class="ssh">12.1&nbsp;&nbsp;Renewal of Environmental Permit</h3>
  <p>${escapeHtml(f.renewal)}</p>
  <h3 class="ssh">12.2&nbsp;&nbsp;Permit Display</h3>
  <p>${escapeHtml(f.permitDisplay)}</p>
  <h3 class="ssh">12.3&nbsp;&nbsp;Permit Schedule Awareness</h3>
  <p>${escapeHtml(f.permitAwareness)}</p>
  <h3 class="ssh">12.4&nbsp;&nbsp;Permit Limitation</h3>
  <p>${escapeHtml(f.permitLimitation)}</p>
  <h3 class="ssh">12.5&nbsp;&nbsp;Complaint Management Mechanism</h3>
  <p>${escapeHtml(f.complaintManagement)}</p>
  <h3 class="ssh">12.6&nbsp;&nbsp;Community Relations, Consultation and Awareness Creation</h3>
  <p>${escapeHtml(f.communityRelations)}</p>
  <h3 class="ssh">12.7&nbsp;&nbsp;Revocation, Suspension and Cancellation of Permit</h3>
  <p>${escapeHtml(f.revocation)}</p>
  <h3 class="ssh">12.8&nbsp;&nbsp;Penalty for Breach of Conditions of Environmental Permit</h3>
  <p>${escapeHtml(f.penalty)}</p>

  <h2 class="sh">13.0&nbsp;&nbsp;Interpretations</h2>
  <p>${escapeHtml(f.interpretations)}</p>

  <h2 class="sh">14.0&nbsp;&nbsp;Notification</h2>
  ${bulletsHtml(f.notificationList)}
  `
}

function plainText(f) {
  const flat = [
    f.title, '',
    '1.0 ENTITY PROFILE',
    `Name of Entity: ${f.entityProfile.name}`,
    `Address: ${f.entityProfile.address}`,
    `Email: ${f.entityProfile.email}`,
    `Contact No.: ${f.entityProfile.contactNo}`,
    `Entity TIN: ${f.entityProfile.tin}`,
    `Contact Person: ${f.entityProfile.contactPerson}`,
    `Designation: ${f.entityProfile.designation}`,
    `Type of Undertaking: ${f.entityProfile.typeOfUndertaking}`,
    '',
    '2.0 PERMIT IDENTIFICATION DETAILS',
    `File No.: ${f.permitDetails.fileNo}`,
    `Permit No.: ${f.permitDetails.permitNo}`,
    `Date of Issue: ${f.permitDetails.dateOfIssue}`,
    `Date of Expiry: ${f.permitDetails.dateOfExpiry}`,
    `Effective Date: ${f.permitDetails.effectiveDate}`,
    `Place of Issue: ${f.permitDetails.placeOfIssue}`,
    '',
    '3.0 LEGAL BASIS', f.legalBasis, '',
    '4.0 PROJECT DESCRIPTION', f.projectDescription,
    '4.1 Activity', f.activity,
    '4.2 Facilities', ...lines(f.facilitiesList).map((l) => `• ${l}`),
    '4.3 Location',
    `Location: ${f.location.line}`, `Town: ${f.location.town}`, `District: ${f.location.district}`,
    `Region: ${f.location.region}`, `Coordinates: ${f.location.coordinates}`,
    '',
    '5.0 ENVIRONMENTAL IMPACT AND MANAGEMENT',
    ...f.impactRows.flatMap((r) => [
      `${r.impact} — Source: ${r.source.replace(/\n/g, ' ')} (${r.remarks})`,
      ...r.management.map((m) => `  - ${m}`),
    ]),
    f.additionalDirectives.length ? 'Additional Directives:' : '',
    ...f.additionalDirectives.map((d) => `• ${d}`),
    '',
    '6.0 EPA LEGAL REQUIREMENTS', ...f.legalRequirements.map((l) => `• ${l}`),
    '',
    '7.1 ACTS OF PARLIAMENT', ...f.actsOfParliament.map((l) => `• ${l}`),
    '7.2 REGULATIONS', ...f.regulationsList.map((l) => `• ${l}`),
    '7.3 STANDARDS', ...f.standardsList.map((l) => `• ${l}`),
    '',
    '8.0 ENVIRONMENTAL MONITORING',
    ...f.monitoringRows.flatMap((r) => [
      `${r.indicator} — ${r.frequency} (${r.responsibility})`,
      ...r.parameter.map((p) => `  - ${p}`),
    ]),
    '',
    '9.0 ENVIRONMENTAL REPORTING', f.environmentalReporting,
    '10.0 RIGHT OF ENTRY', f.rightOfEntry,
    '11.0 NOTIFICATION', f.notificationChanges,
    '12.0 VALIDITY PERIOD', f.validityPeriodText,
    '12.1 Renewal', f.renewal,
    '12.2 Permit Display', f.permitDisplay,
    '12.3 Permit Schedule Awareness', f.permitAwareness,
    '12.4 Permit Limitation', f.permitLimitation,
    '12.5 Complaint Management', f.complaintManagement,
    '12.6 Community Relations', f.communityRelations,
    '12.7 Revocation, Suspension and Cancellation', f.revocation,
    '12.8 Penalty', f.penalty,
    '13.0 INTERPRETATIONS', f.interpretations,
    '14.0 NOTIFICATION', ...f.notificationList.map((l) => `• ${l}`),
  ]
  return flat.filter((l) => l !== undefined && l !== '').join('\n')
}

// A minimal repeatable-row editor shared by the Impact/Management and
// Monitoring tables — `fields` describes each column as {key, label, type}
// where type is 'text' | 'textarea' | 'list' (list = one item per line).
function RowEditor({ rows, setRows, fields, addLabel }) {
  function update(i, key, value) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)))
  }
  function addRow() {
    const blank = Object.fromEntries(fields.map((f) => [f.key, f.type === 'list' ? [] : '']))
    setRows((prev) => [...prev, blank])
  }
  function removeRow(i) {
    setRows((prev) => prev.filter((_, idx) => idx !== i))
  }
  return (
    <div className="sched-table">
      {rows.map((row, i) => (
        <div className="sched-row" key={i}>
          <div className="sched-row__grid">
            {fields.map((f) => (
              <div className="form-group" key={f.key}>
                <label className="mrep-label">{f.label}</label>
                {f.type === 'text' && (
                  <input className="input" value={row[f.key] ?? ''} onChange={(e) => update(i, f.key, e.target.value)} />
                )}
                {f.type === 'textarea' && (
                  <textarea className="input textarea" rows={2} value={row[f.key] ?? ''} onChange={(e) => update(i, f.key, e.target.value)} />
                )}
                {f.type === 'list' && (
                  <textarea className="input textarea" rows={3}
                    value={toText(row[f.key])}
                    onChange={(e) => update(i, f.key, e.target.value.split('\n'))}
                    placeholder="One item per line" />
                )}
              </div>
            ))}
          </div>
          <button type="button" className="btn btn--ghost btn--xs btn--danger" onClick={() => removeRow(i)}>
            <Trash2 size={12} /> Remove row
          </button>
        </div>
      ))}
      <button type="button" className="btn btn--ghost btn--sm" onClick={addRow}>
        <Plus size={14} /> {addLabel}
      </button>
    </div>
  )
}

const IMPACT_FIELDS = [
  { key: 'impact', label: 'Impact', type: 'text' },
  { key: 'source', label: 'Source', type: 'textarea' },
  { key: 'management', label: 'Management (one per line)', type: 'list' },
  { key: 'remarks', label: 'Remarks / Timeline', type: 'text' },
]

const MONITORING_FIELDS = [
  { key: 'indicator', label: 'Indicator', type: 'text' },
  { key: 'parameter', label: 'Parameter (one per line)', type: 'list' },
  { key: 'frequency', label: 'Frequency', type: 'text' },
  { key: 'responsibility', label: 'Responsibility', type: 'text' },
]

export default function ScheduleModal({ permit, facility: facilityProp, fileNumber, onClose }) {
  const [facility, setFacility] = useState(facilityProp ?? null)
  const [screening, setScreening] = useState(null)
  const [loadingContext, setLoadingContext] = useState(!facilityProp)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  useEffect(() => {
    let alive = true
    Promise.all([
      facilityProp ? Promise.resolve(facilityProp) : getFacility(fileNumber).catch(() => null),
      listSubRecords(fileNumber, 'screenings').catch(() => []),
    ]).then(([fac, screenings]) => {
      if (!alive) return
      if (fac) setFacility(fac)
      const latest = [...screenings].sort((a, b) => (b.date?.seconds ?? 0) - (a.date?.seconds ?? 0))[0] ?? null
      setScreening(latest)
      setLoadingContext(false)
    })
    return () => { alive = false }
  }, [fileNumber, facilityProp])

  const draft = useMemo(() => buildScheduleDraft(permit, facility, screening), [permit, facility, screening])

  const [form, setForm] = useState(draft)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setForm(draft) }, [draft])

  function set(key, value) { setForm((p) => ({ ...p, [key]: value })) }
  function setEntity(key, value) { setForm((p) => ({ ...p, entityProfile: { ...p.entityProfile, [key]: value } })) }
  function setPermitDetail(key, value) { setForm((p) => ({ ...p, permitDetails: { ...p.permitDetails, [key]: value } })) }
  function setLocation(key, value) { setForm((p) => ({ ...p, location: { ...p.location, [key]: value } })) }
  function setImpactRows(updater) { setForm((p) => ({ ...p, impactRows: typeof updater === 'function' ? updater(p.impactRows) : updater })) }
  function setMonitoringRows(updater) { setForm((p) => ({ ...p, monitoringRows: typeof updater === 'function' ? updater(p.monitoringRows) : updater })) }

  const printable = {
    ...form,
    facilitiesList: lines(toText(form.facilitiesList)),
    additionalDirectives: lines(toText(form.additionalDirectives)),
    legalRequirements: lines(toText(form.legalRequirements)),
    actsOfParliament: lines(toText(form.actsOfParliament)),
    regulationsList: lines(toText(form.regulationsList)),
    standardsList: lines(toText(form.standardsList)),
    notificationList: lines(toText(form.notificationList)),
  }

  function handlePrint() {
    const win = window.open('', '_blank', 'width=900,height=760')
    if (!win) { alert('Please allow pop-ups for this site to print.'); return }
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Schedule — ${escapeHtml(facility?.name ?? fileNumber ?? '')}</title>
<style>${SCHEDULE_CSS}</style></head><body>${scheduleHtml(printable)}</body></html>`)
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

  return createPortal(
    <div className="doc-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="doc-modal" role="dialog" aria-modal="true">
        <div className="doc-modal-toolbar">
          <span className="doc-modal-toolbar__title">Generate Schedule</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn--ghost btn--sm" onClick={handleCopy} title="Copy schedule text">
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
              {loadingContext
                ? 'Loading facility and screening data…'
                : 'Draft generated from the facility profile, this permit, and the facility’s latest screening record — edit any section below, then Print / PDF or Copy text.'}
            </p>

            <div className="mrep-sec">1.0 Entity Profile</div>
            <div className="form-row">
              <div className="form-group"><label className="mrep-label">Name of Entity</label>
                <input className="input" value={form.entityProfile.name} onChange={(e) => setEntity('name', e.target.value)} /></div>
              <div className="form-group"><label className="mrep-label">Type of Undertaking</label>
                <input className="input" value={form.entityProfile.typeOfUndertaking} onChange={(e) => setEntity('typeOfUndertaking', e.target.value)} /></div>
            </div>
            <div className="form-group"><label className="mrep-label">Address</label>
              <input className="input" value={form.entityProfile.address} onChange={(e) => setEntity('address', e.target.value)} /></div>
            <div className="form-row">
              <div className="form-group"><label className="mrep-label">Email Address</label>
                <input className="input" value={form.entityProfile.email} onChange={(e) => setEntity('email', e.target.value)} /></div>
              <div className="form-group"><label className="mrep-label">Contact No.</label>
                <input className="input" value={form.entityProfile.contactNo} onChange={(e) => setEntity('contactNo', e.target.value)} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="mrep-label">Entity TIN</label>
                <input className="input" value={form.entityProfile.tin} onChange={(e) => setEntity('tin', e.target.value)} /></div>
              <div className="form-group"><label className="mrep-label">Contact Person</label>
                <input className="input" value={form.entityProfile.contactPerson} onChange={(e) => setEntity('contactPerson', e.target.value)} /></div>
            </div>
            <div className="form-group"><label className="mrep-label">Designation</label>
              <input className="input" value={form.entityProfile.designation} onChange={(e) => setEntity('designation', e.target.value)} /></div>

            <div className="mrep-sec">2.0 Permit Identification Details</div>
            <div className="form-row">
              <div className="form-group"><label className="mrep-label">File No.</label>
                <input className="input" value={form.permitDetails.fileNo} onChange={(e) => setPermitDetail('fileNo', e.target.value)} /></div>
              <div className="form-group"><label className="mrep-label">Permit No.</label>
                <input className="input" value={form.permitDetails.permitNo} onChange={(e) => setPermitDetail('permitNo', e.target.value)} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="mrep-label">Date of Issue</label>
                <input className="input" value={form.permitDetails.dateOfIssue} onChange={(e) => setPermitDetail('dateOfIssue', e.target.value)} /></div>
              <div className="form-group"><label className="mrep-label">Effective Date</label>
                <input className="input" value={form.permitDetails.effectiveDate} onChange={(e) => setPermitDetail('effectiveDate', e.target.value)} /></div>
              <div className="form-group"><label className="mrep-label">Date of Expiry</label>
                <input className="input" value={form.permitDetails.dateOfExpiry} onChange={(e) => setPermitDetail('dateOfExpiry', e.target.value)} /></div>
            </div>
            <div className="form-group"><label className="mrep-label">Place of Issue</label>
              <input className="input" value={form.permitDetails.placeOfIssue} onChange={(e) => setPermitDetail('placeOfIssue', e.target.value)} /></div>

            <div className="mrep-sec">3.0 Legal Basis for the Environmental Permit</div>
            <textarea className="input textarea" rows={4} value={form.legalBasis} onChange={(e) => set('legalBasis', e.target.value)} />

            <div className="mrep-sec">4.0 Project Description</div>
            <textarea className="input textarea" rows={3} value={form.projectDescription} onChange={(e) => set('projectDescription', e.target.value)} />
            <label className="mrep-label">4.1 Activity</label>
            <input className="input" value={form.activity} onChange={(e) => set('activity', e.target.value)} />
            <label className="mrep-label">4.2 Facilities <span className="mrep-label__hint">· one item per line</span></label>
            <textarea className="input textarea" rows={4} value={toText(form.facilitiesList)} onChange={(e) => set('facilitiesList', e.target.value)} />

            <label className="mrep-label">4.3 Location</label>
            <div className="form-row">
              <div className="form-group"><label className="mrep-label">Location / Plot</label>
                <input className="input" value={form.location.line} onChange={(e) => setLocation('line', e.target.value)} /></div>
              <div className="form-group"><label className="mrep-label">Town</label>
                <input className="input" value={form.location.town} onChange={(e) => setLocation('town', e.target.value)} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="mrep-label">District</label>
                <input className="input" value={form.location.district} onChange={(e) => setLocation('district', e.target.value)} /></div>
              <div className="form-group"><label className="mrep-label">Region</label>
                <input className="input" value={form.location.region} onChange={(e) => setLocation('region', e.target.value)} /></div>
              <div className="form-group"><label className="mrep-label">Coordinates</label>
                <input className="input" value={form.location.coordinates} onChange={(e) => setLocation('coordinates', e.target.value)} /></div>
            </div>

            <div className="mrep-sec">5.0 Environmental Impact and Management <span>· 5.1.1 Operational Phase</span></div>
            <RowEditor rows={form.impactRows} setRows={setImpactRows} fields={IMPACT_FIELDS} addLabel="Add impact row" />
            <label className="mrep-label">Additional Directives <span className="mrep-label__hint">· one per line</span></label>
            <textarea className="input textarea" rows={3} value={toText(form.additionalDirectives)} onChange={(e) => set('additionalDirectives', e.target.value)} />

            <div className="mrep-sec">8.0 Environmental Monitoring <span>· 8.1 Operational Phase</span></div>
            <RowEditor rows={form.monitoringRows} setRows={setMonitoringRows} fields={MONITORING_FIELDS} addLabel="Add monitoring row" />

            <div className="mrep-sec">12.0 Validity Period</div>
            <textarea className="input textarea" rows={2} value={form.validityPeriodText} onChange={(e) => set('validityPeriodText', e.target.value)} />

            <details className="sched-details">
              <summary>Standard Clauses (6.0, 7.0, 9.0 – 14.0) — usually don&apos;t need editing</summary>

              <label className="mrep-label">6.0 EPA Legal Requirements <span className="mrep-label__hint">· one per line</span></label>
              <textarea className="input textarea" rows={4} value={toText(form.legalRequirements)} onChange={(e) => set('legalRequirements', e.target.value)} />

              <label className="mrep-label">7.1 Acts of Parliament</label>
              <textarea className="input textarea" rows={3} value={toText(form.actsOfParliament)} onChange={(e) => set('actsOfParliament', e.target.value)} />
              <label className="mrep-label">7.2 Regulations</label>
              <textarea className="input textarea" rows={3} value={toText(form.regulationsList)} onChange={(e) => set('regulationsList', e.target.value)} />
              <label className="mrep-label">7.3 Standards</label>
              <textarea className="input textarea" rows={3} value={toText(form.standardsList)} onChange={(e) => set('standardsList', e.target.value)} />

              <label className="mrep-label">9.0 Environmental Reporting</label>
              <textarea className="input textarea" rows={2} value={form.environmentalReporting} onChange={(e) => set('environmentalReporting', e.target.value)} />
              <label className="mrep-label">10.0 Right of Entry</label>
              <textarea className="input textarea" rows={3} value={form.rightOfEntry} onChange={(e) => set('rightOfEntry', e.target.value)} />
              <label className="mrep-label">11.0 Notification (Changes to the Project)</label>
              <textarea className="input textarea" rows={3} value={form.notificationChanges} onChange={(e) => set('notificationChanges', e.target.value)} />
              <label className="mrep-label">12.1 Renewal of Environmental Permit</label>
              <textarea className="input textarea" rows={3} value={form.renewal} onChange={(e) => set('renewal', e.target.value)} />
              <label className="mrep-label">12.2 Permit Display</label>
              <textarea className="input textarea" rows={2} value={form.permitDisplay} onChange={(e) => set('permitDisplay', e.target.value)} />
              <label className="mrep-label">12.3 Permit Schedule Awareness</label>
              <textarea className="input textarea" rows={2} value={form.permitAwareness} onChange={(e) => set('permitAwareness', e.target.value)} />
              <label className="mrep-label">12.4 Permit Limitation</label>
              <textarea className="input textarea" rows={2} value={form.permitLimitation} onChange={(e) => set('permitLimitation', e.target.value)} />
              <label className="mrep-label">12.5 Complaint Management Mechanism</label>
              <textarea className="input textarea" rows={2} value={form.complaintManagement} onChange={(e) => set('complaintManagement', e.target.value)} />
              <label className="mrep-label">12.6 Community Relations, Consultation and Awareness Creation</label>
              <textarea className="input textarea" rows={2} value={form.communityRelations} onChange={(e) => set('communityRelations', e.target.value)} />
              <label className="mrep-label">12.7 Revocation, Suspension and Cancellation of Permit</label>
              <textarea className="input textarea" rows={3} value={form.revocation} onChange={(e) => set('revocation', e.target.value)} />
              <label className="mrep-label">12.8 Penalty for Breach of Conditions</label>
              <textarea className="input textarea" rows={3} value={form.penalty} onChange={(e) => set('penalty', e.target.value)} />
              <label className="mrep-label">13.0 Interpretations</label>
              <textarea className="input textarea" rows={3} value={form.interpretations} onChange={(e) => set('interpretations', e.target.value)} />
              <label className="mrep-label">14.0 Notification (distribution list) <span className="mrep-label__hint">· one per line</span></label>
              <textarea className="input textarea" rows={3} value={toText(form.notificationList)} onChange={(e) => set('notificationList', e.target.value)} />
            </details>

            <div className="mrep-hint" style={{ marginTop: 4 }}>
              Environmental Protection Authority – Konongo Area Office · {fmtDate(permit?.issue_date)}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
