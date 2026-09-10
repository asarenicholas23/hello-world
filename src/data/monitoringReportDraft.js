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
  const bandTone = rate == null ? ''
    : rate >= 80 ? ' reflecting a strong level of compliance with the facility’s permit conditions.'
    : rate >= 60 ? ' reflecting a reasonable level of compliance, with some areas requiring improvement.'
    : rate >= 40 ? ' indicating several areas of non-compliance that require corrective action.'
    : ' indicating significant non-compliance that requires urgent corrective action.'
  const complianceLine = rate == null
    ? ''
    : `At this visit the facility recorded an overall compliance score of ${rate}%${band ? ` (${band})` : ''}` +
      (applicable ? `, based on ${compliant} of ${applicable} applicable checklist items,` : ',') + bandTone

  // officer's free-text overall observations, kept as a short lead-in paragraph
  const notesParagraph = String(record.notes || '').split(/\n+/).map((s) => s.trim()).filter(Boolean).join(' ')

  // ── Observations, split into what's going well and what isn't ─────
  // (a single "all the things that are wrong" list reads as entirely
  // negative — pulling out compliant items and fully-compliant sections
  // gives credit for the facility's good practices too)
  const strengths = []
  const concerns = []
  const seenS = new Set()
  const seenC = new Set()
  const addTo = (arr, seen, line) => {
    const t = String(line || '').trim()
    if (t && !seen.has(t.toLowerCase())) { seen.add(t.toLowerCase()); arr.push(t) }
  }

  for (const section of checklist?.sections ?? []) {
    let yesCount = 0
    let noCount = 0
    // Yes items with no remark: held back per-section so a fully-compliant
    // section gets one summary line instead of one generic line per item.
    const unremarkedYes = []
    for (const item of section.items) {
      if (item.type === 'text' || item.type === 'select' || item.conditional) continue
      const answer = record[item.key]
      const remark = String(record[`${item.key}_remark`] || '').trim()
      if (answer === 'Yes') {
        yesCount++
        if (remark) addTo(strengths, seenS, remark)
        else unremarkedYes.push(`${item.label} was confirmed in place.`)
      } else if (answer === 'No') {
        noCount++
        addTo(concerns, seenC, remark || `${item.label} — found not to be in place / non-compliant at the time of the visit.`)
      }
    }
    const applicableInSection = yesCount + noCount
    if (applicableInSection >= 2 && noCount === 0) {
      // Commend sections the facility got fully right, even where no remark was left
      const sectionLabel = section.title.replace(/^[A-Z]:\s*/, '')
      addTo(strengths, seenS, `Full compliance was observed under ${sectionLabel} — all ${applicableInSection} applicable items were met.`)
    } else {
      // Mixed or partial section — still credit each compliant item individually,
      // so a facility with scattered gaps (rather than one weak section) still
      // gets its passing items acknowledged.
      unremarkedYes.forEach((line) => addTo(strengths, seenS, line))
    }
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
    notesParagraph,
    strengths,
    concerns,
    recommendations,
    signatory: officer || '',
    signatoryTitle: 'Lead Monitoring Officer',
    team,
    dateStr,
  }
}
