import { useEffect, useState } from 'react'
import { ShieldCheck, ArrowRight } from 'lucide-react'
import { listSubRecords } from '../firebase/subrecords'
import { recordComplianceRate, complianceBand, BAND_TINT } from '../data/compliance'
import { fmtDate } from '../utils/records'

/**
 * A facility's current compliance — the score of its latest monitoring visit —
 * shown as a colour-coded meter on the facility profile.
 */
export default function FacilityComplianceCard({ fileNumber, sectorPrefix, onOpen }) {
  const [state, setState] = useState({ loading: true, rate: null, visit: null, count: 0 })

  useEffect(() => {
    let alive = true
    listSubRecords(fileNumber, 'monitoring')
      .then((recs) => {
        if (!alive) return
        if (!recs.length) { setState({ loading: false, rate: null, visit: null, count: 0 }); return }
        const latest = [...recs].sort((a, b) =>
          (b.date?.seconds ?? 0) - (a.date?.seconds ?? 0))[0]
        const rate = recordComplianceRate({ sector_prefix: sectorPrefix, ...latest })
        setState({ loading: false, rate, visit: latest.date ?? null, count: recs.length })
      })
      .catch(() => { if (alive) setState({ loading: false, rate: null, visit: null, count: 0 }) })
    return () => { alive = false }
  }, [fileNumber, sectorPrefix])

  const band = state.rate == null ? null : complianceBand(state.rate)
  const tint = band ? (BAND_TINT[band.label] ?? { bg: '#f3f4f6', text: '#374151' }) : null

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Compliance</span>
        {state.count > 0 && onOpen && (
          <button className="btn btn--ghost btn--xs" onClick={onOpen}>
            Monitoring visits <ArrowRight size={12} />
          </button>
        )}
      </div>

      {state.loading ? (
        <div style={{ fontSize: 13, color: '#9ca3af', padding: '6px 0' }}>Loading…</div>
      ) : state.rate == null ? (
        <div className="info-item">
          <ShieldCheck size={14} />
          <span style={{ color: '#9ca3af' }}>No scored monitoring visit yet.</span>
        </div>
      ) : (
        <div className="fac-compliance">
          <div className="fac-compliance__row">
            <span className="fac-compliance__pct">{state.rate}%</span>
            <span className="cscore-band" style={{ background: tint.bg, color: tint.text }}>{band.label}</span>
          </div>
          <div className="cscore-score__track">
            <div className="cscore-score__fill" style={{ width: `${state.rate}%`, background: band.color }} />
          </div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>
            Latest visit {fmtDate(state.visit)}{state.count > 1 && ` · ${state.count} visits on file`}
          </div>
        </div>
      )}
    </div>
  )
}
