// Sector-specific site verification checklists
// item type defaults to 'yesno_na' (Yes / No / N/A)
// other types: 'text', 'select', 'district'
// conditional: { key, value } — only show item when another field equals that value

export const SV_CHECKLIST_OPTIONS = ['', 'Yes', 'No', 'N/A']

export const SITE_VERIFICATION_CHECKLISTS = {

  // ── Energy / Car Washing Bay (CE) ────────────────────────────
  CE: {
    label: 'Car Washing Bay',
    extraFields: [
      { key: 'num_ramps',           label: 'Number of Ramps',                               type: 'text' },
      { key: 'detergent_used',      label: 'Detergent Used',                                type: 'text' },
      { key: 'nearness_water_body', label: 'Nearness to a Water Body',                      type: 'text' },
    ],
    sections: [
      {
        title: 'Permits & Licenses',
        items: [
          { key: 'env_permit',        label: 'Environmental Permit available' },
          { key: 'env_certificate',   label: 'Environmental Certificate available' },
          { key: 'dev_permit',        label: 'Development/Building Permit available' },
          { key: 'assembly_license',  label: 'District/Metro Assembly Operational License available' },
          { key: 'work_force',        label: 'Work Force', type: 'text' },
        ],
      },
      {
        title: 'Water Storage & Wastewater',
        items: [
          { key: 'storage_tank',          label: 'Storage tank for wastewater available' },
          { key: 'storage_tank_capacity', label: 'Storage tank capacity', type: 'text', conditional: { key: 'storage_tank', value: 'Yes' } },
          { key: 'wastewater_quantity',   label: 'Approximate quantity of wastewater discharged', type: 'text' },
          { key: 'drainage_system',       label: 'Drainage system available' },
          { key: 'drainage_description',  label: 'How wastewater is discharged', type: 'text' },
        ],
      },
      {
        title: 'Waste Management',
        items: [
          { key: 'sanitary_waste', label: 'Sanitary waste management', type: 'text' },
          { key: 'solid_waste',    label: 'Solid waste management',    type: 'text' },
        ],
      },
    ],
  },

  // ── Energy / Fuel/Filling Station (CE_FUEL_STATION) ─────────────
  CE_FUEL_STATION: {
    label: 'Fuel/Filling Station',
    extraFields: [
      { key: 'num_pumps',         label: 'Number of Dispenser Pumps',               type: 'text' },
      { key: 'fuel_types',        label: 'Fuel Types Dispensed',                    type: 'text' },
      { key: 'num_tanks',         label: 'Number of Storage Tanks',                 type: 'text' },
      { key: 'total_storage_cap', label: 'Total Storage Capacity (litres)',         type: 'text' },
      { key: 'tank_type',         label: 'Tank Type (underground / above ground)',  type: 'text' },
    ],
    sections: [
      {
        title: 'Permits & Licenses',
        items: [
          { key: 'env_permit',            label: 'Environmental Permit (EPA)' },
          { key: 'env_certificate',       label: 'Environmental Certificate (EPA)' },
          { key: 'energy_commission_lic', label: 'Energy Commission License' },
          { key: 'fire_permit',           label: 'Fire Permit (Ghana National Fire Service)' },
          { key: 'fire_certificate',      label: 'Fire Certificate (Ghana National Fire Service)' },
          { key: 'dev_permit',            label: 'Development/Building Permit (MMDA)' },
          { key: 'assembly_license',      label: 'District/Metro Assembly Operational License' },
          { key: 'work_force',            label: 'Workforce', type: 'text' },
        ],
      },
      {
        title: 'Storage Tanks & Equipment',
        items: [
          { key: 'leak_detection',      label: 'Leak detection system available' },
          { key: 'overfill_protection', label: 'Overfill protection devices in place' },
          { key: 'double_wall_tanks',   label: 'Double-walled / secondary containment tanks' },
          { key: 'vent_pipes',          label: 'Vent pipes installed on tanks' },
          { key: 'tank_inspection_log', label: 'Tank inspection log maintained' },
          { key: 'tank_condition',      label: 'Tank condition', type: 'select', options: ['', 'Excellent', 'Good', 'Fair', 'Poor'] },
        ],
      },
      {
        title: 'Spill Prevention & Containment',
        items: [
          { key: 'spill_containment',   label: 'Spill containment / forecourt bunding in place' },
          { key: 'interceptor',         label: 'Oil/water interceptor separator installed' },
          { key: 'forecourt_drainage',  label: 'Forecourt drainage connected to interceptor' },
          { key: 'drainage_system',     label: 'Overall drainage system adequate' },
          { key: 'spill_kit',           label: 'Spill response kit available' },
          { key: 'spill_response_plan', label: 'Spill response / emergency plan in place' },
          { key: 'wastewater_quantity', label: 'Approx. wastewater discharged per day', type: 'text' },
        ],
      },
      {
        title: 'Fire Safety',
        items: [
          { key: 'fire_extinguishers',  label: 'Fire extinguishers available and serviceable' },
          { key: 'sand_buckets',        label: 'Sand buckets available' },
          { key: 'no_smoking_signs',    label: 'No smoking / No naked flame signs displayed' },
          { key: 'fire_alarms',         label: 'Fire alarms installed' },
          { key: 'emergency_exits',     label: 'Emergency exits available and clearly marked' },
          { key: 'fire_assembly_point', label: 'Fire assembly point designated' },
          { key: 'staff_fire_trained',  label: 'Staff trained in fire fighting' },
        ],
      },
      {
        title: 'Waste Management',
        items: [
          { key: 'used_oil_management', label: 'Used oil collected and managed properly',        type: 'text' },
          { key: 'oily_rag_disposal',   label: 'Oily rags / contaminated waste disposal method', type: 'text' },
          { key: 'solid_waste',         label: 'Solid waste management',                         type: 'text' },
          { key: 'sanitary_waste',      label: 'Sanitary waste management',                      type: 'text' },
        ],
      },
    ],
  },

  // ── Health / Healthcare Facility (CH) ─────────────────────────
  CH: {
    label: 'Healthcare Facility',
    extraFields: [
      { key: 'parental_healthcare',  label: 'Parental Healthcare',               type: 'text' },
      { key: 'env_officer_name',     label: 'Name of Environmental Officer',     type: 'text' },
      { key: 'env_officer_contact',  label: 'Environmental Officer Contact No.', type: 'text' },
      { key: 'relevant_permits',     label: 'List of Relevant Permits',          type: 'text' },
    ],
    sections: [
      {
        title: 'Facility Profile',
        items: [
          { key: 'facility_type',      label: 'Type of Healthcare Facility', type: 'select', options: ['', 'Hospital', 'Veterinary', 'Clinic', 'Polyclinic', 'Midwifery', 'Medical Laboratory', 'Traditional Healthcare', 'Health-Post', 'Funeral Homes/Mortuary', 'Others'] },
          { key: 'hospital_type',      label: 'If Hospital — Type',          type: 'select', options: ['', 'Teaching Hospital', 'Regional', 'Polyclinic', 'District'], conditional: { key: 'facility_type', value: 'Hospital' } },
          { key: 'hospital_ownership', label: 'If Hospital — Ownership',     type: 'select', options: ['', 'Private', 'Public'],                                       conditional: { key: 'facility_type', value: 'Hospital' } },
          { key: 'num_beds',           label: 'Number of Beds',              type: 'text' },
          { key: 'staff_strength',     label: 'Total Staff Strength',        type: 'text' },
          { key: 'staff_doctors',      label: 'Doctors',                     type: 'text' },
          { key: 'staff_nurses',       label: 'Nurses',                      type: 'text' },
          { key: 'staff_paramedics',   label: 'Paramedics',                  type: 'text' },
          { key: 'staff_auxiliary',    label: 'Auxiliary Staff',             type: 'text' },
          { key: 'staff_lab_tech',     label: 'Lab Technicians',             type: 'text' },
          { key: 'daily_patients',     label: 'Average patients admitted daily', type: 'text' },
          { key: 'specialized_services', label: 'Specialised services provided', type: 'text' },
        ],
      },
      {
        title: 'Environmental Awareness',
        items: [
          { key: 'knows_env_laws',     label: 'Aware of country\'s environmental laws and regulations' },
          { key: 'knows_waste_policy', label: 'Aware of country\'s environmental policy on waste management' },
          { key: 'has_waste_guidelines', label: 'Has copy of Healthcare Waste Management Guidelines' },
          { key: 'liquid_waste_type',  label: 'Liquid waste generated (specify)', type: 'text' },
          { key: 'solid_waste_type',   label: 'Solid waste generated (specify)',  type: 'text' },
        ],
      },
      {
        title: 'Waste Categories (per day)',
        items: [
          { key: 'waste_general',        label: 'General/Normal Waste',                    type: 'select', options: ['', '1-5 tonnes', '5-10 tonnes', '10-20 tonnes'] },
          { key: 'waste_infectious',     label: 'Infectious Waste',                        type: 'select', options: ['', '1-5 tonnes', '5-10 tonnes', '10-20 tonnes'] },
          { key: 'waste_pharmaceutical', label: 'Pharmaceutical Waste',                    type: 'select', options: ['', '1-5 tonnes', '5-10 tonnes', '10-20 tonnes'] },
          { key: 'waste_pathological',   label: 'Pathological Waste (human/animal tissue)',type: 'select', options: ['', '1-5 tonnes', '5-10 tonnes', '10-20 tonnes'] },
          { key: 'waste_hazardous',      label: 'Hazardous Waste',                         type: 'select', options: ['', '1-5 tonnes', '5-10 tonnes', '10-20 tonnes'] },
          { key: 'waste_radiological',   label: 'Radiological Waste',                      type: 'select', options: ['', '1-5 tonnes', '5-10 tonnes', '10-20 tonnes'] },
          { key: 'waste_heavy_metals',   label: 'Heavy Metals',                            type: 'select', options: ['', '1-5 tonnes', '5-10 tonnes', '10-20 tonnes'] },
          { key: 'waste_incinerator_ash',label: 'Incinerator Ash',                         type: 'select', options: ['', '1-5 tonnes', '5-10 tonnes', '10-20 tonnes'] },
        ],
      },
      {
        title: 'Waste Treatment & Disposal',
        items: [
          { key: 'treats_waste_onsite',    label: 'Waste treated within the facility' },
          { key: 'treatment_incinerator',  label: 'On-site incinerator used',         conditional: { key: 'treats_waste_onsite', value: 'Yes' } },
          { key: 'treatment_open_burning', label: 'Open air burning used',            conditional: { key: 'treats_waste_onsite', value: 'Yes' } },
          { key: 'treatment_chemical',     label: 'Chemical disinfestations used',    conditional: { key: 'treats_waste_onsite', value: 'Yes' } },
          { key: 'treatment_burial',       label: 'Burial on site used',              conditional: { key: 'treats_waste_onsite', value: 'Yes' } },
          { key: 'offsite_disposal',       label: 'If not treated on site — disposal method', type: 'text', conditional: { key: 'treats_waste_onsite', value: 'No' } },
        ],
      },
    ],
  },

  // ── Hospitality (CT) ─────────────────────────────────────────
  CT: {
    label: 'Hospitality Industry',
    extraFields: [
      { key: 'workforce_management', label: 'Management Staff', type: 'text' },
      { key: 'workforce_senior',     label: 'Senior Staff',     type: 'text' },
      { key: 'workforce_junior',     label: 'Junior Staff',     type: 'text' },
      { key: 'workforce_casuals',    label: 'Casuals',          type: 'text' },
      { key: 'workforce_temporary',  label: 'Temporary Staff',  type: 'text' },
    ],
    sections: [
      {
        title: 'Permits & Licenses',
        items: [
          { key: 'env_permit',          label: 'EPA Environmental Permit' },
          { key: 'env_certificate',     label: 'EPA Environmental Certificate' },
          { key: 'tourist_board',       label: 'Ghana Tourist Board License' },
          { key: 'fire_permit',         label: 'Ghana National Fire Service — Fire Permit' },
          { key: 'fire_certificate',    label: 'Ghana National Fire Service — Fire Certificate' },
          { key: 'dev_permit',          label: 'Town & Country Planning — Development Permit' },
          { key: 'building_permit',     label: 'Town & Country Planning — Building Permit' },
        ],
      },
      {
        title: 'Site Description',
        items: [
          { key: 'current_zoning',      label: 'Current zoning',                              type: 'text' },
          { key: 'distance_nearest',    label: 'Approximate distance to nearest facility',    type: 'text' },
          { key: 'adjacent_land_use',   label: 'Adjacent land uses',                          type: 'text' },
          { key: 'nearness_water_body', label: 'Nearness to a water body',                    type: 'text' },
        ],
      },
      {
        title: 'Nature of Undertaking',
        items: [
          { key: 'undertaking_type', label: 'Type of establishment', type: 'select', options: ['', 'Hotel', 'Guest House', 'Hostels', 'Social Centre', 'Restaurant', 'Nite Club/Pub', 'Rest Stop', 'Others'] },
          { key: 'star_rating',      label: 'Star rating',           type: 'select', options: ['', 'Five (5) Star', 'Four (4) Stars', 'Three (3) Star', 'Two (2) Star', 'One (1) Star', 'Budget'] },
          { key: 'num_rooms',        label: 'Number of rooms (accommodation)',         type: 'text' },
          { key: 'num_conf_halls',   label: 'Number of conference halls',              type: 'text' },
          { key: 'conf_seating',     label: 'Conference seating capacity',             type: 'text' },
          { key: 'num_restaurants',  label: 'Number of restaurants',                  type: 'text' },
          { key: 'rest_seating',     label: 'Restaurant seating capacity',            type: 'text' },
        ],
      },
      {
        title: 'Infrastructure & Utilities',
        items: [
          { key: 'water_source',         label: 'Water source',                type: 'select', options: ['', 'GWCL', 'Tanker Services', 'Well', 'Others'] },
          { key: 'water_availability',   label: 'Water availability',          type: 'select', options: ['', 'Reliable', 'Seasonal', 'Scarce'] },
          { key: 'water_storage_tank',   label: 'Water storage tank available' },
          { key: 'water_storage_cap',    label: 'Water storage capacity',      type: 'text', conditional: { key: 'water_storage_tank', value: 'Yes' } },
          { key: 'water_monthly',        label: 'Approximate water consumed per month', type: 'text' },
          { key: 'power_source',         label: 'Power source',                type: 'select', options: ['', 'ECG', 'Standby Generator', 'ECG + Standby Generator', 'Others'] },
          { key: 'site_drainage_plan',   label: 'Site drainage plan in place' },
          { key: 'sewage_treatment',     label: 'Type of sewage treatment facility', type: 'text' },
          { key: 'access_road',          label: 'Access road type',            type: 'select', options: ['', 'Paved', 'Unpaved'] },
          { key: 'parking_capacity',     label: 'Parking lot capacity',        type: 'text' },
        ],
      },
      {
        title: 'Potential Environmental Impacts',
        items: [
          { key: 'impact_solid',         label: 'Solid waste impact managed adequately' },
          { key: 'impact_liquid',        label: 'Liquid/Effluent impact managed adequately' },
          { key: 'impact_gaseous',       label: 'Gaseous emissions managed adequately' },
          { key: 'impact_odour',         label: 'Odour impact managed adequately' },
          { key: 'impact_fire',          label: 'Fire hazard managed adequately' },
          { key: 'recv_vegetation',      label: 'Vegetation affected by undertaking' },
          { key: 'recv_soil',            label: 'Soil/Land affected by undertaking' },
          { key: 'recv_surface_water',   label: 'Surface water affected by undertaking' },
          { key: 'recv_air',             label: 'Air affected by undertaking' },
        ],
      },
      {
        title: 'Management of Impacts',
        items: [
          { key: 'mgmt_waste_odour',     label: 'Odour from waste treatment facility — management adequate' },
          { key: 'mgmt_sewage_odour',    label: 'Odour from sewage systems — management adequate' },
          { key: 'mgmt_pantry',          label: 'Pantry services — management adequate' },
          { key: 'mgmt_runoff',          label: 'Runoff/rainwater — management adequate' },
          { key: 'mgmt_laundry_ww',      label: 'Wastewater from laundry, washroom and sewage — management adequate' },
          { key: 'mgmt_kitchen',         label: 'Kitchen — management adequate' },
          { key: 'mgmt_dining',          label: 'Dining room — management adequate' },
          { key: 'mgmt_washroom',        label: 'Washroom — management adequate' },
          { key: 'mgmt_fire_occ',        label: 'Fire hazard — occupational management adequate' },
          { key: 'mgmt_accidents',       label: 'Accidents — occupational management adequate' },
        ],
      },
      {
        title: 'Emergency Response & Environmental Monitoring',
        items: [
          { key: 'staff_fire_trained',   label: 'Staff trained in fire fighting' },
          { key: 'fire_response_plan',   label: 'Emergency response plan for fire outbreak in place' },
          { key: 'emergency_exits',      label: 'Emergency exit points available' },
          { key: 'assembly_point',       label: 'Assembly point designated for emergencies' },
          { key: 'ehs_training',         label: 'Staff trained in Environment, Health and Safety (EHS)' },
          { key: 'ehs_training_date',    label: 'If yes — when was last EHS training?', type: 'text', conditional: { key: 'ehs_training', value: 'Yes' } },
          { key: 'air_quality_comply',   label: 'Compliance with EPA Ambient Air Quality guidelines' },
          { key: 'discharge_comply',     label: 'Compliance with EPA Efficient Discharge guidelines' },
          { key: 'noise_comply',         label: 'Compliance with EPA Ambient Noise Level guidelines' },
          { key: 'records_accidents',    label: 'Accident records maintained' },
          { key: 'records_waste_vol',    label: 'Volume of waste generated — records maintained' },
          { key: 'records_guests',       label: 'Number of guests per annum — records maintained' },
        ],
      },
    ],
  },

  // ── Manufacturing (CU) ───────────────────────────────────────
  CU: {
    label: 'Manufacturing',
    extraFields: [
      { key: 'facility_type',       label: 'Type of Facility',        type: 'text' },
      { key: 'installed_capacity',  label: 'Installed Capacity',      type: 'text' },
      { key: 'production_capacity', label: 'Production Capacity',     type: 'text' },
      { key: 'num_workers',         label: 'Number of Workers',       type: 'text' },
    ],
    sections: [
      {
        title: 'Permits & Licenses',
        items: [
          { key: 'env_permit',           label: 'Environmental Permit (EPA)' },
          { key: 'env_certificate',      label: 'Environmental Certificate (EPA)' },
          { key: 'fire_permit',          label: 'Fire Permit (Ghana National Fire Service)' },
          { key: 'fire_certificate',     label: 'Fire Certificate (Ghana National Fire Service)' },
          { key: 'insurance_docs',       label: 'Insurance Documents (National Insurance Commission)' },
          { key: 'insurance_cert',       label: 'Insurance Certificate (National Insurance Commission)' },
          { key: 'dev_permit',           label: 'Development Permit (MMDA)' },
          { key: 'building_permit',      label: 'Building Permit (MMDA)' },
          { key: 'emp_year',             label: 'Environmental Management Plan — year submitted',  type: 'text' },
          { key: 'aer_year',             label: 'Annual Environmental Report — year submitted',    type: 'text' },
          { key: 'quarterly_rep_year',   label: 'Quarterly Report — year submitted',              type: 'text' },
        ],
      },
      {
        title: 'Type of Undertaking',
        items: [
          { key: 'undertaking_type',  label: 'Type of undertaking', type: 'select', options: ['', 'Sachet Water Production', 'Scrap Metals & Used Oil', 'Steel Processing', 'Refilling', 'Wood Cutting & Joinery', 'Re-assembling', 'Secondary & Tertiary Production', 'Minor Polythene Recycling', 'Packaging & Repackaging', 'Roofing Sheets', 'Sawmill & Wood Processing', 'Moulding Sites/Shops', 'Others'] },
          { key: 'undertaking_scope', label: 'Scope of undertaking',                      type: 'text' },
          { key: 'machinery',         label: 'Installed machinery/equipment (type & qty)', type: 'text' },
        ],
      },
      {
        title: 'Infrastructure & Utilities',
        items: [
          { key: 'water_source',      label: 'Water source',        type: 'select', options: ['', 'GWCL', 'Water Tanker Service', 'Well', 'Mechanized Borehole', 'Bore hole with hand pump', 'Rain harvest'] },
          { key: 'power_source',      label: 'Power/Energy source', type: 'select', options: ['', 'ECG', 'VRA', 'Wind', 'Stand by Generator Set', 'Solar', 'Others'] },
          { key: 'air_conditioner',   label: 'Air conditioner available' },
          { key: 'standby_generator', label: 'Standby generating set available' },
          { key: 'generator_type',    label: 'Generator type', type: 'select', options: ['', 'Generator', 'Plant'], conditional: { key: 'standby_generator', value: 'Yes' } },
          { key: 'computers',         label: 'Desktop computers available' },
          { key: 'computer_count',    label: 'Number of desktop computers',           type: 'text', conditional: { key: 'computers', value: 'Yes' } },
          { key: 'computer_disposal', label: 'How decommissioned computers are disposed', type: 'text', conditional: { key: 'computers', value: 'Yes' } },
        ],
      },
      {
        title: 'Waste Management',
        items: [
          { key: 'washrooms',          label: 'Washroom(s) available' },
          { key: 'washroom_type',      label: 'Washroom type',       type: 'select', options: ['', 'W/C', 'KVIP', 'PIT'],                                          conditional: { key: 'washrooms', value: 'Yes' } },
          { key: 'washroom_count',     label: 'Number of washrooms', type: 'text',                                                                                  conditional: { key: 'washrooms', value: 'Yes' } },
          { key: 'washroom_condition', label: 'Condition of washroom(s)', type: 'select', options: ['', 'Excellent', 'Very Good', 'Good', 'Poor', 'Very Poor'],      conditional: { key: 'washrooms', value: 'Yes' } },
          { key: 'drains',             label: 'Drains available' },
          { key: 'septic_tank',        label: 'Septic tank for liquid waste available' },
          { key: 'septic_dislodged',   label: 'Septic tank regularly dislodged',  conditional: { key: 'septic_tank', value: 'Yes' } },
          { key: 'waste_bins',         label: 'Access to litter/waste bins' },
          { key: 'waste_bin_count',    label: 'Number of waste bins',            type: 'text', conditional: { key: 'waste_bins', value: 'Yes' } },
          { key: 'waste_bin_freq',     label: 'How often waste bins are emptied', type: 'text', conditional: { key: 'waste_bins', value: 'Yes' } },
          { key: 'bulb_disposal',      label: 'How dead bulbs/fluorescent tubes are disposed', type: 'text' },
        ],
      },
      {
        title: 'Traffic & Fire Management',
        items: [
          { key: 'access_entry_exit',  label: 'Access to facility: entry and exit available' },
          { key: 'emergency_exit',     label: 'Emergency exit available' },
          { key: 'parking_space',      label: 'Parking space available' },
          { key: 'parking_capacity',   label: 'Capacity of parking space', type: 'text', conditional: { key: 'parking_space', value: 'Yes' } },
          { key: 'parking_adequate',   label: 'Parking space adequate',                  conditional: { key: 'parking_space', value: 'Yes' } },
          { key: 'fire_extinguishers', label: 'Fire extinguishers available' },
          { key: 'smoke_detectors',    label: 'Smoke detectors available' },
          { key: 'sand_buckets',       label: 'Sand buckets available' },
          { key: 'water_hydrants',     label: 'Water hydrants available' },
          { key: 'fire_alarms',        label: 'Fire alarms available' },
        ],
      },
    ],
  },
}

// Sectors without a dedicated site verification checklist — basic placeholder
const SV_PLACEHOLDER = (label) => ({
  label,
  extraFields: [],
  sections: [
    {
      title: 'General Compliance',
      items: [
        { key: 'env_permit',        label: 'Environmental Permit available' },
        { key: 'permit_displayed',  label: 'Permit displayed in visible location' },
        { key: 'no_violations',     label: 'No violations or illegal practices observed' },
        { key: 'site_description',  label: 'Site description / observations', type: 'text' },
      ],
    },
  ],
})

SITE_VERIFICATION_CHECKLISTS.CI = SV_PLACEHOLDER('Infrastructure')
SITE_VERIFICATION_CHECKLISTS.PP = SV_PLACEHOLDER('Agrochemical & Pesticide')
SITE_VERIFICATION_CHECKLISTS.CA = SV_PLACEHOLDER('Agriculture')
SITE_VERIFICATION_CHECKLISTS.CM = SV_PLACEHOLDER('Mining')
