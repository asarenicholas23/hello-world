// Facility compliance scoring — derived from monitoring visits.
//
// A facility's "current compliance" is the compliance rate of its most recent
// monitoring visit. The rate (0–100) is the share of applicable checklist
// items marked Yes; see computeCompliance() in monitoringChecklists.js.

import {
  MONITORING_CHECKLISTS, computeCompliance, complianceBand, COMPLIANCE_BANDS,
} from './monitoringChecklists'

export { COMPLIANCE_BANDS, complianceBand }

// Soft background / text tints per band, for chips and bars.
export const BAND_TINT = {
  Excellent: { bg: '#dcfce7', text: '#166534' },
  Good:      { bg: '#e8f0d8', text: '#3f6212' },
  Fair:      { bg: '#fef3c7', text: '#92400e' },
  Poor:      { bg: '#fee2e2', text: '#991b1b' },
}

export const BAND_ORDER = ['Excellent', 'Good', 'Fair', 'Poor']

function toMs(ts) {
  if (!ts) return 0
  if (typeof ts.toMillis === 'function') return ts.toMillis()
  if (ts.seconds != null) return ts.seconds * 1000
  const t = new Date(ts).getTime()
  return Number.isNaN(t) ? 0 : t
}

// Compliance rate for a single monitoring record — prefers the snapshot saved
// with the record, otherwise recomputes from the stored answers.
export function recordComplianceRate(rec) {
  if (rec?.compliance_rate != null && rec.compliance_rate !== '') {
    const n = Number(rec.compliance_rate)
    return Number.isFinite(n) ? n : null
  }
  const cl = rec?.sector_prefix ? MONITORING_CHECKLISTS[rec.sector_prefix] : null
  if (!cl) return null
  return computeCompliance(cl, rec).rate
}

/**
 * Reduce joined monitoring rows to one compliance row per facility, using each
 * facility's latest scored visit.
 *
 * @param monitoringRows rows from getCrossRecords('monitoring', facilityMap) —
 *   each carries fileNumber, facilityName, sectorPrefix, facilityDistrict + the
 *   monitoring record fields.
 * @returns [{ fileNumber, facilityName, sectorPrefix, district, rate, band,
 *   bandColor, lastVisit, visits }] sorted by rate desc.
 */
export function facilityComplianceRows(monitoringRows) {
  const latest = new Map()
  const counts = new Map()
  for (const r of monitoringRows) {
    counts.set(r.fileNumber, (counts.get(r.fileNumber) || 0) + 1)
    const t = toMs(r.date) || toMs(r.created_at)
    const cur = latest.get(r.fileNumber)
    if (!cur || t >= cur._t) latest.set(r.fileNumber, { ...r, _t: t })
  }

  const rows = []
  for (const r of latest.values()) {
    const rate = recordComplianceRate(r)
    if (rate == null) continue
    const band = complianceBand(rate)
    rows.push({
      fileNumber:   r.fileNumber,
      facilityName: r.facilityName ?? r.fileNumber,
      sectorPrefix: r.sectorPrefix ?? r.sector_prefix ?? '',
      district:     r.facilityDistrict ?? r.district ?? '',
      rate,
      band:         band?.label ?? null,
      bandColor:    band?.color ?? '#9ca3af',
      lastVisit:    r.date ?? null,
      visits:       counts.get(r.fileNumber) || 1,
    })
  }
  return rows.sort((a, b) => b.rate - a.rate)
}

export function summarizeCompliance(rows) {
  const byBand = { Excellent: 0, Good: 0, Fair: 0, Poor: 0 }
  let sum = 0
  for (const r of rows) {
    if (r.band) byBand[r.band] = (byBand[r.band] || 0) + 1
    sum += r.rate
  }
  return {
    total: rows.length,
    avg:   rows.length ? Math.round(sum / rows.length) : null,
    byBand,
    best:  rows[0] ?? null,
    worst: rows.length ? rows[rows.length - 1] : null,
  }
}

// Average compliance rate per sector prefix → [{ sector, avg, count, band, color }]
export function complianceBySector(rows) {
  const acc = new Map()
  for (const r of rows) {
    const a = acc.get(r.sectorPrefix) ?? { sum: 0, count: 0 }
    a.sum += r.rate
    a.count += 1
    acc.set(r.sectorPrefix, a)
  }
  return [...acc.entries()].map(([sector, a]) => {
    const avg = Math.round(a.sum / a.count)
    const band = complianceBand(avg)
    return { sector, avg, count: a.count, band: band?.label ?? null, color: band?.color ?? '#9ca3af' }
  }).sort((x, y) => y.avg - x.avg)
}
