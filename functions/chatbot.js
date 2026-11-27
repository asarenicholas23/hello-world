// Osei, the in-app assistant. The model answers by calling tools that read the
// office's records and run the same fee and forecast logic as the app
// (functions/shared, synced from src/ by scripts/sync-functions-shared.mjs).
const functions = require('firebase-functions')
const { getFirestore } = require('firebase-admin/firestore')
const { getAuth } = require('firebase-admin/auth')
const { OpenAI } = require('openai')
const feeTable = require('./shared/act1080Fees.json')

const openrouterKey = functions.params.defineSecret('OPENROUTER_KEY')

// OpenRouter model id (Claude Sonnet 5.5: $2 / $10 per million tokens in / out, Nov 2026).
// It rejects a non-default temperature, and its thinking counts toward max_tokens.
const CHAT_MODEL = 'anthropic/claude-sonnet-5.5'
const MAX_TOOL_ROUNDS = 6
const CACHE_MS = 5 * 60 * 1000
const DAY = 864e5

const SECTORS = { CU: 'Manufacturing', CI: 'Infrastructure', CH: 'Health', CT: 'Hospitality', CE: 'Energy', PP: 'Agrochemical & Pesticide', CA: 'Agriculture', CM: 'Mining' }
const DISTRICTS = { AAC: 'Asante Akim Central', AAS: 'Asante Akim South', AAN: 'Asante Akim North', SKW: 'Sekyere Kumawu', SAP: 'Sekyere Afram Plains', BF: 'Bosome Freho', KMA: 'Kumasi Metropolitan' }

let sharedModules = null
async function shared() {
  if (!sharedModules) {
    const [fee, capacity, forecast, subSectors] = await Promise.all([
      import('./shared/feeCalc.mjs'),
      import('./shared/capacity.mjs'),
      import('./shared/revenueForecast.mjs'),
      import('./shared/subSectors.mjs'),
    ])
    sharedModules = { FEE: fee.default, ...capacity, ...forecast, ...subSectors }
  }
  return sharedModules
}

async function resolveAuth(data, context) {
  if (context?.auth) return context.auth
  if (data?.auth) return data.auth
  const rawRequest = data?.rawRequest
  const authHeader = rawRequest?.headers?.authorization || rawRequest?.headers?.Authorization
  const token = authHeader?.split('Bearer ')[1] || authHeader?.split('bearer ')[1]
  if (!token) return null
  try {
    const decoded = await getAuth().verifyIdToken(token)
    return { uid: decoded.uid, token: decoded, rawToken: token }
  } catch (err) {
    console.error('chatbot verifyIdToken failed', err)
    return null
  }
}

// ── Data (cached per warm instance) ─────────────────────────────────────────────

let cache = null
async function loadData(db) {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache
  const dec = (id) => { try { return decodeURIComponent(id) } catch { return id } }
  const sub = async (name) => (await db.collectionGroup(name).get()).docs.map((d) => ({ id: d.id, fileNumber: dec(d.ref.parent.parent.id), ...d.data() }))
  const [facilitiesSnap, permits, finance, screenings, siteVerifications, enforcement, monitoring, fieldReportsSnap] = await Promise.all([
    db.collection('facilities').get(),
    sub('permits'), sub('finance'), sub('screenings'), sub('site_verifications'), sub('enforcement'), sub('monitoring'),
    db.collection('field_reports').get(),
  ])
  const facilities = facilitiesSnap.docs.map((d) => ({ ...d.data(), file_number: dec(d.id) }))
  const fieldReports = fieldReportsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
  const { buildCapacityIndex, buildFeeContext } = await shared()
  const capacityIndex = buildCapacityIndex({ screenings, siteVerifications, fieldReports })
  const ctx = buildFeeContext({ feeTable, facilities, finance, capacityIndex })
  const byFile = (list) => {
    const m = new Map()
    for (const r of list) { if (!m.has(r.fileNumber)) m.set(r.fileNumber, []); m.get(r.fileNumber).push(r) }
    return m
  }
  cache = {
    at: Date.now(), facilities, permits, finance, screenings, siteVerifications, enforcement, monitoring, fieldReports, ctx,
    facilityByFile: new Map(facilities.map((f) => [f.file_number, f])),
    permitsByFile: byFile(permits), financeByFile: byFile(finance), enforcementByFile: byFile(enforcement),
    screeningsByFile: byFile(screenings), siteVerificationsByFile: byFile(siteVerifications), monitoringByFile: byFile(monitoring),
  }
  return cache
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

function ms(v) {
  if (v == null || v === '') return null
  if (typeof v === 'number') return v
  if (typeof v.toMillis === 'function') return v.toMillis()
  if (typeof v.seconds === 'number') return v.seconds * 1000
  if (typeof v._seconds === 'number') return v._seconds * 1000
  const t = new Date(v).getTime()
  return Number.isNaN(t) ? null : t
}
function day(v) { const t = ms(v); return t ? new Date(t).toISOString().slice(0, 10) : null }
function cedis(x) { return Math.round((Number(x) || 0) * 100) / 100 }
function districtName(code) { return DISTRICTS[code] ?? (code || 'Unknown') }
function sectorName(prefix) { return SECTORS[prefix] ?? prefix ?? null }
function clean(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && !v.length)))
}

function permitInfo(data, fileNumber, now = Date.now()) {
  const list = data.permitsByFile.get(fileNumber) ?? []
  let latest = null
  for (const p of list) { const e = ms(p.expiry_date); if (e && (!latest || e > latest.e)) latest = { e, p } }
  if (!latest) return { status: 'none', expiry: null, permit_number: null }
  const status = latest.e < now ? 'expired' : latest.e < now + 60 * DAY ? 'expiring' : 'active'
  return { status, expiry: day(latest.e), permit_number: latest.p.permit_number ?? null }
}

function matchesText(f, q, extra = '') {
  const hay = [f.name, f.file_number, f.type_of_undertaking, f.location, f.contact_person, f.district, districtName(f.district), extra].join(' ').toLowerCase()
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((t) => hay.includes(t))
}

function resolveDistrict(input) {
  if (!input) return null
  const s = String(input).trim().toLowerCase()
  const hit = Object.entries(DISTRICTS).find(([code, name]) => code.toLowerCase() === s || name.toLowerCase() === s || name.toLowerCase().includes(s))
  return hit ? hit[0] : String(input).toUpperCase()
}
function resolveSector(input) {
  if (!input) return null
  const s = String(input).trim().toLowerCase()
  const hit = Object.entries(SECTORS).find(([p, name]) => p.toLowerCase() === s || name.toLowerCase().includes(s))
  return hit ? hit[0] : String(input).toUpperCase()
}

// "gold board", "gold trading", "GoldBod", "gold_board" → 'gold_board'.
function resolveSubSector(input, SUB_SECTORS) {
  if (!input) return null
  const s = String(input).trim().toLowerCase().replace(/[_-]+/g, ' ')
  if (/gold/.test(s)) return 'gold_board'
  const hit = SUB_SECTORS.find((x) => x.value.replace(/_/g, ' ') === s || x.name.toLowerCase().includes(s))
  return hit ? hit.value : '__none__'
}

const SUB_SECTOR_PARAM = { type: 'string', description: 'Sub-sector, e.g. "Gold board applications" (gold trading / gold buying offices, under Infrastructure, Tier 1 or Tier 2).' }

function periodRange(args, now = Date.now()) {
  if (args.from || args.to) return { from: args.from ? ms(args.from) : null, to: args.to ? ms(`${args.to}T23:59:59`) ?? ms(args.to) : null }
  const days = { month: 30, quarter: 91, half_year: 182, year: 365 }[args.period ?? 'year'] ?? 365
  return { from: now, to: now + days * DAY }
}

// ── Tools ───────────────────────────────────────────────────────────────────────

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'search_facilities',
      description: 'Find facilities by name, file number, type of undertaking, location or contact, and/or filter by district, sector, sub-sector (e.g. Gold board applications) or permit status. Returns up to `limit` matches with permit status.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Words to match, e.g. "Asuo Barima", "fuel station Juaso", "CT0006".' },
          district: { type: 'string', description: 'District name or code, e.g. "Asante Akim Central" or "AAC".' },
          sector: { type: 'string', description: 'Sector name or prefix, e.g. "Hospitality" or "CT".' },
          sub_sector: SUB_SECTOR_PARAM,
          permit_status: { type: 'string', enum: ['active', 'expiring', 'expired', 'none'], description: 'expiring = within 60 days.' },
          limit: { type: 'integer', description: 'Default 15, max 50.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_facility',
      description: 'Full record for one facility: profile, permits, payments, screenings, site verifications, monitoring, enforcement, capacities found in field records, and the estimated fee (paid history vs Act 1080).',
      parameters: { type: 'object', properties: { file_number: { type: 'string' } }, required: ['file_number'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'revenue_forecast',
      description: 'Revenue the office can expect in a future window: renewals due, backlog (expired or no permit and not paid since), unpaid invoices and new applications on trend. Also gives the expected amount after the historical collection rate and the top facilities to target.',
      parameters: {
        type: 'object',
        properties: {
          period: { type: 'string', enum: ['month', 'quarter', 'half_year', 'year'], description: 'Window starting today. Default year.' },
          from: { type: 'string', description: 'Start date YYYY-MM-DD (instead of period).' },
          to: { type: 'string', description: 'End date YYYY-MM-DD (instead of period).' },
          include_backlog: { type: 'boolean', description: 'Default true.' },
          include_penalty: { type: 'boolean', description: 'Add 3 × permit fee to backlog facilities. Default false; only when the user asks.' },
          district: { type: 'string' },
          sector: { type: 'string' },
          sub_sector: SUB_SECTOR_PARAM,
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'finance_summary',
      description: 'What has been billed and paid in a past window, grouped by district, sector, payment type, month or facility.',
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'YYYY-MM-DD' },
          to: { type: 'string', description: 'YYYY-MM-DD' },
          group_by: { type: 'string', enum: ['district', 'sector', 'payment_type', 'month', 'facility'] },
          district: { type: 'string' },
          sector: { type: 'string' },
          sub_sector: SUB_SECTOR_PARAM,
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calculate_fee',
      description: 'Look up Act 1080 fees for a kind of undertaking (the Fee Calculator). Returns the matching fee lines with processing and permit fees, and the total when a capacity is given. Use for "how much does a X pay" questions about a type rather than a specific facility.',
      parameters: {
        type: 'object',
        properties: {
          undertaking: { type: 'string', description: 'e.g. "hotel", "sachet water", "fuel filling station", "church", "hostel".' },
          capacity: { type: 'number', description: 'Rooms, beds, bags a day, litres, tonnes, seats or housing units, whichever the line uses.' },
          phase: { type: 'string', enum: ['Construction', 'Operation'], description: 'Default Operation.' },
          penalty: { type: 'boolean', description: 'Add 3 × permit fee.' },
        },
        required: ['undertaking'],
      },
    },
  },
]

async function search_facilities(data, args) {
  const { SUB_SECTORS, facilitySubSector } = await shared()
  const district = resolveDistrict(args.district)
  const sector = resolveSector(args.sector)
  const subSector = resolveSubSector(args.sub_sector, SUB_SECTORS)
  const limit = Math.min(Math.max(Number(args.limit) || 15, 1), 50)
  const now = Date.now()
  const hits = []
  for (const f of data.facilities) {
    if (district && f.district !== district) continue
    if (sector && f.sector_prefix !== sector) continue
    const sub = facilitySubSector(f)
    if (subSector && sub?.value !== subSector) continue
    if (args.query && !matchesText(f, args.query, sub?.name)) continue
    const p = permitInfo(data, f.file_number, now)
    if (args.permit_status && p.status !== args.permit_status) continue
    hits.push({ f, p, sub })
  }
  return {
    total_matches: hits.length,
    facilities: hits.slice(0, limit).map(({ f, p, sub }) => clean({
      file_number: f.file_number, name: f.name, type: f.type_of_undertaking, district: districtName(f.district),
      sector: sectorName(f.sector_prefix), sub_sector: sub?.name, location: f.location, permit_status: p.status, permit_expiry: p.expiry,
    })),
  }
}

async function get_facility(data, args) {
  const fn = String(args.file_number ?? '').trim()
  const f = data.facilityByFile.get(fn) ?? data.facilities.find((x) => x.file_number.toLowerCase() === fn.toLowerCase())
  if (!f) return { error: `No facility with file number ${fn}. Use search_facilities to find it.` }
  const { estimateFacility, facilitySubSector } = await shared()
  const file = f.file_number
  const est = estimateFacility(f, data.ctx, { application: (data.permitsByFile.get(file) ?? []).length ? 'renewal' : 'new' })
  const caps = Object.fromEntries(Object.entries(est.capacities ?? {}).map(([k, v]) => [k, `${v.value} (from ${v.source}${v.dateMs ? `, ${day(v.dateMs)}` : ''})`]))
  const sortByDate = (list, key = 'date') => [...(list ?? [])].sort((a, b) => (ms(b[key]) ?? ms(b.created_at) ?? 0) - (ms(a[key]) ?? ms(a.created_at) ?? 0))
  return clean({
    file_number: file, name: f.name, type: f.type_of_undertaking, sector: sectorName(f.sector_prefix), sub_sector: facilitySubSector(f)?.name, district: districtName(f.district),
    location: f.location, contact: f.contact_person, phone: f.phone, email: f.email, officer: f.primary_officer_name,
    permit: permitInfo(data, file),
    permits: sortByDate(data.permitsByFile.get(file), 'issue_date').slice(0, 5).map((p) => clean({ permit_number: p.permit_number, issued: day(p.issue_date), expires: day(p.expiry_date) })),
    payments: sortByDate(data.financeByFile.get(file)).slice(0, 10).map((r) => clean({ date: day(r.date ?? r.created_at), type: r.payment_type, amount: cedis(r.amount), status: r.payment_status ?? 'paid', reference: r.reference_number })),
    screenings: sortByDate(data.screeningsByFile.get(file)).slice(0, 3).map((s) => clean({ date: day(s.date ?? s.created_at), capacity: s.capacity, officer: s.officer_name, notes: s.notes })),
    site_verifications: sortByDate(data.siteVerificationsByFile.get(file)).slice(0, 3).map((s) => clean({ date: day(s.date ?? s.created_at), officer: s.officer_name, notes: s.notes })),
    monitoring_visits: (data.monitoringByFile.get(file) ?? []).length,
    enforcement: sortByDate(data.enforcementByFile.get(file)).slice(0, 5).map((e) => clean({ date: day(e.date ?? e.created_at), action: e.action_taken, notes: e.notes })),
    capacities_on_record: caps,
    fee_estimate: clean({
      processing: est.processing, permit: est.permit, total: est.total, basis: est.sourceLabel,
      act_1080: est.act ? clean({
        activities: est.act.parts.map((x) => clean({ activity: x.ruleLabel, line: `${x.lineId} ${x.lineLabel}`, processing: x.processing, permit: x.permit, total: x.total, capacity_used: x.qty ? `${x.qty.value} ${x.qty.unit} (${x.qty.source})` : null, pages: x.pages })),
        not_priced: est.act.unpriced.length ? est.act.unpriced.map((u) => `${u.ruleLabel}: ${u.why}`) : null,
        processing: est.act.processing, permit: est.act.permit, total: est.act.total, note: est.act.note,
      }) : 'No Act 1080 line mapped for this type of undertaking',
      penalty_if_charged: cedis(est.permit * 3),
    }),
  })
}

async function revenue_forecast(data, args) {
  const { buildRevenueForecast, SOURCE_NAMES, SUB_SECTORS, facilitySubSector } = await shared()
  const district = resolveDistrict(args.district)
  const sector = resolveSector(args.sector)
  const subSector = resolveSubSector(args.sub_sector, SUB_SECTORS)
  const facilities = data.facilities.filter((f) => (!district || f.district === district) && (!sector || f.sector_prefix === sector)
    && (!subSector || facilitySubSector(f)?.value === subSector))
  const range = periodRange(args)
  const fc = buildRevenueForecast({
    facilities, permits: data.permits, finance: data.finance, ctx: data.ctx, range,
    includeBacklog: args.include_backlog !== false, includePenalty: args.include_penalty === true,
  })
  const backlog = fc.rows.filter((r) => r.stream === 'backlog')
  const byGroup = (key, label) => {
    const m = {}
    fc.rows.forEach((r) => { const k = label(r[key]); m[k] = cedis((m[k] ?? 0) + r.total) })
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, total]) => ({ name, total }))
  }
  return {
    window: { from: day(range.from), to: day(range.to) },
    possible_total: fc.possible,
    how_the_total_adds_up: 'possible_total is exactly renewals_due + backlog + unpaid_invoices + new_applications. Each facility is in at most one stream: a facility with an unpaid invoice is counted only there, never again as a renewal or backlog.',
    expected_total: fc.expected,
    collection_rate_pct: fc.collectionRate != null ? Math.round(fc.collectionRate * 100) : null,
    streams: {
      renewals_due: fc.streams.renewal,
      backlog: { ...fc.streams.backlog, expired: backlog.filter((r) => r.backlogReason === 'expired').length, no_permit: backlog.filter((r) => r.backlogReason === 'no permit').length },
      unpaid_invoices: fc.streams.unpaid,
      new_applications: fc.streams.new,
    },
    penalty_included: args.include_penalty === true,
    penalty_potential_if_charged: cedis(backlog.reduce((s, r) => s + r.permit, 0) * 3),
    estimate_basis_counts: fc.sourceCounts,
    by_district: byGroup('facilityDistrict', districtName),
    by_sector: byGroup('sectorPrefix', sectorName),
    top_targets: [...fc.rows].sort((a, b) => b.total - a.total).slice(0, 10).map((r) => clean({
      file_number: r.fileNumber, name: r.facilityName, stream: r.stream, reason: r.backlogReason, expiry: r.expiryMs ? day(r.expiryMs) : null,
      estimate: r.total, basis: SOURCE_NAMES[r.source] ?? r.source,
    })),
  }
}

async function finance_summary(data, args) {
  const { paymentKind, SUB_SECTORS, facilitySubSector } = await shared()
  const district = resolveDistrict(args.district)
  const sector = resolveSector(args.sector)
  const subSector = resolveSubSector(args.sub_sector, SUB_SECTORS)
  const from = args.from ? ms(args.from) : null
  const to = args.to ? ms(`${args.to}T23:59:59`) ?? ms(args.to) : null
  const rows = data.finance.filter((r) => {
    const f = data.facilityByFile.get(r.fileNumber)
    if (district && f?.district !== district) return false
    if (sector && f?.sector_prefix !== sector) return false
    if (subSector && (!f || facilitySubSector(f)?.value !== subSector)) return false
    const t = ms(r.date) ?? ms(r.created_at)
    if (from != null && (!t || t < from)) return false
    if (to != null && (!t || t > to)) return false
    return true
  })
  const groupKey = (r) => {
    const f = data.facilityByFile.get(r.fileNumber)
    switch (args.group_by) {
      case 'district': return districtName(f?.district) ?? 'Unknown'
      case 'sector': return sectorName(f?.sector_prefix) ?? 'Unknown'
      case 'payment_type': return paymentKind(r.payment_type)
      case 'month': return (day(r.date ?? r.created_at) ?? 'unknown').slice(0, 7)
      case 'facility': return `${f?.name ?? r.fileNumber} (${r.fileNumber})`
      default: return 'All'
    }
  }
  const groups = {}
  let billed = 0; let paid = 0
  for (const r of rows) {
    const a = Number(r.amount) || 0
    const isPaid = (r.payment_status ?? 'paid') !== 'unpaid'
    billed += a; if (isPaid) paid += a
    const g = (groups[groupKey(r)] ??= { billed: 0, paid: 0, unpaid: 0, records: 0 })
    g.billed += a; g.records += 1
    if (isPaid) g.paid += a; else g.unpaid += a
  }
  const list = Object.entries(groups).map(([name, g]) => ({ name, billed: cedis(g.billed), paid: cedis(g.paid), unpaid: cedis(g.unpaid), records: g.records }))
  list.sort((a, b) => (args.group_by === 'month' ? a.name.localeCompare(b.name) : b.billed - a.billed))
  return {
    window: { from: args.from ?? 'all', to: args.to ?? 'all' },
    records: rows.length, billed: cedis(billed), paid: cedis(paid), unpaid: cedis(billed - paid),
    note: 'Most finance records in the app start in December 2025; earlier payments were mostly not migrated.',
    groups: list.slice(0, 25),
  }
}

async function calculate_fee(data, args) {
  const { FEE } = await shared()
  const lines = feeTable.main.map(FEE.rowToLine)
  const fams = FEE.buildFamilies(lines)
  const phase = args.phase ?? 'Operation'
  const found = FEE.search(fams, String(args.undertaking ?? '')).slice(0, 4)
  if (!found.length) return { error: `No Act 1080 line matches "${args.undertaking}". Try other words, e.g. "hotel", "filling station", "sachet".` }
  const cap = Number(args.capacity)
  return {
    note: 'Permitting rates (new or renewal); per-unit lines multiply by the capacity. Impact scale (large…micro) is not defined by Act 1080 or L.I. 2504: use the scale assigned at screening.',
    matches: found.map((fam) => {
      const inPhase = fam.lines.filter((l) => !l.phase || l.phase === phase)
      const useLines = inPhase.length ? inPhase : fam.lines
      const band = Number.isFinite(cap) && cap > 0 ? useLines.find((l) => FEE.inBand(l, cap)) : null
      const show = band ? [band] : useLines.slice(0, 8)
      return {
        family: fam.title, sector: fam.sector,
        lines: show.map((l) => {
          const b = FEE.bill(l, { regime: 'P', qty: Number.isFinite(cap) && cap > 0 ? cap : null, rate: null, penalty: { on: !!args.penalty, mult: 3, base: 'permit' } })
          return clean({
            line: `${l.id} ${FEE.stripNumbering(l.label)}`, phase: l.phase, band: l.bmin != null || l.bmax != null ? `${l.bmin ?? ''}–${l.bmax ?? ''} ${l.unit}` : null,
            basis: l.basis, processing: l.fees.pp?.cur === 'GHS' ? l.fees.pp.v : l.fees.pp ? `${l.fees.pp.cur} ${l.fees.pp.v}` : null,
            permit: l.fees.pm?.cur === 'GHS' ? l.fees.pm.v : l.fees.pm ? `${l.fees.pm.cur} ${l.fees.pm.v}` : null,
            total_for_capacity: b.complete ? b.total : null, needs_capacity: b.needQty || null, pages: l.pages,
          })
        }),
      }
    }),
  }
}

const TOOL_IMPL = { search_facilities, get_facility, revenue_forecast, finance_summary, calculate_fee }

function systemPrompt() {
  const today = new Date().toISOString().slice(0, 10)
  return `You are Osei, the assistant in the Ghana EPA Konongo Area Office permit app. Today is ${today}.

You answer from the office's records using the tools. Always call a tool before giving a number, a facility detail or a list; never invent facilities, amounts or dates. If a tool returns nothing useful, say what you checked and what is missing.

How the office's money works:
- Every facility pays a processing fee and a permit fee under the Fees and Charges (Miscellaneous Provisions) Act, 2022 (Act 1080). Permits usually run 12–24 months.
- Estimates come from, in order: what the facility paid before, the Act 1080 line for each activity it does and its capacity (a facility doing several things, e.g. a hotel with a restaurant, pays for each, added up; the sector it is filed under does not limit this), what similar facilities paid, the sector median. Always say which basis a figure uses.
- Gold board applications are a sub-sector of Infrastructure: offices for the sale of gold (gold trading, gold buying). Their fees are office practice, not in Act 1080: Tier 1 processing GH¢2,000 + permit GH¢10,000; Tier 2 processing GH¢5,000 + permit GH¢15,000. Use sub_sector "Gold board applications" to find or total them.
- Capacities (rooms, beds, bags a day, tank litres) come from screenings and site verifications. When a typical size was assumed, say so.
- Non-compliance penalty (late renewal or operating without a permit) is 3 × the permit fee. Do not include it unless the user asks; you may mention what it would add.
- Neither Act 1080 nor the Environmental Assessment Regulations, 2025 (L.I. 2504) define large/medium/small/minor/micro impact scale; that comes from screening.
- These are estimates. The Ghana.gov invoice from the EPA client portal is the bill.
- "Expected" revenue applies the office's historical collection rate (paid ÷ billed) to the possible total.

Answer style: short and direct, in plain text (no tables, no markdown headings). Lead with the answer. Use GH¢ with thousands separators. Use short "- " lists for several items. Mention file numbers so staff can find facilities. You can only read data; you cannot edit records, send messages or assign work.`
}

exports.chatbot = functions.https.onCall({ secrets: [openrouterKey], timeoutSeconds: 120, memory: '512MiB' }, async (data, context) => {
  const authContext = await resolveAuth(data, context)
  const payload = Array.isArray(data?.messages) ? data.messages : Array.isArray(data?.data?.messages) ? data.data.messages : []
  if (!authContext) throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated')

  // Only user and assistant turns from the client; the last 16, each capped in length.
  const history = payload
    .filter((m) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string')
    .slice(-16)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }))
  if (!history.some((m) => m.role === 'user')) throw new functions.https.HttpsError('invalid-argument', 'No question was sent')

  const openai = new OpenAI({ apiKey: process.env.OPENROUTER_KEY, baseURL: 'https://openrouter.ai/api/v1' })
  const db = getFirestore()

  try {
    const store = await loadData(db)
    const messages = [{ role: 'system', content: systemPrompt() }, ...history]
    const toolLog = []
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
      const response = await openai.chat.completions.create({
        model: CHAT_MODEL,
        messages,
        tools: round < MAX_TOOL_ROUNDS ? TOOLS : undefined,
        max_tokens: 4000,
      })
      const msg = response.choices[0].message
      const calls = msg.tool_calls ?? []
      if (!calls.length) {
        console.log('chatbot answered', { uid: authContext.uid, rounds: round, tools: toolLog })
        // The chat window shows plain text, so drop markdown emphasis and headings.
        const reply = (msg.content || '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/^#{1,6}\s+/gm, '')
        return { reply: reply || 'Sorry, I could not put an answer together. Please rephrase the question.' }
      }
      messages.push({ role: 'assistant', content: msg.content || null, tool_calls: calls })
      for (const call of calls) {
        let result
        try {
          const impl = TOOL_IMPL[call.function.name]
          const args = JSON.parse(call.function.arguments || '{}')
          result = impl ? await impl(store, args) : { error: `Unknown tool ${call.function.name}` }
          toolLog.push(call.function.name)
        } catch (err) {
          console.error('chatbot tool failed', call.function.name, err)
          result = { error: `The ${call.function.name} lookup failed: ${err.message}` }
        }
        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result).slice(0, 14000) })
      }
    }
    return { reply: 'That question needed more lookups than I can do at once. Please ask about one facility, district or period at a time.' }
  } catch (error) {
    console.error('OpenRouter API error:', { message: error?.message, stack: error?.stack, response: error?.response?.data ?? null })
    throw new functions.https.HttpsError('internal', 'Failed to get chatbot response')
  }
})

// Exposed for local testing of the tools without the model.
exports._tools = { loadData, TOOL_IMPL }
