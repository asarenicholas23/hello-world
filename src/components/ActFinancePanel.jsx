import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight, Calculator, Info } from 'lucide-react'
import { listSubRecords } from '../firebase/subrecords'
import { listFieldReportsForFacility } from '../firebase/fieldReports'
import { buildCapacityIndex } from '../utils/capacity'
import { actEstimate, buildFeeContext, matchRule, paymentKind } from '../utils/revenueForecast'
import { fmtDate } from '../utils/records'
import Spinner from './Spinner'

const UNIT_LABEL = {
  rooms: 'rooms', beds: 'beds', bags_per_day: 'bags a day', boxes_per_day: 'boxes a day', production: 'bags a day',
  litres: 'litres of tank storage', tonnes: 'tonnes of tank storage', seats: 'seats', housing_units: 'housing units',
}

function cedis(x) {
  return `GH¢ ${Number(x || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// "Possible finance from Act 1080": what the Act's schedule says this facility would pay,
// shown apart from the recorded payments and collapsed until opened.
export default function ActFinancePanel({ facility, fileNumber, financeRecords }) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [capInput, setCapInput] = useState('')
  const [penalty, setPenalty] = useState(false)

  useEffect(() => {
    if (!open || data) return
    let cancelled = false
    Promise.all([
      import('../data/act1080Fees.json').then((m) => m.default),
      listSubRecords(fileNumber, 'screenings').catch(() => []),
      listSubRecords(fileNumber, 'site_verifications').catch(() => []),
      listFieldReportsForFacility(fileNumber).catch(() => []),
      listSubRecords(fileNumber, 'permits').catch(() => []),
    ]).then(([feeTable, screenings, siteVerifications, fieldReports, permits]) => {
      if (cancelled) return
      const withFile = (list) => list.map((r) => ({ ...r, fileNumber }))
      const capacityIndex = buildCapacityIndex({ screenings: withFile(screenings), siteVerifications: withFile(siteVerifications), fieldReports })
      setData({ feeTable, caps: capacityIndex[fileNumber] ?? {}, hasPermit: permits.length > 0 })
    }).catch(() => { if (!cancelled) setError('Could not load the fee table or field records.') })
    return () => { cancelled = true }
  }, [open, data, fileNumber])

  const rule = useMemo(() => (facility ? matchRule(facility) : null), [facility])

  const result = useMemo(() => {
    if (!data || !facility || !rule) return null
    let caps = data.caps
    const typed = Number(capInput)
    if (capInput !== '' && Number.isFinite(typed) && typed > 0 && rule.cap?.length) {
      caps = { ...caps, [rule.cap[0]]: { value: typed, source: 'entered here' } }
    }
    const ctx = buildFeeContext({
      feeTable: data.feeTable,
      facilities: [facility],
      finance: [],
      capacityIndex: { [fileNumber]: caps },
    })
    return actEstimate(facility, caps, ctx, { application: data.hasPermit ? 'renewal' : 'new' })
  }, [data, facility, rule, capInput, fileNumber])

  const lastPaid = useMemo(() => {
    const out = {}
    for (const r of financeRecords ?? []) {
      if ((r.payment_status ?? 'paid') !== 'paid') continue
      const kind = paymentKind(r.payment_type)
      if (kind !== 'processing' && kind !== 'permit') continue
      const ms = r.date?.toMillis?.() ?? (r.date ? new Date(r.date).getTime() : 0)
      if (!out[kind] || ms > out[kind].ms) out[kind] = { amount: Number(r.amount) || 0, ms, date: r.date }
    }
    return out
  }, [financeRecords])

  const penaltyAmount = result && penalty ? result.permit * 3 : 0
  const actTotal = result ? result.total + penaltyAmount : 0
  const paidTotal = (lastPaid.processing?.amount ?? 0) + (lastPaid.permit?.amount ?? 0)
  const capKey = rule?.cap?.[0]
  // The capacity the estimate used when nothing is typed (LPG litres are converted to tonnes).
  const recordedCap = capInput === '' && result?.qty?.kind === 'recorded'
    ? { value: result.qty.value, source: result.qty.source, dateMs: Object.values(data?.caps ?? {}).find((c) => result.qty.source.startsWith(c.source))?.dateMs ?? null }
    : null

  return (
    <section className={`act-finance${open ? ' is-open' : ''}`}>
      <button type="button" className="act-finance__toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <Calculator size={15} />
        <span>Possible finance from Act 1080</span>
        <small>Estimate, not a recorded payment</small>
      </button>

      {open && (
        <div className="act-finance__body">
          {error && <div className="login-error">{error}</div>}
          {!error && !data && <div className="tab-loading"><Spinner size={20} /></div>}

          {data && !rule && (
            <p className="act-finance__note">
              No Act 1080 line is mapped for “{facility?.type_of_undertaking || 'this type of undertaking'}”.
              Work it out on the <Link to="/fee-calculator">Fee Calculator</Link>.
            </p>
          )}

          {data && rule && (
            <>
              <div className="act-finance__row">
                <span>Fee line</span>
                <strong>{rule.label}</strong>
                {result && <small>{result.lineLabel} · Act 1080 p.{String(result.pages).split(',')[0]}</small>}
              </div>

              {capKey && (
                <div className="act-finance__row">
                  <span>Capacity</span>
                  <div className="act-finance__cap">
                    <input
                      type="number" min="0" inputMode="decimal"
                      value={capInput}
                      placeholder={recordedCap ? String(recordedCap.value) : 'Enter'}
                      onChange={(e) => setCapInput(e.target.value)}
                      aria-label={`Capacity in ${UNIT_LABEL[capKey] ?? capKey}`}
                    />
                    <em>{UNIT_LABEL[capKey] ?? capKey}</em>
                  </div>
                  <small>
                    {capInput !== '' ? 'Entered here (not saved)'
                      : recordedCap ? `From ${recordedCap.source}${recordedCap.dateMs ? `, ${fmtDate(new Date(recordedCap.dateMs))}` : ''}`
                        : 'Not on any screening or site verification. Enter it to price this facility.'}
                  </small>
                </div>
              )}

              {result ? (
                <>
                  <div className="act-finance__lines">
                    <div><span>Processing fee{result.perUnit && result.qty ? ` (${result.qty.value} × ${cedis(result.rate.processing)})` : ''}</span><strong>{cedis(result.processing)}</strong></div>
                    <div><span>Permit fee{result.perUnit && result.qty ? ` (${result.qty.value} × ${cedis(result.rate.permit)})` : ''}</span><strong>{cedis(result.permit)}</strong></div>
                    {penalty && <div><span>Penalty (3 × permit fee)</span><strong>{cedis(penaltyAmount)}</strong></div>}
                    <div className="act-finance__total"><span>Act 1080 total</span><strong>{cedis(actTotal)}</strong></div>
                  </div>
                  <label className="act-finance__penalty">
                    <input type="checkbox" checked={penalty} onChange={(e) => setPenalty(e.target.checked)} />
                    Add ×3 penalty (late renewal or operating without a permit)
                  </label>
                  {paidTotal > 0 && (
                    <p className="act-finance__compare">
                      Last paid: {cedis(paidTotal)}
                      {lastPaid.permit?.date ? ` (permit fee ${fmtDate(lastPaid.permit.date)})` : ''}.
                      {' '}The Act figure is {actTotal >= paidTotal ? `${cedis(actTotal - paidTotal)} more` : `${cedis(paidTotal - actTotal)} less`}.
                    </p>
                  )}
                </>
              ) : (
                <p className="act-finance__note">Enter the capacity to price this facility.</p>
              )}

              {result?.note && <p className="act-finance__note"><Info size={13} /> {result.note}</p>}
              <p className="act-finance__note">The Ghana.gov invoice from the EPA client portal is the bill. This uses the Act's permitting rates for the facility's type of undertaking.</p>
            </>
          )}
        </div>
      )}
    </section>
  )
}
