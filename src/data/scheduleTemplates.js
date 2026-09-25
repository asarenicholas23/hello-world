// Default content for the "Schedule to the Environmental Permit" generator.
//
// These are starting points, not final legal text — every schedule is
// site-specific, so the generated draft is always hand-edited by an officer
// before it's printed/issued (see src/data/scheduleDraft.js and
// src/components/ScheduleModal.jsx).
//
// Shape mirrors MONITORING_CHECKLISTS / SITE_VERIFICATION_CHECKLISTS: a
// shared default plus small, sector-keyed additive overrides — not a full
// rewrite per sector, since fabricating sector-specific regulatory detail
// we can't verify is riskier than starting from a solid generic baseline.

// ── 5.1.1 Environmental Impact and Management (operational phase) ─────────
export const IMPACT_MANAGEMENT_DEFAULTS = [
  {
    impact: 'Waste (Solid and Liquid)',
    source: 'Domestic solid waste such as food remains, papers, packaging, etc.\nGrey water and black water from washrooms.\nRun-off from rain.',
    management: [
      'Provide dustbins with lids at vantage points.',
      'Ensure dustbins are lined and emptied regularly.',
      'Contract a licensed waste management company to collect and dispose of solid waste at an approved dump site.',
      'No waste should be burned on site.',
      'Channel liquid waste into a septic tank or suitable treatment system.',
      'Provide drains to channel ONLY storm water / run-off.',
    ],
    remarks: 'At all times',
  },
  {
    impact: 'Occupational Health & Safety (OH&S)',
    source: 'Physical safety hazards, including accidents that may occur during operation.',
    management: [
      'Provide a well-stocked first aid kit for minor injuries.',
      'Ensure staff/occupants are aware of basic emergency procedures.',
    ],
    remarks: 'At all times',
  },
  {
    impact: 'Traffic',
    source: 'Vehicles moving in and out of the facility.',
    management: [
      'Provide adequate on-site parking to reduce traffic congestion around the facility.',
    ],
    remarks: 'At all times',
  },
  {
    impact: 'Fire Outbreak',
    source: 'Faulty electrical gadgets, wiring, or machinery.',
    management: [
      'Provide fire extinguishers and ensure occupants know how to use them.',
      'Carry out regular maintenance of electrical installations.',
      'Install fire alarms / smoke detectors at vantage points.',
      'Comply with the Fire Precaution (Premises) Regulations, 2003 (LI 1724) and its amendments.',
    ],
    remarks: 'Quarterly',
  },
]

// ── 8.1 Environmental Monitoring (operational phase) ───────────────────────
export const MONITORING_TABLE_DEFAULTS = [
  {
    indicator: 'Waste (Solid Waste)',
    parameter: [
      'Quantities generated (kg)',
      'Quantities disposed of (kg)',
      'Quantities reused (kg)',
      'Quantities recycled (kg)',
    ],
    frequency: 'Annually',
    responsibility: 'Management',
  },
  {
    indicator: 'Occupational Health and Safety',
    parameter: ['Nature and number of incidents/accidents'],
    frequency: 'Annually',
    responsibility: 'Management',
  },
  {
    indicator: 'Fire Outbreak',
    parameter: [
      'Assembly point / emergency exits in place',
      'Cautionary notices posted',
      'Number of fire outbreaks',
    ],
    frequency: 'Quarterly',
    responsibility: 'Management',
  },
]

// ── Small, additive sector overrides ────────────────────────────────────
export const EXTRA_IMPACT_ROWS = {
  PP: [
    {
      impact: 'Agrochemical Storage & Handling',
      source: 'Storage, handling and sale of agrochemicals / pesticides.',
      management: [
        'Store agrochemicals in a well-ventilated, secured store away from foodstuffs and water sources.',
        'Ensure all containers are properly labelled, with Safety Data Sheets available.',
        'Dispose of empty containers per manufacturer/EPA guidance — never reuse for other purposes.',
        'Ensure staff handling agrochemicals use appropriate PPE.',
      ],
      remarks: 'At all times',
    },
  ],
  CE: [
    {
      impact: 'Fuel / Oil Spill',
      source: 'Fuel dispensing, storage tanks and vehicle refuelling.',
      management: [
        'Maintain a spill response kit on site at all times.',
        'Inspect storage tanks and dispensing equipment regularly for leaks.',
        'Ensure forecourt drainage prevents fuel/oil from reaching open drains or water bodies.',
      ],
      remarks: 'At all times',
    },
  ],
  CM: [
    {
      impact: 'Dust & Tailings Management',
      source: 'Excavation, haulage and processing activities; tailings storage.',
      management: [
        'Apply dust suppression measures along haul roads and active work areas.',
        'Manage the tailings storage facility per its design specifications.',
        'Monitor and treat mine water before discharge.',
      ],
      remarks: 'At all times',
    },
  ],
}

export const EXTRA_DIRECTIVES = {
  PP: [
    'Agrochemicals must not be sold to unlicensed persons; only approved/registered products may be stocked.',
  ],
  CE: [
    'Petroleum products must not be dispensed into unapproved containers.',
  ],
  CH: [
    'Medical/clinical waste must be segregated, stored and disposed of in line with the applicable health-care waste management guidelines.',
  ],
}

// ── Standard clauses (sections 6.0 and 9.0–14.0) ───────────────────────────
// Placeholders substituted by buildScheduleDraft: {{ENTITY}}, {{DISTRICT}}, {{REGION}}
export const LEGAL_REQUIREMENTS = [
  'Environmental Protection Authority Act, 2025 (Act 1124).',
  'Environmental Protection (Environmental Assessment) Regulations, 2025 (LI 2504).',
  'Environmental Protection (Refrigeration and Air Conditioning Certification) Regulations, 2025 (LI 2503).',
  'Hazardous and Other Waste (Classification) Control and Management Regulations, 2016 (LI 2250).',
  'Fees and Charges (Miscellaneous Provisions) Act, 2022 (Act 1080).',
  'Environmental Protection (Management of Ozone Depleting Substances, Halocarbons, Halocarbon Alternatives and their Products) Regulations, 2025 (LI 2505).',
  'Environmental Protection (Effluent) Regulations, 2025 (LI 2506).',
  'Environmental Protection (Air Quality Management) Regulations, 2025 (LI 2507).',
]

export const ACTS_OF_PARLIAMENT = [
  'Labour Act, 2003 (Act 651).',
  'Land Use and Spatial Planning Act, 2016 (Act 925).',
  'Factories, Offices and Shops Act, 1970 (Act 328).',
  'Persons with Disability Act, 2006 (Act 715).',
  'Public Health Act, 2012 (Act 851).',
  'Local Government Act, 2016 (Act 936).',
]

export const REGULATIONS_LIST = [
  'Fire Precaution (Premises) Regulations, 2003 (LI 1724).',
  'Fire Precaution (Premises) (Amendment) Regulations, 2016 (LI 2249).',
  'Land Use and Spatial Planning Regulations, 2019 (LI 2384).',
  'National Building Regulations, 1996 (LI 1630).',
]

export const STANDARDS_LIST = [
  'Ghana Standard for Environment and Health Protection — Requirements for Ambient Air Quality and Point Source Control/Stack Emission (GS 1236: 2019).',
  'Ghana Standard for Health Protection — Requirements for Ambient Noise Control (GS 1222: 2018).',
  'Ghana Standard for Environmental Protection — Requirements for Effluent Discharges (GS 1212: 2019).',
]

export const STANDARD_CLAUSES = {
  environmentalReporting:
    'Submit an Annual Environmental Report on the operations of the undertaking in accordance with Regulation 38 of LI 2504. ' +
    'The report shall include the monitoring results referenced in Section 8.1.',
  rightOfEntry:
    'The company shall allow authorised representatives of the EPA to enter the facility at all times to access and verify records kept under ' +
    'this permit, inspect facilities/equipment/practices/operations regulated under this permit, and monitor substances and/or parameters for ' +
    'the purposes of ensuring compliance with this permit, the EPA Act, 2025 (Act 1124) and the Environmental Assessment Regulations, 2025 (LI 2504).',
  notificationChanges:
    'Notify the EPA in writing prior to any change in the planned undertaking/activity that departs from the information provided in Form EA1. ' +
    'Notify the Authority in writing of any change in the entity’s legal arrangements (acquisition, merger, takeover or transfer) as required ' +
    'under Regulation 51 of LI 2504. The Authority may require changes to the project, notified in writing, where continued operations pose a ' +
    'danger to public safety or the environment.',
  renewal:
    'The entity shall apply for renewal of the Environmental Permit not later than three (3) months before the expiry date, in accordance with ' +
    'Regulation 31 of LI 2504, and shall submit the reports required for renewal upon request. The permit may only be renewed upon satisfactory ' +
    'compliance with the relevant conditions. The Authority may also commence the renewal process by conducting an environmental inspection, ' +
    'audit or monitoring visit.',
  permitDisplay: 'A copy of this permit shall be displayed prominently on the premises at all times.',
  permitAwareness:
    'All tenants/occupants of {{ENTITY}} shall be sensitised on the conditions of this permit by management, with evidence of sensitisation ' +
    'provided in the sector-specific Environmental Management Form.',
  permitLimitation:
    'This permit is NOT transferable, does not apply to activities outside the scope of this undertaking, and cannot be used to operate at ' +
    'other facilities or other locations.',
  complaintManagement:
    'Establish a procedure and management system to receive and resolve public complaints related to the operation of the facility, and report ' +
    'on the performance of that system in the Annual Environmental Report.',
  communityRelations:
    'Implement measures to improve company-community relations, institute programmes to create environmental awareness, and organise fora for ' +
    'consultation and interaction on potential impacts and mitigation measures — reporting the outcome in the Annual Environmental Report.',
  revocation:
    'The Authority may revoke, suspend or cancel this permit where the entity fails to obtain any other required authorisation, breaches any ' +
    'provision of the Regulations or other relevant enactment, fails to make required payments, breaches any permit condition, or fails to ' +
    'comply with mitigation commitments in its assessment report or environmental management plan.',
  penalty:
    'Provision of false information or failure to comply with the conditions of this permit shall attract administrative penalties/fines under ' +
    'the Fees and Charges (Miscellaneous Provisions) Act, 2022 (Act 1080), sanctions under Regulations 52(c) and 53 of LI 2504, and may render ' +
    'this Environmental Permit invalid.',
  interpretations:
    '“Authority” means the Environmental Protection Authority established by the Environmental Protection Authority Act, 2025 (Act 1124). ' +
    '“Entity” means {{ENTITY}}. “Application” means the application for this permit, together with any response to a notice served ' +
    'and any other information formally accepted by the Authority as part of the application.',
  notificationList: [
    'The Hon. Minister, Ministry of Environment, Science, and Technology, Accra',
    'The Chief Executive Officer, Environmental Protection Authority, Accra',
    'The Area Head, Environmental Protection Authority, Konongo Area Office, Konongo',
  ],
}
