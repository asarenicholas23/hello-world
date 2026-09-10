import { useMemo, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Award, TriangleAlert, Building2, Target } from 'lucide-react'
import { SECTORS, DISTRICTS, SECTOR_COLORS } from '../data/constants'
import { COMPLIANCE_BANDS, BAND_TINT, BAND_ORDER, summarizeCompliance, complianceBySector } from '../data/compliance'
import { fmtDate } from '../utils/records'

function sectorLabel(prefix) {
  return SECTORS.find((s) => s.prefix === prefix)?.name ?? prefix ?? 'Unknown'
}
function districtLabel(code) {
  return DISTRICTS.find((d) => d.code === code)?.name ?? code ?? '—'
}

const BAND_RANGE = {
  Excellent: '≥ 80%',
  Good: '60–79%',
  Fair: '40–59%',
  Poor: '< 40%',
}

function BandChip({ band }) {
  const tint = BAND_TINT[band] ?? { bg: '#f3f4f6', text: '#374151' }
  return <span className="cscore-band" style={{ background: tint.bg, color: tint.text }}>{band ?? '—'}</span>
}

/**
 * Compliance scorecard — colour-coded band chart, sector/district filters and a
 * ranked facility table. `rows` come from facilityComplianceRows().
 */
export default function ComplianceScorecard({ rows = [], onOpenFacility }) {
  const [sector, setSector] = useState('')
  const [district, setDistrict] = useState('')
  const [sort, setSort] = useState({ key: 'rate', dir: 'desc' })

  const filtered = useMemo(() => rows.filter((r) => (
    (!sector || r.sectorPrefix === sector) && (!district || r.district === district)
  )), [rows, sector, district])

  const summary = useMemo(() => summarizeCompliance(filtered), [filtered])
  const bySector = useMemo(() => complianceBySector(filtered), [filtered])

  const bandData = BAND_ORDER.map((label) => ({
    band: label,
    count: summary.byBand[label] ?? 0,
    color: COMPLIANCE_BANDS.find((b) => b.label === label)?.color ?? '#9ca3af',
  }))

  const sorted = useMemo(() => {
    const list = [...filtered]
    const dir = sort.dir === 'asc' ? 1 : -1
    list.sort((a, b) => {
      if (sort.key === 'name') return dir * a.facilityName.localeCompare(b.facilityName)
      if (sort.key === 'visit') return dir * ((a.lastVisit?.seconds ?? 0) - (b.lastVisit?.seconds ?? 0))
      return dir * (a.rate - b.rate)
    })
    return list
  }, [filtered, sort])

  function toggleSort(key) {
    setSort((p) => (p.key === key ? { key, dir: p.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'name' ? 'asc' : 'desc' }))
  }

  const activeDistricts = DISTRICTS.filter((d) => rows.some((r) => r.district === d.code))

  return (
    <div className="cscore">
      {/* Filters */}
      <div className="filter-bar cscore-filters">
        <div className="filter-group">
          <label>Sector</label>
          <select className="select" value={sector} onChange={(e) => setSector(e.target.value)}>
            <option value="">All sectors</option>
            {SECTORS.filter((s) => rows.some((r) => r.sectorPrefix === s.prefix)).map((s) => (
              <option key={s.prefix} value={s.prefix}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>District</label>
          <select className="select" value={district} onChange={(e) => setDistrict(e.target.value)}>
            <option value="">All districts</option>
            {activeDistricts.map((d) => (
              <option key={d.code} value={d.code}>{d.name}</option>
            ))}
          </select>
        </div>
        {(sector || district) && (
          <button className="btn btn--ghost btn--sm" onClick={() => { setSector(''); setDistrict('') }}>
            Clear
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>
          No scored monitoring visits for this filter yet.
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="cscore-kpis">
            <div className="cscore-kpi">
              <div className="cscore-kpi__icon" style={{ background: '#eff6ff' }}><Building2 size={18} color="#1d4ed8" /></div>
              <div>
                <strong>{summary.total}</strong>
                <span>Facilities scored</span>
              </div>
            </div>
            <div className="cscore-kpi">
              <div className="cscore-kpi__icon" style={{ background: '#f0fdf4' }}><Target size={18} color="#15803d" /></div>
              <div>
                <strong>{summary.avg == null ? '—' : `${summary.avg}%`}</strong>
                <span>Average compliance</span>
              </div>
            </div>
            <div className="cscore-kpi cscore-kpi--link" onClick={() => summary.best && onOpenFacility?.(summary.best.fileNumber)}>
              <div className="cscore-kpi__icon" style={{ background: '#dcfce7' }}><Award size={18} color="#166534" /></div>
              <div>
                <strong>{summary.best ? `${summary.best.rate}%` : '—'}</strong>
                <span>{summary.best ? `Most compliant · ${summary.best.facilityName}` : 'Most compliant'}</span>
              </div>
            </div>
            <div className="cscore-kpi cscore-kpi--link" onClick={() => summary.worst && onOpenFacility?.(summary.worst.fileNumber)}>
              <div className="cscore-kpi__icon" style={{ background: '#fee2e2' }}><TriangleAlert size={18} color="#991b1b" /></div>
              <div>
                <strong>{summary.worst ? `${summary.worst.rate}%` : '—'}</strong>
                <span>{summary.worst ? `Least compliant · ${summary.worst.facilityName}` : 'Least compliant'}</span>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="cscore-charts">
            <div className="card cscore-chart">
              <div className="cscore-chart__title">Facilities by compliance level</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={bandData} margin={{ top: 8, right: 8, bottom: 4, left: -18 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                  <XAxis dataKey="band" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => [`${v} facilities`, 'Count']} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {bandData.map((d) => <Cell key={d.band} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="cscore-legend">
                {BAND_ORDER.map((label) => (
                  <span key={label} className="cscore-legend__item">
                    <i style={{ background: COMPLIANCE_BANDS.find((b) => b.label === label)?.color }} />
                    {label} <em>{BAND_RANGE[label]}</em>
                  </span>
                ))}
              </div>
            </div>

            {bySector.length > 1 && (
              <div className="card cscore-chart">
                <div className="cscore-chart__title">Average score by sector</div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={bySector} margin={{ top: 8, right: 8, bottom: 4, left: -18 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                    <XAxis dataKey="sector" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v, _n, p) => [`${v}%`, sectorLabel(p.payload.sector)]} />
                    <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
                      {bySector.map((d) => <Cell key={d.sector} fill={d.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Ranked table */}
          <div className="card cscore-table-card">
            <div className="cscore-chart__title">Facility ranking</div>
            <div className="cscore-table-wrap">
              <table className="cscore-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th className="cscore-th--sort" onClick={() => toggleSort('name')}>Facility</th>
                    <th>Sector</th>
                    <th>District</th>
                    <th className="cscore-th--sort" onClick={() => toggleSort('visit')}>Last visit</th>
                    <th className="cscore-th--sort" onClick={() => toggleSort('rate')} style={{ minWidth: 160 }}>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r, i) => {
                    const sc = SECTOR_COLORS[r.sectorPrefix] ?? { bg: '#f3f4f6', text: '#374151' }
                    return (
                      <tr key={r.fileNumber} onClick={() => onOpenFacility?.(r.fileNumber)}>
                        <td className="cscore-rank">{sort.key === 'rate' && sort.dir === 'desc' ? i + 1 : ''}</td>
                        <td>
                          <div className="cscore-fac">{r.facilityName}</div>
                          <div className="file-num" style={{ fontSize: 11 }}>{r.fileNumber}</div>
                        </td>
                        <td><span className="record-badge" style={{ background: sc.bg, color: sc.text }}>{r.sectorPrefix}</span></td>
                        <td style={{ fontSize: 12, color: '#6b7280' }}>{districtLabel(r.district)}</td>
                        <td style={{ fontSize: 12, color: '#6b7280' }}>
                          {fmtDate(r.lastVisit)}{r.visits > 1 && <span style={{ color: '#9ca3af' }}> · {r.visits} visits</span>}
                        </td>
                        <td>
                          <div className="cscore-score">
                            <div className="cscore-score__track">
                              <div className="cscore-score__fill" style={{ width: `${r.rate}%`, background: r.bandColor }} />
                            </div>
                            <span className="cscore-score__pct">{r.rate}%</span>
                            <BandChip band={r.band} />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/** Compact band-distribution card for the dashboard. */
export function ComplianceMiniCard({ rows = [], onClick }) {
  const summary = summarizeCompliance(rows)
  if (!summary.total) return null
  return (
    <div className="analytics-entry-card" onClick={onClick}>
      <div className="analytics-entry-card__icon"><Target size={22} color="#15803d" /></div>
      <div className="analytics-entry-card__body" style={{ flex: 1 }}>
        <div className="analytics-entry-card__title">
          Compliance Scorecard · avg {summary.avg}%
        </div>
        <div className="cscore-mini-bar">
          {BAND_ORDER.map((label) => {
            const n = summary.byBand[label] ?? 0
            if (!n) return null
            const color = COMPLIANCE_BANDS.find((b) => b.label === label)?.color
            return (
              <span key={label} className="cscore-mini-seg"
                style={{ flex: n, background: color }}
                title={`${label}: ${n}`} />
            )
          })}
        </div>
        <div className="analytics-entry-card__desc">
          {BAND_ORDER.map((label) => `${label} ${summary.byBand[label] ?? 0}`).join(' · ')} — across {summary.total} facilities
        </div>
      </div>
    </div>
  )
}
