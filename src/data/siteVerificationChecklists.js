// Sector-specific site verification checklists
// item type defaults to 'yesno_na' (Yes / No / N/A)
// other types: 'text', 'select', 'readonly'
// conditional: { key, value } — only show item when another field equals that value
// default: pre-filled value used when a field is first initialized (e.g. for 'readonly' fields)

import { DISTRICTS, REGION } from './constants'

export const SV_CHECKLIST_OPTIONS = ['', 'Yes', 'No', 'N/A']
const YN_OPTIONS = ['', 'Yes', 'No']

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

  // ── Energy / Fuel Service and Filling Stations (CE_FUEL_STATION) ────
  // Source: EPA "SITE VERIFICATION CHECKLIST — FUEL SERVICE AND FILLING STATIONS"
  CE_FUEL_STATION: {
    label: 'Fuel Service and Filling Station',
    extraFields: [
      { key: 'undertaking_type', label: 'Type of Undertaking', type: 'select', options: ['', 'Fuel Filling Station', 'Fuel Service Station'] },
      { key: 'num_workers',      label: 'Number of Workers',   type: 'text' },
    ],
    sections: [
      {
        title: 'Permits & Licenses',
        items: [
          { key: 'env_permit',              label: 'Environmental Permit (EPA)' },
          { key: 'env_certificate',         label: 'Environmental Certificate (EPA)' },
          { key: 'npa_construction_permit', label: 'Construction Permit (National Petroleum Authority)' },
          { key: 'npa_operational_permit',  label: 'Operational Permit (National Petroleum Authority)' },
          { key: 'fire_permit',             label: 'Fire Permit (Ghana National Fire Service)' },
          { key: 'fire_certificate',        label: 'Fire Certificate (Ghana National Fire Service)' },
          { key: 'dev_permit',              label: 'Development Permit (Town and Country Planning Dept.)' },
          { key: 'building_permit',         label: 'Building Permit (Town and Country Planning Dept.)' },
        ],
      },
      {
        title: 'Site Description',
        items: [
          { key: 'land_use_changes',            label: 'Changes in adjacent land uses since establishment' },
          { key: 'land_use_changes_compatible', label: 'If yes — are the changes compatible with the facility?', conditional: { key: 'land_use_changes', value: 'Yes' } },
          { key: 'current_zoning',              label: 'Current zoning',                            type: 'text' },
          { key: 'distance_nearest_facility',   label: 'Approximate distance to the nearest facility', type: 'text' },
          { key: 'adjacent_land_uses',          label: 'Adjacent land uses',                        type: 'text' },
          { key: 'nearness_water_body',         label: 'Nearness to a water body',                  type: 'text' },
        ],
      },
      {
        title: 'Services Provided',
        items: [
          { key: 'dispensing_fuel',  label: 'Dispensing of Fuel' },
          { key: 'lube_bay',         label: 'Lube Bay' },
          { key: 'shopping_mart',    label: 'Shopping Mart' },
          { key: 'washing_bay',      label: 'Washing Bay' },
          { key: 'restaurant',       label: 'Restaurant' },
          { key: 'banking_facility', label: 'Banking Facility' },
          { key: 'lubricant_shop',   label: 'Lubricant Shop' },
          { key: 'offices',         label: 'Offices' },
          { key: 'services_other',  label: 'Others (specify)', type: 'text' },
        ],
      },
      {
        title: 'Storage Tanks',
        items: [
          { key: 'tank_type',                     label: 'Type of Tank',      type: 'select', options: ['', 'Steel', 'Fibreglass-Reinforced Plastics (FRP)'] },
          { key: 'tank_placement',                label: 'Placement of Storage Tanks', type: 'select', options: ['', 'Surface', 'Underground'] },
          { key: 'petrol_tank_count_capacity',    label: 'Petrol — number and capacity', type: 'text' },
          { key: 'petrol_installation_year',      label: 'Petrol — year of installation', type: 'text' },
          { key: 'petrol_replacement_year',       label: 'Petrol — year of replacement',  type: 'text' },
          { key: 'diesel_tank_count_capacity',    label: 'Diesel — number and capacity', type: 'text' },
          { key: 'diesel_installation_year',      label: 'Diesel — year of installation', type: 'text' },
          { key: 'diesel_replacement_year',       label: 'Diesel — year of replacement',  type: 'text' },
          { key: 'kerosene_tank_count_capacity',  label: 'Kerosene — number and capacity', type: 'text' },
          { key: 'kerosene_installation_year',    label: 'Kerosene — year of installation', type: 'text' },
          { key: 'kerosene_replacement_year',     label: 'Kerosene — year of replacement',  type: 'text' },
        ],
      },
      {
        title: 'Infrastructure & Utilities',
        items: [
          { key: 'water_source',       label: 'Water source', type: 'select', options: ['', 'GWC', 'Water Tanker Service', 'Well/Borehole', 'Others'] },
          { key: 'power_source',       label: 'Power source', type: 'select', options: ['', 'ECG', 'Stand-by Generator', 'Others'] },
          { key: 'site_drainage_available', label: 'Site drainage system available' },
          { key: 'forecourt_condition', label: 'Forecourt condition', type: 'select', options: ['', 'Paved', 'Unpaved'] },
          { key: 'num_washrooms',      label: 'Number of washrooms', type: 'text' },
          { key: 'washroom_condition', label: 'Condition of washroom(s)', type: 'text' },
          { key: 'forecourt_comments', label: 'Comments and observations', type: 'text' },
        ],
      },
      {
        title: 'Traffic Management',
        items: [
          { key: 'access_entry_exit',    label: 'Access to facility: Entry and Exit available' },
          { key: 'parking_capacity',     label: 'Parking spaces (capacity)', type: 'text' },
          { key: 'accidents_last_year',  label: 'Number of accident(s) in the last year', type: 'text' },
        ],
      },
      {
        title: 'Occupational Health and Safety',
        items: [
          { key: 'attendant_ehs_training', label: 'Attendant(s) received training in environment, health and safety' },
          { key: 'first_aid_kit',          label: 'First aid kit available' },
          { key: 'assembly_point',         label: 'Assembly point for emergency available' },
          { key: 'protective_clothing',    label: 'Protective clothing (list)', type: 'text' },
        ],
      },
      {
        title: 'Emergency Response Measures',
        items: [
          { key: 'emergency_response_plan',         label: 'Emergency response plan for Fire, Oil Spill and Vehicular Accidents' },
          { key: 'emergency_spill_kit',              label: 'Emergency response spill kit available' },
          { key: 'tanks_buried_bunkers',             label: 'Tanks buried in concrete bunkers' },
          { key: 'staff_firefighting_trained',       label: 'Staff received training in fire fighting' },
          { key: 'fire_drills_per_year',             label: 'Number of fire drills in a year', type: 'text' },
          { key: 'staff_oil_spill_trained',          label: 'Staff received training in oil spill management' },
          { key: 'attendants_safe_handling_trained', label: 'Attendants received training in safe product handling' },
        ],
      },
      {
        title: 'Environmental Monitoring (Record Keeping)',
        items: [
          { key: 'waste_oil_sludge_records',    label: 'Waste oil and sludge generation records kept' },
          { key: 'spills_leaks_records',        label: 'Spills and leaks records kept' },
          { key: 'disposal_waste_oil_records',  label: 'Disposal of waste oil and sludge records kept' },
          { key: 'disposal_solid_waste_records',label: 'Disposal of solid waste records kept' },
          { key: 'accidents_records',           label: 'Accidents records kept' },
        ],
      },
    ],
  },

  // ── Energy / LPG Re-filling Plant (CE_LPG) ───────────────────────
  // Source: EPA "SITE VERIFICATION CHECKLIST — PETROLEUM PRODUCTS RETAIL OUTLETS
  // LIQUIFIED PETROLEUM GAS (LPG) RE-FILLING PLANT"
  CE_LPG: {
    label: 'LPG Re-filling Plant',
    extraFields: [
      { key: 'num_workers', label: 'Number of Workers', type: 'text' },
    ],
    sections: [
      {
        title: 'Permits & Licenses',
        items: [
          { key: 'env_permit',              label: 'Environmental Permit (EPA)' },
          { key: 'env_certificate',         label: 'Environmental Certificate (EPA)' },
          { key: 'npa_construction_permit', label: 'Construction Permit (National Petroleum Authority)' },
          { key: 'npa_operational_permit',  label: 'Operational Permit (National Petroleum Authority)' },
          { key: 'fire_permit',             label: 'Fire Permit (Ghana National Fire Service)' },
          { key: 'fire_certificate',        label: 'Fire Certificate (Ghana National Fire Service)' },
          { key: 'dev_permit',              label: 'Development Permit (Town and Country Planning Dept.)' },
          { key: 'building_permit',         label: 'Building Permit (Town and Country Planning Dept.)' },
          { key: 'non_destructive_test_cert', label: 'Non-Destructive Test Certificate (Ghana Atomic Energy Commission)' },
          { key: 'fid_certificate',         label: 'FID Certificate (Factories Inspectorate Department)' },
          { key: 'gsb_certificate',         label: 'GSB Certificate (Ghana Standards Board)' },
          { key: 'insurance_certificate',   label: 'Valid Insurance Certificate' },
        ],
      },
      {
        title: 'Site Description',
        items: [
          { key: 'land_use_changes',            label: 'Changes in adjacent land uses since establishment' },
          { key: 'land_use_changes_compatible', label: 'If yes — are the changes compatible with the facility?', conditional: { key: 'land_use_changes', value: 'Yes' } },
          { key: 'current_zoning',                    label: 'Current zoning', type: 'text' },
          { key: 'distance_nearest_facility_water',   label: 'Approximate distance to the nearest facility/water body', type: 'text' },
        ],
      },
      {
        title: 'Services and Facilities Provided',
        items: [
          { key: 'lpg_refilling',              label: 'LPG Re-filling' },
          { key: 'auto_gas_dispensing',        label: 'Auto Gas Dispensing' },
          { key: 'sale_filled_cylinders',      label: 'Sale of filled LPG Cylinders' },
          { key: 'sale_bottles_accessories',   label: 'Sale of LPG Bottles and Accessories' },
          { key: 'offices',                    label: 'Offices' },
          { key: 'services_other',             label: 'Others (specify)', type: 'text' },
        ],
      },
      {
        title: 'Storage Tanks',
        items: [
          { key: 'tank_count_capacity',   label: 'Installed capacity — number and capacity', type: 'text' },
          { key: 'tank_installation_year',label: 'Year of installation', type: 'text' },
          { key: 'tank_replacement_year', label: 'Year of replacement',  type: 'text' },
        ],
      },
      {
        title: 'Safety Accessories',
        items: [
          { key: 'temperature_gauge',      label: 'Temperature Gauge' },
          { key: 'pressure_gauge',         label: 'Pressure Gauge' },
          { key: 'sight_glass',            label: 'Sight glass / Liquid level Gauge' },
          { key: 'safety_relief_valve',    label: 'Safety Relief Valve / Emergency Shut-off Valve' },
          { key: 'bottom_drain_valve',     label: 'Bottom Drained Valve' },
          { key: 'water_sprinklers',       label: 'Water Sprinklers' },
          { key: 'pressure_balancer',      label: 'Pressure Balancer' },
          { key: 'stairway_platform',      label: 'Stair way and Platform' },
          { key: 'grounding_earthing',     label: 'Grounding (Earthing)' },
          { key: 'flame_fire_arresters',   label: 'Flame/Fire Arresters' },
        ],
      },
      {
        title: 'Infrastructure & Utilities',
        items: [
          { key: 'water_source',       label: 'Water source', type: 'select', options: ['', 'GWC', 'Water Tanker Service', 'Well/Borehole', 'Overhead Water Reservoir', 'Others'] },
          { key: 'power_source',       label: 'Power source', type: 'select', options: ['', 'ECG', 'Stand-by Generator', 'Others'] },
          { key: 'site_drainage_available', label: 'Site drainage system available' },
          { key: 'forecourt_condition', label: 'Forecourt condition', type: 'select', options: ['', 'Paved', 'Unpaved'] },
          { key: 'num_washrooms',      label: 'Number of washrooms', type: 'text' },
          { key: 'washroom_condition', label: 'Condition of washroom(s)', type: 'text' },
          { key: 'forecourt_restricted_public_areas', label: 'Forecourt divided into restricted and public areas' },
          { key: 'emergency_procedures_displayed',    label: 'Emergency procedures displayed' },
          { key: 'facility_fenced',    label: 'Facility fenced' },
          { key: 'forecourt_comments', label: 'Comments and observations', type: 'text' },
        ],
      },
      {
        title: 'Traffic Management',
        items: [
          { key: 'access_entry_exit',   label: 'Access to facility: Entry and Exit available' },
          { key: 'parking_capacity',    label: 'Parking spaces (capacity)', type: 'text' },
          { key: 'accidents_last_year', label: 'Number of accident(s) in the last year', type: 'text' },
        ],
      },
      {
        title: 'Occupational Health and Safety',
        items: [
          { key: 'attendant_ehs_training', label: 'Attendant(s) received training in environment, health and safety' },
          { key: 'first_aid_kit',          label: 'First aid kit available' },
          { key: 'assembly_point',         label: 'Assembly point for emergency available' },
          { key: 'protective_clothing',    label: 'Protective clothing (list)', type: 'text' },
        ],
      },
      {
        title: 'Fire Safety Equipment',
        items: [
          { key: 'smoke_detectors',   label: 'Smoke Detectors' },
          { key: 'fire_alarms',       label: 'Fire Alarms' },
          { key: 'fire_hydrants',     label: 'Fire Hydrants' },
          { key: 'hose_reels',        label: 'Hose Reels' },
          { key: 'warning_signs',     label: 'Warning Notices/Signs' },
        ],
      },
      {
        title: 'Emergency Response Measures',
        items: [
          { key: 'leak_explosion_procedures',        label: 'Procedures for handling gas leaks and explosions in place' },
          { key: 'emergency_response_plan',          label: 'Emergency response plan available' },
          { key: 'staff_firefighting_trained',       label: 'Staff received training in fire fighting' },
          { key: 'fire_drills_per_year',              label: 'Number of fire drills in a year', type: 'text' },
          { key: 'staff_gas_leak_trained',            label: 'Staff received training in gas leak management' },
          { key: 'attendants_safe_handling_trained',  label: 'Attendants received training in safe product handling' },
        ],
      },
      {
        title: 'Environmental Monitoring',
        items: [
          { key: 'gas_leaks_explosion_records', label: 'Gas leaks and explosion records kept' },
          { key: 'disposal_solid_waste_records',label: 'Disposal of solid waste records kept' },
          { key: 'accidents_records',           label: 'Accidents records kept' },
          { key: 'accident_investigation_reports', label: 'Accident (fire, leaks etc.) investigation reports available' },
          { key: 'non_destructive_test_reports',    label: 'Non-destructive tests reports available' },
        ],
      },
      {
        title: 'Neighbourhood Consultation',
        items: [
          { key: 'neighbour_concerns', label: 'Concerns of immediate neighbours', type: 'text' },
        ],
      },
    ],
  },

  // ── Health / Healthcare Facility (CH) ─────────────────────────
  // Source: EPA "SITE VERIFICATION CHECKLIST FOR HEALTHCARE FACILITY(S)"
  CH: {
    label: 'Healthcare Facility',
    extraFields: [
      { key: 'facility_name',       label: 'Name of Healthcare Facility',       type: 'text' },
      { key: 'year_established',    label: 'Year of Establishment',             type: 'text' },
      { key: 'parental_healthcare', label: 'Parental Healthcare',               type: 'text' },
      { key: 'location',            label: 'Location',                         type: 'text' },
      { key: 'contact_person',      label: 'Contact Person',                    type: 'text' },
      { key: 'contact_position',    label: 'Position',                          type: 'text' },
      { key: 'address',             label: 'Address',                           type: 'text' },
      { key: 'tel',                 label: 'Tel',                               type: 'text' },
      { key: 'fax',                 label: 'Fax',                               type: 'text' },
      { key: 'email',               label: 'E-mail',                            type: 'text' },
      { key: 'env_officer_name',    label: 'Name of Environmental Officer',     type: 'text' },
      { key: 'env_officer_contact', label: 'Environmental Officer Contact No.', type: 'text' },
      { key: 'env_officer_fax',     label: 'Environmental Officer Fax',         type: 'text' },
      { key: 'env_officer_email',   label: 'Environmental Officer E-mail',      type: 'text' },
      { key: 'relevant_permits',    label: 'List of Relevant Permits',          type: 'text' },
    ],
    sections: [
      {
        title: 'Project Description',
        items: [
          { key: 'facility_type',       label: 'Type of Healthcare Facility', type: 'select', options: ['', 'Hospital', 'Veterinary', 'Clinic', 'Polyclinic', 'Medical Laboratory', 'Traditional Healthcare', 'Midwifery', 'Health Post', 'Funeral Homes/Mortuary', 'Others'] },
          { key: 'facility_type_other',  label: 'If Others — please specify', type: 'text', conditional: { key: 'facility_type', value: 'Others' } },
          { key: 'hospital_type',        label: 'If Hospital — Type',          type: 'select', options: ['', 'Teaching Hospital', 'Regional', 'Polyclinic', 'District'], conditional: { key: 'facility_type', value: 'Hospital' } },
          { key: 'hospital_ownership',   label: 'If Hospital — Private or Public', type: 'select', options: ['', 'Private', 'Public'], conditional: { key: 'facility_type', value: 'Hospital' } },
          { key: 'num_beds',             label: 'Number of Beds',              type: 'text' },
          { key: 'staff_strength',       label: 'Staff Strength',              type: 'text' },
          { key: 'staff_doctors',        label: 'Doctors',                     type: 'text' },
          { key: 'staff_physician_assistant', label: 'Physician Assistant',    type: 'text' },
          { key: 'staff_nurses',         label: 'Nurses',                      type: 'text' },
          { key: 'staff_auxiliary',      label: 'Auxiliary',                   type: 'text' },
          { key: 'staff_lab_tech',       label: 'Lab Technicians',             type: 'text' },
          { key: 'staff_paramedics',     label: 'Paramedics',                  type: 'text' },
          { key: 'staff_others',         label: 'Others (specify)',            type: 'text' },
          { key: 'daily_patients',       label: 'Average patients admitted daily', type: 'text' },
          { key: 'specialized_service',  label: 'Specialised services provided', type: 'select', options: ['', 'Surgery', 'Maternity', 'Orthopedic', 'Radiology', 'Funeral Homes', 'Dentistry', 'Others'] },
          { key: 'specialized_service_other', label: 'If Others — please specify', type: 'text', conditional: { key: 'specialized_service', value: 'Others' } },
        ],
      },
      {
        title: 'Location of Facility',
        items: [
          { key: 'plot_no',        label: 'Plot/H/No',        type: 'text' },
          { key: 'street_area',    label: 'Street/Area Name', type: 'text' },
          { key: 'zoning_status',  label: 'Zoning Status',    type: 'text' },
          { key: 'town',           label: 'Town',             type: 'text' },
          { key: 'major_landmark', label: 'Major Landmark',   type: 'text' },
          { key: 'major_land_use', label: 'Major Land Use',   type: 'text' },
          { key: 'district',       label: 'District',         type: 'select', options: ['', ...DISTRICTS.map((d) => d.name)] },
          { key: 'region',         label: 'Region',           type: 'readonly', default: REGION },
        ],
      },
      {
        title: 'Environmental Management',
        items: [
          { key: 'knows_env_laws',     label: 'Aware of country\'s environmental laws and regulations' },
          { key: 'knows_waste_policy', label: 'Aware of country\'s current environmental policy on waste management' },
          { key: 'solid_waste_type',   label: 'Solid waste generated (specify)',  type: 'text' },
          { key: 'liquid_waste_type',  label: 'Liquid waste generated (specify)', type: 'text' },
        ],
      },
      {
        title: 'Waste Categories Generated Per Day',
        items: [
          { key: 'waste_general',        label: 'General/Normal Waste',                     type: 'select', options: ['', '1-5 tonnes', '5-10 tonnes', '10-20 tonnes', 'N/A'] },
          { key: 'waste_infectious',     label: 'Infectious Waste',                         type: 'select', options: ['', '1-5 tonnes', '5-10 tonnes', '10-20 tonnes', 'N/A'] },
          { key: 'waste_pharmaceutical', label: 'Pharmaceutical Waste',                     type: 'select', options: ['', '1-5 tonnes', '5-10 tonnes', '10-20 tonnes', 'N/A'] },
          { key: 'waste_pathological',   label: 'Pathological Waste (Human and Animal Tissue)', type: 'select', options: ['', '1-5 tonnes', '5-10 tonnes', '10-20 tonnes', 'N/A'] },
          { key: 'waste_hazardous',      label: 'Hazardous Waste',                          type: 'select', options: ['', '1-5 tonnes', '5-10 tonnes', '10-20 tonnes', 'N/A'] },
          { key: 'waste_photographic',   label: 'Photographic Waste',                       type: 'select', options: ['', '1-5 tonnes', '5-10 tonnes', '10-20 tonnes', 'N/A'] },
          { key: 'waste_radiological',   label: 'Radiological Waste',                       type: 'select', options: ['', '1-5 tonnes', '5-10 tonnes', '10-20 tonnes', 'N/A'] },
          { key: 'waste_heavy_metals',   label: 'Heavy Metals',                             type: 'select', options: ['', '1-5 tonnes', '5-10 tonnes', '10-20 tonnes', 'N/A'] },
          { key: 'waste_incinerator_ash',label: 'Incinerator Ash',                          type: 'select', options: ['', '1-5 tonnes', '5-10 tonnes', '10-20 tonnes', 'N/A'] },
          { key: 'waste_organic',        label: 'Organic Substances',                       type: 'select', options: ['', '1-5 tonnes', '5-10 tonnes', '10-20 tonnes', 'N/A'] },
          { key: 'waste_organic_specify',label: 'Organic Substances — specify',             type: 'text' },
          { key: 'waste_other',          label: 'Others',                                   type: 'select', options: ['', '1-5 tonnes', '5-10 tonnes', '10-20 tonnes', 'N/A'] },
          { key: 'waste_other_specify',  label: 'Others — specify',                         type: 'text' },
        ],
      },
      {
        title: 'Waste Treatment & Disposal',
        items: [
          { key: 'treats_waste_onsite',    label: 'Waste treated within the facility' },
          { key: 'treatment_incinerator',  label: 'On-site Incinerator used',         conditional: { key: 'treats_waste_onsite', value: 'Yes' } },
          { key: 'treatment_open_burning', label: 'Open air Burning used',            conditional: { key: 'treats_waste_onsite', value: 'Yes' } },
          { key: 'treatment_chemical',     label: 'Chemical Disinfestations used',    conditional: { key: 'treats_waste_onsite', value: 'Yes' } },
          { key: 'treatment_burial',       label: 'Burial on site used',              conditional: { key: 'treats_waste_onsite', value: 'Yes' } },
          { key: 'offsite_disposal',       label: 'If not treated on site — how is it disposed of?', type: 'text', conditional: { key: 'treats_waste_onsite', value: 'No' } },
          { key: 'treated_waste_disposal', label: 'How is treated waste disposed of?', type: 'select', options: ['', 'Municipal Landfill', 'Sewage treatment facility', 'Off-site incinerator', 'Soak away', 'Others'] },
          { key: 'treated_waste_disposal_other', label: 'If Others — please specify', type: 'text', conditional: { key: 'treated_waste_disposal', value: 'Others' } },
        ],
      },
      {
        title: 'Recommendations',
        items: [
          { key: 'rec_env_permit',         label: 'Environmental Permit Should be granted' },
          { key: 'rec_env_certificate',    label: 'Environmental Certificate Should be granted' },
          { key: 'rec_further_assessment', label: 'Further Environmental Assessment Required' },
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
          { key: 'land_use_changes',            label: 'Changes in adjacent land uses since project inception' },
          { key: 'land_use_changes_compatible', label: 'If yes — are the changes compatible with the facility?', conditional: { key: 'land_use_changes', value: 'Yes' } },
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
        title: 'Eco-Tourism Facilities',
        items: [
          { key: 'eco_water_falls',      label: 'Water Falls' },
          { key: 'eco_game_reserves',    label: 'Game Reserves' },
          { key: 'eco_national_parks',   label: 'National Parks' },
          { key: 'eco_botanical_gardens',label: 'Botanical Gardens' },
          { key: 'eco_para_gliding',     label: 'Para Gliding' },
          { key: 'eco_beaches',          label: 'Beaches' },
          { key: 'eco_heritage_sites',   label: 'Heritage/Archaeological Sites' },
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
          { key: 'accidents_last_year',  label: 'Number of accident(s) in the last year', type: 'text' },
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
          { key: 'special_conditions',   label: 'Any special conditions for certification', type: 'text' },
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
          { key: 'ceiling_fans',      label: 'Ceiling/Standing fans available' },
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

  // ── Infrastructure / General Construction (CI) ────────────────
  // Source: EPA "ENVIRONMENTAL MANAGEMENT REPORT — RENEWAL OF ENVIRONMENTAL
  // PERMIT — GENERAL CONSTRUCTION — FORM EMR-GC" (Environmental Assessment
  // Regulations 1999, LI 1652). Tabular sections are flattened into
  // Yes/No + supporting text fields to match this app's checklist pattern.
  CI: {
    label: 'General Construction / Infrastructure',
    extraFields: [
      { key: 'type_of_project',    label: 'Type of Project (e.g. Warehouse, Apartment, Shops and Offices)', type: 'text' },
      { key: 'activities_description', label: 'Brief Description of Activities Undertaken', type: 'text' },
      { key: 'equipment_facilities',   label: 'Equipment/Facilities Used in Operations',    type: 'text' },
      { key: 'land_take',          label: 'Land Take (acres)',           type: 'text' },
      { key: 'facility_capacity',  label: 'Capacity/Size of Facility',   type: 'text' },
    ],
    sections: [
      {
        title: 'Site Description',
        items: [
          { key: 'land_use_changes',         label: 'Changes in adjacent land uses since project inception' },
          { key: 'land_use_changes_details', label: 'If yes — what are the changes', type: 'text', conditional: { key: 'land_use_changes', value: 'Yes' } },
          { key: 'predominant_land_use',     label: 'Predominant land use of the area (commercial/residential/mixed/industrial)', type: 'text' },
          { key: 'nearness_water_body',      label: 'Nearness to a water body' },
          { key: 'water_body_distance',      label: 'If yes — approximate distance to the water body (m)', type: 'text', conditional: { key: 'nearness_water_body', value: 'Yes' } },
          { key: 'nearness_sensitive_area',  label: 'Nearness to any environmentally sensitive area (wetlands, aquifer recharge areas, flood-prone areas, unstable slopes, swamps etc.)' },
          { key: 'sensitive_area_distance',  label: 'If yes — approximate distance to the sensitive area (m)', type: 'text', conditional: { key: 'nearness_sensitive_area', value: 'Yes' } },
        ],
      },
      {
        title: 'Workforce',
        items: [
          { key: 'total_workers',    label: 'Total number of workers', type: 'text' },
          { key: 'management_staff', label: 'Management staff',        type: 'text' },
          { key: 'senior_staff',     label: 'Senior staff',            type: 'text' },
          { key: 'junior_staff',     label: 'Junior staff',            type: 'text' },
          { key: 'casuals',          label: 'Casuals',                 type: 'text' },
        ],
      },
      {
        title: 'Infrastructure & Utilities',
        items: [
          { key: 'water_source',              label: 'Water source', type: 'select', options: ['', 'GWCL', 'Water Tanker Service', 'Well/Borehole', 'Others'] },
          { key: 'water_annual_consumption',  label: 'Total annual water consumption (litres/m³)', type: 'text' },
          { key: 'power_source',              label: 'Power source', type: 'select', options: ['', 'ECG', 'Stand-by Generator', 'Solar', 'Others'] },
          { key: 'power_annual_consumption',  label: 'Total annual power consumption (kWh)', type: 'text' },
          { key: 'access_road',               label: 'Access road', type: 'select', options: ['', 'Paved', 'Unpaved'] },
          { key: 'parking_capacity',          label: 'Parking lot capacity', type: 'text' },
          { key: 'washrooms_available',       label: 'Washroom/toilet available at the facility' },
          { key: 'washrooms_separate_sexes',  label: 'Separate washrooms for male and female', conditional: { key: 'washrooms_available', value: 'Yes' } },
          { key: 'washroom_count',            label: 'Number of washrooms', type: 'text', conditional: { key: 'washrooms_available', value: 'Yes' } },
          { key: 'washroom_cleaning_freq',    label: 'How often washrooms are cleaned', type: 'text', conditional: { key: 'washrooms_available', value: 'Yes' } },
          { key: 'site_drainage_available',   label: 'Site drainage system available' },
          { key: 'drainage_condition',        label: 'Condition of drain (choked, silted, free, covered or not, etc.)', type: 'text', conditional: { key: 'site_drainage_available', value: 'Yes' } },
        ],
      },
      {
        title: 'Legislative & Permits Compliance',
        items: [
          { key: 'relevant_policies_acts_regulations', label: 'Relevant national policies, acts & regulations for this sector, and obligations under them', type: 'text' },
          { key: 'standards_guidelines',                label: 'Relevant national standards & guidelines, and obligations under them', type: 'text' },
          { key: 'epa_permit',                     label: 'Availability of EPA Permit' },
          { key: 'gnfs_fire_certificate',          label: 'Availability of GNFS Fire Certificate' },
          { key: 'business_registration_certificate', label: 'Availability of Business/Company Registration Certificate (Registrar General)' },
        ],
      },
      {
        title: 'Environmental & OHS Policy',
        items: [
          { key: 'env_policy_available', label: 'Environmental Policy available' },
          { key: 'env_policy_summary',   label: 'Environmental policy statement, objective and target', type: 'text', conditional: { key: 'env_policy_available', value: 'Yes' } },
          { key: 'ohs_policy_available', label: 'Occupational Health and Safety (OHS) Policy available' },
          { key: 'ohs_policy_summary',   label: 'OHS policy statement, objective and target', type: 'text', conditional: { key: 'ohs_policy_available', value: 'Yes' } },
        ],
      },
      {
        title: 'Environmental Impacts & Pollution Management',
        items: [
          { key: 'waste_litters_managed',          label: 'Waste/Litters (solid & liquid waste) managed adequately' },
          { key: 'waste_litters_practices',        label: 'Sources & management practices', type: 'text', conditional: { key: 'waste_litters_managed', value: 'Yes' } },
          { key: 'air_emissions_managed',          label: 'Air emissions managed adequately' },
          { key: 'air_emissions_practices',        label: 'Sources & management practices', type: 'text', conditional: { key: 'air_emissions_managed', value: 'Yes' } },
          { key: 'liquid_waste_managed',           label: 'Liquid waste/effluent discharges managed adequately' },
          { key: 'liquid_waste_practices',         label: 'Sources & management practices', type: 'text', conditional: { key: 'liquid_waste_managed', value: 'Yes' } },
          { key: 'soil_contamination_managed',     label: 'Soil contamination managed adequately' },
          { key: 'soil_contamination_practices',   label: 'Sources & management practices', type: 'text', conditional: { key: 'soil_contamination_managed', value: 'Yes' } },
          { key: 'stormwater_runoff_managed',      label: 'Stormwater runoffs managed adequately' },
          { key: 'stormwater_runoff_practices',    label: 'Sources & management practices', type: 'text', conditional: { key: 'stormwater_runoff_managed', value: 'Yes' } },
          { key: 'surface_water_quality_managed',  label: 'Surface water quality managed adequately' },
          { key: 'surface_water_quality_practices',label: 'Management practices', type: 'text', conditional: { key: 'surface_water_quality_managed', value: 'Yes' } },
          { key: 'noise_vibration_managed',        label: 'Ambient noise/vibration managed adequately' },
          { key: 'noise_vibration_practices',      label: 'Management practices', type: 'text', conditional: { key: 'noise_vibration_managed', value: 'Yes' } },
          { key: 'solid_waste_managed',            label: 'Solid waste managed adequately' },
          { key: 'solid_waste_practices',          label: 'Management practices', type: 'text', conditional: { key: 'solid_waste_managed', value: 'Yes' } },
          { key: 'hazardous_waste_managed',        label: 'Hazardous waste (electrical bulbs, car batteries, dry cells etc.) managed adequately' },
          { key: 'hazardous_waste_practices',      label: 'Management practices', type: 'text', conditional: { key: 'hazardous_waste_managed', value: 'Yes' } },
          { key: 'plastic_waste_managed',          label: 'Plastic waste managed adequately' },
          { key: 'plastic_waste_practices',        label: 'Management practices', type: 'text', conditional: { key: 'plastic_waste_managed', value: 'Yes' } },
          { key: 'traffic_managed',                label: 'Traffic (congestion, on-street parking, accidents) managed adequately' },
          { key: 'traffic_practices',              label: 'Management practices', type: 'text', conditional: { key: 'traffic_managed', value: 'Yes' } },
          { key: 'ohs_impacts_managed',            label: 'Occupational health and safety impacts managed adequately' },
          { key: 'ohs_impacts_practices',          label: 'Management practices', type: 'text', conditional: { key: 'ohs_impacts_managed', value: 'Yes' } },
        ],
      },
      {
        title: 'Resource Efficiency & Emergency Response',
        items: [
          { key: 'water_mgmt_efficient',      label: 'Water management measures in place to reduce consumption' },
          { key: 'water_mgmt_measures',       label: 'Control measures and management options', type: 'text', conditional: { key: 'water_mgmt_efficient', value: 'Yes' } },
          { key: 'energy_mgmt_efficient',     label: 'Energy (fuel & electricity) management measures in place' },
          { key: 'energy_mgmt_measures',      label: 'Control measures and management options', type: 'text', conditional: { key: 'energy_mgmt_efficient', value: 'Yes' } },
          { key: 'waste_mgmt_efficient',      label: 'Waste management measures in place to reduce waste generation' },
          { key: 'waste_mgmt_measures',       label: 'Control measures and management options', type: 'text', conditional: { key: 'waste_mgmt_efficient', value: 'Yes' } },
          { key: 'equipment_mgmt_efficient',  label: 'Equipment and machine (e.g. forklift) management measures in place' },
          { key: 'equipment_mgmt_measures',   label: 'Control measures and management options', type: 'text', conditional: { key: 'equipment_mgmt_efficient', value: 'Yes' } },
          { key: 'fire_response',             label: 'Emergency response measures for Fire in place' },
          { key: 'fire_response_measures',    label: 'Control measures and management options', type: 'text', conditional: { key: 'fire_response', value: 'Yes' } },
          { key: 'chemical_oil_spill_response', label: 'Emergency response measures for Chemical and Oil Spill in place' },
          { key: 'chemical_oil_spill_measures', label: 'Control measures and management options', type: 'text', conditional: { key: 'chemical_oil_spill_response', value: 'Yes' } },
          { key: 'vehicular_accident_response', label: 'Emergency response measures for Vehicular Accidents in place' },
          { key: 'vehicular_accident_measures', label: 'Control measures and management options', type: 'text', conditional: { key: 'vehicular_accident_response', value: 'Yes' } },
          { key: 'flooding_response',         label: 'Emergency response measures for Flooding in place' },
          { key: 'flooding_response_measures',label: 'Control measures and management options', type: 'text', conditional: { key: 'flooding_response', value: 'Yes' } },
          { key: 'explosion_response',        label: 'Emergency response measures for Explosions in place' },
          { key: 'explosion_response_measures', label: 'Control measures and management options', type: 'text', conditional: { key: 'explosion_response', value: 'Yes' } },
        ],
      },
      {
        title: 'Environmental Monitoring',
        items: [
          { key: 'air_emissions_records',        label: 'Air emissions — records kept' },
          { key: 'air_emissions_details',        label: 'Parameters measured / quantity / frequency / storage, treatment and disposal', type: 'text', conditional: { key: 'air_emissions_records', value: 'Yes' } },
          { key: 'vehicular_accidents_records',  label: 'Vehicular accidents — records kept' },
          { key: 'vehicular_accidents_details',  label: 'Parameters measured / quantity / frequency / resolution', type: 'text', conditional: { key: 'vehicular_accidents_records', value: 'Yes' } },
          { key: 'solid_waste_mgmt_records',     label: 'Management of solid waste — records kept' },
          { key: 'solid_waste_mgmt_details',     label: 'Quantity measured / frequency / storage, treatment and disposal', type: 'text', conditional: { key: 'solid_waste_mgmt_records', value: 'Yes' } },
          { key: 'liquid_waste_records',         label: 'Liquid waste — records kept' },
          { key: 'liquid_waste_details',         label: 'Quantity measured / frequency / storage, treatment and disposal', type: 'text', conditional: { key: 'liquid_waste_records', value: 'Yes' } },
          { key: 'spills_leaks_records',         label: 'Spills and leaks, waste oil — records kept' },
          { key: 'spills_leaks_details',         label: 'Quantity measured / frequency / storage, treatment and disposal', type: 'text', conditional: { key: 'spills_leaks_records', value: 'Yes' } },
          { key: 'fire_incidence_records',       label: 'Fire incidence — records kept' },
          { key: 'fire_incidence_details',       label: 'Frequency / mode of resolution', type: 'text', conditional: { key: 'fire_incidence_records', value: 'Yes' } },
        ],
      },
      {
        title: 'Education & Training',
        items: [
          { key: 'training_env_mgmt',              label: 'Environmental Management training provided' },
          { key: 'training_env_mgmt_details',      label: 'Date of training / number trained / purpose', type: 'text', conditional: { key: 'training_env_mgmt', value: 'Yes' } },
          { key: 'training_firefighting',          label: 'Fire-fighting training provided' },
          { key: 'training_firefighting_details',  label: 'Date of training / number trained / purpose', type: 'text', conditional: { key: 'training_firefighting', value: 'Yes' } },
          { key: 'training_ohs',                   label: 'Occupational Health and Safety training provided' },
          { key: 'training_ohs_details',           label: 'Date of training / number trained / purpose', type: 'text', conditional: { key: 'training_ohs', value: 'Yes' } },
          { key: 'training_sops',                  label: 'Standard Operating Procedures (SOPs) training provided' },
          { key: 'training_sops_details',          label: 'Date of training / number trained / purpose', type: 'text', conditional: { key: 'training_sops', value: 'Yes' } },
          { key: 'training_materials_handling',    label: 'Raw Materials and Product Handling training provided' },
          { key: 'training_materials_handling_details', label: 'Date of training / number trained / purpose', type: 'text', conditional: { key: 'training_materials_handling', value: 'Yes' } },
          { key: 'training_spill_leaks',           label: 'Spill/Leaks Management training provided' },
          { key: 'training_spill_leaks_details',   label: 'Date of training / number trained / purpose', type: 'text', conditional: { key: 'training_spill_leaks', value: 'Yes' } },
        ],
      },
      {
        title: 'Corporate Social Responsibility & Complaints',
        items: [
          { key: 'csr_policy',                  label: 'Has a CSR policy or social development scheme' },
          { key: 'csr_activities',              label: 'Major CSR activities carried out within the past year', type: 'text', conditional: { key: 'csr_policy', value: 'Yes' } },
          { key: 'complaint_register',          label: 'Maintains a complaint register' },
          { key: 'complaint_procedure',         label: 'Has a procedure to deal with complaints from the public, regulators or staff' },
          { key: 'complaints_received',         label: 'Received any complaints in the last year' },
          { key: 'complaints_count',            label: 'If yes — how many', type: 'text', conditional: { key: 'complaints_received', value: 'Yes' } },
          { key: 'complaints_nature',           label: 'Nature of complaint(s)', type: 'text', conditional: { key: 'complaints_received', value: 'Yes' } },
          { key: 'complaints_resolution',       label: 'How the complaint(s) were dealt with', type: 'text', conditional: { key: 'complaints_received', value: 'Yes' } },
        ],
      },
      {
        title: 'Challenges & Improvement Measures',
        items: [
          { key: 'environmental_challenges', label: 'Major environmental challenges faced in operations in the past year', type: 'text' },
          { key: 'improvement_measures',     label: 'Planned environmental improvement measures, timelines and budget for the permit duration', type: 'text' },
        ],
      },
      {
        title: 'Attachments Checklist',
        items: [
          { key: 'attach_old_env_permit',   label: 'Old Environmental Permit attached' },
          { key: 'attach_fire_certificate', label: 'Fire Certificate attached' },
          { key: 'attach_photos',           label: 'Photographs of Facility attached' },
          { key: 'attach_company_reg_cert', label: 'Company Registration Certificate attached' },
          { key: 'attach_env_ohs_policy',   label: "Company's Policy on Environment/OHS attached" },
          { key: 'attach_csr_policy',       label: "Company's Policy on CSR attached" },
        ],
      },
    ],
  },

  // ── Agrochemical & Pesticide (PP) ─────────────────────────────
  // Source: EPA "CHECKLIST FOR INSPECTION OF PESTICIDES STORAGE/RETAIL PREMISES" (EPA/CCMC)
  PP: {
    label: 'Pesticides Checklist',
    extraFields: [
      { key: 'company_name',      label: 'Company Name',                 type: 'text' },
      { key: 'owner_of_company',  label: 'Owner of Company',             type: 'text' },
      { key: 'license_number',    label: 'License Number (if any)',      type: 'text' },
      { key: 'reference_number',  label: 'Reference Number',             type: 'text' },
      { key: 'num_employees',     label: 'Number of Persons Employed',   type: 'text' },
      { key: 'workers',           label: 'Worker Details',               type: 'workers', default: [] },
    ],
    // Written report that accompanies the checklist on new-facility inspections.
    // Source: EPA/CCMC "REPORT ON INSPECTION OF PESTICIDES STORAGE/RETAIL PREMISE".
    // Company Name, Reference Number and License Number (section 1.0) come from extraFields above.
    report: {
      title: 'Inspection Report',
      sections: [
        {
          title: '2.0 Storage/Premise Details',
          items: [
            { key: 'report_siting',            label: 'i. Siting of Premise',                   type: 'textarea' },
            { key: 'report_structure_area',    label: 'ii. Storage/Retail Structure and Area', type: 'textarea' },
            { key: 'report_storage_capacity',  label: 'iii. Storage Capacity',                 type: 'textarea' },
            { key: 'report_spillage',          label: 'iv. Spillage Containment',              type: 'textarea' },
            { key: 'report_ventilation_light', label: 'v. Ventilation and Light',              type: 'textarea' },
            { key: 'report_ehs',               label: 'vi. Environmental Health and Safety',   type: 'textarea' },
            { key: 'report_entrance_exit',     label: 'vii. Entrance and Exit',                type: 'textarea' },
            { key: 'report_disposal',          label: 'viii. Pesticides Disposal Options',     type: 'textarea' },
          ],
        },
        {
          title: '3.0 Recommendations',
          items: [
            { key: 'report_recommendations', label: 'Recommendations', type: 'textarea' },
          ],
        },
        {
          title: 'Inspection Sign-off',
          items: [
            { key: 'report_inspection_time', label: 'Time of Inspection',   type: 'time' },
            { key: 'report_rpo_name',        label: 'Checked by RPO — Name', type: 'text' },
            { key: 'report_rpo_date',        label: 'Checked by RPO — Date', type: 'date' },
          ],
        },
      ],
    },
    sections: [
      {
        title: 'Siting of Premise',
        items: [
          { key: 'sensitive_area_distance',        label: 'Located at least 10–15m from sensitive areas (playgrounds, watercourses, feedlots, animal shelters, schools, food market, flammable materials, explosives etc.)' },
          { key: 'flood_prone',                    label: 'Site subject/prone to flooding' },
          { key: 'runoff_contamination_risk',      label: 'Possibility of run-off from site contaminating surface or ground water' },
          { key: 'easy_access_delivery_firefighting', label: 'Easy access for pesticides delivery vehicles, fire fighting vehicles and equipment' },
        ],
      },
      {
        title: 'Storage/Retail Structure and Area',
        items: [
          { key: 'structure_metal',                label: 'Structure made of metal' },
          { key: 'structure_sandcrete',             label: 'Structure made of sandcrete' },
          { key: 'structure_wood',                  label: 'Structure made of wood' },
          { key: 'site_drainage_system',            label: 'Presence of drainage system to contain run-off' },
          { key: 'fireproof_childproof_burglarproof', label: 'Storage structure fireproof, child-proof, animal-proof and burglar-proof' },
          { key: 'floor_chemical_resistant',        label: 'Storage floor resistant to chemical attack' },
          { key: 'storekeeper_office_separate',     label: "Storekeeper's office separate from storage area" },
          { key: 'walls_smooth_crack_free',         label: 'Internal walls smooth and free from cracks to allow easy cleaning' },
          { key: 'washing_facilities',              label: 'Provision made for washing facilities' },
          { key: 'protective_clothing_masks',       label: 'Protective clothing and respiratory masks available' },
          { key: 'wooden_structure_bunding',        label: 'Where store is a wooden structure — concrete bunding present' },
          { key: 'gangways_1m',                     label: 'Store marked with 1-metre wide gangways between shelves/stacks for easy inspection and airflow' },
          { key: 'timber_brick_pallets',             label: 'Timber or brick used as pallets on floor' },
        ],
      },
      {
        title: 'Storage Capacity',
        items: [
          { key: 'storage_capacity_adequate',   label: 'Storage capacity adequate for easy access, movement and stacking of pesticides' },
          { key: 'need_move_containers',        label: 'Need to move containers to select pesticides' },
          { key: 'space_outdated_stock',        label: 'Sufficient space for storing out-of-date stocks' },
          { key: 'space_empty_containers',      label: 'Sufficient space for storing empty containers awaiting disposal' },
          { key: 'fifo_stock_rotation',         label: 'Stocks arranged to use the oldest first (first in first out) to prevent stocks from accumulating' },
        ],
      },
      {
        title: 'Spillage Containment',
        items: [
          { key: 'entrance_ramp',       label: 'Ramp at entrance to contain leakage/spills' },
          { key: 'absorbent_material',  label: 'Presence of absorbent material (sand, sawdust, activated charcoal, absorptive clay) for emergency spillage situations' },
          { key: 'floor_concrete_bunding', label: 'Floor concrete bunding available (if wooden structure)' },
        ],
      },
      {
        title: 'Ventilation & Light',
        items: [
          { key: 'building_ventilated',       label: 'Building well ventilated' },
          { key: 'stored_away_sunlight',      label: 'Pesticides stored away from direct sunlight' },
          { key: 'working_area_ventilated',   label: 'Working area for dispensing and repacking pesticides well ventilated and some distance from store entrance' },
          { key: 'store_illuminated',         label: 'Store well illuminated' },
        ],
      },
      {
        title: 'Environmental Health and Safety',
        items: [
          { key: 'firefighting_equipment',           label: 'Fire-fighting equipment (fire extinguisher, fire-proof blanket etc.) available' },
          { key: 'containers_minimize_handling',      label: 'Containers arranged to minimize handling to avoid mechanical damage' },
          { key: 'firefighting_equipment_positioned', label: 'Fire fighting and decontamination equipment positioned at strategic, well-lit points and clearly indicated' },
          { key: 'soap_water_available',              label: 'Soap and water readily available for washing' },
          { key: 'drum_spanners_funnels',             label: 'Drum spanners and metal funnels available' },
          { key: 'area_marked_warning_signs',         label: 'Area well marked and secured with weatherproof bright warning signs' },
          { key: 'no_smoking_eating_signs',           label: "'No Smoking', 'No Eating', 'No Drinking' signs inside and outside of stores" },
          { key: 'danger_warning_signs',              label: "Warning signs (e.g. 'Danger' and 'Keep off') adequate and visible" },
          { key: 'stock_cards',                       label: 'Stock cards available' },
          { key: 'containers_labelled',               label: 'Pesticide containers adequately and legibly labelled' },
          { key: 'container_labels_intact',           label: 'Container labels intact' },
          { key: 'ppe_available',                     label: 'Presence of personal protective equipment' },
          { key: 'first_aid_box',                     label: 'First Aid box available' },
        ],
      },
      {
        title: 'Entrance and Exit',
        items: [
          { key: 'direct_access_outside',       label: 'The premise has direct access to outside' },
          { key: 'sufficient_emergency_exits',  label: 'Sufficient emergency exits without passing through another room/building' },
          { key: 'doors_windows_secured',       label: 'Doors and windows have secured locks to prevent unauthorized entry' },
          { key: 'doors_open_outward',          label: 'All access doors open outward in the direction of escape' },
          { key: 'security_guard',              label: 'Presence of security guard' },
        ],
      },
      {
        title: 'Pesticides Disposal Options',
        items: [
          { key: 'pesticide_disposal_system', label: 'Existence of pesticide disposal system' },
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

SITE_VERIFICATION_CHECKLISTS.CA = SV_PLACEHOLDER('Agriculture')
SITE_VERIFICATION_CHECKLISTS.CM = SV_PLACEHOLDER('Mining')

/**
 * Flattens a sector checklist (extraFields + sections) into the same
 * { title, fields: [{ key, label }] } shape as SCREENING_FIELD_SECTIONS —
 * lets the task review UI render a commentable field list for Site
 * Verification / Pesticides Checklist submissions the same way it does for
 * Screening, without duplicating field definitions.
 */
export function checklistFieldSections(checklist, { includeReport = false } = {}) {
  const sections = []
  if (checklist.extraFields?.length) {
    sections.push({
      title: 'Facility Information',
      fields: checklist.extraFields.map((f) => ({
        key: f.key,
        label: f.label,
        ...(f.type === 'workers' ? { format: formatWorkers } : {}),
      })),
    })
  }
  for (const section of checklist.sections) {
    sections.push({ title: section.title, fields: section.items.map((i) => ({ key: i.key, label: i.label })) })
  }
  sections.push({ title: 'Notes', fields: [{ key: 'notes', label: 'General Comments & Recommendations' }] })
  if (includeReport && checklist.report) {
    for (const section of checklist.report.sections) {
      sections.push({
        title: `${checklist.report.title} — ${section.title}`,
        fields: section.items.map((i) => ({ key: i.key, label: i.label })),
      })
    }
  }
  return sections
}

// ── Worker details (type: 'workers') ─────────────────────────────

export const WORKER_SEX_OPTIONS = ['', 'Male', 'Female']
export const EMPTY_WORKER = { name: '', sex: '', age: '', position: '', qualification: '' }

function isBlankWorker(w) {
  return !w || Object.keys(EMPTY_WORKER).every((k) => !String(w[k] ?? '').trim())
}

/** Drops fully-empty rows and trims values before saving. */
export function cleanWorkers(list) {
  if (!Array.isArray(list)) return []
  return list
    .filter((w) => !isBlankWorker(w))
    .map((w) => Object.fromEntries(Object.keys(EMPTY_WORKER).map((k) => [k, String(w[k] ?? '').trim()])))
}

/** One line per worker — used where a list has to render as plain text. */
export function formatWorkers(list) {
  const rows = cleanWorkers(list)
  if (!rows.length) return '—'
  return rows.map((w, i) => {
    const bits = [w.sex, w.age && `${w.age} yrs`, w.position, w.qualification].filter(Boolean)
    return `${i + 1}. ${w.name || '(no name)'}${bits.length ? ` — ${bits.join(', ')}` : ''}`
  }).join('\n')
}

// ── Shared form helpers ──────────────────────────────────────────

/** All report field items, flattened. Empty when the checklist has no report. */
export function checklistReportItems(checklist) {
  return (checklist?.report?.sections ?? []).flatMap((s) => s.items)
}

/** Blank form state for a checklist (optionally including its written report). */
export function buildChecklistDefaults(checklist, { includeReport = false } = {}) {
  const defaults = {}
  if (!checklist) return defaults
  for (const section of checklist.sections) {
    for (const item of section.items) defaults[item.key] = item.default ?? ''
  }
  for (const field of checklist.extraFields ?? []) defaults[field.key] = field.default ?? ''
  if (includeReport) {
    for (const item of checklistReportItems(checklist)) defaults[item.key] = item.default ?? ''
  }
  return defaults
}

/** Copies checklist values from form state into a save payload. */
export function applyChecklistPayload(payload, checklist, data, { includeReport = false, isVisible = () => true } = {}) {
  for (const section of checklist.sections) {
    for (const item of section.items) {
      if (isVisible(item)) payload[item.key] = data[item.key] ?? ''
    }
  }
  for (const field of checklist.extraFields ?? []) {
    payload[field.key] = field.type === 'workers' ? cleanWorkers(data[field.key]) : (data[field.key] ?? '')
  }
  if (includeReport) {
    for (const item of checklistReportItems(checklist)) {
      payload[item.key] = typeof data[item.key] === 'string' ? data[item.key].trim() : (data[item.key] ?? '')
    }
  }
  return payload
}
