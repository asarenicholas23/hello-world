// Build a narrative "Compliance Monitoring Report" draft from a monitoring
// checklist record — the letter-style report officers send to a facility.
//
// The draft is a starting point: the modal lets the officer edit every
// section before printing.

import { MONITORING_CHECKLISTS, computeCompliance, complianceBand, suggestedRecommendations } from './monitoringChecklists'
import { fmtDate } from '../utils/records'
import { DISTRICTS } from './constants'

function districtName(code) {
  return DISTRICTS.find((d) => d.code === code)?.name ?? code ?? ''
}

function recText(r) {
  return typeof r === 'string' ? r : (r?.text ?? '')
}

export function buildMonitoringReportDraft(record = {}, facility = null) {
  const name = facility?.name || record.facility_name || record.file_number || 'the facility'
  const location = record.location
    || facility?.location
    || districtName(record.municipality_district || facility?.district)
    || ''
  const dateStr = fmtDate(record.date) || 'the date of the visit'
  const permitNo = (record.epa_permit_number || '').trim()
  const officer = record.officer_name || ''
  const team = Array.isArray(record.officer_team) ? record.officer_team.map((o) => o.name).filter(Boolean) : []

  // ── Introduction ──────────────────────────────────────────
  const whoClause = team.length
    ? `officers of the Environmental Protection Authority (EPA), Konongo Area Office`
    : `an officer of the Environmental Protection Authority (EPA), Konongo Area Office`
  const permitClause = permitNo
    ? ` its EPA permit (Permit No. ${permitNo})`
    : ' its EPA permit'
  const introduction =
    `A compliance monitoring exercise was conducted at ${name}${location ? `, ${location}` : ''} on ${dateStr} by ${whoClause}. ` +
    `The exercise was carried out in accordance with Sections 32 and 33 of the Environmental Protection Act, 2025 (Act 1124), ` +
    `to assess the facility's level of compliance with the conditions of${permitClause} and relevant environmental regulations. ` +
    `This report presents the findings of that exercise and the recommendations the facility is expected to implement prior to the next monitoring visit.`

  // ── Compliance score line ─────────────────────────────────
  const checklist = record.sector_prefix ? MONITORING_CHECKLISTS[record.sector_prefix] : null
  let applicable = record.compliance_applicable
  let compliant = record.compliance_compliant
  let rate = record.compliance_rate
  if (rate == null && checklist) {
    const c = computeCompliance(checklist, record)
    applicable = c.applicable; compliant = c.compliant; rate = c.rate
  }
  const band = rate == null ? null : (record.compliance_status || complianceBand(rate)?.label)
  const complianceLine = rate == null
    ? ''
    : `At this visit the facility recorded an overall compliance score of ${rate}%${band ? ` (${band})` : ''}` +
      (applicable ? `, based on ${compliant} of ${applicable} applicable checklist items.` : '.')

  // ── Observations ──────────────────────────────────────────
  const observations = []
  const seen = new Set()
  const add = (line) => {
    const t = String(line || '').trim()
    if (t && !seen.has(t.toLowerCase())) { seen.add(t.toLowerCase()); observations.push(t) }
  }

  // officer's free-text overall observations, split into bullets
  String(record.notes || '').split(/\n+/).forEach(add)

  // per-item remarks + non-compliant items
  for (const section of checklist?.sections ?? []) {
    for (const item of section.items) {
      if (item.type === 'text' || item.type === 'select' || item.conditional) continue
      const answer = record[item.key]
      const remark = String(record[`${item.key}_remark`] || '').trim()
      if (answer === 'No') {
        add(remark || `${item.label} — found not to be in place / non-compliant at the time of the visit.`)
      } else if (remark) {
        add(`${item.label}: ${remark}`)
      }
    }
  }

  if (observations.length === 0) {
    add('No significant environmental concerns were observed at the time of the visit.')
  }

  // ── Recommendations ───────────────────────────────────────
  let recommendations = (Array.isArray(record.recommendations) ? record.recommendations : [])
    .map(recText)
    .map((s) => s.trim())
    .filter(Boolean)

  if (recommendations.length === 0 && checklist) {
    recommendations = suggestedRecommendations(checklist, record).map((s) => s.text)
  }
  if (record.corrective_timeline) {
    recommendations.push(`The corrective actions above should be completed within: ${record.corrective_timeline}.`)
  }
  if (record.follow_up_date) {
    recommendations.push(`A follow-up monitoring visit is scheduled for ${fmtDate(record.follow_up_date)}.`)
  }
  if (recommendations.length === 0) {
    recommendations = ['Maintain current environmental management practices and keep all records up to date ahead of the next monitoring visit.']
  }

  return {
    recipient: `The Environmental Officer\n${name}${location ? `, ${location}` : ''}`,
    title: `COMPLIANCE MONITORING REPORT – ${name.toUpperCase()}${location ? `, ${location.toUpperCase()}` : ''}`,
    introduction,
    complianceLine,
    observations,
    recommendations,
    signatory: officer || '',
    signatoryTitle: 'Lead Monitoring Officer',
    team,
    dateStr,
  }
}
