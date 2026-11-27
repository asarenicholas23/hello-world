import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight, Calculator, Info, X, Search, Plus } from 'lucide-react'
import { listSubRecords } from '../firebase/subrecords'
import { listFieldReportsForFacility } from '../firebase/fieldReports'
import { buildCapacityIndex } from '../utils/capacity'
import { updateFacility } from '../firebase/facilities'
import { useAuth } from '../context/AuthContext'
import { FIELD_ROLES, hasFullDataAccess } from '../data/constants'
import {
  FEE_RULES, IMPACT_SCALES, actEstimate, buildFeeContext, lineTitle, matchRules, paymentKind, resolveRule, ruleById, withSavedCapacities,
} from '../utils/revenueForecast'
import FEE from '../utils/feeCalc'
import { fmtDate } from '../utils/records'
import Spinner from './Spinner'

const unitLabel = (key) => UNIT_LABEL[key] ?? (key?.startsWith('units_') ? 'units' : key)

const UNIT_LABEL = {
  rooms: 'rooms', beds: 'beds', bags_per_day: 'bags a day', boxes_per_day: 'boxes a day', production: 'bags a day',
  litres: 'litres of tank storage', tonnes: 'tonnes of tank storage', seats: 'seats', housing_units: 'housing units', floor_area: 'm² of floor area',
}

function cedis(x) {
  return `GH¢ ${Number(x || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// "Possible finance from Act 1080": what the Act's schedule says this facility would pay,
// shown apart from the recorded payments and collapsed until opened. A facility is
// priced on every activity it does (hotel + restaurant, fuel + LPG), whatever sector it
// is filed under; the list can be changed here and saved on the facility.
export default function ActFinancePanel({ facility, fileNumber, financeRecords }) {
  const { user, role, dataAccess } = useAuth()
  const [open, setOpen] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [capInput, setCapInput] = useState({})
  const [penalty, setPenalty] = useState(false)
  // Activity ids being priced; null = what the facility record says.
  const [chosen, setChosen] = useState(null)
  const [savedList, setSavedList] = useState(null)
  // Impact scale being priced; null = what the facility record says.
  const [scaleChoice, setScaleChoice] = useState(null)
  const [savedScale, setSavedScale] = useState(null)
  const [savedCaps, setSavedCaps] = useState(null)
  const [tableQuery, setTableQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

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

  // The facility as last saved here (the page's copy does not refresh after a save).
  const current = useMemo(() => {
    if (!facility) return null
    let f = facility
    if (savedList) f = { ...f, fee_activities: savedList }
    if (savedScale != null) f = { ...f, impact_scale: savedScale }
    if (savedCaps) f = { ...f, fee_capacities: savedCaps }
    return f
  }, [facility, savedList, savedScale, savedCaps])
  const recordScale = IMPACT_SCALES.includes(current?.impact_scale) ? current.impact_scale : ''
  const scaleChanged = scaleChoice != null && scaleChoice !== recordScale
  const ctx = useMemo(() => (data ? buildFeeContext({
    feeTable: data.feeTable, facilities: [], finance: [], capacityIndex: { [fileNumber]: data.caps },
  }) : null), [data, fileNumber])
  const lineById = ctx?.lineById

  const recordRules = useMemo(() => (current ? matchRules(current).map((r) => resolveRule(r, lineById)) : []), [current, lineById])
  const savedOnRecord = Array.isArray(current?.fee_activities) && current.fee_activities.length > 0
  const rules = useMemo(
    () => (chosen ? chosen.map(ruleById).filter(Boolean).map((r) => resolveRule(r, lineById)) : recordRules),
    [chosen, recordRules, lineById],
  )
  const changed = chosen != null && chosen.join('+') !== recordRules.map((r) => r.id).join('+')
  const canSave = FIELD_ROLES.has(role) || role === 'finance' || hasFullDataAccess(role, dataAccess)

  // Field-record capacities, with what officers saved on the facility on top.
  const baseCaps = useMemo(() => (data ? withSavedCapacities(current, data.caps) : {}), [data, current])

  // Capacities typed here, by capacity key (rooms, floor_area …), for saving.
  const typedCaps = useMemo(() => {
    const out = {}
    for (const rule of rules) {
      const key = rule.cap?.[0]
      const n = Number(capInput[rule.id])
      if (key && capInput[rule.id] && Number.isFinite(n) && n > 0) out[key] = n
    }
    return out
  }, [rules, capInput])
  const capsChanged = Object.entries(typedCaps).some(([k, v]) => Number(current?.fee_capacities?.[k]) !== v)

  // Capacities for one activity: what is on record, or what was typed for it here.
  const capsFor = useCallback((rule) => {
    const typed = Number(capInput[rule.id])
    if (capInput[rule.id] && Number.isFinite(typed) && typed > 0 && rule.cap?.length) {
      return { ...baseCaps, [rule.cap[0]]: { value: typed, source: 'entered here' } }
    }
    return baseCaps
  }, [capInput, baseCaps])

  // The whole Act 1080 fee table, searchable, to add any line as an activity.
  const families = useMemo(() => (data ? FEE.buildFamilies(data.feeTable.main.map(FEE.rowToLine)) : []), [data])
  const tableHits = useMemo(() => {
    const q = tableQuery.trim()
    if (q.length < 2) return []
    return FEE.search(families, q, '').slice(0, 6)
  }, [families, tableQuery])

  const application = data?.hasPermit ? 'renewal' : 'new'
  const usesScale = rules.some((r) => r.scale || ruleById(r.fallback)?.scale)
  const result = useMemo(() => {
    if (!ctx || !current || !rules.length) return null
    const priced = scaleChoice != null ? { ...current, impact_scale: scaleChoice } : current
    return actEstimate(priced, baseCaps, ctx, { application, rules, capsFor })
  }, [ctx, current, rules, baseCaps, application, capsFor, scaleChoice])

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
  const unpricedById = new Map((result?.unpriced ?? []).map((u) => [u.ruleId, u]))
  const partById = new Map((result?.parts ?? []).map((p) => [p.forRule ?? p.ruleId, p]))
  const addable = FEE_RULES.filter((r) => !rules.some((x) => x.id === r.id))

  function setList(ids) { setChosen(ids); setSaveMsg('') }
  function removeRule(id) { setList(rules.map((r) => r.id).filter((x) => x !== id)) }
  function addRule(id) { if (id) setList([...rules.map((r) => r.id), id]) }

  // Saves what changed: the activity list (ids; [] = read from the type again), the scale,
  // and capacities typed here (so forecasts use them).
  async function save(ids, scale, caps) {
    setSaving(true); setSaveMsg('')
    const update = {}
    if (ids) update.fee_activities = ids
    if (scale != null) update.impact_scale = scale
    const nextCaps = caps && Object.keys(caps).length ? { ...(current?.fee_capacities ?? {}), ...caps } : null
    if (nextCaps) update.fee_capacities = nextCaps
    try {
      await updateFacility(fileNumber, update, user?.uid ?? null)
      if (ids) { setSavedList(ids); setChosen(null) }
      if (scale != null) { setSavedScale(scale); setScaleChoice(null) }
      if (nextCaps) { setSavedCaps(nextCaps); setCapInput({}) }
      setSaveMsg(ids && !ids.length ? 'Saved. Activities are read from the type of undertaking again.' : 'Saved. Forecasts will use this.')
    } catch {
      setSaveMsg('Could not save. Check your connection and try again.')
    } finally { setSaving(false) }
  }

  function capRow(rule) {
    const capKey = rule.cap?.[0]
    if (!capKey) return null
    const part = partById.get(rule.id)
    const typed = capInput[rule.id] ?? ''
    const recorded = typed === '' && part?.qty?.kind === 'recorded' ? part.qty : null
    const savedHere = recorded?.source === 'entered by an officer'
    const typical = typed === '' && part?.qty?.kind === 'typical' ? part.qty : null
    const dateMs = recorded ? Object.values(data?.caps ?? {}).find((c) => recorded.source.startsWith(c.source))?.dateMs : null
    return (
      <div className="act-finance__cap">
        <input
          type="number" min="0" inputMode="decimal"
          value={typed}
          placeholder={recorded || typical ? String((recorded ?? typical).value) : 'Enter'}
          onChange={(e) => setCapInput((c) => ({ ...c, [rule.id]: e.target.value }))}
          aria-label={`${rule.label}: capacity in ${unitLabel(capKey)}`}
        />
        <em>{unitLabel(capKey)}</em>
        <small>
          {typed !== '' ? (canSave ? 'Entered here; save it so forecasts use it' : 'Entered here (not saved)')
            : savedHere ? 'Saved on this facility by an officer'
              : recorded ? `From ${recorded.source}${dateMs ? `, ${fmtDate(new Date(dateMs))}` : ''}`
                : typical ? `Not on record; ${typical.source}`
                  : 'Not on any screening or site verification. Enter it to price this activity; until then forecasts use what similar facilities paid.'}
        </small>
      </div>
    )
  }

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

          {data && (
            <>
              <div className="act-finance__row">
                <span>Activities charged</span>
                <small>
                  {chosen ? 'Changed here' : savedOnRecord ? 'Saved on this facility' : `Read from the type of undertaking${facility?.type_of_undertaking ? ` (“${facility.type_of_undertaking}”)` : ''}`}.
                  {' '}Each is priced on its own Act 1080 line, whatever the facility's sector, and the fees are added.
                </small>
              </div>

              {!rules.length && (
                <p className="act-finance__note">
                  No Act 1080 line is mapped for “{facility?.type_of_undertaking || 'this type of undertaking'}”.
                  Add the activities below, or work it out on the <Link to="/fee-calculator">Fee Calculator</Link>.
                </p>
              )}

              {rules.map((rule) => {
                const part = partById.get(rule.id)
                const miss = unpricedById.get(rule.id)
                return (
                  <div key={rule.id} className="act-finance__activity">
                    <div className="act-finance__activity-head">
                      <strong>{part?.ruleLabel && rule.lineRef ? part.ruleLabel : rule.label}</strong>
                      {rules.length > 1 || chosen ? (
                        <button type="button" className="act-finance__remove" onClick={() => removeRule(rule.id)} aria-label={`Remove ${rule.label}`} title="Remove this activity"><X size={14} /></button>
                      ) : null}
                    </div>
                    {part && <small>{part.lineLabel} · {part.pages ? `Act 1080 p.${String(part.pages).split(',')[0]}` : 'Office practice, not in Act 1080'}</small>}
                    {capRow(rule)}
                    {part ? (
                      <div className="act-finance__lines">
                        <div><span>Processing fee{part.perUnit && part.qty ? ` (${part.qty.value} × ${cedis(part.rate.processing)})` : ''}</span><strong>{cedis(part.processing)}</strong></div>
                        <div><span>Permit fee{part.perUnit && part.qty ? ` (${part.qty.value} × ${cedis(part.rate.permit)})` : ''}</span><strong>{cedis(part.permit)}</strong></div>
                      </div>
                    ) : miss ? (
                      <p className="act-finance__note">Not priced: {miss.why}.</p>
                    ) : null}
                    {part?.note && <p className="act-finance__note"><Info size={13} /> {part.note}</p>}
                  </div>
                )
              })}

              {usesScale && (
                <div className="act-finance__row">
                  <span>Impact scale</span>
                  <div className="act-finance__cap">
                    <select
                      value={scaleChoice ?? recordScale}
                      onChange={(e) => { setScaleChoice(e.target.value); setSaveMsg('') }}
                      aria-label="Impact scale"
                    >
                      <option value="">Not set (Small, or the activity’s usual scale)</option>
                      {IMPACT_SCALES.map((x) => <option key={x} value={x}>{x}</option>)}
                    </select>
                    <small>Use the scale assigned at screening. Act 1080 and L.I. 2504 do not define it.</small>
                  </div>
                </div>
              )}

              <div className="act-finance__row">
                <span>Find in the Act 1080 fee table</span>
                <div className="act-finance__search">
                  <Search size={14} />
                  <input
                    type="search" value={tableQuery} onChange={(e) => setTableQuery(e.target.value)}
                    placeholder="e.g. charcoal, warehouse, poultry" aria-label="Search the Act 1080 fee table"
                  />
                </div>
                {tableHits.map((fam) => (
                  <div key={fam.key} className="act-finance__family">
                    <small>{fam.sector} › {fam.title}</small>
                    {fam.lines.filter((l) => l.phase !== 'Construction').slice(0, 8).map((l) => {
                      const id = `line:${l.id}`
                      const on = rules.some((r) => r.id === id)
                      const pp = l.fees.pp ?? l.fees.cp
                      const pm = l.fees.pm ?? l.fees.cm
                      const fee = (f) => (f ? (f.cur === 'GHS' ? cedis(f.v) : f.cur === 'USD' ? `US$ ${f.v}` : 'FOB %') : '—')
                      return (
                        <button key={l.id} type="button" className="act-finance__line-pick" disabled={on} onClick={() => { addRule(id); setTableQuery('') }}>
                          <Plus size={12} />
                          <span>{FEE.stripNumbering(l.label) || lineTitle(l)}{l.phase ? ` (${l.phase})` : ''}</span>
                          <em>{fee(pp)} + {fee(pm)}{FEE.isPerUnit(l) ? ` per ${l.unit || 'unit'}` : ''}</em>
                        </button>
                      )
                    })}
                  </div>
                ))}
                {tableQuery.trim().length >= 2 && !tableHits.length && <small>Nothing in the fee table matches “{tableQuery.trim()}”.</small>}
              </div>

              <div className="act-finance__edit">
                <select value="" onChange={(e) => addRule(e.target.value)} aria-label="Add an activity">
                  <option value="">+ Add an activity…</option>
                  {addable.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
                {(chosen || scaleChoice != null || Object.keys(capInput).some((k) => capInput[k] !== '')) && (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setList(null); setScaleChoice(null); setCapInput({}) }}>Undo changes</button>
                )}
                {canSave && (changed || scaleChanged || capsChanged) && (
                  <button type="button" className="btn btn--primary btn--sm" disabled={saving || !rules.length} onClick={() => save(changed ? rules.map((r) => r.id) : null, scaleChanged ? scaleChoice : null, capsChanged ? typedCaps : null)}>
                    {saving ? 'Saving…' : 'Save to facility'}
                  </button>
                )}
                {canSave && !chosen && savedOnRecord && (
                  <button type="button" className="btn btn--ghost btn--sm" disabled={saving} onClick={() => save([])}>Read from type of undertaking</button>
                )}
              </div>
              {saveMsg && <p className="act-finance__note">{saveMsg}</p>}

              {result && (
                <>
                  <div className="act-finance__lines">
                    {result.parts.length > 1 && (
                      <>
                        <div><span>Processing fees ({result.parts.length} activities)</span><strong>{cedis(result.processing)}</strong></div>
                        <div><span>Permit fees ({result.parts.length} activities)</span><strong>{cedis(result.permit)}</strong></div>
                      </>
                    )}
                    {penalty && <div><span>Penalty (3 × permit fee{result.parts.length > 1 ? 's' : ''})</span><strong>{cedis(penaltyAmount)}</strong></div>}
                    <div className="act-finance__total"><span>Act 1080 total{result.unpriced.length ? ' (so far)' : ''}</span><strong>{cedis(actTotal)}</strong></div>
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
              )}

              <p className="act-finance__note">The Ghana.gov invoice from the EPA client portal is the bill. This uses the Act's permitting rates for each activity the facility does.</p>
            </>
          )}
        </div>
      )}
    </section>
  )
}
