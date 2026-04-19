export const SECTORS = [
  { prefix: 'CU', name: 'Manufacturing' },
  { prefix: 'CI', name: 'Infrastructure' },
  { prefix: 'CH', name: 'Health' },
  { prefix: 'CT', name: 'Hospitality' },
  { prefix: 'CE', name: 'Energy' },
  { prefix: 'PP', name: 'Agrochemical & Pesticide' },
  { prefix: 'CA', name: 'Agriculture' },
  { prefix: 'CM', name: 'Mining' },
]

export const DISTRICTS = [
  { code: 'AAC', name: 'Asante Akim Central' },
  { code: 'AAS', name: 'Asante Akim South' },
  { code: 'AAN', name: 'Asante Akim North' },
  { code: 'SKW', name: 'Sekyere Kumawu' },
  { code: 'SAP', name: 'Sekyere Afram Plains' },
  { code: 'BF', name: 'Bosome Freho' },
]

export const REGION = 'Ashanti'

export const PAYMENT_TYPES = [
  'Processing Fee',
  'Permit Fee',
  'Annual Fee',
  'Penalty',
  'Other',
]

export const ENFORCEMENT_ACTIONS = [
  { value: 'warning',  label: 'Warning' },
  { value: 'notice',   label: 'Notice to Comply' },
  { value: 'fine',     label: 'Fine' },
  { value: 'closure',  label: 'Closure Order' },
  { value: 'other',    label: 'Other' },
]

export const COMPLIANCE_STATUS = [
  { value: 'compliant',     label: 'Compliant' },
  { value: 'partial',       label: 'Partially Compliant' },
  { value: 'non_compliant', label: 'Non-Compliant' },
]

export const MONITORING_CHECKLIST = {
  CU: [
    { key: 'effluent_treatment', label: 'Effluent Treatment System Operational' },
    { key: 'waste_management',   label: 'Solid Waste Managed Appropriately' },
    { key: 'air_emissions',      label: 'Air Emissions Within Limits' },
    { key: 'noise_control',      label: 'Noise Control Measures in Place' },
    { key: 'chemical_storage',   label: 'Chemicals Stored Safely' },
    { key: 'spill_prevention',   label: 'Spill Prevention Measures Present' },
  ],
  CI: [
    { key: 'dust_control',    label: 'Dust Suppression Measures Active' },
    { key: 'noise_control',   label: 'Noise Barriers / Control Measures' },
    { key: 'waste_disposal',  label: 'Construction Waste Disposed Properly' },
    { key: 'water_quality',   label: 'No Water Body Contamination' },
    { key: 'erosion_control', label: 'Erosion and Sediment Controls' },
  ],
  CH: [
    { key: 'medical_waste',      label: 'Medical Waste Segregated and Disposed' },
    { key: 'sharps_disposal',    label: 'Sharps Disposal Containers in Use' },
    { key: 'chemical_handling',  label: 'Chemicals Labelled and Secured' },
    { key: 'effluent_treatment', label: 'Effluent Treatment Functioning' },
    { key: 'sanitation',         label: 'Adequate Sanitation Facilities' },
  ],
  CT: [
    { key: 'waste_management', label: 'Food / Solid Waste Managed' },
    { key: 'water_treatment',  label: 'Water Treatment / Pool Chemicals Safe' },
    { key: 'grease_trap',      label: 'Grease Trap Installed and Maintained' },
    { key: 'noise_control',    label: 'Noise Within Permitted Hours' },
    { key: 'sanitation',       label: 'Sanitation Facilities Adequate' },
  ],
  CE: [
    { key: 'emissions',        label: 'Emissions Within Permitted Limits' },
    { key: 'spill_control',    label: 'Oil / Fuel Spill Control in Place' },
    { key: 'waste_disposal',   label: 'Hazardous Waste Disposed Correctly' },
    { key: 'safety_systems',   label: 'Safety and Shutdown Systems Functional' },
    { key: 'transformer_oil',  label: 'Transformer Oil Leak Prevention' },
  ],
  PP: [
    { key: 'chemical_storage', label: 'Chemicals Stored in Approved Facilities' },
    { key: 'labelling',        label: 'All Containers Labelled Correctly' },
    { key: 'disposal',         label: 'Empty Container Disposal Procedure Followed' },
    { key: 'ppe',              label: 'Workers Using Appropriate PPE' },
    { key: 'spill_kit',        label: 'Spill Response Kit Available' },
  ],
  CA: [
    { key: 'pesticide_use',    label: 'Approved Pesticides Only' },
    { key: 'buffer_zones',     label: 'Buffer Zones Maintained' },
    { key: 'water_management', label: 'Irrigation / Water Management Adequate' },
    { key: 'soil_erosion',     label: 'Soil Erosion Prevention Measures' },
    { key: 'waste_disposal',   label: 'Farm Waste Properly Disposed' },
  ],
  CM: [
    { key: 'tailings',            label: 'Tailings Facility Properly Managed' },
    { key: 'dust_suppression',    label: 'Dust Suppression Active' },
    { key: 'effluent_treatment',  label: 'Mine Water Treatment Operational' },
    { key: 'reclamation',         label: 'Reclamation Plan Being Implemented' },
    { key: 'cyanide_management',  label: 'Cyanide / Chemicals Managed Safely' },
    { key: 'noise_control',       label: 'Blasting Noise Within Limits' },
  ],
}

// Color per sector prefix — used in cards and badges
export const SECTOR_COLORS = {
  CU: { bg: '#eff6ff', text: '#1d4ed8' },
  CI: { bg: '#f5f3ff', text: '#7c3aed' },
  CH: { bg: '#fdf4ff', text: '#a21caf' },
  CT: { bg: '#fff7ed', text: '#c2410c' },
  CE: { bg: '#fefce8', text: '#a16207' },
  PP: { bg: '#f0fdf4', text: '#15803d' },
  CA: { bg: '#ecfdf5', text: '#065f46' },
  CM: { bg: '#fdf2f8', text: '#be185d' },
}
