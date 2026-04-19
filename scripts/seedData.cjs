/**
 * EPA Permit Management — Facility & Sub-record Seed
 *
 * Seeds 10 realistic Ashanti-region facilities across all 8 sectors,
 * plus permits, finance records, screenings, monitoring visits,
 * site verifications, and enforcement actions.
 *
 * Run AFTER seed.cjs (which creates staff + counters).
 *
 *   node scripts/seedData.cjs
 */

const admin = require('firebase-admin')

// Re-use existing key if already initialised by another require
let app
try {
  app = admin.app()
} catch {
  const serviceAccount = require('./serviceAccountKey.json')
  app = admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
}

const db   = admin.firestore()
const auth = admin.auth()

const TS = (dateStr) => admin.firestore.Timestamp.fromDate(new Date(dateStr))
const NOW = admin.firestore.FieldValue.serverTimestamp

// Resolve staff UIDs at runtime
async function getUids() {
  const [adm, fin, off] = await Promise.all([
    auth.getUserByEmail('admin@epa-ashanti.gh'),
    auth.getUserByEmail('finance@epa-ashanti.gh'),
    auth.getUserByEmail('officer@epa-ashanti.gh'),
  ])
  return { admin: adm.uid, finance: fin.uid, officer: off.uid }
}

// ── Facilities ─────────────────────────────────────────────────────────
const FACILITIES = [
  {
    file_number: 'CI1',
    sector_prefix: 'CI',
    sector: 'Infrastructure',
    name: 'Kumasi Water Treatment Works',
    type_of_undertaking: 'Water Treatment & Supply',
    location: 'Barekese Reservoir Road, Abuakwa',
    district: 'KMA',
    region: 'Ashanti',
    coordinates: { lat: 6.7070, lng: -1.6484 },
    email: 'compliance@kwsw.gov.gh',
    entity_tin: 'C0012345678',
    contact_person: 'Ing. Kwabena Frimpong',
    designation: 'Plant Manager',
    address: 'P.O. Box KS 101, Kumasi',
    phone: '+233 322 022 101',
  },
  {
    file_number: 'CU1',
    sector_prefix: 'CU',
    sector: 'Manufacturing',
    name: 'Kumasi Brewing Company Ltd',
    type_of_undertaking: 'Beverage Manufacturing',
    location: 'Industrial Area, Suame, Kumasi',
    district: 'KMA',
    region: 'Ashanti',
    coordinates: { lat: 6.7200, lng: -1.5900 },
    email: 'env@kumasibrewing.gh',
    entity_tin: 'C0098765432',
    contact_person: 'Abena Kusi',
    designation: 'Environmental Health & Safety Manager',
    address: 'P.O. Box KS 445, Kumasi',
    phone: '+233 322 041 200',
  },
  {
    file_number: 'CH1',
    sector_prefix: 'CH',
    sector: 'Health',
    name: 'Konongo Government Hospital',
    type_of_undertaking: 'General Hospital',
    location: 'Hospital Road, Konongo',
    district: 'KON',
    region: 'Ashanti',
    coordinates: { lat: 6.6200, lng: -1.2240 },
    email: 'admin@konongohospital.gov.gh',
    entity_tin: 'G0000100023',
    contact_person: 'Dr. Yaw Boateng',
    designation: 'Medical Superintendent',
    address: 'P.O. Box KO 1, Konongo',
    phone: '+233 322 090 100',
  },
  {
    file_number: 'CT1',
    sector_prefix: 'CT',
    sector: 'Hospitality',
    name: 'Ashanti Royal Hotel & Conference Centre',
    type_of_undertaking: '4-Star Hotel & Event Venue',
    location: 'Prempeh II Street, Adum, Kumasi',
    district: 'KMA',
    region: 'Ashanti',
    coordinates: { lat: 6.6885, lng: -1.6244 },
    email: 'gm@ashantiroyal.gh',
    entity_tin: 'C0055123456',
    contact_person: 'Maame Ama Sarkodie',
    designation: 'General Manager',
    address: 'P.O. Box KS 892, Kumasi',
    phone: '+233 322 033 500',
  },
  {
    file_number: 'CM1',
    sector_prefix: 'CM',
    sector: 'Mining',
    name: 'Obuasi Gold Mining Company Ltd',
    type_of_undertaking: 'Underground Gold Mining',
    location: 'Mine Site, Obuasi',
    district: 'OBU',
    region: 'Ashanti',
    coordinates: { lat: 6.2000, lng: -1.6600 },
    email: 'environment@obuasigold.gh',
    entity_tin: 'C0022987654',
    contact_person: 'Kweku Asante-Mensah',
    designation: 'Environmental Manager',
    address: 'P.O. Box OB 5, Obuasi',
    phone: '+233 322 070 001',
  },
  {
    file_number: 'CA1',
    sector_prefix: 'CA',
    sector: 'Agriculture',
    name: 'Ejisu Cocoa & Agro-Processing Ltd',
    type_of_undertaking: 'Cocoa Fermentation & Drying',
    location: 'Ejisu-Ashanti Road, Near Junction',
    district: 'EJI',
    region: 'Ashanti',
    coordinates: { lat: 6.7550, lng: -1.4760 },
    email: 'info@ejisucoco.gh',
    entity_tin: 'C0044321098',
    contact_person: 'Nana Ama Boateng',
    designation: 'Operations Director',
    address: 'P.O. Box EJ 12, Ejisu',
    phone: '+233 322 055 300',
  },
  {
    file_number: 'CE1',
    sector_prefix: 'CE',
    sector: 'Energy',
    name: 'Ashanti Power Solutions Ltd',
    type_of_undertaking: 'Heavy Fuel Oil Power Generation',
    location: 'Kaase Industrial Area, Kumasi',
    district: 'KMA',
    region: 'Ashanti',
    coordinates: { lat: 6.6600, lng: -1.5700 },
    email: 'compliance@ashantipower.gh',
    entity_tin: 'C0077654321',
    contact_person: 'Ing. Kofi Acheampong',
    designation: 'Plant Director',
    address: 'P.O. Box KS 1100, Kumasi',
    phone: '+233 322 029 800',
  },
  {
    file_number: 'PP1',
    sector_prefix: 'PP',
    sector: 'Agrochemical & Pesticide',
    name: 'Kumasi Agricultural Inputs Depot',
    type_of_undertaking: 'Pesticide Storage & Distribution',
    location: 'Anloga Junction, Kumasi',
    district: 'KMA',
    region: 'Ashanti',
    coordinates: { lat: 6.6750, lng: -1.6100 },
    email: 'safety@kumaidepot.gh',
    entity_tin: 'C0033789456',
    contact_person: 'Akosua Nyarko',
    designation: 'Depot Manager',
    address: 'P.O. Box KS 2200, Kumasi',
    phone: '+233 322 066 400',
  },
  {
    file_number: 'CU2',
    sector_prefix: 'CU',
    sector: 'Manufacturing',
    name: 'West African Textiles Ghana Ltd',
    type_of_undertaking: 'Textile Dyeing & Finishing',
    location: 'Ejisu Industrial Park',
    district: 'EJI',
    region: 'Ashanti',
    coordinates: { lat: 6.7480, lng: -1.4650 },
    email: 'env@watghana.com',
    entity_tin: 'C0011234567',
    contact_person: 'Ibrahim Al-Hassan',
    designation: 'EHS Coordinator',
    address: 'P.O. Box EJ 88, Ejisu',
    phone: '+233 322 055 900',
  },
  {
    file_number: 'CI2',
    sector_prefix: 'CI',
    sector: 'Infrastructure',
    name: 'Ejisu-Juaben Road Expansion Project',
    type_of_undertaking: 'Road Construction & Rehabilitation',
    location: 'Ejisu-Juaben Municipal, along N6 Highway',
    district: 'EJI',
    region: 'Ashanti',
    coordinates: { lat: 6.7630, lng: -1.4800 },
    email: 'environment@ghanaroads.gov.gh',
    entity_tin: 'G0000200011',
    contact_person: 'Francis Agyemang',
    designation: 'Site Environmental Officer',
    address: 'Dept. of Urban Roads, Kumasi Regional Office',
    phone: '+233 322 048 600',
  },
]

// ── Sub-record data builders ────────────────────────────────────────────

function permits(uids) {
  return {
    CI1: [
      {
        permit_number: 'EPA/ASH/KMA/EA1/CI1/24/00101',
        issue_date: TS('2024-04-01'),
        effective_date: TS('2024-04-15'),
        expiry_date: TS('2027-04-14'),   // active
        issue_location: 'Kumasi',
        notes: 'Full environmental permit for water treatment operations. Covers abstraction from Barekese Reservoir.',
        created_by: uids.admin,
      },
    ],
    CU1: [
      {
        permit_number: 'EPA/ASH/KMA/EA2/CU1/23/00055',
        issue_date: TS('2023-05-10'),
        effective_date: TS('2023-05-10'),
        expiry_date: TS('2026-05-20'),   // expiring within 60 days of 2026-04-19
        issue_location: 'Kumasi',
        notes: 'Covers effluent discharge to municipal sewer. Renewal application to be submitted by April 2026.',
        created_by: uids.admin,
      },
    ],
    CH1: [
      {
        permit_number: 'EPA/ASH/KON/EA3/CH1/25/00012',
        issue_date: TS('2025-01-15'),
        effective_date: TS('2025-02-01'),
        expiry_date: TS('2028-01-31'),   // active
        issue_location: 'Konongo',
        notes: 'Environmental permit covering medical waste management and effluent discharge.',
        created_by: uids.admin,
      },
    ],
    CT1: [
      {
        permit_number: 'EPA/ASH/KMA/EA4/CT1/24/00078',
        issue_date: TS('2024-07-20'),
        effective_date: TS('2024-08-01'),
        expiry_date: TS('2027-07-31'),   // active
        issue_location: 'Kumasi',
        notes: 'Permit covers solid waste management, grease trap operations, and pool chemical handling.',
        created_by: uids.admin,
      },
    ],
    CM1: [
      {
        permit_number: 'EPA/ASH/OBU/EA5/CM1/21/00003',
        issue_date: TS('2021-03-01'),
        effective_date: TS('2021-03-01'),
        expiry_date: TS('2024-02-28'),   // expired
        issue_location: 'Obuasi',
        notes: 'EXPIRED. Renewal application submitted Feb 2024 — pending EPA review.',
        created_by: uids.admin,
      },
      {
        permit_number: 'EPA/ASH/OBU/EA5/CM1/18/00001',
        issue_date: TS('2018-06-01'),
        effective_date: TS('2018-06-01'),
        expiry_date: TS('2021-05-31'),   // expired (old)
        issue_location: 'Obuasi',
        notes: 'First permit. Superseded by 2021 renewal.',
        created_by: uids.admin,
      },
    ],
    CA1: [
      {
        permit_number: 'EPA/ASH/EJI/EA6/CA1/25/00034',
        issue_date: TS('2025-03-10'),
        effective_date: TS('2025-04-01'),
        expiry_date: TS('2028-03-31'),   // active
        issue_location: 'Ejisu',
        notes: 'Covers cocoa fermentation, wastewater ponds, and solid waste from processing.',
        created_by: uids.admin,
      },
    ],
    CE1: [
      {
        permit_number: 'EPA/ASH/KMA/EA7/CE1/24/00066',
        issue_date: TS('2024-09-01'),
        effective_date: TS('2024-09-01'),
        expiry_date: TS('2027-08-31'),   // active
        issue_location: 'Kumasi',
        notes: 'Permit covers HFO generator emissions, transformer oil storage, and cooling water discharge.',
        created_by: uids.admin,
      },
    ],
    PP1: [
      {
        permit_number: 'EPA/ASH/KMA/EA8/PP1/23/00099',
        issue_date: TS('2023-11-01'),
        effective_date: TS('2023-11-01'),
        expiry_date: TS('2026-06-10'),   // expiring in ~52 days from 2026-04-19
        issue_location: 'Kumasi',
        notes: 'Pesticide storage permit. Covers Class I and II restricted-use pesticides.',
        created_by: uids.admin,
      },
    ],
    CU2: [
      {
        permit_number: 'EPA/ASH/EJI/EA9/CU2/24/00041',
        issue_date: TS('2024-02-14'),
        effective_date: TS('2024-03-01'),
        expiry_date: TS('2027-02-28'),   // active
        issue_location: 'Ejisu',
        notes: 'Covers dyeing effluent discharge into Oda River — subject to BOD monitoring quarterly.',
        created_by: uids.admin,
      },
    ],
    CI2: [
      {
        permit_number: 'EPA/ASH/EJI/EA10/CI2/25/00008',
        issue_date: TS('2025-06-01'),
        effective_date: TS('2025-07-01'),
        expiry_date: TS('2027-12-31'),   // active
        issue_location: 'Kumasi',
        notes: 'Construction phase environmental permit. Valid for project duration.',
        created_by: uids.admin,
      },
    ],
  }
}

function finance(uids) {
  return {
    CI1: [
      { date: TS('2024-04-01'), payment_type: 'Permit Fee', amount: 2400, currency: 'GHS', reference_number: 'RCP-2024-0401', notes: '', created_by: uids.finance },
      { date: TS('2025-04-15'), payment_type: 'Annual Fee', amount: 1200, currency: 'GHS', reference_number: 'RCP-2025-0415', notes: 'Annual renewal fee.', created_by: uids.finance },
    ],
    CU1: [
      { date: TS('2023-05-10'), payment_type: 'Permit Fee', amount: 3500, currency: 'GHS', reference_number: 'RCP-2023-0510', notes: '', created_by: uids.finance },
      { date: TS('2024-05-10'), payment_type: 'Annual Fee', amount: 1750, currency: 'GHS', reference_number: 'RCP-2024-0510', notes: '', created_by: uids.finance },
      { date: TS('2025-05-10'), payment_type: 'Annual Fee', amount: 1750, currency: 'GHS', reference_number: 'RCP-2025-0510', notes: '', created_by: uids.finance },
    ],
    CM1: [
      { date: TS('2021-03-01'), payment_type: 'Permit Fee', amount: 12000, currency: 'GHS', reference_number: 'RCP-2021-0301', notes: 'Initial permit fee.', created_by: uids.finance },
      { date: TS('2023-03-15'), payment_type: 'Penalty', amount: 5000, currency: 'GHS', reference_number: 'PEN-2023-0315', notes: 'Penalty for late environmental report submission.', created_by: uids.finance },
    ],
    CH1: [
      { date: TS('2025-01-15'), payment_type: 'Permit Fee', amount: 1800, currency: 'GHS', reference_number: 'RCP-2025-0115', notes: '', created_by: uids.finance },
    ],
    CA1: [
      { date: TS('2025-03-10'), payment_type: 'Processing Fee', amount: 800, currency: 'GHS', reference_number: 'RCP-2025-0310', notes: 'EIA processing fee.', created_by: uids.finance },
      { date: TS('2025-04-01'), payment_type: 'Permit Fee', amount: 1500, currency: 'GHS', reference_number: 'RCP-2025-0401', notes: '', created_by: uids.finance },
    ],
    PP1: [
      { date: TS('2023-11-01'), payment_type: 'Permit Fee', amount: 2000, currency: 'GHS', reference_number: 'RCP-2023-1101', notes: '', created_by: uids.finance },
    ],
    CU2: [
      { date: TS('2024-02-14'), payment_type: 'Processing Fee', amount: 600, currency: 'GHS', reference_number: 'RCP-2024-0214', notes: '', created_by: uids.finance },
      { date: TS('2024-03-01'), payment_type: 'Permit Fee', amount: 3200, currency: 'GHS', reference_number: 'RCP-2024-0301', notes: '', created_by: uids.finance },
    ],
  }
}

function screenings(uids) {
  return {
    CI1: [
      {
        date: TS('2023-10-12'),
        officer_id: uids.officer,
        officer_name: 'Kwame Asante',
        coordinates: { lat: 6.7072, lng: -1.6481 },
        photos: [],
        notes: 'Pre-permit screening completed. Effluent treatment infrastructure in good condition. Chemical dosing room adequately ventilated.',
        created_by: uids.officer,
      },
    ],
    CH1: [
      {
        date: TS('2024-10-20'),
        officer_id: uids.officer,
        officer_name: 'Kwame Asante',
        coordinates: { lat: 6.6202, lng: -1.2238 },
        photos: [],
        notes: 'Screening prior to permit renewal. Medical waste segregation adequate. Autoclave operational. Sharps containers available in all wards.',
        created_by: uids.officer,
      },
    ],
    CA1: [
      {
        date: TS('2025-01-08'),
        officer_id: uids.officer,
        officer_name: 'Kwame Asante',
        coordinates: { lat: 6.7553, lng: -1.4758 },
        photos: [],
        notes: 'First-time screening for cocoa processing facility. Fermentation boxes well maintained. Wastewater pond under construction — to be completed before permit issue.',
        created_by: uids.officer,
      },
    ],
    PP1: [
      {
        date: TS('2023-09-15'),
        officer_id: uids.officer,
        officer_name: 'Kwame Asante',
        coordinates: { lat: 6.6748, lng: -1.6102 },
        photos: [],
        notes: 'Storage facility inspection. Fire extinguishers present. Ventilation adequate. Spill containment bunds installed. PPE available for all staff.',
        created_by: uids.officer,
      },
    ],
  }
}

function siteVerifications(uids) {
  return {
    CU1: [
      {
        date: TS('2026-03-10'),
        officer_id: uids.officer,
        officer_name: 'Kwame Asante',
        linked_permit_id: '',  // will be filled after permit created
        coordinates: { lat: 6.7201, lng: -1.5898 },
        photos: [],
        notes: 'Pre-renewal site visit. Effluent treatment plant overhauled. New BOD analyser installed. Ready for permit renewal.',
        created_by: uids.officer,
      },
    ],
    CM1: [
      {
        date: TS('2024-01-22'),
        officer_id: uids.officer,
        officer_name: 'Kwame Asante',
        linked_permit_id: '',
        coordinates: { lat: 6.2002, lng: -1.6598 },
        photos: [],
        notes: 'Site visit for permit renewal assessment. Tailings dam at 78% capacity — management plan under review. Cyanide storage meets ICMI standards.',
        created_by: uids.officer,
      },
    ],
  }
}

function monitoring(uids) {
  return {
    CI1: [
      {
        date: TS('2025-09-15'),
        officer_id: uids.officer,
        officer_name: 'Kwame Asante',
        compliance_status: 'compliant',
        checklist: {
          dust_control:    { ok: true,  note: '' },
          noise_control:   { ok: true,  note: 'All pumps within noise limits.' },
          waste_disposal:  { ok: true,  note: '' },
          water_quality:   { ok: true,  note: 'Effluent BOD 12 mg/L — within 30 mg/L limit.' },
          erosion_control: { ok: true,  note: '' },
        },
        photos: [],
        notes: 'Routine annual monitoring. All parameters within permitted limits. Excellent record-keeping.',
        created_by: uids.officer,
      },
      {
        date: TS('2024-09-10'),
        officer_id: uids.officer,
        officer_name: 'Kwame Asante',
        compliance_status: 'compliant',
        checklist: {
          dust_control:    { ok: true,  note: '' },
          noise_control:   { ok: true,  note: '' },
          waste_disposal:  { ok: true,  note: '' },
          water_quality:   { ok: true,  note: '' },
          erosion_control: { ok: false, note: 'Minor erosion near access road — contractor notified.' },
        },
        photos: [],
        notes: 'Previous annual visit. Minor erosion issue noted and rectified by December 2024.',
        created_by: uids.officer,
      },
    ],
    CU1: [
      {
        date: TS('2026-02-14'),
        officer_id: uids.officer,
        officer_name: 'Kwame Asante',
        compliance_status: 'partial',
        checklist: {
          effluent_treatment: { ok: true,  note: 'New aeration unit installed.' },
          waste_management:   { ok: true,  note: '' },
          air_emissions:      { ok: false, note: 'CO₂ scrubber offline for maintenance — planned maintenance, not violation.' },
          noise_control:      { ok: true,  note: '' },
          chemical_storage:   { ok: true,  note: '' },
          spill_prevention:   { ok: false, note: 'Secondary containment bund cracked — repair order issued.' },
        },
        photos: [],
        notes: 'Follow-up monitoring before permit renewal. Most systems compliant. Two minor issues noted with follow-up required by March 2026.',
        created_by: uids.officer,
      },
    ],
    CM1: [
      {
        date: TS('2025-11-20'),
        officer_id: uids.officer,
        officer_name: 'Kwame Asante',
        compliance_status: 'non_compliant',
        checklist: {
          tailings:           { ok: false, note: 'Tailings dam wall seepage detected on east face. Urgent repair needed.' },
          dust_suppression:   { ok: false, note: 'Water bowser not in operation. Dust levels excessive.' },
          effluent_treatment: { ok: false, note: 'Treatment pond pH 4.2 — highly acidic. Fish kill observed downstream.' },
          reclamation:        { ok: false, note: 'Reclamation plan not implemented for Section C as required.' },
          cyanide_management: { ok: true,  note: 'Cyanide storage secured and meets ICMI standards.' },
          noise_control:      { ok: true,  note: '' },
        },
        photos: [],
        notes: 'Critical non-compliance found. Acid drainage into Obuasi stream confirmed. Enforcement action initiated. Operations in affected section suspended pending remediation.',
        created_by: uids.officer,
      },
      {
        date: TS('2024-05-08'),
        officer_id: uids.officer,
        officer_name: 'Kwame Asante',
        compliance_status: 'partial',
        checklist: {
          tailings:           { ok: true,  note: '' },
          dust_suppression:   { ok: false, note: 'Dust suppression inadequate during dry season.' },
          effluent_treatment: { ok: true,  note: 'Treatment within parameters.' },
          reclamation:        { ok: false, note: 'Reclamation work behind schedule.' },
          cyanide_management: { ok: true,  note: '' },
          noise_control:      { ok: true,  note: '' },
        },
        photos: [],
        notes: 'Partial compliance. Dust suppression and reclamation schedule issues identified. Notice to comply issued.',
        created_by: uids.officer,
      },
    ],
    CU2: [
      {
        date: TS('2025-10-05'),
        officer_id: uids.officer,
        officer_name: 'Kwame Asante',
        compliance_status: 'partial',
        checklist: {
          effluent_treatment: { ok: false, note: 'BOD of dyeing effluent at 52 mg/L vs 30 mg/L limit.' },
          waste_management:   { ok: true,  note: '' },
          air_emissions:      { ok: true,  note: '' },
          noise_control:      { ok: true,  note: '' },
          chemical_storage:   { ok: true,  note: '' },
          spill_prevention:   { ok: true,  note: '' },
        },
        photos: [],
        notes: 'Effluent BOD exceeds limit. Company given 60 days to install additional treatment capacity.',
        created_by: uids.officer,
      },
    ],
    CH1: [
      {
        date: TS('2025-08-18'),
        officer_id: uids.officer,
        officer_name: 'Kwame Asante',
        compliance_status: 'compliant',
        checklist: {
          medical_waste:     { ok: true, note: 'Segregation and incineration well documented.' },
          sharps_disposal:   { ok: true, note: '' },
          chemical_handling: { ok: true, note: '' },
          effluent_treatment:{ ok: true, note: 'Effluent pH 7.1 — within range.' },
          sanitation:        { ok: true, note: '' },
        },
        photos: [],
        notes: 'Annual routine monitoring. Hospital maintaining high standards. Commended for waste segregation documentation.',
        created_by: uids.officer,
      },
    ],
  }
}

function enforcement(uids) {
  return {
    CM1: [
      {
        date: TS('2025-11-25'),
        officer_id: uids.officer,
        officer_name: 'Kwame Asante',
        location: 'East tailings dam, Obuasi Mine Site',
        contact_person: 'Kweku Asante-Mensah',
        action_taken: 'closure',
        follow_up_date: TS('2026-01-25'),
        coordinates: { lat: 6.1998, lng: -1.6605 },
        photos: [],
        notes: 'Partial closure order issued for eastern extraction section due to critical acid drainage. Company ordered to implement emergency tailings dam repair and present remediation plan within 60 days.',
        created_by: uids.officer,
      },
      {
        date: TS('2024-05-15'),
        officer_id: uids.officer,
        officer_name: 'Kwame Asante',
        location: 'Dust generation zones, Mine Site',
        contact_person: 'Kweku Asante-Mensah',
        action_taken: 'notice',
        follow_up_date: TS('2024-07-15'),
        coordinates: null,
        photos: [],
        notes: 'Notice to comply issued for dust suppression failure and reclamation schedule delay.',
        created_by: uids.officer,
      },
    ],
    CU2: [
      {
        date: TS('2025-10-15'),
        officer_id: uids.officer,
        officer_name: 'Kwame Asante',
        location: 'Effluent discharge point, Ejisu Industrial Park',
        contact_person: 'Ibrahim Al-Hassan',
        action_taken: 'warning',
        follow_up_date: TS('2025-12-15'),
        coordinates: { lat: 6.7481, lng: -1.4648 },
        photos: [],
        notes: 'Formal warning issued for effluent BOD exceedance (52 mg/L vs 30 mg/L limit). Company has 60 days to install additional treatment. Fine will apply if unresolved.',
        created_by: uids.officer,
      },
    ],
    CU1: [
      {
        date: TS('2025-06-10'),
        officer_id: uids.officer,
        officer_name: 'Kwame Asante',
        location: 'Secondary containment area, Brewery',
        contact_person: 'Abena Kusi',
        action_taken: 'notice',
        follow_up_date: TS('2025-08-10'),
        coordinates: null,
        photos: [],
        notes: 'Notice to comply for cracked containment bund and CO₂ scrubber downtime. Both issues rectified by August 2025 — case closed.',
        created_by: uids.officer,
      },
    ],
  }
}

// ── Main seed function ──────────────────────────────────────────────────
async function seedData() {
  console.log('\n=== EPA Permit System — Facility & Sub-record Seed ===\n')

  const uids = await getUids()
  console.log(`Admin  UID: ${uids.admin}`)
  console.log(`Finance UID: ${uids.finance}`)
  console.log(`Officer UID: ${uids.officer}\n`)

  // ── Facilities ──────────────────────────────────────────────────────
  console.log('Seeding facilities...')
  const createdAt = {
    CI1: TS('2023-09-01'),
    CU1: TS('2023-04-15'),
    CH1: TS('2024-11-01'),
    CT1: TS('2024-06-20'),
    CM1: TS('2021-02-10'),
    CA1: TS('2025-01-05'),
    CE1: TS('2024-08-01'),
    PP1: TS('2023-09-01'),
    CU2: TS('2024-01-20'),
    CI2: TS('2025-05-15'),
  }

  for (const f of FACILITIES) {
    await db.collection('facilities').doc(f.file_number).set({
      ...f,
      created_at:  createdAt[f.file_number],
      updated_at:  createdAt[f.file_number],
      created_by:  uids.admin,
    }, { merge: true })
    console.log(`  [facility] ${f.file_number} — ${f.name}`)
  }

  // Update sector counters to match seeded file numbers
  const counterUpdates = { CI: 2, CU: 2, CH: 1, CT: 1, CM: 1, CA: 1, CE: 1, PP: 1 }
  console.log('\nUpdating sector counters...')
  for (const [prefix, count] of Object.entries(counterUpdates)) {
    await db.collection('counters').doc(prefix).set({ last_count: count }, { merge: true })
    console.log(`  [counter] ${prefix} → last_count=${count}`)
  }

  // ── Sub-records ─────────────────────────────────────────────────────
  const permitData    = permits(uids)
  const financeData   = finance(uids)
  const screeningData = screenings(uids)
  const svData        = siteVerifications(uids)
  const monitorData   = monitoring(uids)
  const enfData       = enforcement(uids)

  async function seedSub(fileNumber, collection, records) {
    for (const rec of records) {
      const ref = db
        .collection('facilities').doc(fileNumber)
        .collection(collection).doc()
      await ref.set({ ...rec, created_at: rec.date ?? rec.created_at ?? TS('2025-01-01') })
    }
  }

  console.log('\nSeeding permits...')
  for (const [fn, recs] of Object.entries(permitData)) {
    await seedSub(fn, 'permits', recs)
    console.log(`  [permits] ${fn}: ${recs.length} record(s)`)
  }

  console.log('\nSeeding finance...')
  for (const [fn, recs] of Object.entries(financeData)) {
    await seedSub(fn, 'finance', recs)
    console.log(`  [finance] ${fn}: ${recs.length} record(s)`)
  }

  console.log('\nSeeding screenings...')
  for (const [fn, recs] of Object.entries(screeningData)) {
    await seedSub(fn, 'screenings', recs)
    console.log(`  [screenings] ${fn}: ${recs.length} record(s)`)
  }

  console.log('\nSeeding site verifications...')
  for (const [fn, recs] of Object.entries(svData)) {
    await seedSub(fn, 'site_verifications', recs)
    console.log(`  [site_verifications] ${fn}: ${recs.length} record(s)`)
  }

  console.log('\nSeeding monitoring...')
  for (const [fn, recs] of Object.entries(monitorData)) {
    await seedSub(fn, 'monitoring', recs)
    console.log(`  [monitoring] ${fn}: ${recs.length} record(s)`)
  }

  console.log('\nSeeding enforcement...')
  for (const [fn, recs] of Object.entries(enfData)) {
    await seedSub(fn, 'enforcement', recs)
    console.log(`  [enforcement] ${fn}: ${recs.length} record(s)`)
  }

  console.log('\n✓ Seed complete.\n')
  console.log('Facilities seeded:')
  FACILITIES.forEach((f) => console.log(`  ${f.file_number.padEnd(5)} ${f.name}`))
  console.log()
  process.exit(0)
}

seedData().catch((err) => {
  console.error('\nSeed failed:', err.message)
  console.error(err)
  process.exit(1)
})
