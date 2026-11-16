import { useEffect, useMemo, useState } from 'react'
import { Search, Calculator, Copy, Check, AlertTriangle, Info } from 'lucide-react'
import FEE from '../utils/feeCalc'
import '../styles/feeCalculator.css'

// Act 1080 fee calculator.
// The fee table (src/data/act1080Fees.json, ~230 KB) is loaded on demand so it
// stays out of the main bundle. To update it from the fee Sheet, see
// docs/fee-calculator/README.md and scripts/build-fee-table.mjs.

// The app's own sectors, mapped to the sections of the Act 1080 schedule.
const SECTOR_GROUPS = [
  { key: 'CU', name: 'Manufacturing', act: ['Manufacturing'] },
  { key: 'CI', name: 'Infrastructure', act: ['General construction', 'Transportation', 'Telecommunication', 'Urban tree cover'] },
  { key: 'CH', name: 'Health', act: ['Health'] },
  { key: 'CT', name: 'Hospitality', act: ['Tourism and hospitality'] },
  { key: 'CE', name: 'Energy', act: ['Energy (power generation)', 'Downstream petroleum', 'Oil and gas (upstream)'] },
  { key: 'PP', name: 'Agrochemical & Pesticide', act: ['Pesticides registration and licensing', 'Chemical clearance and permits'] },
  { key: 'CA', name: 'Agriculture', act: ['Agriculture', 'Aquaculture, poultry and piggery', 'Wildlife and forestry'] },
  { key: 'CM', name: 'Mining', act: ['Mining'] },
  { key: 'OT', name: 'Other charges', act: ['Other fee categories', 'Hazardous and electronic waste', 'Product labels (electrical and electronic items)'] },
]

const RATE_KEY = 'epa_fee_calc_usd_rate'

// Words officers use that the Act does not, so a search for "church" finds
// "Other construction proposals such as religious facilities".
const SEARCH_ALIASES = [
  [/religious/i, 'church mosque temple chapel worship prayer centre'],
  [/hostel/i, 'student accommodation'],
  [/tourism|hotel|room hotel/i, 'guest house lodge motel'],
  [/filling station|fuel service/i, 'fuel station petrol station gas station pump'],
  [/lpg/i, 'gas cooking gas'],
  [/sachet|bottled water/i, 'pure water'],
  [/hospital|maternity|clinic/i, 'clinic health centre'],
  [/telecom/i, 'mast tower'],
  [/quarry/i, 'stone chippings'],
  [/vehicle servicing|garage/i, 'mechanic workshop fitting shop'],
  [/sand and gravel|borrow pit/i, 'sand winning'],
  [/shopping mall|shops/i, 'store supermarket'],
]
const money = FEE.money

function buildLines(data) {
  const lines = data.main.map(FEE.rowToLine)
  data.other.forEach((o, i) => {
    const per = o[3].match(/\bper\s+(\w+)/i)
    lines.push({
      id: 'X' + String(i + 1).padStart(3, '0'), kind: 'other', sector: o[0], sub: o[1], group: o[2], label: o[3], phase: '',
      bmin: null, bmax: null, unit: per ? per[1] : 'units',
      basis: /\bper\b|each|additional/i.test(o[3]) ? 'Per unit' : 'Flat', fees: { x: FEE.parseFee(o[4]) },
      pages: String(o[5]), check: 'Not in office document', conf: o[6], notes: '',
    })
  })
  data.labels.forEach((l, i) => {
    const fee = FEE.parseFee(l[2])
    lines.push({
      id: 'E' + String(i + 1).padStart(3, '0'), kind: 'label', sector: 'Product labels (electrical and electronic items)',
      sub: 'Product label, ' + l[0], group: '', label: l[1], phase: '', bmin: null, bmax: null, unit: 'items',
      basis: fee && fee.cur === 'FOB' ? 'Flat' : 'Per unit', fees: { x: fee }, pages: String(l[3]),
      check: 'Not in office document', conf: l[4], notes: '',
    })
  })
  return lines
}

const shortFee = (f) => f.cur === 'FOB' ? `${f.v * 100}% of FOB` : `${f.cur === 'USD' ? 'US$ ' : 'GH¢ '}${money(f.v)}`
const fmtQty = (q) => Number.isInteger(q) ? q.toLocaleString('en-GH') : String(q)

function Tabs({ label, items, value, onChange }) {
  return (
    <div className="fc-tabs" role="group" aria-label={label}>
      {items.map(([v, t]) => (
        <button key={v || 'none'} type="button" className={v === value ? 'is-active' : ''} aria-pressed={v === value} onClick={() => onChange(v)}>
          {t}
        </button>
      ))}
    </div>
  )
}

export default function FeeCalculatorPage() {
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('')
  const [famKey, setFamKey] = useState(null)
  const [phase, setPhase] = useState(null)
  const [lineId, setLineId] = useState(null)
  const [cap, setCap] = useState('')
  const [unit, setUnit] = useState(null)
  const [qty, setQty] = useState('')
  const [qtyTouched, setQtyTouched] = useState(false)
  const [regime, setRegime] = useState('P')
  const [pen, setPen] = useState(false)
  const [mult, setMult] = useState('3')
  const [penBase, setPenBase] = useState('permit')
  const [fob, setFob] = useState('')
  const [rate, setRate] = useState(() => { try { return localStorage.getItem(RATE_KEY) || '' } catch { return '' } })
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    import('../data/act1080Fees.json')
      .then((m) => { if (!cancelled) setData(m.default) })
      .catch(() => { if (!cancelled) setLoadError('The fee table could not be loaded. Check your connection and refresh.') })
    return () => { cancelled = true }
  }, [])

  const { lines, fams, lineById } = useMemo(() => {
    if (!data) return { lines: [], fams: [], lineById: new Map() }
    const ls = buildLines(data)
    const fs = FEE.buildFamilies(ls)
    for (const f of fs) {
      for (const [re, words] of SEARCH_ALIASES) if (re.test(f.text)) f.text += ' ' + words
    }
    return { lines: ls, fams: fs, lineById: new Map(ls.map((l) => [l.id, l])) }
  }, [data])

  const results = useMemo(() => {
    if (!query.trim() && !group) return []
    const sectors = group ? new Set(SECTOR_GROUPS.find((g) => g.key === group).act) : null
    return FEE.search(fams, query.trim(), '').filter((f) => !sectors || sectors.has(f.sector))
  }, [fams, query, group])

  const fam = useMemo(() => fams.find((f) => f.key === famKey) || null, [fams, famKey])
  const famLines = useMemo(() => fam ? fam.lines.filter((l) => phase === null || l.phase === phase) : [], [fam, phase])
  const bandLines = useMemo(() => famLines.filter((l) => l.bmin !== null || l.bmax !== null), [famLines])
  const units = useMemo(() => [...new Set(bandLines.map((l) => l.unit || 'units'))], [bandLines])
  const capNum = FEE.num(cap)
  const matches = useMemo(() => (capNum !== null && bandLines.length ? FEE.matchBand(famLines, capNum, unit) : []), [famLines, bandLines, capNum, unit])

  // The line in use: a capacity picks its band (unless the officer picked one of the
  // matching bands), otherwise the officer's choice, otherwise the first line.
  const activeLineId = useMemo(() => {
    if (!fam) return null
    if (matches.length) return matches.some((m) => m.id === lineId) ? lineId : matches[0].id
    return famLines.some((l) => l.id === lineId) ? lineId : (famLines[0]?.id ?? null)
  }, [fam, famLines, matches, lineId])

  const line = activeLineId ? lineById.get(activeLineId) : null
  const perUnit = line ? FEE.isPerUnit(line) : false

  // The number of units follows the capacity until the officer types their own.
  const qtyValue = !qtyTouched && line && perUnit && bandLines.length && (line.unit || 'units') === unit ? cap : qty

  function chooseFamily(f) {
    setFamKey(f.key)
    setPhase(f.phases.length ? f.phases[0] : null)
    setUnit(f.units[0] || null)
    setLineId(null); setCap(''); setQty(''); setQtyTouched(false); setFob(''); setPen(false); setCopied(false)
  }

  function changeRate(v) {
    setRate(v)
    try { localStorage.setItem(RATE_KEY, v) } catch { /* storage unavailable */ }
  }

  const rateNum = Number(rate) > 0 ? Number(rate) : null
  const result = useMemo(() => {
    if (!line) return null
    if (line.kind === 'main') {
      return FEE.bill(line, { regime, qty: FEE.num(qtyValue), rate: rateNum, penalty: { on: pen, mult: FEE.num(mult), base: penBase } })
    }
    const q = perUnit ? FEE.num(qtyValue) : null
    const it = FEE.feeAmount(line.fees.x, perUnit ? (q > 0 ? q : null) : null, rateNum, FEE.num(fob))
    const needQty = perUnit && !(q > 0)
    return { items: [{ name: 'Charge', ...it }], total: it.status === 'ok' ? it.ghs : 0, complete: it.status === 'ok' && !needQty, needQty, per: perUnit }
  }, [line, regime, qtyValue, rateNum, pen, mult, penBase, perUnit, fob])

  function calcText(it) {
    if (it.status === 'none') return 'Not listed in the Act for this line'
    const f = it.fee
    if (f.cur === 'FOB') {
      if (it.status === 'needFob') return 'Enter the FOB value'
      const t = `${f.v * 100}% × US$ ${money(Number(fob))} = US$ ${money(it.usd)}`
      return it.status === 'needRate' ? `${t}, enter the exchange rate` : `${t} × ${rate}`
    }
    const rateTxt = `${f.cur === 'USD' ? 'US$ ' : 'GH¢ '}${money(f.v)}`
    let t = perUnit && it.qty !== undefined ? `${fmtQty(it.qty)} ${line.unit || 'units'} × ${rateTxt}` : `Flat rate ${rateTxt}`
    if (f.cur === 'USD') t += it.status === 'needRate' ? ` = US$ ${money(it.usd)}, enter the exchange rate` : ` = US$ ${money(it.usd)} × ${rate}`
    return t
  }

  function summary() {
    const out = ['Act 1080 fee estimate', `${fam.title}: ${line.label}${line.phase ? ` (${line.phase} phase)` : ''}`]
    if (line.kind === 'main') out.push(regime === 'C' ? 'Application: certificate' : 'Application: permit')
    for (const it of result.items) {
      if (it.name === 'Penalty') { if (it.status === 'ok') out.push(`Non-compliance penalty: ${it.mult} × ${it.baseName} = GH¢ ${money(it.ghs)}`) }
      else out.push(`${it.name}: ${it.status === 'ok' ? `GH¢ ${money(it.ghs)} (${calcText(it)})` : it.status === 'none' ? 'not listed' : 'incomplete'}`)
    }
    out.push(result.complete ? `Total: GH¢ ${money(result.total)}` : `Total so far: GH¢ ${money(result.total)} (incomplete)`)
    if (rateNum && result.items.some((i) => i.fee && (i.fee.cur === 'USD' || i.fee.cur === 'FOB'))) out.push(`Exchange rate used: US$ 1 = GH¢ ${rate}`)
    out.push(`Source: Act 1080, page ${line.pages}, line ${line.id}`)
    return out.join('\n')
  }

  async function copySummary() {
    try { await navigator.clipboard.writeText(summary()); setCopied(true); setTimeout(() => setCopied(false), 2000) }
    catch { setCopied(false) }
  }

  const missing = []
  if (result?.needQty) missing.push(`the number of ${line.unit || 'units'}`)
  if (result?.items.some((i) => i.status === 'needRate')) missing.push('the exchange rate')
  if (result?.items.some((i) => i.status === 'needFob')) missing.push('the FOB value')
  const anyOk = result?.items.some((i) => i.status === 'ok')
  const hasUsd = line && Object.values(line.fees).some((x) => x && (x.cur === 'USD' || x.cur === 'FOB'))
  const hasFob = line && Object.values(line.fees).some((x) => x && x.cur === 'FOB')
  const scaleOnly = fam && !bandLines.length && famLines.some((l) => /impact scale|\bscale\b/i.test(l.label))

  const badges = []
  if (line) {
    if (line.check === 'Differs from office document') badges.push(['yellow', 'Act differs from office extract'])
    else if (line.check === 'Check') badges.push(['yellow', 'Not found in the Act scan'])
    else if (line.check === 'Not in office document') badges.push(['blue', 'From the Act only'])
    else if (line.check) badges.push(['green', 'Matches office extract'])
    if (line.conf === 'Medium') badges.push(['yellow', 'Machine-read, verify'])
    if (line.basis === 'Flat – confirm') badges.push(['yellow', 'Flat or per unit? Confirm'])
    if (line.basis === 'Per unit (office practice)') badges.push(['gray', 'Per unit by office practice'])
  }

  return (
    <div className="page studio-skin fee-calc">
      <div className="page-header">
        <div>
          <h1 className="page-title">Fee Calculator</h1>
          <p className="page-subtitle">Processing, permit and penalty fees under the Fees and Charges (Miscellaneous Provisions) Act, 2022 (Act 1080)</p>
        </div>
        {data && <span className="fc-chip">Fee table · {data.built}</span>}
      </div>

      <div className="fc-tools">
        <label className="fc-search" htmlFor="fc-q">
          <Search size={16} aria-hidden="true" />
          <input id="fc-q" type="text" autoComplete="off" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a facility: hospital, hostel, sachet water, filling station, quarry" />
        </label>
        <select className="fc-select" value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Filter by sector">
          <option value="">All sectors</option>
          {SECTOR_GROUPS.map((g) => <option key={g.key} value={g.key}>{g.name}</option>)}
        </select>
      </div>

      {loadError && <div className="fc-notice fc-notice--warn"><AlertTriangle size={14} /> {loadError}</div>}

      <div className="fc-grid">
        <section className="card fc-card" aria-label="Facility">
          <div className="fc-card__header"><h3>Facility</h3>{(query || group) && <span>{results.length} match{results.length === 1 ? '' : 'es'}</span>}</div>

          {!data && !loadError && <p className="fc-empty">Loading the fee table…</p>}
          {data && !query.trim() && !group && <p className="fc-empty">Type a few letters of the facility type, or pick a sector.</p>}
          {data && (query.trim() || group) && !results.length && <p className="fc-empty">Nothing matches “{query}”. Try a shorter word, such as “hosp” or “water”.</p>}

          {results.length > 0 && (
            <div className="fc-results" role="list">
              {results.slice(0, 40).map((f) => {
                const ph = f.phases.filter(Boolean)
                return (
                  <button key={f.key} type="button" role="listitem" className={`fc-result${f.key === famKey ? ' is-active' : ''}`} onClick={() => chooseFamily(f)}>
                    <span>{f.sector}</span>
                    <strong>{f.title}</strong>
                    <small>{f.lines.length} line{f.lines.length > 1 ? 's' : ''}{ph.length ? ` · ${ph.join(' / ')}` : ''}</small>
                  </button>
                )
              })}
              {results.length > 40 && <p className="fc-empty">{results.length - 40} more. Add another word to narrow the list.</p>}
            </div>
          )}

          {fam && (
            <div className="fc-setup">
              <div>
                <div className="fc-label">Set up</div>
                <div className="fc-setup__title">{fam.title}</div>
              </div>

              <div className="fc-row fc-row--top">
                {(fam.phases.length > 1 || (fam.phases.length === 1 && fam.phases[0])) && (
                  <div className="fc-field">
                    <span className="fc-field__label">Phase</span>
                    <Tabs label="Phase" items={fam.phases.map((p) => [p, p || 'Not stated'])} value={phase} onChange={setPhase} />
                  </div>
                )}
                {fam.kind === 'main' && (
                  <div className="fc-field">
                    <span className="fc-field__label">Application</span>
                    <Tabs label="Application type" items={[['P', 'Permit · new'], ['C', 'Certificate · existing']]} value={regime} onChange={setRegime} />
                  </div>
                )}
              </div>

              {bandLines.length > 0 && (
                <div className="fc-field">
                  <label className="fc-field__label" htmlFor="fc-cap">Capacity</label>
                  <div className="fc-row">
                    <input id="fc-cap" className="fc-input" type="number" min="0" step="any" inputMode="decimal" placeholder="0" value={cap} onChange={(e) => setCap(e.target.value)} />
                    {units.length > 1
                      ? <select className="fc-select fc-select--sm" value={unit || ''} onChange={(e) => setUnit(e.target.value)} aria-label="Unit">{units.map((u) => <option key={u}>{u}</option>)}</select>
                      : <span className="fc-unit">{units[0]}</span>}
                  </div>
                  {capNum !== null && matches.length > 1 && (
                    <div className="fc-notice fc-notice--warn">
                      {capNum} {unit} sits on the edge of two bands in the Act. Pick the one your office applies.
                      <div className="fc-row">{matches.map((m) => <button key={m.id} type="button" className="fc-pick" onClick={() => setLineId(m.id)}>{m.label}</button>)}</div>
                    </div>
                  )}
                  {capNum !== null && matches.length === 1 && <div className="fc-notice fc-notice--ok">Falls in band {matches[0].label}</div>}
                  {capNum !== null && matches.length === 0 && <div className="fc-notice fc-notice--warn">No band in this list covers {capNum} {unit}. Check the figure, or pick a line below.</div>}
                </div>
              )}

              {scaleOnly && (
                <div className="fc-notice fc-notice--info">
                  <Info size={14} /> Neither Act 1080 nor the Environmental Assessment Regulations, 2025 (L.I. 2504) say what makes a proposal large, medium, small, minor or micro. L.I. 2504 only lists undertakings that need a permit (First Schedule; places of worship are item 50) and leaves the level of assessment to screening. Use the scale your office assigns at screening.
                </div>
              )}

              <div className="fc-field">
                <div className="fc-row fc-row--between">
                  <span className="fc-field__label">{bandLines.length ? 'Band' : 'Scale or line'}</span>
                  {fam.kind === 'main' && <span className="fc-help">Processing fee, then permit fee</span>}
                </div>
                <div className="fc-lines" role="radiogroup" aria-label="Line">
                  {famLines.map((x) => {
                    const a = regime === 'C' ? x.fees.cp : x.fees.pp
                    const b = regime === 'C' ? x.fees.cm : x.fees.pm
                    return (
                      <label key={x.id} className={`fc-line${x.id === activeLineId ? ' is-active' : ''}`}>
                        <input type="radio" name="fc-line" value={x.id} checked={x.id === activeLineId} onChange={() => { setLineId(x.id); if (matches.length && !matches.some((m) => m.id === x.id)) setCap('') }} />
                        <span>
                          <strong>{x.label}</strong>
                          {x.group && !fam.title.includes(FEE.stripNumbering(x.group)) && <span className="fc-line__group">{x.group}</span>}
                        </span>
                        <span className="fc-line__fee">
                          {x.kind === 'main'
                            ? <>{a ? shortFee(a) : '–'}<em>{b ? shortFee(b) : '–'}</em></>
                            : (x.fees.x ? shortFee(x.fees.x) : '–')}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {line && perUnit && (
                <div className="fc-field">
                  <label className="fc-field__label" htmlFor="fc-qty">Number of {line.unit || 'units'}</label>
                  <div className="fc-row">
                    <input id="fc-qty" className="fc-input" type="number" min="0" step="any" inputMode="decimal" placeholder="0" value={qtyValue}
                      onChange={(e) => { setQty(e.target.value); setQtyTouched(e.target.value !== '') }} />
                    <span className="fc-help">The fee is the rate × this number.</span>
                  </div>
                </div>
              )}

              {hasFob && (
                <div className="fc-field">
                  <label className="fc-field__label" htmlFor="fc-fob">FOB value of the consignment, US$</label>
                  <input id="fc-fob" className="fc-input" type="number" min="0" step="any" placeholder="0" value={fob} onChange={(e) => setFob(e.target.value)} />
                </div>
              )}

              {hasUsd && (
                <div className="fc-field">
                  <label className="fc-field__label" htmlFor="fc-rate">Exchange rate, GH¢ to US$ 1</label>
                  <div className="fc-row">
                    <input id="fc-rate" className="fc-input" type="number" min="0" step="any" inputMode="decimal" placeholder="0.00" value={rate} onChange={(e) => changeRate(e.target.value)} />
                    <span className="fc-help">Use the rate your office applies today.</span>
                  </div>
                </div>
              )}

              {fam.kind === 'main' && (
                <>
                  <label className={`fc-toggle${pen ? ' is-on' : ''}`}>
                    <input type="checkbox" checked={pen} onChange={(e) => setPen(e.target.checked)} />
                    <span><strong>Charge a non-compliance penalty</strong><span>Late permit renewal, or operating without a permit</span></span>
                  </label>
                  {pen && (
                    <div className="fc-row fc-row--top">
                      <div className="fc-field">
                        <label className="fc-field__label" htmlFor="fc-mult">Multiply by</label>
                        <input id="fc-mult" className="fc-input fc-input--sm" type="number" min="1" step="any" value={mult} onChange={(e) => setMult(e.target.value)} />
                      </div>
                      <div className="fc-field">
                        <label className="fc-field__label" htmlFor="fc-penbase">Applied to</label>
                        <select id="fc-penbase" className="fc-select fc-select--sm" value={penBase} onChange={(e) => setPenBase(e.target.value)}>
                          <option value="permit">Permit fee</option>
                          <option value="both">Processing fee + permit fee</option>
                        </select>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </section>

        <aside className="fc-side" aria-live="polite">
          <div className="fc-total">
            <span className="fc-total__label"><Calculator size={14} /> Total to pay{line ? ` · ${line.kind === 'main' ? (regime === 'C' ? 'Certificate' : 'Permit') : 'Charge'}${pen && line.kind === 'main' ? ' with penalty' : ''}` : ''}</span>
            {!line && <strong className="is-pending">Choose a facility</strong>}
            {line && result.complete && <strong>GH¢ {money(result.total)}</strong>}
            {line && !result.complete && <strong className={anyOk ? '' : 'is-pending'}>{anyOk ? `GH¢ ${money(result.total)}` : 'Not yet worked out'}</strong>}
            {line && missing.length > 0 && <small className="is-warn">{anyOk ? 'So far. ' : ''}Enter {missing.join(' and ')} to finish.</small>}
            {line && !missing.length && <small>{line.label}</small>}
            {!line && <small>Search on the left and pick a result.</small>}
          </div>

          {line && (
            <section className="card fc-card">
              <div className="fc-card__header"><h3>Breakdown</h3><span>{line.id}</span></div>
              <div className="fc-what">
                <span>{fam.title}{line.phase ? ` · ${line.phase} phase` : ''}</span>
                <strong>{line.label}</strong>
              </div>
              <div className="fc-items">
                {result.items.map((it) => it.name === 'Penalty' ? (
                  <div key="pen" className={`fc-item${it.status === 'ok' ? '' : ' is-none'}`}>
                    <div><strong>Non-compliance penalty</strong><span>{it.status === 'ok' ? `${it.mult} × ${it.baseName} (GH¢ ${money(it.base)})` : it.status === 'needRate' ? 'Enter the exchange rate' : 'No fee to base it on'}</span></div>
                    <b>{it.status === 'ok' ? `GH¢ ${money(it.ghs)}` : '–'}</b>
                  </div>
                ) : (
                  <div key={it.name} className={`fc-item${it.status === 'none' ? ' is-none' : ''}`}>
                    <div><strong>{it.name}</strong><span>{calcText(it)}</span></div>
                    <b>{it.status === 'ok' ? `GH¢ ${money(it.ghs)}` : it.usd ? `US$ ${money(it.usd)}` : '–'}</b>
                  </div>
                ))}
              </div>
              {badges.length > 0 && <div className="fc-badges">{badges.map(([c, t]) => <span key={t} className={`badge badge--${c}`}>{t}</span>)}</div>}
              {line.notes && <div className="fc-notice fc-notice--warn">{line.notes}</div>}
              <p className="fc-source">Act 1080, page{line.pages.includes(',') ? 's' : ''} <b>{line.pages}</b></p>
              <div className="fc-row">
                <button type="button" className="btn btn--primary" onClick={copySummary}>
                  {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy summary</>}
                </button>
              </div>
            </section>
          )}
        </aside>
      </div>

      <p className="fc-foot">
        Estimates for officers. The Ghana.gov invoice from the EPA client portal is the bill.
        Amounts come from the Act 1080 schedule, pages 295–445; page 294 is missing from the scan the table was built from.
        {lines.length > 0 && ` ${lines.length} fee lines loaded.`}
      </p>
    </div>
  )
}
