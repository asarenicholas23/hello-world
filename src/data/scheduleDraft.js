// Build an editable "Schedule to the Environmental Permit" draft from a
// permit record, the facility profile, and the facility's latest screening
// record — the same "auto-fill from what we already captured, then
// hand-edit" approach used for monitoring reports (see
// monitoringReportDraft.js). Schedules are site-specific, so this is a
// starting point the officer reviews and edits in ScheduleModal before
// printing, not a final document.
//
// Site-verification checklists aren't used as a source here: their field
// keys vary per sector/sub-type (e.g. CE vs CE_FUEL_STATION vs PP), so
// there's no single reliable shape to pull from generically the way
// screenings (a fixed field set for every sector) can be.

import { fmtDate } from '../utils/records'
import { DISTRICTS, REGION } from './constants'
import {
  IMPACT_MANAGEMENT_DEFAULTS, MONITORING_TABLE_DEFAULTS,
  EXTRA_IMPACT_ROWS, EXTRA_DIRECTIVES,
  LEGAL_REQUIREMENTS, ACTS_OF_PARLIAMENT, REGULATIONS_LIST, STANDARDS_LIST,
  STANDARD_CLAUSES,
} from './scheduleTemplates'

function districtName(code) {
  return DISTRICTS.find((d) => d.code === code)?.name ?? code ?? ''
}

function sub(text, vars) {
  return String(text || '').replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '')
}

function addMonths(date, n) {
  const d = new Date(date)
  d.setMonth(d.getMonth() + n)
  return d
}

function monthsBetween(from, to) {
  if (!from || !to) return null
  const months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
  return months > 0 ? months : null
}

function toDate(ts) {
  if (!ts) return null
  return ts.toDate ? ts.toDate() : new Date(ts)
}

function cloneRows(rows) {
  return rows.map((r) => ({ ...r, management: [...(r.management ?? [])] }))
}

function cloneMonitoringRows(rows) {
  return rows.map((r) => ({ ...r, parameter: [...(r.parameter ?? [])] }))
}

export function buildScheduleDraft(permit = {}, facility = null, screening = null) {
  const entityName = facility?.name || permit.facility_name || facility?.file_number || 'the entity'
  const district = districtName(facility?.district)
  const region = facility?.region || REGION
  const vars = { ENTITY: entityName.toUpperCase(), DISTRICT: district, REGION: region }

  // ── 1.0 Entity Profile ────────────────────────────────────
  const entityProfile = {
    name: entityName,
    address: facility?.address || facility?.location || '',
    email: facility?.email || '',
    contactNo: facility?.phone || '',
    tin: facility?.entity_tin || '',
    contactPerson: facility?.contact_person || entityName,
    designation: facility?.designation || '',
    typeOfUndertaking: screening?.type_of_undertaking || facility?.type_of_undertaking || '',
  }

  // ── 2.0 Permit Identification Details ─────────────────────
  const permitDetails = {
    fileNo: facility?.file_number || '',
    permitNo: permit.permit_number || '',
    dateOfIssue: fmtDate(permit.issue_date),
    dateOfExpiry: fmtDate(permit.expiry_date),
    effectiveDate: fmtDate(permit.effective_date),
    placeOfIssue: permit.issue_location || 'Ashanti Regional Office',
  }

  // ── 3.0 Legal Basis (composed) ─────────────────────────────
  const undertakingLine = entityProfile.typeOfUndertaking
    ? `the operation of ${entityProfile.typeOfUndertaking}`
    : 'the operation of the undertaking'
  const whereClause = district ? ` in the ${district} of the ${region} Region` : ` in the ${region} Region`
  const legalBasis =
    `In pursuance of the Environmental Protection Authority Act, 2025, Act 1124 {Sections 3(2)(c)(i) and 29} and the Environmental Assessment ` +
    `Regulations, 2025 (LI 2504), and on the basis of the information provided in the Environmental Assessment Form (EA1) as well as field ` +
    `assessment conducted by the Authority, this Environmental Permit is issued authorising ${entityName} to continue ${undertakingLine}` +
    `${whereClause}.`

  // ── 4.0 Project Description / 4.1 Activity ─────────────────
  const projectDescription =
    `Comply with all project specifications, mitigation measures and other environmental management commitments in Form EA1. ` +
    `The project involves ${undertakingLine}${whereClause}.`
  const activity = entityProfile.typeOfUndertaking
    ? `Operation of ${entityProfile.typeOfUndertaking}`
    : ''

  // ── 4.2 Facilities (bullet list, seeded from screening) ─────
  const facilitiesList = [screening?.components, screening?.capacity, screening?.land_take]
    .filter(Boolean)
    .flatMap((s) => String(s).split(/\n+/))
    .map((s) => s.trim())
    .filter(Boolean)

  // ── 4.3 Location ─────────────────────────────────────────
  const coords = screening?.latitude && screening?.longitude
    ? `${screening.latitude}, ${screening.longitude}`
    : (facility?.coordinates ? `${facility.coordinates.lat}, ${facility.coordinates.lng}` : '')
  const location = {
    line: screening?.plot_no || screening?.street_area || entityProfile.address,
    town: screening?.town || '',
    landmark: screening?.major_landmark || '',
    district,
    region,
    coordinates: coords,
  }

  // ── 5.1.1 / 8.1 Sector-aware tables ─────────────────────────
  const sectorPrefix = facility?.sector_prefix || ''
  const impactRows = [...cloneRows(IMPACT_MANAGEMENT_DEFAULTS), ...cloneRows(EXTRA_IMPACT_ROWS[sectorPrefix] ?? [])]
  const monitoringRows = cloneMonitoringRows(MONITORING_TABLE_DEFAULTS)

  // Fold in whatever waste detail the screening captured, so the Waste row's
  // source text reflects what was actually observed rather than the generic default.
  const wasteDetail = [screening?.liquid_waste, screening?.solid_waste, screening?.gaseous_waste]
    .filter(Boolean).join(' / ')
  if (wasteDetail) {
    const wasteRow = impactRows.find((r) => r.impact === 'Waste (Solid and Liquid)')
    if (wasteRow) wasteRow.source = `${wasteRow.source}\nObserved at screening: ${wasteDetail}.`
  }

  // ── Additional Directives ───────────────────────────────────
  const additionalDirectives = [...(EXTRA_DIRECTIVES[sectorPrefix] ?? [])]

  // ── 12.0 Validity Period + related computed dates ───────────
  const effective = toDate(permit.effective_date)
  const expiry = toDate(permit.expiry_date)
  const validityMonths = monthsBetween(effective, expiry)
  const validityPeriodText = effective && expiry
    ? `The Permit shall be valid for a period of ${validityMonths ? `${validityMonths} months` : 'the period stated above'} effective from ` +
      `${fmtDate(permit.effective_date)} and shall expire on ${fmtDate(permit.expiry_date)}.`
    : 'The validity period will be calculated once the effective and expiry dates are set on the permit.'
  const renewalDueDate = expiry ? fmtDate({ toDate: () => addMonths(expiry, -3) }) : ''
  const nextAerDueDate = effective ? fmtDate({ toDate: () => addMonths(effective, 12) }) : ''

  return {
    entityProfile,
    permitDetails,
    legalBasis,
    projectDescription,
    activity,
    facilitiesList,
    location,
    impactRows,
    monitoringRows,
    additionalDirectives,

    validityPeriodText,
    renewalDueDate,
    nextAerDueDate,

    legalRequirements: [...LEGAL_REQUIREMENTS],
    actsOfParliament: [...ACTS_OF_PARLIAMENT],
    regulationsList: [...REGULATIONS_LIST],
    standardsList: [...STANDARDS_LIST],

    environmentalReporting: sub(STANDARD_CLAUSES.environmentalReporting, vars) +
      (nextAerDueDate ? ` The next report should be submitted before ${nextAerDueDate} and every twelve (12) months thereafter.` : ''),
    rightOfEntry: sub(STANDARD_CLAUSES.rightOfEntry, vars),
    notificationChanges: sub(STANDARD_CLAUSES.notificationChanges, vars),
    renewal: sub(STANDARD_CLAUSES.renewal, vars) +
      (renewalDueDate ? ` For this permit, the renewal application is due by ${renewalDueDate}.` : ''),
    permitDisplay: sub(STANDARD_CLAUSES.permitDisplay, vars),
    permitAwareness: sub(STANDARD_CLAUSES.permitAwareness, vars),
    permitLimitation: sub(STANDARD_CLAUSES.permitLimitation, vars),
    complaintManagement: sub(STANDARD_CLAUSES.complaintManagement, vars),
    communityRelations: sub(STANDARD_CLAUSES.communityRelations, vars),
    revocation: sub(STANDARD_CLAUSES.revocation, vars),
    penalty: sub(STANDARD_CLAUSES.penalty, vars),
    interpretations: sub(STANDARD_CLAUSES.interpretations, vars),
    notificationList: [...STANDARD_CLAUSES.notificationList],

    title: `SCHEDULE TO THE ENVIRONMENTAL PERMIT — ${entityName.toUpperCase()}`,
  }
}
