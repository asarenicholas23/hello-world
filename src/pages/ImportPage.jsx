import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Upload, Download, CheckCircle, XCircle,
  AlertCircle, Loader, ChevronRight, Building2, FileText, CreditCard, Flag, ClipboardList,
} from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { useAuth } from '../context/AuthContext'
import { createFacility, createFacilityWithId, listFacilities } from '../firebase/facilities'
import { createSubRecord } from '../firebase/subrecords'
import { createFieldReport, listFieldReports } from '../firebase/fieldReports'
import { SECTORS, DISTRICTS, PAYMENT_TYPES } from '../data/constants'
import {
  parseCSV,
  detectColumnMapping, buildTemplateCSV,
  detectPermitMapping, buildPermitTemplateCSV,
} from '../utils/csvParser'
import { normalizeAttachmentUrl } from '../utils/attachments'

// ── Shared helpers ─────────────────────────────────────────────────────

function matchSector(value) {
  if (!value) return null
  const v = value.trim().toUpperCase()
  return (
    SECTORS.find((s) => s.prefix === v) ??
    SECTORS.find((s) => s.name.toUpperCase() === v) ??
    SECTORS.find((s) => s.name.toUpperCase().includes(v) || v.includes(s.prefix))
  )
}

function matchDistrict(value) {
  if (!value) return ''
  const v = value.trim().toUpperCase()
  return (
    DISTRICTS.find((d) => d.code === v)?.code ??
    DISTRICTS.find((d) => d.name.toUpperCase() === v)?.code ??
    DISTRICTS.find((d) => d.name.toUpperCase().includes(v))?.code ??
    value.trim()
  )
}

function parseCoordinates(value) {
  if (!value) return null
  const parts = value.split(/[\s,\/]+/).map(Number).filter((n) => !isNaN(n))
  if (parts.length === 2) return { lat: parts[0], lng: parts[1] }
  return null
}

function normalizeEntityName(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\b(ltd|limited|company|co|enterprise|enterprises|ent|ghana|gh)\b/g, '')
    .replace(/[^a-z0-9]+/g, '')
}

function parseAmount(raw) {
  const cleaned = String(raw ?? '').replace(/[^0-9.-]+/g, '')
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : null
}

function matchPaymentType(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return 'Other'
  const norm = raw.toLowerCase().replace(/[^a-z0-9]+/g, '')
  return PAYMENT_TYPES.find((type) => type.toLowerCase().replace(/[^a-z0-9]+/g, '') === norm) ?? raw
}

// Parse flexible date strings from spreadsheets into Firestore Timestamp
function parseDateStr(raw) {
  if (!raw) return null
  const s = raw.trim()
  if (!s) return null

  // ISO first (YYYY-MM-DD or YYYY-MM-DDTHH:...), because it is unambiguous.
  const isoDate = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/)
  if (isoDate) {
    const year = Number(isoDate[1])
    const month = Number(isoDate[2])
    const day = Number(isoDate[3])
    const d = new Date(year, month - 1, day)
    if (!isNaN(d) && d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day) {
      return Timestamp.fromDate(d)
    }
  }

  // DD/MM/YYYY, DD-MM-YYYY. EPA imports are Ghana-style day/month/year.
  const slashDate = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (slashDate) {
    const a = Number(slashDate[1])
    const b = Number(slashDate[2])
    const year = Number(slashDate[3])
    const day = a
    const month = b
    const d = new Date(year, month - 1, day)
    if (!isNaN(d) && d.getMonth() === month - 1 && d.getDate() === day) {
      return Timestamp.fromDate(d)
    }
  }

  // Finally allow textual dates like "06 Feb 2026" / "Feb 06 2026".
  const textual = new Date(s)
  if (!isNaN(textual)) return Timestamp.fromDate(textual)

  return null
}

// ── Facility helpers ───────────────────────────────────────────────────

function rowToFacility(row, mapping) {
  const get = (field) => (mapping[field] != null ? (row[mapping[field]] ?? '').trim() : '')
  const sectorRaw = get('sector')
  const sector = matchSector(sectorRaw)
  return {
    file_number:         get('file_number').replace(/\s+/g, '') || null,
    name:                get('name'),
    sector:              sector?.name ?? sectorRaw,
    sector_prefix:       sector?.prefix ?? '',
    type_of_undertaking: get('type_of_undertaking'),
    location:            get('location'),
    district:            matchDistrict(get('district')),
    email:               get('email'),
    entity_tin:          get('entity_tin'),
    contact_person:      get('contact_person'),
    designation:         get('designation'),
    address:             get('address'),
    phone:               get('phone'),
    coordinates:         parseCoordinates(get('coordinates')),
  }
}

function validateFacility(f) {
  const errors = []
  if (!f.name)          errors.push('Name is required')
  if (!f.sector_prefix) errors.push(`Unknown sector "${f.sector}" — use sector name or prefix (e.g. Manufacturing or CU)`)
  return errors
}

function warnFacility(f) {
  const warnings = []
  if (!f.location) warnings.push('No location')
  if (!f.district) warnings.push('No district')
  return warnings
}

// ── Permit helpers ─────────────────────────────────────────────────────

function rowToPermit(row, mapping) {
  const get = (field) => (mapping[field] != null ? (row[mapping[field]] ?? '').trim() : '')
  return {
    permit_id:      get('permit_id'),
    entity_name:    get('entity_name'),
    file_number:    get('file_number').replace(/\s+/g, ''),
    permit_number:  get('permit_number'),
    issue_date:     parseDateStr(get('issue_date')),
    effective_date: parseDateStr(get('effective_date')),
    expiry_date:    parseDateStr(get('expiry_date')),
    issue_location: get('issue_location'),
    permit_image_url: normalizeAttachmentUrl(get('permit_image_url')),
    notes:          get('notes'),
    // display helpers for preview
    _entity_name_raw:    get('entity_name'),
    _issue_date_raw:     get('issue_date'),
    _effective_date_raw: get('effective_date'),
    _expiry_date_raw:    get('expiry_date'),
  }
}

function validatePermit(p) {
  const errors = []
  if (!p.file_number)   errors.push('File number is required (to link permit to a facility)')
  if (!p.permit_number) errors.push('Permit number is required')
  if (p._issue_date_raw && !p.issue_date) {
    errors.push(`Cannot parse issue date "${p._issue_date_raw}"`)
  }
  if (p._effective_date_raw && !p.effective_date) {
    errors.push(`Cannot parse effective date "${p._effective_date_raw}"`)
  }
  if (p._expiry_date_raw && !p.expiry_date) {
    errors.push(`Cannot parse expiry date "${p._expiry_date_raw}"`)
  }
  return errors
}

// ── Finance helpers ────────────────────────────────────────────────────

function detectFinanceMapping(headers) {
  const normalize = (s) => s.toLowerCase().replace(/[\s_\-\/\.]/g, '')
  const aliases = {
    invoice_no:   ['invoiceno', 'invoicenumber', 'invoiceid', 'reference', 'referencenumber', 'refno'],
    file_number:  ['fileno', 'filenumber', 'facilityno', 'facilitynumber', 'facilityfileno', 'facilityfilenumber', 'clientid'],
    client_name:  ['clientname', 'entityname', 'facilityname', 'customername', 'nameofundertaking', 'undertakingname'],
    contact:      ['contact', 'phone', 'contactno', 'contactnumber', 'telephone', 'mobile'],
    amount:       ['invoiceamt', 'invoiceamnt', 'invoiceamount', 'amount', 'amt', 'totalamount'],
    client_id:    ['clientid', 'customerid', 'entityid'],
    category:     ['category', 'paymenttype', 'type', 'feetype', 'description'],
    sector:       ['sector', 'industry'],
    department:   ['department', 'office', 'unit'],
    created_date: ['createddate', 'datecreated', 'date', 'invoicedate', 'createdon'],
  }

  const mapping = {}
  headers.forEach((header, idx) => {
    const norm = normalize(header)
    for (const [field, names] of Object.entries(aliases)) {
      if (!(field in mapping) && names.some((name) => norm === name || norm.includes(name))) {
        mapping[field] = idx
        break
      }
    }
  })
  return mapping
}

function rowToFinance(row, mapping, paymentStatus) {
  const get = (field) => (mapping[field] != null ? (row[mapping[field]] ?? '').trim() : '')
  const notes = [
    (get('client_id') || get('file_number')) ? `Client ID: ${get('client_id') || get('file_number')}` : '',
    get('contact') ? `Contact: ${get('contact')}` : '',
    get('sector') ? `Sector: ${get('sector')}` : '',
    get('department') ? `Department: ${get('department')}` : '',
  ].filter(Boolean).join('\n')

  return {
    invoice_no:        get('invoice_no'),
    file_number:       get('file_number').replace(/\s+/g, ''),
    client_name:       get('client_name'),
    contact:           get('contact'),
    amount:            parseAmount(get('amount')),
    client_id:         get('client_id') || get('file_number'),
    category:          get('category'),
    sector:            get('sector'),
    department:        get('department'),
    date:              parseDateStr(get('created_date')),
    payment_type:      matchPaymentType(get('category')),
    payment_status:    paymentStatus,
    currency:          'GHS',
    reference_number:  get('invoice_no'),
    notes,
    _created_date_raw: get('created_date'),
    _amount_raw:       get('amount'),
  }
}

function buildFinanceTemplateCSV(paymentStatus) {
  const headers = ['Invoice No.', 'File Number', 'Client Name', 'Contact', 'Invoice Amnt.', 'Client Id', 'Category', 'Sector', 'Department', 'Created Date']
  const example = [
    paymentStatus === 'paid' ? 'INV-PAID-001' : 'INV-UNPAID-001',
    'PP035',
    'Kumasi Plastic Industries Ltd',
    '+233 24 000 0000',
    '1250.00',
    'C-001',
    'Processing Fee',
    'Manufacturing',
    'Konongo Area Office',
    '2026-04-23',
  ]
  return [headers.join(','), example.map((v) => `"${v}"`).join(',')].join('\n')
}

// ── Field report helpers ───────────────────────────────────────────────

function detectFieldReportMapping(headers) {
  const normalize = (s) => s.toLowerCase().replace(/[\s_\-\/\.]/g, '')
  const aliases = {
    facility_name:      ['nameoffacility', 'facilityname', 'clientname', 'entityname'],
    location:           ['location', 'address'],
    contact_person:     ['contactperson', 'contactname'],
    sector:             ['sector'],
    phone:              ['contactnumber', 'contactno', 'phone', 'telephone', 'mobile'],
    district:           ['district'],
    permit_status:      ['permitstatus'],
    reporting_status:   ['reportingstatus', 'reportstatus'],
    date_letter_served: ['dateletterserved', 'letterserveddate'],
    date_reported:      ['datereported', 'reportdate'],
    date_of_invoice:    ['dateofinvoice', 'invoicedate'],
    amount_invoice:     ['amountinvoice', 'invoiceamount', 'invoiceamt', 'invoiceamnt'],
    payment_status:     ['paymentstatus'],
    date_of_payment:    ['dateofpayment', 'paymentdate'],
    amount:             ['amount', 'amountpaid', 'paymentamount'],
  }

  const mapping = {}
  headers.forEach((header, idx) => {
    const norm = normalize(header)
    for (const [field, names] of Object.entries(aliases)) {
      if (!(field in mapping) && names.some((name) => norm === name || norm.includes(name))) {
        mapping[field] = idx
        break
      }
    }
  })
  return mapping
}

function matchReportingStatus(value) {
  const norm = String(value ?? '').trim().toLowerCase()
  if (!norm) return 'pending'
  if (['reported', 'submitted', 'done', 'complete', 'completed', 'yes'].includes(norm)) return 'reported'
  if (['rejected', 'declined', 'no'].includes(norm)) return 'rejected'
  return 'pending'
}

function matchInvoiceStatus(paymentStatus, amountInvoice, dateOfInvoice) {
  const norm = String(paymentStatus ?? '').trim().toLowerCase()
  if (norm === 'paid' || norm === 'yes' || norm === 'complete' || norm === 'completed') return 'paid'
  if (norm === 'unpaid' || norm === 'not paid' || amountInvoice > 0 || dateOfInvoice) return 'invoiced'
  return 'pending'
}

function rowToFieldReport(row, mapping) {
  const get = (field) => (mapping[field] != null ? (row[mapping[field]] ?? '').trim() : '')
  const sectorRaw = get('sector')
  const sector = matchSector(sectorRaw)
  const amountInvoice = parseAmount(get('amount_invoice'))
  const amountPaid = parseAmount(get('amount'))
  const dateOfInvoice = parseDateStr(get('date_of_invoice'))
  const dateReported = parseDateStr(get('date_reported'))
  const paymentStatusRaw = get('payment_status')

  return {
    report_type:          'walk_in',
    facility_name:        get('facility_name'),
    location:             get('location'),
    contact_person:       get('contact_person'),
    sector_prefix:        sector?.prefix ?? '',
    sector:               sector?.name ?? sectorRaw,
    phone:                get('phone'),
    district:             matchDistrict(get('district')),
    permit_status:        get('permit_status'),
    reporting_status:     matchReportingStatus(get('reporting_status')),
    date_letter_served:   parseDateStr(get('date_letter_served')),
    date_reported:        dateReported,
    date_of_invoice:      dateOfInvoice,
    amount_invoice:       amountInvoice,
    payment_status:       paymentStatusRaw,
    date_of_payment:      parseDateStr(get('date_of_payment')),
    amount:               amountPaid,
    invoice_status:       matchInvoiceStatus(paymentStatusRaw, amountInvoice, dateOfInvoice),
    date:                 dateReported,
    officer_id:           null,
    officer_name:         null,
    action_taken:         '',
    follow_up_date:       null,
    enforcement_location: '',
    coordinates:          null,
    photos:               [],
    screening:            null,
    notes:                '',
    _date_letter_served_raw: get('date_letter_served'),
    _date_reported_raw:      get('date_reported'),
    _date_of_invoice_raw:    get('date_of_invoice'),
    _date_of_payment_raw:    get('date_of_payment'),
    _amount_invoice_raw:     get('amount_invoice'),
    _amount_raw:             get('amount'),
  }
}

function buildFieldReportTemplateCSV() {
  const headers = [
    'NAME OF FACILITY', 'LOCATION', 'CONTACT PERSON', 'SECTOR', 'CONTACT NUMBER',
    'DISTRICT', 'PERMIT STATUS', 'REPORTING STATUS', 'DATE LETTER SERVED',
    'DATE REPORTED', 'DATE OF INVOICE', 'AMOUNT INVOICE', 'PAYMENT STATUS',
    'DATE OF PAYMENT', 'AMOUNT',
  ]
  const example = [
    'Kumasi Plastic Industries Ltd', 'Konongo', 'Ama Mensah', 'Manufacturing',
    '+233 24 000 0000', 'Asante Akim Central', 'Valid', 'Reported',
    '15/04/2026', '16/04/2026', '18/04/2026', '1200.00', 'Paid',
    '20/04/2026', '1200.00',
  ]
  return [headers.join(','), example.map((v) => `"${v}"`).join(',')].join('\n')
}

// ── Screening helpers ──────────────────────────────────────────────────

function detectScreeningMapping(headers) {
  const normalize = (s) => s.toLowerCase().replace(/[\s_\-\/\.()]/g, '')
  const aliases = {
    file_number:             ['fileno', 'filenumber', 'filenum', 'fileno'],
    inspection_date:         ['inspectiondate', 'date', 'visitdate'],
    proponent_name:          ['nameofproponent', 'proponentname', 'proponent'],
    company_name:            ['companysname', 'companyname', 'company'],
    type_of_undertaking:     ['typeofundertaking', 'undertaking', 'type'],
    components:              ['components'],
    capacity:                ['capacity'],
    liquid_waste:            ['liquidwaste'],
    solid_waste:             ['solidwaste'],
    gaseous_waste:           ['gaseouswaste'],
    description_comments:    ['commentsondesriptionofundertaking', 'commentsondescription', 'descriptioncomments'],
    street_area:             ['streetareaname', 'streetarea', 'street'],
    town:                    ['town'],
    district:                ['district'],
    major_landmark:          ['majorlandmark', 'landmark'],
    adjacent_land_use:       ['adjacentlanduse', 'landuse'],
    north:                   ['north'],
    south:                   ['south'],
    east:                    ['east'],
    west:                    ['west'],
    latitude:                ['latitude', 'lat'],
    existing_infrastructure: ['existinginfrastructureandfacilityonsite', 'existinginfrastructure'],
    construction_impacts:    ['constructionphaseimpacts', 'constructionimpacts'],
    operational_impacts:     ['operationalphaseimpacts', 'operationalimpacts'],
    impacts_in_ea1:          ['impactsaddressedinea1', 'impactsinea1'],
    mitigation_measures:     ['ifnomitigationmeasures', 'mitigationmeasures', 'mitigation'],
    neighbour_name:          ['nameofneighbour', 'neighbourname'],
    neighbour_contact:       ['contactofneighbour', 'neighbourcontact'],
    neighbour_location:      ['locationinrelationtotheundertaking', 'neighbourlocation'],
    neighbour_comments:      ['theircomments', 'neighbourcomments'],
    observations:            ['observations'],
    comments:                ['comments'],
    permit_recommended:      ['permitrecommended'],
    additional_info_required:['additionalinforequired', 'additionalinfo'],
    per_recommended:         ['perrecommended'],
    eia_recommended:         ['eiarecommended'],
    permit_declined:         ['permitdeclined'],
    permit_declined_reason:  ['reasonforpermitdeclined', 'permitdeclinedreason'],
    officer_name:            ['nameofofficer', 'officername', 'officer'],
    screening_id:            ['screeningid', 'scrid'],
  }

  const mapping = {}
  headers.forEach((header, idx) => {
    const norm = normalize(header)
    for (const [field, names] of Object.entries(aliases)) {
      if (!(field in mapping) && names.some((name) => norm === name || norm.includes(name))) {
        mapping[field] = idx
        break
      }
    }
  })
  return mapping
}

function normalizeYesNo(value) {
  if (!value) return ''
  const v = value.trim().toLowerCase()
  if (['yes', 'y', '1', 'true'].includes(v)) return 'Yes'
  if (['no', 'n', '0', 'false'].includes(v)) return 'No'
  return ''
}

function rowToScreening(row, mapping) {
  const get = (field) => (mapping[field] != null ? (row[mapping[field]] ?? '').trim() : '')
  return {
    file_number:             get('file_number').replace(/\s+/g, ''),
    inspection_date:         parseDateStr(get('inspection_date')),
    proponent_name:          get('proponent_name'),
    company_name:            get('company_name'),
    type_of_undertaking:     get('type_of_undertaking'),
    components:              get('components'),
    capacity:                get('capacity'),
    liquid_waste:            get('liquid_waste'),
    solid_waste:             get('solid_waste'),
    gaseous_waste:           get('gaseous_waste'),
    description_comments:    get('description_comments'),
    street_area:             get('street_area'),
    town:                    get('town'),
    district:                matchDistrict(get('district')),
    major_landmark:          get('major_landmark'),
    adjacent_land_use:       get('adjacent_land_use'),
    north:                   get('north'),
    south:                   get('south'),
    east:                    get('east'),
    west:                    get('west'),
    latitude:                get('latitude'),
    existing_infrastructure: get('existing_infrastructure'),
    construction_impacts:    get('construction_impacts'),
    operational_impacts:     get('operational_impacts'),
    impacts_in_ea1:          normalizeYesNo(get('impacts_in_ea1')),
    mitigation_measures:     get('mitigation_measures'),
    neighbour_name:          get('neighbour_name'),
    neighbour_contact:       get('neighbour_contact'),
    neighbour_location:      get('neighbour_location'),
    neighbour_comments:      get('neighbour_comments'),
    observations:            get('observations'),
    comments:                get('comments'),
    permit_recommended:      normalizeYesNo(get('permit_recommended')),
    additional_info_required:normalizeYesNo(get('additional_info_required')),
    per_recommended:         normalizeYesNo(get('per_recommended')),
    eia_recommended:         normalizeYesNo(get('eia_recommended')),
    permit_declined:         normalizeYesNo(get('permit_declined')),
    permit_declined_reason:  get('permit_declined_reason'),
    officer_name:            get('officer_name'),
    screening_id:            get('screening_id'),
    photos:                  [],
    coordinates:             null,
    _inspection_date_raw:    get('inspection_date'),
  }
}

function buildScreeningTemplateCSV() {
  const headers = [
    'File No.', 'Inspection Date', 'Name of Proponent', "Company's Name", 'Type of Undertaking',
    'Components', 'Capacity', 'Liquid Waste', 'Solid Waste', 'Gaseous Waste',
    'Comments on description of undertaking', 'Street/Area Name', 'Town', 'District', 'Major Landmark',
    'Adjacent Land Use', 'North', 'South', 'East', 'West', 'Latitude',
    'Existing Infrastructure and Facility on site', 'Construction Phase Impacts', 'Operational Phase Impacts',
    'Impacts Addressed in EA1?', 'If no, Mitigation measures', 'Name of Neighbour', 'Contact of Neighbour',
    'Location in relation to the undertaking', 'Their comments', 'Observations', 'Comments',
    'Permit Recommended?', 'Additional Info Required?', 'PER Recommended?', 'EIA Recommended?',
    'Permit Declined?', 'Reason for Permit Declined', 'Picture of Facility', 'Name of Officer', 'ScreeningID',
  ]
  const example = [
    'CI42', '15/04/2026', 'Kwame Mensah', 'Kumasi Plastics Ltd', 'Manufacturing',
    'Extrusion plant, storage, loading bay', '500 tonnes/month',
    'Effluent from wash process', 'Plastic scraps and waste', 'Boiler emissions',
    'Adequate description provided', 'Industrial Area', 'Konongo', 'Asante Akim Central',
    'Konongo Market', 'Industrial', 'Residential', 'Forest reserve', 'Agricultural', 'Road',
    '6.6270', 'Existing warehouse and office block', 'Dust, noise from construction',
    'Waste discharge, air emissions', 'Yes', '', 'Akosua Asante', '+233 20 000 0000',
    'North of facility', 'No objections raised', 'Site appears suitable for proposed use',
    'Recommend monitoring plan be submitted', 'Yes', 'No', 'No', 'No', 'No', '',
    '', 'Ama Boateng', 'SCR-CI42-001',
  ]
  return [headers.join(','), example.map((v) => `"${v}"`).join(',')].join('\n')
}

// ── Component ──────────────────────────────────────────────────────────

const STAGES = { idle: 'idle', preview: 'preview', importing: 'importing', done: 'done' }

export default function ImportPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const fileInputRef = useRef()

  const [importType, setImportType] = useState('facilities') // facilities | permits | finance_paid | finance_unpaid | field_reports | screenings
  const [stage, setStage]           = useState(STAGES.idle)
  const [dragOver, setDragOver]     = useState(false)
  const [parseError, setParseError] = useState('')

  const [headers, setHeaders]   = useState([])
  const [mapping, setMapping]   = useState({})
  const [records, setRecords]   = useState([])
  const [existingFacilitiesById, setExistingFacilitiesById] = useState(new Map())
  const [existingFacilitiesByName, setExistingFacilitiesByName] = useState(new Map())
  const [facilityLinkLoading, setFacilityLinkLoading] = useState(false)
  const [fieldReportsByName, setFieldReportsByName] = useState(new Map())

  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [results, setResults]   = useState([])

  function reset() {
    setStage(STAGES.idle)
    setHeaders([])
    setMapping({})
    setRecords([])
    setResults([])
    setParseError('')
  }

  useEffect(() => {
    if (importType !== 'permits' && importType !== 'screenings' && !importType.startsWith('finance_')) return

    let cancelled = false
    setFacilityLinkLoading(true)

    const facilitiesPromise = listFacilities().then((rows) => {
      if (cancelled) return
      const byId = new Map()
      const byName = new Map()
      const duplicateNames = new Set()

      rows.forEach((f) => {
        const fileNumber = String(f.file_number ?? '').trim()
        const name = String(f.name ?? '').trim()
        if (fileNumber) byId.set(fileNumber, name)
        const nameKey = normalizeEntityName(name)
        if (!nameKey) return
        if (byName.has(nameKey)) duplicateNames.add(nameKey)
        byName.set(nameKey, { fileNumber, name, duplicate: false })
      })

      duplicateNames.forEach((nameKey) => {
        const existing = byName.get(nameKey)
        byName.set(nameKey, { ...existing, duplicate: true })
      })

      setExistingFacilitiesById(byId)
      setExistingFacilitiesByName(byName)
    })

    // For screenings: also load field reports for name-based fallback matching
    const fieldReportsPromise = importType === 'screenings'
      ? listFieldReports().then((reports) => {
          if (cancelled) return
          const byName = new Map()
          reports.forEach((r) => {
            const nameKey = normalizeEntityName(r.facility_name ?? '')
            if (nameKey && !byName.has(nameKey)) {
              byName.set(nameKey, { fileNumber: r.assigned_file_number ?? null, facilityName: r.facility_name, reportId: r.id })
            }
          })
          setFieldReportsByName(byName)
        })
      : Promise.resolve()

    Promise.all([facilitiesPromise, fieldReportsPromise])
      .catch(() => {
        if (cancelled) return
        setExistingFacilitiesById(new Map())
        setExistingFacilitiesByName(new Map())
      })
      .finally(() => {
        if (!cancelled) setFacilityLinkLoading(false)
      })

    return () => { cancelled = true }
  }, [importType])

  function switchType(t) {
    setImportType(t)
    reset()
  }

  // ── File handling ────────────────────────────────────────────────────

  function handleFile(file) {
    if (!file) return
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      setParseError('Please upload a CSV file (.csv).')
      return
    }
    setParseError('')
    const reader = new FileReader()
    reader.onload = (e) => processCSV(e.target.result)
    reader.readAsText(file)
  }

  function processCSV(text) {
    const { headers: h, rows } = parseCSV(text)
    if (!h.length) { setParseError('File appears empty or has no header row.'); return }

    if (importType === 'permits') {
      const map = detectPermitMapping(h)
      if (!('permit_number' in map) && !('file_number' in map)) {
        setParseError('Could not recognise permit columns. Download the template to see the expected format.')
        return
      }
      setHeaders(h)
      setMapping(map)
      setRecords(rows.map((row) => rowToPermit(row, map)))
    } else if (importType.startsWith('finance_')) {
      const map = detectFinanceMapping(h)
      if (!('amount' in map) || (!('file_number' in map) && !('client_name' in map))) {
        setParseError('Could not recognise finance columns. Make sure the CSV includes Invoice Amnt. plus File Number, Client Id, or Client Name.')
        return
      }
      setHeaders(h)
      setMapping(map)
      setRecords(rows.map((row) => rowToFinance(row, map, importType === 'finance_paid' ? 'paid' : 'unpaid')))
    } else if (importType === 'field_reports') {
      const map = detectFieldReportMapping(h)
      if (!('facility_name' in map)) {
        setParseError('Could not recognise field report columns. Make sure the CSV includes NAME OF FACILITY.')
        return
      }
      setHeaders(h)
      setMapping(map)
      setRecords(rows.map((row) => rowToFieldReport(row, map)))
    } else if (importType === 'screenings') {
      const map = detectScreeningMapping(h)
      if (!('inspection_date' in map) && !('file_number' in map)) {
        setParseError('Could not recognise screening columns. Download the template to see the expected format.')
        return
      }
      setHeaders(h)
      setMapping(map)
      setRecords(rows.map((row) => rowToScreening(row, map)))
    } else {
      const map = detectColumnMapping(h)
      if (!('name' in map) && !('sector' in map)) {
        setParseError('Could not recognise facility columns. Download the template to see the expected format.')
        return
      }
      setHeaders(h)
      setMapping(map)
      setRecords(rows.map((row) => rowToFacility(row, map)))
    }
    setStage(STAGES.preview)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    handleFile(e.dataTransfer.files[0])
  }

  // ── Import ───────────────────────────────────────────────────────────

  // Standard file number format: one or more letters then digits (e.g. CI42, CU1547, PP035)
  function isStandardFileNumber(fn) {
    return /^[A-Z]{1,4}\d+$/i.test((fn ?? '').trim())
  }

  function resolveScreeningFacility(record) {
    const fn = record.file_number
    if (fn && existingFacilitiesById.has(fn)) {
      return { fileNumber: fn, name: existingFacilitiesById.get(fn), matchMethod: 'file number' }
    }
    // Non-standard or missing file number: try name-based matching
    if (!fn || !isStandardFileNumber(fn)) {
      const nameKey = normalizeEntityName(record.proponent_name || record.company_name || '')
      if (nameKey) {
        // 1. Try registered facilities by name
        const facilityMatch = existingFacilitiesByName.get(nameKey)
        if (facilityMatch?.fileNumber && !facilityMatch.duplicate) {
          return { fileNumber: facilityMatch.fileNumber, name: facilityMatch.name, matchMethod: 'facility name' }
        }
        // 2. Fall back to field reports that have an assigned file number
        const reportMatch = fieldReportsByName.get(nameKey)
        if (reportMatch?.fileNumber) {
          return { fileNumber: reportMatch.fileNumber, name: reportMatch.facilityName, matchMethod: 'field report name' }
        }
      }
    }
    return null
  }

  function validateRecord(record) {
    if (importType === 'facilities') return validateFacility(record)

    if (importType === 'permits') {
      const errors = validatePermit(record)
      if (record.file_number && !facilityLinkLoading && !existingFacilitiesById.has(record.file_number)) {
        errors.push(`No facility found with file number "${record.file_number}"`)
      }
      return errors
    }

    if (importType === 'screenings') {
      const errors = []
      if (!record.file_number) errors.push('File No. is required')
      if (record._inspection_date_raw && !record.inspection_date) errors.push(`Cannot parse inspection date "${record._inspection_date_raw}"`)
      if (!record.inspection_date) errors.push('Inspection Date is required')
      if (record.file_number && !facilityLinkLoading) {
        const linked = resolveScreeningFacility(record)
        if (!linked) errors.push(`No facility found for file number "${record.file_number}"`)
      }
      return errors
    }

    if (importType === 'field_reports') {
      const errors = []
      if (!record.facility_name) errors.push('Name of facility is required')
      if (record.sector && !record.sector_prefix) errors.push(`Unknown sector "${record.sector}"`)
      if (record._date_letter_served_raw && !record.date_letter_served) errors.push(`Cannot parse date letter served "${record._date_letter_served_raw}"`)
      if (record._date_reported_raw && !record.date_reported) errors.push(`Cannot parse date reported "${record._date_reported_raw}"`)
      if (record._date_of_invoice_raw && !record.date_of_invoice) errors.push(`Cannot parse date of invoice "${record._date_of_invoice_raw}"`)
      if (record._date_of_payment_raw && !record.date_of_payment) errors.push(`Cannot parse date of payment "${record._date_of_payment_raw}"`)
      if (record._amount_invoice_raw && record.amount_invoice == null) errors.push(`Cannot parse amount invoice "${record._amount_invoice_raw}"`)
      if (record._amount_raw && record.amount == null) errors.push(`Cannot parse amount "${record._amount_raw}"`)
      return errors
    }

    const errors = []
    if (record.amount == null || record.amount <= 0) errors.push(`Cannot parse invoice amount "${record._amount_raw}"`)
    if (!record.date) errors.push(record._created_date_raw ? `Cannot parse created date "${record._created_date_raw}"` : 'Created Date is required')
    if (!record.file_number && !record.client_name) errors.push('File Number or Client Name is required')
    if ((record.file_number || record.client_name) && !facilityLinkLoading) {
      const linked = resolveFinanceFacility(record)
      if (!linked) {
        errors.push(record.file_number
          ? `No facility found with file number "${record.file_number}" or client "${record.client_name}"`
          : `No facility found for client "${record.client_name}"`)
      } else if (linked.duplicate) {
        errors.push(`Multiple facilities match client "${record.client_name}"`)
      }
    }
    return errors
  }

  function getLinkedFacilityName(fileNumber) {
    return existingFacilitiesById.get(fileNumber) ?? ''
  }

  function resolveFinanceFacility(record) {
    if (record.file_number && existingFacilitiesById.has(record.file_number)) {
      return {
        fileNumber: record.file_number,
        name: existingFacilitiesById.get(record.file_number),
        matchMethod: 'file number',
      }
    }

    if (!record.client_name) return null
    const linked = existingFacilitiesByName.get(normalizeEntityName(record.client_name))
    if (!linked) return null
    return { ...linked, matchMethod: 'client name' }
  }

  const validRecords = records.filter((r) => validateRecord(r).length === 0)

  async function handleImport() {
    setProgress({ done: 0, total: validRecords.length })
    setResults([])
    setStage(STAGES.importing)

    const out = []
    for (let i = 0; i < validRecords.length; i++) {
      const r = validRecords[i]
      try {
        if (importType === 'permits') {
          const { file_number, _entity_name_raw, _issue_date_raw, _effective_date_raw, _expiry_date_raw, ...permitData } = r
          const linkedFacilityName = getLinkedFacilityName(file_number)
          permitData.entity_name = linkedFacilityName || permitData.entity_name || ''
          await createSubRecord(file_number, 'permits', permitData, user.uid)
          out.push({ name: r.permit_number, fileNumber: file_number, facilityName: linkedFacilityName, success: true })
        } else if (importType.startsWith('finance_')) {
          const linkedFacility = resolveFinanceFacility(r)
          const {
            invoice_no, file_number, client_name, contact, client_id, category, sector, department,
            _created_date_raw, _amount_raw, ...financeData
          } = r
          financeData.client_name = client_name
          financeData.import_category = category
          financeData.import_sector = sector
          financeData.import_department = department
          financeData.import_contact = contact
          financeData.client_id = client_id
          financeData.invoice_no = invoice_no
          financeData.import_file_number = file_number
          financeData.facility_match_method = linkedFacility.matchMethod
          await createSubRecord(linkedFacility.fileNumber, 'finance', financeData, user.uid)
          out.push({ name: invoice_no || client_name || file_number, fileNumber: linkedFacility.fileNumber, facilityName: linkedFacility.name, success: true })
        } else if (importType === 'screenings') {
          const linkedFacility = resolveScreeningFacility(r)
          const { file_number, _inspection_date_raw, ...screeningData } = r
          screeningData.date = screeningData.inspection_date
          screeningData.screening_id = screeningData.screening_id || `SCR-${linkedFacility.fileNumber}-imported`
          await createSubRecord(linkedFacility.fileNumber, 'screenings', screeningData, user.uid)
          out.push({ name: r.proponent_name || r.company_name || file_number, fileNumber: linkedFacility.fileNumber, facilityName: linkedFacility.name, success: true })
        } else if (importType === 'field_reports') {
          const {
            _date_letter_served_raw, _date_reported_raw, _date_of_invoice_raw, _date_of_payment_raw,
            _amount_invoice_raw, _amount_raw, ...fieldReportData
          } = r
          await createFieldReport(fieldReportData, user.uid)
          out.push({ name: r.facility_name, success: true })
        } else {
          const { file_number: explicitId, ...facilityData } = r
          const fn = explicitId
            ? await createFacilityWithId(explicitId, facilityData, user.uid)
            : await createFacility(facilityData, user.uid)
          out.push({ name: r.name, fileNumber: fn, success: true })
        }
      } catch (err) {
        out.push({
          name: importType === 'permits'
            ? r.permit_number
            : importType.startsWith('finance_')
              ? (r.invoice_no || r.client_name || r.file_number)
              : importType === 'field_reports'
                ? r.facility_name
                : importType === 'screenings'
                  ? (r.proponent_name || r.company_name || r.file_number)
                  : r.name,
          error: err.message,
          success: false,
        })
      }
      setProgress({ done: i + 1, total: validRecords.length })
      setResults([...out])
    }
    setStage(STAGES.done)
  }

  // ── Template download ────────────────────────────────────────────────

  const isFinanceImport = importType.startsWith('finance_')
  const importNoun = importType === 'permits'
    ? 'Permit'
    : isFinanceImport
      ? 'Finance Record'
      : importType === 'field_reports'
        ? 'Field Report'
        : importType === 'screenings'
          ? 'Screening'
          : 'Facility'

  function downloadTemplate() {
    const [content, filename] = importType === 'permits'
      ? [buildPermitTemplateCSV(), 'epa-permits-template.csv']
      : isFinanceImport
        ? [buildFinanceTemplateCSV(importType === 'finance_paid' ? 'paid' : 'unpaid'), `epa-finance-${importType === 'finance_paid' ? 'paid' : 'unpaid'}-template.csv`]
        : importType === 'field_reports'
          ? [buildFieldReportTemplateCSV(), 'epa-field-reports-template.csv']
          : importType === 'screenings'
            ? [buildScreeningTemplateCSV(), 'epa-screenings-template.csv']
            : [buildTemplateCSV(), 'epa-facilities-template.csv']
    const blob = new Blob([content], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Computed counts ───────────────────────────────────────────────────

  const invalidCount = records.length - validRecords.length
  const warnCount    = importType === 'facilities'
    ? records.filter((r) => validateRecord(r).length === 0 && warnFacility(r).length > 0).length
    : 0
  const successCount = results.filter((r) => r.success).length
  const failCount    = results.filter((r) => !r.success).length

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="page">
      <button className="btn btn--ghost btn--sm btn--back" onClick={() => navigate('/')}>
        <ArrowLeft size={14} /> Back to Dashboard
      </button>

      <div className="page-header" style={{ marginTop: 12 }}>
        <div>
          <div className="page-title">Import Data</div>
          <div className="page-subtitle">Bulk-import facilities, permits, finance records, or field reports from a CSV file.</div>
        </div>
        {stage === STAGES.idle && (
          <button className="btn btn--ghost" onClick={downloadTemplate}>
            <Download size={14} /> Download Template
          </button>
        )}
      </div>

      {/* ── Type selector ── */}
      {stage === STAGES.idle && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 4 }}>
          <button
            className={`btn ${importType === 'facilities' ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => switchType('facilities')}
          >
            <Building2 size={14} /> Facilities
          </button>
          <button
            className={`btn ${importType === 'permits' ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => switchType('permits')}
          >
            <FileText size={14} /> Permits
          </button>
          <button
            className={`btn ${importType === 'finance_paid' ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => switchType('finance_paid')}
          >
            <CreditCard size={14} /> Finance Paid
          </button>
          <button
            className={`btn ${importType === 'finance_unpaid' ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => switchType('finance_unpaid')}
          >
            <CreditCard size={14} /> Finance Unpaid
          </button>
          <button
            className={`btn ${importType === 'field_reports' ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => switchType('field_reports')}
          >
            <Flag size={14} /> Field Reports
          </button>
          <button
            className={`btn ${importType === 'screenings' ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => switchType('screenings')}
          >
            <ClipboardList size={14} /> Screenings
          </button>
        </div>
      )}

      {/* ── Stage: Idle ── */}
      {stage === STAGES.idle && (
        <>
          {parseError && (
            <div className="login-error" style={{ marginBottom: 16 }}>
              <AlertCircle size={15} style={{ flexShrink: 0 }} /> {parseError}
            </div>
          )}

          <div
            className={`import-dropzone${dragOver ? ' import-dropzone--over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={36} color="#9ca3af" />
            <div className="import-dropzone__label">Drop your CSV here, or click to browse</div>
            <div className="import-dropzone__hint">CSV files only · columns auto-detected from headers</div>
            <input ref={fileInputRef} type="file" accept=".csv,text/csv"
              style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files[0])} />
          </div>

          <div className="import-help-card">
            {importType === 'facilities' ? (
              <>
                <div className="import-help-card__title">Importing Facilities</div>
                <ol className="import-help-card__steps">
                  <li>Open your facilities spreadsheet in Google Sheets</li>
                  <li>Go to <strong>File → Download → Comma-separated values (.csv)</strong></li>
                  <li>Make sure row 1 contains column headers (see template for expected names)</li>
                  <li>Upload the downloaded file above</li>
                </ol>
                <div className="import-help-card__sectors">
                  <strong>Valid sector values:</strong>{' '}
                  {SECTORS.map((s) => `${s.name} (${s.prefix})`).join(' · ')}
                </div>
              </>
            ) : importType === 'permits' ? (
              <>
                <div className="import-help-card__title">Importing Permits</div>
                <ol className="import-help-card__steps">
                  <li>Each row must have the <strong>file number</strong> of the facility the permit belongs to</li>
                  <li>Dates can be in any common format: <code>2025-01-15</code>, <code>15/01/2025</code>, <code>15 Jan 2025</code></li>
                  <li>Facilities must already exist in the system before importing their permits</li>
                  <li>Download the template to see required column names</li>
                </ol>
                <div className="import-help-card__sectors">
                  <strong>Supported headers:</strong> PermID, Entity Name, File No., PERMIT NO., Date of Issue, Effective Date, Date of Expiry, Place of Issue, Permit Image
                </div>
              </>
            ) : isFinanceImport ? (
              <>
                <div className="import-help-card__title">
                  Importing {importType === 'finance_paid' ? 'Paid' : 'Unpaid'} Finance
                </div>
                <ol className="import-help-card__steps">
                  <li>Export the <strong>{importType === 'finance_paid' ? 'Paid' : 'Unpaid'}</strong> sheet as CSV</li>
                  <li>The importer first links by <strong>File Number</strong> or <strong>Client Id</strong></li>
                  <li>If the file number does not match, it falls back to <strong>Client Name</strong></li>
                  <li>Invoice No. becomes the finance reference number</li>
                </ol>
                <div className="import-help-card__sectors">
                  <strong>Supported headers:</strong> Invoice No., File Number, Client Name, Contact, Invoice Amnt., Client Id, Category, Sector, Department, Created Date
                </div>
              </>
            ) : importType === 'screenings' ? (
              <>
                <div className="import-help-card__title">Importing Screenings</div>
                <ol className="import-help-card__steps">
                  <li>Each row must have a <strong>File No.</strong> matching a registered facility</li>
                  <li>If the file number doesn't match (e.g. from an old system), the importer will try to match by proponent or company name against field reports</li>
                  <li>Yes/No columns accept: Yes/No, Y/N, 1/0</li>
                  <li>Dates should use <strong>DD/MM/YYYY</strong> or ISO format</li>
                </ol>
                <div className="import-help-card__sectors">
                  <strong>Supported headers:</strong> File No., Inspection Date, Name of Proponent, Company's Name, Type of Undertaking, Components, Capacity, Liquid Waste, Solid Waste, Gaseous Waste, Comments on description of undertaking, Street/Area Name, Town, District, Major Landmark, Adjacent Land Use, North, South, East, West, Latitude, Existing Infrastructure and Facility on site, Construction Phase Impacts, Operational Phase Impacts, Impacts Addressed in EA1?, If no Mitigation measures, Name of Neighbour, Contact of Neighbour, Location in relation to the undertaking, Their comments, Observations, Comments, Permit Recommended?, Additional Info Required?, PER Recommended?, EIA Recommended?, Permit Declined?, Reason for Permit Declined, Name of Officer, ScreeningID
                </div>
              </>
            ) : (
              <>
                <div className="import-help-card__title">Importing Field Reports</div>
                <ol className="import-help-card__steps">
                  <li>Export the field reports sheet as CSV</li>
                  <li>Rows are imported as field reports without changing the field report form</li>
                  <li>Dates should use <strong>DD/MM/YYYY</strong> or an ISO date like <code>2026-04-23</code></li>
                  <li>Reporting and payment statuses are preserved on the imported report</li>
                </ol>
                <div className="import-help-card__sectors">
                  <strong>Supported headers:</strong> NAME OF FACILITY, LOCATION, CONTACT PERSON, SECTOR, CONTACT NUMBER, DISTRICT, PERMIT STATUS, REPORTING STATUS, DATE LETTER SERVED, DATE REPORTED, DATE OF INVOICE, AMOUNT INVOICE, PAYMENT STATUS, DATE OF PAYMENT, AMOUNT
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* ── Stage: Preview ── */}
      {stage === STAGES.preview && (
        <>
          <div className="import-summary-bar">
            <span className="import-summary-bar__count">{records.length} rows detected</span>
            <span className="import-summary-bar__valid">
              <CheckCircle size={13} /> {validRecords.length} ready to import
            </span>
            {(importType === 'permits' || isFinanceImport || importType === 'screenings') && facilityLinkLoading && (
              <span style={{ fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} />
                Checking facility links…
              </span>
            )}
            {warnCount > 0 && (
              <span style={{ fontSize: 12, color: '#b45309', display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertCircle size={13} /> {warnCount} with warnings (will still import)
              </span>
            )}
            {invalidCount > 0 && (
              <span className="import-summary-bar__invalid">
                <XCircle size={13} /> {invalidCount} with errors (will be skipped)
              </span>
            )}
            <button className="btn btn--ghost btn--sm" style={{ marginLeft: 'auto' }} onClick={reset}>
              Upload different file
            </button>
          </div>

          {/* Column mapping */}
          <div className="card" style={{ padding: '14px 18px', marginBottom: 12 }}>
            <div className="card-title" style={{ marginBottom: 10 }}>Detected column mapping</div>
            <div className="import-mapping-grid">
              {Object.entries(mapping).map(([field, idx]) => (
                <div key={field} className="import-mapping-row">
                  <span className="import-mapping-row__csv">{headers[idx]}</span>
                  <ChevronRight size={12} color="#9ca3af" />
                  <span className="import-mapping-row__field">{field}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Error breakdown */}
          {invalidCount > 0 && (() => {
            const errorCounts = {}
            const sectorCounts = {}
            records.forEach((r) => {
              const errs = validateRecord(r)
              if (errs.length === 0) return
              errs.forEach((e) => { errorCounts[e] = (errorCounts[e] ?? 0) + 1 })
              if (importType === 'facilities' && !r.sector_prefix && r.sector) {
                sectorCounts[r.sector] = (sectorCounts[r.sector] ?? 0) + 1
              }
            })
            const unknownSectors = Object.entries(sectorCounts).sort((a, b) => b[1] - a[1])
            return (
              <div className="card" style={{ padding: '14px 18px', marginBottom: 12, borderLeft: '3px solid #f87171' }}>
                <div className="card-title" style={{ marginBottom: 10, color: '#dc2626' }}>
                  Error breakdown ({invalidCount} rows skipped)
                </div>
                {Object.entries(errorCounts).map(([msg, count]) => (
                  <div key={msg} style={{ fontSize: 13, color: '#374151', marginBottom: 4 }}>
                    <strong style={{ color: '#dc2626' }}>{count}×</strong> {msg}
                  </div>
                ))}
                {unknownSectors.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>
                      Unrecognised sector values in your CSV:
                    </div>
                    {unknownSectors.map(([name, count]) => (
                      <div key={name} style={{ fontSize: 12, color: '#374151', fontFamily: 'monospace', marginBottom: 2 }}>
                        "{name}" — {count} row{count !== 1 ? 's' : ''}
                      </div>
                    ))}
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
                      Valid sectors: {SECTORS.map((s) => `${s.name} (${s.prefix})`).join(', ')}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}

          {/* Preview table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', fontWeight: 600, fontSize: 13 }}>
              Preview (first 5 rows)
            </div>
            <div style={{ overflowX: 'auto' }}>
              {importType === 'permits' ? (
                <table className="import-table">
                  <thead>
                    <tr>
                      <th>#</th><th>File No.</th><th>Entity</th><th>Permit Number</th>
                      <th>Issue Date</th><th>Effective Date</th><th>Expiry Date</th>
                      <th>Permit Image</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.slice(0, 5).map((r, i) => {
                      const errors = validateRecord(r)
                      const linkedFacilityName = getLinkedFacilityName(r.file_number)
                      const fmt = (ts) => ts ? new Date(ts.seconds * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
                      return (
                        <tr key={i} className={errors.length ? 'import-table__row--error' : ''}>
                          <td style={{ color: '#9ca3af' }}>{i + 1}</td>
                          <td><span className="file-num" style={{ fontSize: 11 }}>{r.file_number || <em style={{ color: '#dc2626' }}>missing</em>}</span></td>
                          <td>{linkedFacilityName || <em style={{ color: '#9ca3af' }}>{r._entity_name_raw || 'linked from file no.'}</em>}</td>
                          <td><strong>{r.permit_number || <em style={{ color: '#9ca3af' }}>—</em>}</strong></td>
                          <td>{fmt(r.issue_date)}</td>
                          <td>{fmt(r.effective_date)}</td>
                          <td>{fmt(r.expiry_date)}</td>
                          <td>
                            {r.permit_image_url
                              ? <a href={normalizeAttachmentUrl(r.permit_image_url)} target="_blank" rel="noopener noreferrer" className="attachment-link">Drive Link</a>
                              : <em style={{ color: '#9ca3af' }}>—</em>}
                          </td>
                          <td>
                            {errors.length === 0
                              ? <span style={{ color: '#16a34a', fontSize: 12 }}>✓ Ready</span>
                              : <span style={{ color: '#dc2626', fontSize: 12 }} title={errors.join('\n')}>✗ {errors[0]}</span>
                            }
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              ) : isFinanceImport ? (
                <table className="import-table">
                  <thead>
                    <tr>
                      <th>#</th><th>Invoice No.</th><th>File No.</th><th>Client Name</th><th>Matched Facility</th>
                      <th>Match</th><th>Amount</th><th>Category</th><th>Created Date</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.slice(0, 5).map((r, i) => {
                      const errors = validateRecord(r)
                      const linkedFacility = resolveFinanceFacility(r)
                      const fmt = (ts) => ts ? new Date(ts.seconds * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
                      return (
                        <tr key={i} className={errors.length ? 'import-table__row--error' : ''}>
                          <td style={{ color: '#9ca3af' }}>{i + 1}</td>
                          <td><strong>{r.invoice_no || <em style={{ color: '#9ca3af' }}>—</em>}</strong></td>
                          <td><span className="file-num" style={{ fontSize: 11 }}>{r.file_number || <em style={{ color: '#dc2626' }}>missing</em>}</span></td>
                          <td>{r.client_name || <em style={{ color: '#dc2626' }}>missing</em>}</td>
                          <td>
                            {linkedFacility && !linkedFacility.duplicate
                              ? <><span className="file-num" style={{ fontSize: 11 }}>{linkedFacility.fileNumber}</span> {linkedFacility.name}</>
                              : <em style={{ color: '#9ca3af' }}>—</em>}
                          </td>
                          <td>{linkedFacility?.matchMethod || <em style={{ color: '#9ca3af' }}>—</em>}</td>
                          <td>{r.amount != null ? `GHS ${r.amount.toLocaleString('en-GH', { minimumFractionDigits: 2 })}` : <em style={{ color: '#dc2626' }}>{r._amount_raw || 'missing'}</em>}</td>
                          <td>{r.payment_type || <em style={{ color: '#9ca3af' }}>—</em>}</td>
                          <td>{fmt(r.date)}</td>
                          <td>
                            {errors.length === 0
                              ? <span style={{ color: '#16a34a', fontSize: 12 }}>✓ Ready</span>
                              : <span style={{ color: '#dc2626', fontSize: 12 }} title={errors.join('\n')}>✗ {errors[0]}</span>
                            }
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              ) : importType === 'screenings' ? (
                <table className="import-table">
                  <thead>
                    <tr>
                      <th>#</th><th>File No.</th><th>Matched Facility</th><th>Match</th>
                      <th>Inspection Date</th><th>Proponent</th><th>Company</th>
                      <th>Permit Rec.</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.slice(0, 5).map((r, i) => {
                      const errors = validateRecord(r)
                      const linked = resolveScreeningFacility(r)
                      const fmt = (ts) => ts ? new Date(ts.seconds * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
                      return (
                        <tr key={i} className={errors.length ? 'import-table__row--error' : ''}>
                          <td style={{ color: '#9ca3af' }}>{i + 1}</td>
                          <td><span className="file-num" style={{ fontSize: 11 }}>{r.file_number || <em style={{ color: '#dc2626' }}>missing</em>}</span></td>
                          <td>{linked ? <><span className="file-num" style={{ fontSize: 11 }}>{linked.fileNumber}</span> {linked.name}</> : <em style={{ color: '#9ca3af' }}>—</em>}</td>
                          <td style={{ fontSize: 11, color: '#6b7280' }}>{linked?.matchMethod || '—'}</td>
                          <td>{fmt(r.inspection_date)}</td>
                          <td>{r.proponent_name || <em style={{ color: '#9ca3af' }}>—</em>}</td>
                          <td>{r.company_name || <em style={{ color: '#9ca3af' }}>—</em>}</td>
                          <td>{r.permit_recommended || <em style={{ color: '#9ca3af' }}>—</em>}</td>
                          <td>
                            {errors.length === 0
                              ? <span style={{ color: '#16a34a', fontSize: 12 }}>✓ Ready</span>
                              : <span style={{ color: '#dc2626', fontSize: 12 }} title={errors.join('\n')}>✗ {errors[0]}</span>
                            }
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              ) : importType === 'field_reports' ? (
                <table className="import-table">
                  <thead>
                    <tr>
                      <th>#</th><th>Facility</th><th>Location</th><th>Sector</th>
                      <th>District</th><th>Reported</th><th>Invoice</th><th>Payment</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.slice(0, 5).map((r, i) => {
                      const errors = validateRecord(r)
                      const fmt = (ts) => ts ? new Date(ts.seconds * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
                      return (
                        <tr key={i} className={errors.length ? 'import-table__row--error' : ''}>
                          <td style={{ color: '#9ca3af' }}>{i + 1}</td>
                          <td><strong>{r.facility_name || <em style={{ color: '#dc2626' }}>missing</em>}</strong></td>
                          <td>{r.location || <em style={{ color: '#9ca3af' }}>—</em>}</td>
                          <td>{r.sector_prefix ? `${r.sector} (${r.sector_prefix})` : <span style={{ color: r.sector ? '#dc2626' : '#9ca3af' }}>{r.sector || '—'}</span>}</td>
                          <td>{r.district || <em style={{ color: '#9ca3af' }}>—</em>}</td>
                          <td>{fmt(r.date_reported)}</td>
                          <td>{r.amount_invoice != null ? `GHS ${r.amount_invoice.toLocaleString('en-GH', { minimumFractionDigits: 2 })}` : <em style={{ color: '#9ca3af' }}>—</em>}</td>
                          <td>{r.payment_status || <em style={{ color: '#9ca3af' }}>—</em>}</td>
                          <td>
                            {errors.length === 0
                              ? <span style={{ color: '#16a34a', fontSize: 12 }}>✓ Ready</span>
                              : <span style={{ color: '#dc2626', fontSize: 12 }} title={errors.join('\n')}>✗ {errors[0]}</span>
                            }
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              ) : (
                <table className="import-table">
                  <thead>
                    <tr>
                      <th>#</th><th>Name</th><th>Sector</th><th>Location</th>
                      <th>District</th><th>Phone</th><th>Coordinates</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.slice(0, 5).map((f, i) => {
                      const errors   = validateRecord(f)
                      const warnings = warnFacility(f)
                      const hasError = errors.length > 0
                      const hasWarn  = !hasError && warnings.length > 0
                      return (
                        <tr key={i} className={hasError ? 'import-table__row--error' : hasWarn ? 'import-table__row--warn' : ''}>
                          <td style={{ color: '#9ca3af' }}>{i + 1}</td>
                          <td><strong>{f.name || <em style={{ color: '#9ca3af' }}>—</em>}</strong></td>
                          <td>{f.sector_prefix ? `${f.sector} (${f.sector_prefix})` : <span style={{ color: '#dc2626' }}>{f.sector || '—'}</span>}</td>
                          <td>{f.location || <em style={{ color: '#9ca3af' }}>—</em>}</td>
                          <td>{f.district || <em style={{ color: '#9ca3af' }}>—</em>}</td>
                          <td>{f.phone || <em style={{ color: '#9ca3af' }}>—</em>}</td>
                          <td>{f.coordinates ? `${f.coordinates.lat}, ${f.coordinates.lng}` : <em style={{ color: '#9ca3af' }}>—</em>}</td>
                          <td>
                            {hasError
                              ? <span style={{ color: '#dc2626', fontSize: 12 }} title={errors.join('\n')}>✗ {errors[0]}</span>
                              : hasWarn
                                ? <span style={{ color: '#b45309', fontSize: 12 }} title={warnings.join('\n')}>⚠ {warnings[0]}</span>
                                : <span style={{ color: '#16a34a', fontSize: 12 }}>✓ Ready</span>
                            }
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
            {records.length > 5 && (
              <div style={{ padding: '10px 16px', fontSize: 12, color: '#9ca3af', borderTop: '1px solid #f3f4f6' }}>
                … and {records.length - 5} more rows
              </div>
            )}
          </div>

          {validRecords.length === 0 ? (
            <div className="login-error">
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              No valid rows to import. Fix the errors above and re-upload.
            </div>
          ) : (
            <div className="form-actions">
              <button className="btn btn--ghost" onClick={reset}>Cancel</button>
              <button className="btn btn--primary" onClick={handleImport} disabled={(importType === 'permits' || isFinanceImport || importType === 'screenings') && facilityLinkLoading}>
                {(importType === 'permits' || isFinanceImport) && facilityLinkLoading
                  ? 'Checking facility links…'
                  : `Import ${validRecords.length} ${validRecords.length === 1 ? importNoun : `${importNoun}s`}`}
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Stage: Importing ── */}
      {stage === STAGES.importing && (
        <div className="import-progress-wrap">
          <Loader size={32} style={{ animation: 'spin 1s linear infinite', color: '#059669' }} />
          <div className="import-progress-label">
            Importing {progress.done} of {progress.total}…
          </div>
          <div className="import-progress-bar-wrap">
            <div className="import-progress-bar"
              style={{ width: `${(progress.done / progress.total) * 100}%` }} />
          </div>
          {results.length > 0 && (
            <div className="import-live-results">
              {results.slice(-5).reverse().map((r, i) => (
                <div key={i} className={`import-live-row${r.success ? '' : ' import-live-row--err'}`}>
                  {r.success
                    ? <><CheckCircle size={13} /> <strong>{r.fileNumber}</strong> — {r.facilityName ? `${r.facilityName} · ` : ''}{r.name}</>
                    : <><XCircle size={13} /> {r.name}: {r.error}</>
                  }
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Stage: Done ── */}
      {stage === STAGES.done && (
        <>
          <div className="import-done-banner">
            <CheckCircle size={24} color="#16a34a" />
            <div>
              <div className="import-done-banner__title">Import complete</div>
              <div className="import-done-banner__sub">
                {successCount} imported successfully{failCount > 0 ? ` · ${failCount} failed` : ''}
              </div>
            </div>
          </div>

          <div className="record-list">
            {results.map((r, i) => (
              <div key={i} className={`record-item${r.success ? '' : ' record-item--error'}`}>
                <div className="record-item__header">
                  <span className="record-item__title">{r.name}</span>
                  {r.success
                    ? <span className="record-badge" style={{ background: '#dcfce7', color: '#166534' }}>
                        <CheckCircle size={11} style={{ marginRight: 4 }} />{r.fileNumber}
                      </span>
                    : <span className="record-badge" style={{ background: '#fee2e2', color: '#991b1b' }}>
                        <XCircle size={11} style={{ marginRight: 4 }} />Failed
                      </span>
                  }
                </div>
                {!r.success && <div className="record-item__note" style={{ color: '#dc2626' }}>{r.error}</div>}
              </div>
            ))}
          </div>

          <div className="form-actions" style={{ marginTop: 16 }}>
            <button className="btn btn--ghost" onClick={() => { reset(); }}>Import More</button>
            <button className="btn btn--primary"
              onClick={() => navigate(importType === 'permits' ? '/permits' : isFinanceImport ? '/finance' : importType === 'field_reports' ? '/field-reports' : importType === 'screenings' ? '/screening' : '/facilities')}>
              View {importType === 'permits' ? 'Permits' : isFinanceImport ? 'Finance' : importType === 'field_reports' ? 'Field Reports' : importType === 'screenings' ? 'Screenings' : 'Facilities'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
