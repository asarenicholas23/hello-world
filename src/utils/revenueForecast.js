// Revenue estimates and forecasts built on the Act 1080 fee table.
//
// Every facility gets an estimate from the first source that has one:
//   1. what the facility itself paid last time (finance records)
//   2. the Act 1080 line for each activity it does (whatever sector it is filed under),
//      priced at its capacity (from screenings / site verifications, else the typical
//      size of similar facilities) and added up
//   3. what similar facilities paid (median)
//   4. the sector median
// The Act 1080 figure is also kept separately on each estimate so the app can show
// "possible finance from Act 1080" next to what was actually invoiced.
//
// Pricing uses the Act's permitting columns (falling back to certification where a
// permitting cell is blank): the office's paid invoices match the permitting figures
// (e.g. churches 990 + 5,000; fuel stations 0.02 + 0.03 per litre).
//
// Pure functions: no React, no Firestore. Copied into functions/shared for the assistant.

import FEE from './feeCalc.js'
import { toMs } from './capacity.js'

const DAY = 864e5

function median(values) {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b)
  if (!v.length) return null
  const m = v.length >> 1
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2
}

function round(x) { return Math.round(x * 100) / 100 }

export function normalizeType(t) {
  return String(t ?? '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
}

export function paymentKind(type) {
  const t = String(type ?? '').toLowerCase()
  if (/process/.test(t)) return 'processing'
  if (/penalt/.test(t)) return 'penalty'
  if (/permit|certif|licen/.test(t)) return 'permit'
  return 'other'
}

// ── Fee rules: type of undertaking → Act 1080 line(s) ───────────────────────────
// lines: candidate line IDs (Operation phase). cap: capacity keys to read, in order.
// Banded lines are picked by capacity; per-unit lines multiply by it.
//
// A facility is priced on what it does, not on the sector it is filed under: a
// filling station filed under Infrastructure still pays the fuel-station fee.
// A facility can do several things ("Hotel and restaurant", "Fuel and LPG station");
// every activity found is priced and the fees are added, as on the Fee Calculator's bill.
//
// re: words that name the activity. weak: vaguer words ("station", "residential") that
// count only when nothing else in the text names an activity; weakSectors limits those
// to facilities filed under that sector. covers: activities this line already includes.
// Impact scale. Neither Act 1080 nor L.I. 2504 defines it; the office assigns it at
// screening. Lines priced by scale use the facility's `impact_scale` (set on the Finance
// tab) and Small when none is saved.
export const IMPACT_SCALES = ['Large', 'Medium', 'Small', 'Minor', 'Micro']
export const DEFAULT_SCALE = 'Small'
function scaleLines(...ids) { return Object.fromEntries(ids.map((id, i) => [IMPACT_SCALES[i], id])) }
const OTHER_CONSTRUCTION = scaleLines('L0491', 'L0492', 'L0493', 'L0494', 'L0495')

// The scale's line, or the nearest scale the Act lists for that activity.
function lineForScale(rule, scale) {
  const order = IMPACT_SCALES.indexOf(scale)
  const listed = IMPACT_SCALES.filter((s) => rule.scale[s])
  const pick = listed.sort((a, b) => Math.abs(IMPACT_SCALES.indexOf(a) - order) - Math.abs(IMPACT_SCALES.indexOf(b) - order))[0]
  return { scale: pick, id: rule.scale[pick] }
}

export const FEE_RULES = [
  // Gold Board applications (offices for the sale of gold): office practice, not in Act 1080
  // (lines L0650/L0651 in the workbook). Tier 2 only when the record says so.
  { id: 'gold2', label: 'Gold trading, Gold Board application (Tier 2)', re: /gold.*\btier ?(2|ii|two)\b|\btier ?(2|ii|two)\b.*gold/, lines: ['L0651'], cap: [],
    note: 'Gold Board application fees are office practice, not in Act 1080.' },
  { id: 'gold1', label: 'Gold trading, Gold Board application (Tier 1)', re: /gold ?(trad\w*|buy\w*|deal\w*|sales?|sell\w*|board|bod|office|shop|merchant\w*|exchange)|goldbod|\b(buy\w*|sell\w*|sales?|trad\w*|deal\w*)( and \w+)?( of)? gold\b/, weak: /\bgold\b(?! ?min)/, weakSectors: ['CI'], lines: ['L0650'], cap: [],
    note: 'Gold Board application fees are office practice, not in Act 1080.',
    assumedNote: 'Tier is not on the record, so Tier 1 is used; change it to Tier 2 on the Finance tab if that applies.', assumedUnless: /\btier\b/ },
  { id: 'hostel', label: 'Hostel (per room)', re: /\bhostel|homestel/, lines: ['L0502', 'L0503', 'L0504', 'L0505', 'L0506', 'L0507'], cap: ['rooms'] },
  { id: 'hotel', label: 'Hotel / guest house (per room)', re: /hotel|guest ?house|gu?e?st ?house|geust ?house|guset ?house|motel|lodge|\binn\b|resort/, lines: ['L0640'], cap: ['rooms'],
    note: 'Act 1080 has no separate guest-house line; the hotel per-room rate (5–40 rooms) is used.', noteIf: /guest|lodge|\binn\b|motel/ },
  { id: 'lpg', label: 'LPG refilling station (per tonne of tank storage)', re: /\blpg\b|liquefied|liquified|gas refill\w*|gas station|gas filling/, lines: ['L0172'], cap: ['tonnes', 'litres'] },
  { id: 'fuel', label: 'Fuel service/filling station (per litre of tank storage)', re: /fuel|filling|service station|petrol|diesel/, weak: /stat+ion$|\bstation\b|energy|\boil\b/, weakSectors: ['CE'], lines: ['L0173'], cap: ['litres'] },
  { id: 'sachet', label: 'Sachet water production (bags per day)', re: /sachet|pure water/, lines: ['L0432', 'L0431', 'L0430', 'L0429'], cap: ['bags_per_day', 'production'],
    covers: ['bottled_water'], fallback: 'bottled_water' },
  { id: 'maternity', label: 'Maternity home with clinic', re: /maternity/, lines: ['L0578'], cap: [], covers: ['hospital'] },
  { id: 'mortuary', label: 'Mortuary (cold rooms)', re: /mortuar|motuar/, lines: ['L0587', 'L0583', 'L0577', 'L0572', 'L0570'], cap: ['rooms'], defaultLine: 'L0587' },
  { id: 'hospital', label: 'Hospital / clinic (beds)', re: /hospital|clinic|chps|health (centre|center|facility)|medical (centre|center)|polyclinic|herbal/, lines: ['L0581', 'L0582', 'L0573', 'L0574', 'L0575', 'L0571', 'L0569'], cap: ['beds'],
    note: 'Clinics are priced on the hospital bed bands, as on the Choice Clinic invoice (Act 1080 p.313).' },
  { id: 'lab', label: 'Diagnostic centre / laboratory', re: /laborator|diagnos|daignos|scan (centre|center)/, lines: ['L0586'], cap: [] },
  { id: 'religious', label: 'Religious facility', re: /church|mosque|chapel|worship|religious|tabernacle|temple|pentecost|assembl(y|ies) of god|ministr(y|ies) int|\bministries\b/, weak: /auditor/, scale: OTHER_CONSTRUCTION, cap: [],
    scaleNote: 'Small matches what churches have paid (990 + 5,000).' },
  { id: 'apartments', label: 'Apartments (per housing unit)', re: /apartment|apartemnt|\bflats?\b/, weak: /residential|real estate|housing/, lines: ['L0470'], cap: ['housing_units'] },
  { id: 'telecom', label: 'Telecom mast', re: /\bmast\b|telecom/, weak: /tower/, lines: ['L0643'], newLines: ['L0642'], cap: [] },
  { id: 'restaurant', label: 'Restaurant / pub (per seat)', re: /restaurant|\bpub\b|\bbar\b|eatery|chop ?bar|drinking (spot|bar|joint)/, weak: /drinking|lounge/, lines: ['L0641'], cap: ['seats'] },
  { id: 'events', label: 'Events centre', re: /event/, lines: ['L0485'], cap: [] },
  // ── Act 1080 sub-sectors priced by impact scale or floor area ──
  { id: 'charcoal', label: 'Charcoal production and briquettes', re: /charcoal|briquet/, scale: scaleLines('L0425', 'L0426', 'L0427', 'L0428') },
  { id: 'wood', label: 'Wood processing (sawmill, timber)', re: /saw ?mill|wood (process\w*|work\w*|pole\w*)|timber|lumber|plywood|veneer/, scale: scaleLines('L0303', 'L0304', 'L0305', 'L0306', 'L0307') },
  { id: 'concrete_batching', label: 'Concrete batching plant', re: /concrete batching|batching plant/, scale: scaleLines('L0313', 'L0314', 'L0315', 'L0316', 'L0317') },
  { id: 'blocks', label: 'Cement/concrete products (blocks, culverts, pavement blocks)', re: /\bblocks? ?(factory|making|production|manufactur\w*|moulding|industry)|culvert|pavement block|paving (stone|block)|concrete products/, scale: scaleLines('L0318', 'L0319', 'L0320', 'L0321', 'L0322') },
  { id: 'waste_oil', label: 'Waste oil recycling / lube', re: /(used|waste) oil (recycl\w*|refin\w*|process\w*)|lube (oil )?(blend\w*|production|plant)|lubricant (blend\w*|production|manufactur\w*)/, scale: scaleLines('L0343', 'L0344', 'L0345', 'L0346', 'L0347') },
  { id: 'oil_fat', label: 'Oil and fat processing (cooking oil, palm oil, shea)', re: /cooking oil|palm (kernel )?oil|vegetable oil|oil mill|oil and fat|kernel oil|shea/, scale: scaleLines('L0293', 'L0294', 'L0295', 'L0296', 'L0297') },
  { id: 'bottled_water', label: 'Bottled water (with or without sachet)', re: /bottled water|mineral water|water (production|manufactur\w*|factory|bottling|processing)/, scale: scaleLines('L0308', 'L0309', 'L0310', 'L0311', 'L0312') },
  { id: 'brewery', label: 'Brewery', re: /brewer/, scale: scaleLines('L0268', 'L0269', 'L0270', 'L0271', 'L0272') },
  { id: 'beverages', label: 'Alcoholic and non-alcoholic beverages', re: /beverage (production|manufactur\w*|factory|processing)|fruit juice|soft drink|distill|akpeteshie|gin (production|distill)/, scale: scaleLines('L0366', 'L0367', 'L0368', 'L0369', 'L0370') },
  { id: 'cocoa_processing', label: 'Cocoa processing', re: /cocoa process/, scale: scaleLines('L0357', 'L0358', 'L0359', 'L0360', 'L0361') },
  { id: 'fish_processing', label: 'Fish processing', re: /fish (process\w*|smok\w*)/, scale: scaleLines('L0376', 'L0377', 'L0378', 'L0379') },
  { id: 'meat_processing', label: 'Meat processing / abattoir', re: /slaughter|abattoir|meat (process\w*|company|compay|factory|plant)/, scale: scaleLines('L0380', 'L0381', 'L0382', 'L0383') },
  { id: 'food', label: 'Food processing (cassava, rice mill, bakery)', re: /food (process\w*|production|manufactur\w*|factory)|cassava|\bgari\b|(rice|corn|maize|grain|flour) ?mill\w*|bakery|bread|cereal process|milling/, scale: scaleLines('L0400', 'L0401', 'L0402', 'L0403', 'L0404') },
  { id: 'pharma', label: 'Pharmaceutical manufacturing', re: /pharmaceutical (manufactur\w*|production|factory)|drug manufactur/, scale: scaleLines('L0348', 'L0349', 'L0350', 'L0351', 'L0352') },
  { id: 'agrochem_formulation', label: 'Agrochemical formulation (fertiliser manufacturing)', re: /fertili[sz]er (manufactur\w*|production|blending|formulat\w*|factory)|agro ?chemical formulat/, scale: scaleLines('L0283', 'L0284', 'L0285', 'L0286', 'L0287') },
  { id: 'paints', label: 'Paints / chemicals production (incl. soap)', re: /paint (production|manufactur\w*|factory)|soap|detergent|chemical (production|manufactur\w*)/, scale: scaleLines('L0371', 'L0372', 'L0373', 'L0374', 'L0375') },
  { id: 'battery', label: 'Lead acid battery production and recycling', re: /batter(y|ies) (recycl\w*|production|manufactur\w*)|lead acid/, scale: scaleLines('L0328', 'L0329', 'L0330', 'L0331', 'L0332') },
  { id: 'plastic_recycling', label: 'Plastic recycling (incl. collection)', re: /(plastic|plactic)\w* (recycl\w*|collect\w*)|(recycl\w*|collect\w*) of (plastic|plactic)/, scale: scaleLines('L0288', 'L0289', 'L0290', 'L0291', 'L0292') },
  { id: 'plastic_products', label: 'Plastic products manufacturing', re: /plastic (products|manufactur\w*|factory)/, scale: scaleLines('L0396', 'L0397', 'L0398', 'L0399') },
  { id: 'metal_recycling', label: 'Metal smelting / recycling (incl. steel)', re: /smelt|metal recycl|steel (manufactur\w*|production|mill|rolling)|iron rod/, scale: scaleLines('L0298', 'L0299', 'L0300', 'L0301', 'L0302') },
  { id: 'scrap', label: 'Scrap collection (metal recycling line)', re: /scraps?\b/, scale: scaleLines('L0298', 'L0299', 'L0300', 'L0301', 'L0302'), defaultScale: 'Micro',
    scaleNote: 'Scrap collection is priced on the metal smelting/recycling line at Micro scale unless another scale is set.' },
  { id: 'metal_fabrication', label: 'Metal fabrication (incl. nails, roofing sheets)', re: /metal fabricat|fabrication|welding|\bnails?\b|roofing sheet/, scale: scaleLines('L0362', 'L0363', 'L0364', 'L0365') },
  { id: 'paper', label: 'Paper and paper recycling', re: /paper (mill|recycl\w*|manufactur\w*|production)|tissue paper/, scale: scaleLines('L0384', 'L0385', 'L0386', 'L0387') },
  { id: 'printing', label: 'General / commercial printing', re: /printing/, scale: scaleLines('L0323', 'L0324', 'L0325', 'L0326', 'L0327') },
  { id: 'textiles', label: 'Textiles', re: /textile|garment/, scale: scaleLines('L0273', 'L0274', 'L0275', 'L0276', 'L0277') },
  { id: 'asphalt', label: 'Asphalt / bitumen batching plant', re: /asphalt|bitumen/, scale: scaleLines('L0421', 'L0422', 'L0423', 'L0424') },
  { id: 'vehicle_assembly', label: 'Vehicle assembly', re: /vehicle assembl/, scale: scaleLines('L0388', 'L0389', 'L0390', 'L0391') },
  { id: 'automobile', label: 'Automobile sales and servicing', re: /automobile|car (sales|dealer\w*|showroom)|vehicle (sales|dealer\w*)/, scale: scaleLines('L0392', 'L0393', 'L0394', 'L0395') },
  { id: 'vulcanizing', label: 'Vulcanizing shop', re: /vulcani[sz]\w*( shop)?/, lines: ['L0175'], cap: [] },
  { id: 'washing_bay', label: 'Washing bay (1–3 ramps)', re: /washing bay|car wash\w*/, lines: ['L0176'], cap: [],
    note: 'For operation the Act gives only the processing fee for a washing bay (1–3 ramps); 4–6 ramps is GH¢100.' },
  { id: 'vehicle_inspection', label: 'Vehicle inspection centre', re: /vehicle (inspection|testing)|roadworth/, lines: ['L0484'], cap: [] },
  { id: 'garage', label: 'Vehicle servicing garage (fitting, spraying)', re: /garage|(spraying|fitting|mechanic\w*|repair) ?(shop|booth)?|servicing of (excavators|vehicles|cars|machines)|vehicle (repair|servicing)/, scale: { Large: 'L0481', Medium: 'L0482', Small: 'L0483' } },
  { id: 'quarry', label: 'Quarry', re: /quarr/, lines: ['L0005'], cap: [] },
  { id: 'poultry', label: 'Poultry production', re: /poultry|layers? farm|broiler|\bbirds?\b farm/, scale: scaleLines('L0530', 'L0531', 'L0532', 'L0533', 'L0534'),
    scaleNote: 'The Act bands poultry by number of birds (Small = 5,001–10,000).' },
  { id: 'piggery', label: 'Piggery production', re: /pig(gery|grey|gery)?\b|swine/, scale: scaleLines('L0541', 'L0542', 'L0543', 'L0544') },
  { id: 'aquaculture', label: 'Aquaculture (fish farm)', re: /aquacultur|fish (farm|pond|cage)|tilapia|catfish/, scale: scaleLines('L0522', 'L0523', 'L0524', 'L0525') },
  { id: 'forestry', label: 'Wildlife and forestry (plantation forestry)', re: /forestr|afforest|reforest|tree plant/, scale: scaleLines('L0621', 'L0622', 'L0623', 'L0624', 'L0625') },
  { id: 'irrigation', label: 'Irrigation', re: /irrigat/, scale: { Large: 'L0518', Medium: 'L0519', Small: 'L0520', Minor: 'L0521' } },
  { id: 'plantation', label: 'Plantation / crop farming', re: /plantation|crop farm|cultivat\w*|oil palm|cashew|cocoa farm/, weak: /\bfarm\w*/, scale: scaleLines('L0509', 'L0510', 'L0511', 'L0512', 'L0513') },
  { id: 'school', label: 'School / educational facility (other construction proposals)', re: /school|classroom|college|universit|educational|dormitor/, scale: OTHER_CONSTRUCTION,
    scaleNote: 'Act 1080 has no school line; "Other construction proposals" (as for religious facilities) is used.' },
  { id: 'other_health', label: 'Other health-related undertaking', weak: /health|pharmac/, scale: scaleLines('L0593', 'L0594', 'L0595', 'L0596', 'L0597') },
  { id: 'office', label: 'Office / bank (per m² of floor area)', re: /bank\w*|savings and loans|credit union|micro ?financ\w*|micro ?credit|insurance|\boffices?\b|forex/, lines: ['L0479'], cap: ['floor_area'] },
  { id: 'warehouse', label: 'Warehouse for general goods (per m² of floor area)', re: /warehouse|cold store|cold room|storage facility/, lines: ['L0472'], cap: ['floor_area'] },
  { id: 'shop', label: 'Shop / store (per m² of floor area)', re: /\bstores?\b|\bshops?\b|showroom|retail|\bmart\b|supermarket|boutique|pharmacy/, lines: ['L0480'], cap: ['floor_area'] },
  { id: 'other_manufacturing', label: 'Other manufacturing', weak: /manufactur\w*|factory|production|processing|recycl\w*|industr\w*/, scale: scaleLines('L0437', 'L0438', 'L0439', 'L0440', 'L0441'),
    scaleNote: 'No specific Act line found for this product; "Other manufacturing industry" is used.' },
  { id: 'pesticide', label: 'Pesticide dealer licence (small scale)', re: /pesticid|agro ?chem|agrochem|weedicide|insecticide|herbicide|fungicide/,
    covers: ['shop'],
    other: { renewal: { group: 'D2. Renewals', label: '1. Small Scale' }, new: { group: 'D1. New applications', label: '1. Small Scale' } },
    note: 'Pesticide dealer licence, Act 1080 pesticides section D (small scale): GH¢400 new, GH¢300 renewal.' },
]

const RULE_BY_ID = new Map(FEE_RULES.map((r) => [r.id, r]))

// Any line of the fee table can be an activity too: id "line:L0425" (picked from the
// fee table on the Finance tab). Its label and capacity come from the line itself.
const LINE_RULES = new Map()
export function ruleById(id) {
  if (RULE_BY_ID.has(id)) return RULE_BY_ID.get(id)
  const m = /^line:(L\d+)$/.exec(String(id ?? ''))
  if (!m) return null
  if (!LINE_RULES.has(id)) LINE_RULES.set(id, { id, lineRef: m[1], label: `Act 1080 line ${m[1]}`, lines: [m[1]], cap: [] })
  return LINE_RULES.get(id)
}

// Capacity key for a per-unit line's unit ("rooms", "m²", "housing units" …).
export function capKeyForLine(line) {
  if (!line || !FEE.isPerUnit(line)) return null
  const u = String(line.unit ?? '').toLowerCase()
  if (/room/.test(u)) return 'rooms'
  if (/bed/.test(u)) return 'beds'
  if (/housing/.test(u)) return 'housing_units'
  if (/m²|m2|sq/.test(u)) return 'floor_area'
  if (/seat/.test(u)) return 'seats'
  if (/litre|liter/.test(u)) return 'litres'
  if (/tonne|ton\b/.test(u)) return 'tonnes'
  if (/bag/.test(u)) return 'bags_per_day'
  return `units_${line.id}`
}

export function lineTitle(line) {
  if (!line) return ''
  return [line.sub && FEE.stripNumbering(line.sub), line.group && FEE.stripNumbering(line.group), FEE.stripNumbering(line.label)].filter(Boolean).join(' – ')
}

// A rule with what the fee table adds for "line:" activities (label, capacity key).
export function resolveRule(rule, lineById) {
  if (!rule?.lineRef) return rule
  const line = lineById?.get(rule.lineRef)
  if (!line) return rule
  const key = capKeyForLine(line)
  return { ...rule, label: lineTitle(line), cap: key ? [key] : [] }
}

// Capacities an officer typed and saved on the facility (Finance tab) win over field records.
export function withSavedCapacities(facility, caps) {
  const saved = facility?.fee_capacities
  if (!saved || typeof saved !== 'object') return caps ?? {}
  const out = { ...(caps ?? {}) }
  for (const [k, v] of Object.entries(saved)) {
    const n = Number(v)
    if (Number.isFinite(n) && n > 0) out[k] = { value: n, source: 'entered by an officer', dateMs: null }
  }
  return out
}

const globalRe = (re) => new RegExp(re.source, 'g')

// Activities named in one piece of text. Each match is taken out of the text before
// later rules look at it, so "gas filling station" is LPG and not also a fuel station.
function rulesInText(text, prefix) {
  let rest = text
  const found = []
  for (const rule of FEE_RULES) {
    if (!rule.re?.test(rest)) continue
    found.push(rule)
    rest = rest.replace(globalRe(rule.re), ' ')
  }
  if (!found.length) {
    for (const rule of FEE_RULES) {
      if (!rule.weak?.test(rest)) continue
      if (rule.weakSectors && !rule.weakSectors.includes(prefix)) continue
      found.push(rule)
      rest = rest.replace(globalRe(rule.weak), ' ')
    }
  }
  return found
}

// Every activity a facility is charged for. A saved list (facility.fee_activities, set
// on the facility's Finance tab) wins; otherwise the type of undertaking is read (the
// name when the type is blank). The sector never rules an activity out; it only helps
// read vague words ("station" under Energy) or an empty record (Pesticide → dealer).
export function matchRules(facility) {
  const saved = Array.isArray(facility?.fee_activities) ? facility.fee_activities.map(ruleById).filter(Boolean) : []
  if (saved.length) return saved
  const t = normalizeType(facility?.type_of_undertaking)
  const name = normalizeType(facility?.name)
  const prefix = facility?.sector_prefix ?? ''
  let found = t ? rulesInText(t, prefix) : []
  if (!found.length && !t && name) found = rulesInText(name, prefix)
  // Nothing named at all: a file under Agrochemical & Pesticide is a dealer.
  if (!found.length && prefix === 'PP') found = [RULE_BY_ID.get('pesticide')]
  // Tagged as a Gold board application but the text names no tier or trading: Tier 1.
  if (facility?.sub_sector === 'gold_board' && !found.some((r) => r.id === 'gold1' || r.id === 'gold2')) found = [RULE_BY_ID.get('gold1'), ...found]
  const covered = new Set(found.flatMap((r) => r.covers ?? []))
  return found.filter((r) => !covered.has(r.id))
}

// First activity, for callers that need one.
export function matchRule(facility) {
  return matchRules(facility)[0] ?? null
}

function capacityFor(rule, caps) {
  for (const key of rule.cap ?? []) {
    const c = caps?.[key]
    if (!c) continue
    if (rule.id === 'lpg' && key === 'litres') return { value: Math.round((c.value / 1960) * 10) / 10, unit: 'tonnes', source: `${c.source} (converted from litres)` }
    return { value: c.value, unit: key, source: c.source }
  }
  return null
}

// Fee in cedis for one cell, with the certification cell as fallback.
function cell(line, primary, fallback) {
  const f = line.fees[primary] ?? line.fees[fallback]
  if (!f || f.cur !== 'GHS') return null
  return f.v
}

function pickBand(lines, qty) {
  if (lines.length === 1) return { line: lines[0], clamped: false }
  if (qty == null) return null
  const hit = lines.find((l) => FEE.inBand(l, qty))
  if (hit) return { line: hit, clamped: false }
  // Outside every band (or in a gap between bands): the nearest one.
  const dist = (l) => {
    if (l.bmin != null && qty < l.bmin) return l.bmin - qty
    if (l.bmax != null && qty > l.bmax) return qty - l.bmax
    return 0
  }
  const nearest = [...lines].sort((a, b) => dist(a) - dist(b))[0]
  return { line: nearest, clamped: true }
}

// Act 1080 estimate for one activity of a facility. Returns null when it cannot be priced
// (with `why` set on the optional `miss` object).
export function actLineEstimate(rule, facility, caps, ctx, { application = 'renewal', miss } = {}) {
  if (!rule) return null
  rule = resolveRule(rule, ctx.lineById)
  const fail = (why) => { if (miss) miss.why = why; return null }

  if (rule.other) {
    const spec = rule.other[application === 'new' ? 'new' : 'renewal']
    const row = ctx.otherRows.find((r) => r[1] === spec.group && r[3] === spec.label)
    const amount = row ? FEE.parseFee(row[4]) : null
    if (!amount || amount.cur !== 'GHS') return fail('not in the fee table')
    return {
      ruleId: rule.id, ruleLabel: rule.label, lineId: `${spec.group} ${spec.label}`, lineLabel: `${spec.group} – ${spec.label}`,
      processing: 0, permit: amount.v, total: amount.v, pages: String(row[5] ?? ''), qty: null, note: rule.note ?? '',
    }
  }

  let scaleUsed = null
  let ids = application === 'new' && rule.newLines ? rule.newLines : rule.lines
  if (rule.scale) {
    const wanted = IMPACT_SCALES.includes(facility?.impact_scale) ? facility.impact_scale : (rule.defaultScale ?? DEFAULT_SCALE)
    const picked = lineForScale(rule, wanted)
    scaleUsed = { wanted, used: picked.scale, saved: IMPACT_SCALES.includes(facility?.impact_scale) }
    ids = [picked.id]
  }
  const lines = ids.map((id) => ctx.lineById.get(id)).filter(Boolean)
  if (!lines.length) return fail('not in the fee table')

  let capacity = capacityFor(rule, caps)
  let capacityKind = capacity ? 'recorded' : null
  if (!capacity && rule.cap?.length) {
    const typical = ctx.typicalCapacity[rule.id]
    if (typical) { capacity = typical; capacityKind = 'typical' }
  }

  let chosen
  if (lines.length === 1) chosen = { line: lines[0], clamped: false }
  else if (capacity) chosen = pickBand(lines, capacity.value)
  else if (rule.defaultLine) chosen = { line: ctx.lineById.get(rule.defaultLine), clamped: false }
  if (!chosen?.line) return fail(rule.cap?.length ? `${rule.cap[0].replace(/_/g, ' ')} not on record` : 'no line picked')

  const line = chosen.line
  const perUnit = FEE.isPerUnit(line)
  if (perUnit && !capacity) return fail(`${(rule.cap?.[0] ?? 'capacity').replace(/_/g, ' ')} not on record`)
  if (perUnit && line.bmin != null && capacity && capacity.value < line.bmin) chosen.clamped = true
  if (perUnit && line.bmax != null && capacity && capacity.value > line.bmax) chosen.clamped = true
  const qty = perUnit ? capacity.value : 1
  const proc = cell(line, 'pp', 'cp')
  const perm = cell(line, 'pm', 'cm')
  if (proc == null && perm == null) return fail('both fees are blank in the Act')
  const processing = round((proc ?? 0) * qty)
  const permit = round((perm ?? 0) * qty)

  const notes = []
  if (rule.note && (!rule.noteIf || rule.noteIf.test(normalizeType(facility.type_of_undertaking)))) notes.push(rule.note)
  if (scaleUsed) {
    if (!scaleUsed.saved) notes.push(`Impact scale is not on the record, so ${scaleUsed.used} is used (Act 1080 and L.I. 2504 leave it to screening); set it on the Finance tab.${rule.scaleNote ? ` ${rule.scaleNote}` : ''}`)
    else if (scaleUsed.used !== scaleUsed.wanted) notes.push(`The Act has no ${scaleUsed.wanted} scale for this activity; ${scaleUsed.used} is used.`)
    else if (rule.scaleNote && /Act 1080 has no|No specific/.test(rule.scaleNote)) notes.push(rule.scaleNote)
  }
  if (rule.assumedNote && !(facility.fee_activities?.length) && !rule.assumedUnless.test(normalizeType(`${facility.type_of_undertaking ?? ''} ${facility.name ?? ''}`))) notes.push(rule.assumedNote)
  if (chosen.clamped) notes.push(`Capacity is outside the Act's band for this line (${line.bmin ?? '…'}–${line.bmax ?? '…'} ${line.unit}); the nearest band is used.`)
  if (proc == null || perm == null) notes.push('One of the two fees is blank in the Act for this line.')

  return {
    ruleId: rule.id, ruleLabel: scaleUsed ? `${rule.label} (${scaleUsed.used} impact scale)` : rule.label, lineId: line.id, lineLabel: FEE.stripNumbering(line.label), pages: line.pages,
    scale: scaleUsed?.used ?? null,
    perUnit, rate: { processing: proc, permit: perm },
    qty: capacity ? { value: capacity.value, unit: capacity.unit, source: capacityKind === 'typical' ? capacity.source : capacity.source, kind: capacityKind } : null,
    processing, permit, total: round(processing + permit), note: notes.join(' '),
  }
}

// Act 1080 estimate for a facility: every activity it does, priced and added up.
// The result has the same fields as one activity's estimate (labels joined with " + ")
// plus `parts` (one per priced activity) and `unpriced` (activities that could not be
// priced, e.g. a restaurant with no seat count). Returns null when nothing is priced.
// opts.rules overrides the activities; opts.capsFor(rule) gives one activity its own capacities.
export function actEstimate(facility, caps, ctx, { application = 'renewal', rules, capsFor, fillGaps = false } = {}) {
  const list = (rules ?? matchRules(facility)).map((r) => resolveRule(r, ctx.lineById))
  const parts = []
  const unpriced = []
  for (const rule of list) {
    const miss = {}
    let est = actLineEstimate(rule, facility, capsFor?.(rule) ?? caps, ctx, { application, miss })
    // e.g. sachet water with no bags-a-day count: the Act's bottled water (with/without sachet) scale line.
    if (!est && rule.fallback) {
      const fb = RULE_BY_ID.get(rule.fallback)
      est = actLineEstimate(fb, facility, capsFor?.(fb) ?? caps, ctx, { application })
      if (est) est = { ...est, forRule: rule.id, note: [`${rule.label}: ${miss.why}, so ${fb.label} is used.`, est.note].filter(Boolean).join(' ') }
    }
    // Forecasts only: an activity with nothing to price it on takes what facilities doing
    // the same thing paid, else the office-wide average of priced activities.
    if (!est && fillGaps) est = averageFor(rule, ctx, miss.why)
    if (est) parts.push(est)
    else unpriced.push({ ruleId: rule.id, ruleLabel: rule.label, why: miss.why ?? 'not priced' })
  }
  if (!parts.length) return null
  if (parts.length === 1 && !unpriced.length) return { ...parts[0], parts, unpriced }

  const processing = round(parts.reduce((a, p) => a + p.processing, 0))
  const permit = round(parts.reduce((a, p) => a + p.permit, 0))
  const notes = parts.filter((p) => p.note).map((p) => `${p.ruleLabel}: ${p.note}`)
  if (unpriced.length) notes.push(`Not priced: ${unpriced.map((u) => `${u.ruleLabel} (${u.why})`).join('; ')}.`)
  const one = parts.length === 1 ? parts[0] : null
  return {
    ruleId: parts.map((p) => p.ruleId).join('+'),
    ruleLabel: parts.map((p) => p.ruleLabel).join(' + '),
    lineId: parts.map((p) => p.lineId).join(' + '),
    lineLabel: parts.map((p) => p.lineLabel).join(' + '),
    pages: parts.map((p) => String(p.pages ?? '').split(',')[0]).filter(Boolean).join(', '),
    perUnit: one?.perUnit ?? false, rate: one?.rate ?? null,
    qty: one?.qty ?? null,
    qtyText: parts.filter((p) => p.qty).map((p) => `${p.qty.value} ${p.qty.unit.replace(/_/g, ' ')}`).join(', '),
    processing, permit, total: round(processing + permit), note: notes.join(' '),
    parts, unpriced,
  }
}

function averageFor(rule, ctx, why) {
  const own = ctx.paidByActivity?.[rule.id]
  const avg = own?.n ? { ...own, kind: 'activity', text: `median paid by ${own.n} facilit${own.n > 1 ? 'ies' : 'y'} doing this` }
    : ctx.generalAverage?.n ? { ...ctx.generalAverage, kind: 'office', text: ctx.generalAverage.basis === 'paid' ? `the office-wide median paid (${ctx.generalAverage.n} facilities)` : `the office-wide median of ${ctx.generalAverage.n} priced activities` }
      : null
  if (!avg) return null
  return {
    ruleId: rule.id, ruleLabel: rule.label, lineId: '', lineLabel: avg.kind === 'activity' ? 'Average of similar facilities' : 'Office-wide average',
    pages: '', perUnit: false, rate: null, qty: null, averaged: avg.kind,
    processing: round(avg.processing), permit: round(avg.permit), total: round(avg.processing + avg.permit),
    note: `${why ? `${why[0].toUpperCase()}${why.slice(1)}; ` : ''}${avg.text} is used for the forecast. Enter it on the Finance tab to price this facility.`,
  }
}

// ── Context shared by every estimate ────────────────────────────────────────────

export function buildFeeContext({ feeTable, facilities = [], finance = [], capacityIndex = {} }) {
  const lines = (feeTable?.main ?? []).map(FEE.rowToLine)
  const lineById = new Map(lines.map((l) => [l.id, l]))
  const otherRows = feeTable?.other ?? []

  // Latest paid processing and permit fee per facility.
  const paidByFile = new Map()
  const billed = { total: 0, paid: 0 }
  for (const r of finance) {
    const amount = Number(r.amount) || 0
    const status = (r.payment_status ?? 'paid') === 'unpaid' ? 'unpaid' : 'paid'
    billed.total += amount
    if (status === 'paid') billed.paid += amount
    if (status !== 'paid' || amount <= 0) continue
    const kind = paymentKind(r.payment_type)
    if (kind !== 'processing' && kind !== 'permit') continue
    const ms = toMs(r.date) ?? toMs(r.created_at) ?? 0
    const entry = paidByFile.get(r.fileNumber) ?? {}
    if (!entry[kind] || ms > entry[kind].ms) entry[kind] = { amount, ms }
    paidByFile.set(r.fileNumber, entry)
  }

  // Typical capacity per rule: median of the facilities whose capacity is on record.
  const capsByRule = {}
  const groupKeyOf = new Map()
  for (const f of facilities) {
    const rules = matchRules(f).map((r) => resolveRule(r, lineById))
    // "Similar" means the same mix of activities (a hotel with a restaurant is compared
    // with other hotels that have restaurants).
    groupKeyOf.set(f.file_number, rules.length ? `rule:${rules.map((r) => r.id).sort().join('+')}` : `type:${normalizeType(f.type_of_undertaking) || '-'}`)
    for (const rule of rules) {
      if (!rule.cap?.length) continue
      const c = capacityFor(rule, withSavedCapacities(f, capacityIndex[f.file_number]))
      if (c) (capsByRule[rule.id] ??= []).push(c)
    }
  }
  const typicalCapacity = {}
  for (const [ruleId, list] of Object.entries(capsByRule)) {
    const raw = median(list.map((c) => c.value))
    const value = raw == null ? null : (raw >= 10 ? Math.round(raw) : Math.round(raw * 10) / 10)
    if (value != null) typicalCapacity[ruleId] = { value, unit: list[0].unit, source: `typical size (median of ${list.length} surveyed)` }
  }

  // What similar facilities and sectors paid.
  const facByFile = new Map(facilities.map((f) => [f.file_number, f]))
  const groupPaid = {}
  const sectorPaid = {}
  for (const [fileNumber, entry] of paidByFile) {
    const f = facByFile.get(fileNumber)
    if (!f) continue
    const g = groupKeyOf.get(fileNumber)
    for (const bucket of [(groupPaid[g] ??= { processing: [], permit: [], files: new Set() }), (sectorPaid[f.sector_prefix || '-'] ??= { processing: [], permit: [], files: new Set() })]) {
      if (entry.processing) bucket.processing.push(entry.processing.amount)
      if (entry.permit) bucket.permit.push(entry.permit.amount)
      bucket.files.add(fileNumber)
    }
  }
  const summarise = (b) => ({ processing: median(b.processing) ?? 0, permit: median(b.permit) ?? 0, n: b.files.size })
  const similar = Object.fromEntries(Object.entries(groupPaid).map(([k, b]) => [k, summarise(b)]))
  const sector = Object.fromEntries(Object.entries(sectorPaid).map(([k, b]) => [k, summarise(b)]))

  const ctx = {
    lineById, otherRows, paidByFile, typicalCapacity, similar, sector, groupKeyOf, capacityIndex,
    collectionRate: billed.total > 0 ? billed.paid / billed.total : null,
  }

  // Averages for forecasting activities that cannot be priced: what facilities doing only
  // that activity paid, and the office-wide median of every activity the Act prices.
  const byActivity = {}
  const general = { processing: [], permit: [] }
  for (const f of facilities) {
    const rules = matchRules(f)
    const entry = paidByFile.get(f.file_number)
    if (rules.length === 1 && entry) {
      const b = (byActivity[rules[0].id] ??= { processing: [], permit: [], n: 0 })
      if (entry.processing) b.processing.push(entry.processing.amount)
      if (entry.permit) b.permit.push(entry.permit.amount)
      b.n += 1
    }
    const act = actEstimate(f, withSavedCapacities(f, capacityIndex[f.file_number]), ctx, { application: 'renewal' })
    for (const part of act?.parts ?? []) {
      general.processing.push(part.processing)
      general.permit.push(part.permit)
    }
  }
  ctx.paidByActivity = Object.fromEntries(Object.entries(byActivity).map(([k, b]) => [k, { processing: median(b.processing) ?? 0, permit: median(b.permit) ?? 0, n: b.n }]))
  // Office-wide: what facilities actually paid (any activity); the Act prices of all
  // priced activities only when there are no payments on record.
  const paidAll = { processing: [], permit: [] }
  for (const entry of paidByFile.values()) {
    if (entry.processing) paidAll.processing.push(entry.processing.amount)
    if (entry.permit) paidAll.permit.push(entry.permit.amount)
  }
  ctx.generalAverage = paidAll.permit.length
    ? { processing: median(paidAll.processing) ?? 0, permit: median(paidAll.permit) ?? 0, n: paidByFile.size, basis: 'paid' }
    : general.permit.length
      ? { processing: median(general.processing) ?? 0, permit: median(general.permit) ?? 0, n: general.permit.length, basis: 'act' }
      : null
  return ctx
}

// ── One facility ────────────────────────────────────────────────────────────────

export function estimateFacility(facility, ctx, { application = 'renewal' } = {}) {
  const fileNumber = facility.file_number
  const caps = withSavedCapacities(facility, ctx.capacityIndex?.[fileNumber])
  const act = actEstimate(facility, caps, ctx, { application, fillGaps: true })
  const paid = ctx.paidByFile.get(fileNumber)
  const groupKey = ctx.groupKeyOf.get(fileNumber)
  const similar = groupKey ? ctx.similar[groupKey] : null
  const sector = ctx.sector[facility.sector_prefix || '-']

  let source, sourceLabel, processing, permit
  if (paid?.permit || paid?.processing) {
    source = 'paid'
    processing = paid.processing?.amount ?? act?.processing ?? similar?.processing ?? 0
    permit = paid.permit?.amount ?? act?.permit ?? similar?.permit ?? 0
    sourceLabel = paid.permit && paid.processing ? 'Last amounts paid' : 'Last amount paid (other fee estimated)'
  } else if (act) {
    source = 'act'
    processing = act.processing
    permit = act.permit
    const averaged = act.parts.filter((x) => x.averaged).length
    if (averaged === act.parts.length) source = 'average'
    sourceLabel = averaged === act.parts.length
      ? (act.parts.every((x) => x.averaged === 'activity') ? 'Average paid by facilities doing the same'
        : act.parts.every((x) => x.averaged === 'office') ? 'Office-wide average (nothing to price it on)' : 'Averages (no capacity on record)')
      : act.parts.some((x) => x.qty?.kind === 'typical') ? 'Act 1080 at typical size' : 'Act 1080'
    if (act.parts.length > 1) sourceLabel += ` (${act.parts.length} activities${averaged && averaged < act.parts.length ? `, ${averaged} averaged` : ''})`
    if (act.unpriced.length) sourceLabel += `, ${act.unpriced.length} activit${act.unpriced.length > 1 ? 'ies' : 'y'} not priced`
  } else if (similar && similar.n >= 2) {
    source = 'similar'
    processing = similar.processing
    permit = similar.permit
    sourceLabel = `Similar facilities paid (median of ${similar.n})`
  } else if (sector && sector.n >= 1) {
    source = 'sector'
    processing = sector.processing
    permit = sector.permit
    sourceLabel = `Sector median (${sector.n} facilities)`
  } else {
    source = 'none'
    processing = 0
    permit = 0
    sourceLabel = 'No estimate'
  }
  return {
    fileNumber, processing: round(processing), permit: round(permit), total: round(processing + permit),
    source, sourceLabel, act, capacities: caps,
  }
}

export const SOURCE_NAMES = {
  paid: 'Facility paid before',
  act: 'Act 1080 schedule',
  average: 'Average paid (capacity not on record)',
  similar: 'Similar facilities paid',
  sector: 'Sector median',
  invoice: 'Unpaid invoice',
  none: 'No estimate',
}

// ── Forecast for a period ───────────────────────────────────────────────────────
// streams: renewals due in the window, backlog (expired / no permit, not already
// invoiced or paid since expiry), unpaid invoices, and new applications on trend.

export function buildRevenueForecast({
  facilities = [], permits = [], finance = [], ctx, range = {}, now = Date.now(),
  includeBacklog = true, includePenalty = false, penaltyMult = 3, includeNew = true, includeUnpaid = true,
}) {
  const latestExpiry = new Map()
  const firstIssue = new Map()
  for (const p of permits) {
    const e = toMs(p.expiry_date)
    if (e && (!latestExpiry.has(p.fileNumber) || e > latestExpiry.get(p.fileNumber).ms)) latestExpiry.set(p.fileNumber, { ms: e, permit: p })
    const i = toMs(p.issue_date) ?? toMs(p.effective_date)
    if (i && (!firstIssue.has(p.fileNumber) || i < firstIssue.get(p.fileNumber))) firstIssue.set(p.fileNumber, i)
  }

  const lastPaidMs = new Map()
  const unpaidByFile = new Map()
  for (const r of finance) {
    const ms = toMs(r.date) ?? toMs(r.created_at) ?? 0
    if ((r.payment_status ?? 'paid') === 'unpaid') {
      const list = unpaidByFile.get(r.fileNumber) ?? []
      list.push(r)
      unpaidByFile.set(r.fileNumber, list)
    } else if (ms > (lastPaidMs.get(r.fileNumber) ?? 0)) lastPaidMs.set(r.fileNumber, ms)
  }

  const from = range.from ?? null
  const to = range.to ?? null
  const rows = []
  for (const f of facilities) {
    const fn = f.file_number
    const exp = latestExpiry.get(fn)
    const base = {
      fileNumber: fn, facilityName: f.name ?? fn, sectorPrefix: f.sector_prefix ?? '', facilityDistrict: f.district ?? '',
      typeOfUndertaking: f.type_of_undertaking ?? '', expiryMs: exp?.ms ?? null, permitNumber: exp?.permit?.permit_number ?? '',
    }
    const unpaid = unpaidByFile.get(fn)
    if (unpaid?.length) {
      if (includeUnpaid) {
        const amount = round(unpaid.reduce((s, r) => s + (Number(r.amount) || 0), 0))
        rows.push({ ...base, stream: 'unpaid', processing: 0, permit: 0, penalty: 0, total: amount, source: 'invoice', sourceLabel: `${unpaid.length} unpaid invoice${unpaid.length > 1 ? 's' : ''}`, act: null })
      }
      continue // already billed: not counted again as renewal or backlog
    }

    let stream = null
    if (exp) {
      if (exp.ms >= (from ?? -Infinity) && exp.ms <= (to ?? Infinity) && exp.ms >= now - DAY) stream = 'renewal'
      else if (exp.ms < now && (lastPaidMs.get(fn) ?? 0) < exp.ms) stream = 'backlog'
    } else if (!lastPaidMs.has(fn)) {
      stream = 'backlog'
    }
    if (!stream || (stream === 'backlog' && !includeBacklog)) continue

    const est = estimateFacility(f, ctx, { application: exp ? 'renewal' : 'new' })
    const penalty = stream === 'backlog' && includePenalty ? round(est.permit * penaltyMult) : 0
    rows.push({
      ...base, stream, backlogReason: stream === 'backlog' ? (exp ? 'expired' : 'no permit') : null,
      processing: est.processing, permit: est.permit, penalty, total: round(est.total + penalty),
      source: est.source, sourceLabel: est.sourceLabel, act: est.act,
    })
  }

  // New applications: permits first issued per month over the last 12 months.
  const months = from != null && to != null ? Math.max(0, (to - from) / (30.44 * DAY)) : 0
  const yearAgo = now - 365 * DAY
  const newFiles = [...firstIssue.entries()].filter(([, ms]) => ms >= yearAgo && ms <= now).map(([fn]) => fn)
  const perMonth = newFiles.length / 12
  const newFees = newFiles.map((fn) => ctx.paidByFile.get(fn)).filter(Boolean)
    .map((p) => (p.processing?.amount ?? 0) + (p.permit?.amount ?? 0)).filter((x) => x > 0)
  const newFee = median(newFees) ?? 0
  const newStream = includeNew && months > 0
    ? { count: Math.round(perMonth * months), perMonth: round(perMonth), fee: newFee, total: round(perMonth * months * newFee), basis: newFees.length }
    : { count: 0, perMonth: round(perMonth), fee: newFee, total: 0, basis: newFees.length }

  const sum = (s) => round(rows.filter((r) => r.stream === s).reduce((a, r) => a + r.total, 0))
  const count = (s) => rows.filter((r) => r.stream === s).length
  const streams = {
    renewal: { count: count('renewal'), total: sum('renewal') },
    backlog: { count: count('backlog'), total: sum('backlog'), penalty: round(rows.filter((r) => r.stream === 'backlog').reduce((a, r) => a + r.penalty, 0)) },
    unpaid: { count: count('unpaid'), total: sum('unpaid') },
    new: newStream,
  }
  const possible = round(streams.renewal.total + streams.backlog.total + streams.unpaid.total + streams.new.total)
  const rate = ctx.collectionRate ?? 1
  const sourceCounts = {}
  rows.forEach((r) => { sourceCounts[SOURCE_NAMES[r.source] ?? r.source] = (sourceCounts[SOURCE_NAMES[r.source] ?? r.source] ?? 0) + 1 })
  // Only parts actually priced from the Act (not averages standing in for missing capacity).
  const actPart = (r) => (r.act?.parts ?? []).filter((p) => !p.averaged)
  const actRows = rows.filter((r) => actPart(r).length)
  return {
    rows, streams, possible, expected: round(possible * rate), collectionRate: ctx.collectionRate,
    sourceCounts,
    actCoverage: { facilities: actRows.length, actTotal: round(actRows.reduce((a, r) => a + actPart(r).reduce((b, p) => b + p.total, 0), 0)), estimateTotal: round(actRows.reduce((a, r) => a + r.processing + r.permit, 0)) },
  }
}
