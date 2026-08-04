import { inputToTs, tsToInput } from '../utils/records'

// Section/label metadata for the Screening form fields — used by the task
// review UI to render a commentable list that mirrors ScreeningFields.jsx's
// layout without duplicating input widgets (review is read-only + comment).
export const SCREENING_FIELD_SECTIONS = [
  {
    title: 'Inspection Details',
    fields: [
      { key: 'ea1_receipt_date', label: 'Date of Receipt of Form EA1' },
      { key: 'inspection_date',  label: 'Inspection Date' },
    ],
  },
  {
    title: 'Proponent Information',
    fields: [
      { key: 'proponent_name',      label: 'Name of Proponent' },
      { key: 'company_name',        label: "Company's Name" },
      { key: 'type_of_undertaking', label: 'Type of Undertaking' },
      { key: 'components',          label: 'Components' },
      { key: 'capacity',            label: 'Capacity' },
      { key: 'land_take',           label: 'Land Take' },
    ],
  },
  {
    title: 'Waste Profile',
    fields: [
      { key: 'liquid_waste',          label: 'Liquid Waste' },
      { key: 'solid_waste',           label: 'Solid Waste' },
      { key: 'gaseous_waste',         label: 'Gaseous Waste' },
      { key: 'description_comments',  label: 'Comments on Description of Undertaking' },
    ],
  },
  {
    title: 'Site Location',
    fields: [
      { key: 'plot_no',           label: 'Plot No.' },
      { key: 'street_area',       label: 'Street / Area Name' },
      { key: 'town',              label: 'Town' },
      { key: 'district',          label: 'District' },
      { key: 'major_landmark',    label: 'Major Landmark' },
      { key: 'current_zoning',    label: 'Current Zoning' },
      { key: 'adjacent_land_use', label: 'Adjacent Land Use' },
      { key: 'north',             label: 'North' },
      { key: 'south',             label: 'South' },
      { key: 'east',              label: 'East' },
      { key: 'west',              label: 'West' },
      { key: 'latitude',          label: 'Latitude' },
      { key: 'longitude',         label: 'Longitude' },
    ],
  },
  {
    title: 'Site Assessment',
    fields: [
      { key: 'existing_infrastructure',  label: 'Existing Infrastructure and Facility on Site' },
      { key: 'site_information_comments', label: 'Comment on Site Information' },
      { key: 'construction_impacts',    label: 'Construction Phase Impacts' },
      { key: 'operational_impacts',     label: 'Operational Phase Impacts' },
      { key: 'impacts_in_ea1',          label: 'Impacts Addressed in EA1?' },
      { key: 'mitigation_measures',     label: 'Mitigation Measures' },
    ],
  },
  {
    title: 'Neighbour Information',
    fields: [
      { key: 'neighbour_name',     label: 'Name of Neighbour' },
      { key: 'neighbour_contact',  label: 'Contact of Neighbour' },
      { key: 'neighbour_location', label: 'Location in Relation to the Undertaking' },
      { key: 'neighbour_comments', label: 'Their Comments' },
    ],
  },
  {
    title: 'Observations & Comments',
    fields: [
      { key: 'observations', label: 'Observations' },
      { key: 'comments',     label: 'Comments' },
    ],
  },
  {
    title: 'Screening Decision',
    fields: [
      { key: 'permit_recommended',       label: 'Permit Recommended?' },
      { key: 'additional_info_required', label: 'Additional Info Required?' },
      { key: 'per_recommended',          label: 'PER Recommended?' },
      { key: 'eia_recommended',          label: 'EIA Recommended?' },
      { key: 'permit_declined',          label: 'Permit Declined?' },
      { key: 'permit_declined_reason',   label: 'Reason for Permit Declined' },
    ],
  },
]

// Blank form state — single source of truth for the field key list, shared
// by ScreeningForm.jsx (facility-scoped) and TaskFillPage.jsx (task-scoped).
export const EMPTY_SCREENING_FORM = Object.fromEntries(
  SCREENING_FIELD_SECTIONS.flatMap((s) => s.fields).map((f) => [f.key, ''])
)

// Fields that get .trim()'d on submit — matches ScreeningForm.jsx's original
// payload-building behavior (select/numeric fields are passed through as-is).
const TRIMMED_KEYS = [
  'proponent_name', 'company_name', 'type_of_undertaking', 'components', 'capacity', 'land_take',
  'liquid_waste', 'solid_waste', 'gaseous_waste', 'description_comments',
  'plot_no', 'street_area', 'town', 'major_landmark', 'current_zoning', 'adjacent_land_use',
  'north', 'south', 'east', 'west',
  'existing_infrastructure', 'site_information_comments', 'construction_impacts', 'operational_impacts', 'mitigation_measures',
  'neighbour_name', 'neighbour_contact', 'neighbour_location', 'neighbour_comments',
  'observations', 'comments', 'permit_declined_reason',
]

/**
 * Shapes raw Screening form state into the payload shape stored in
 * facilities/{file_number}/screenings — shared by ScreeningForm.jsx (direct
 * save) and the task fill/approve flow (src/pages/TaskFillPage.jsx,
 * src/firebase/tasks.js) so both paths produce identical records.
 */
export function buildScreeningPayload(form, coordinates) {
  const payload = { ...form }
  for (const key of TRIMMED_KEYS) payload[key] = (form[key] ?? '').trim()
  payload.date = inputToTs(form.inspection_date)
  payload.inspection_date = inputToTs(form.inspection_date)
  payload.ea1_receipt_date = inputToTs(form.ea1_receipt_date)
  payload.coordinates = coordinates ?? null
  return payload
}

const DATE_KEYS = ['inspection_date', 'ea1_receipt_date']

/**
 * Converts an already-captured screening record (e.g. the `screening` object
 * embedded on a field_reports doc, or a facilities/{fn}/screenings doc) back
 * into the flat form-state shape ScreeningFields/TaskFillPage expect, so
 * previously-captured details can pre-fill a new screening task instead of
 * the officer re-typing everything. Date fields come back as Timestamps, so
 * they're converted back to 'YYYY-MM-DD' strings for the date inputs.
 */
export function screeningRecordToForm(record) {
  if (!record) return null
  const form = { ...EMPTY_SCREENING_FORM }
  for (const key of Object.keys(EMPTY_SCREENING_FORM)) {
    const val = record[key]
    if (val === undefined || val === null || val === '') continue
    form[key] = DATE_KEYS.includes(key) ? tsToInput(val) : val
  }
  return form
}
