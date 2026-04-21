// Sector-specific monitoring checklists
// item type defaults to 'yesno_na' (Yes / No / N/A)
// other types: 'text', 'select', 'district'
// conditional: { key, value } — only show item when another field equals that value

export const CHECKLIST_OPTIONS = ['', 'Yes', 'No', 'N/A']

export const MONITORING_CHECKLISTS = {

  // ── Manufacturing (CU) ───────────────────────────────────────
  CU: {
    label: 'Manufacturing',
    extraFields: [
      { key: 'production_capacity', label: 'Production Capacity', type: 'text' },
    ],
    sections: [
      {
        title: 'Permits & Compliance',
        items: [
          { key: 'valid_ep_epa',            label: 'Valid Environmental Permit issued by EPA' },
          { key: 'valid_ep_fda',            label: 'Valid Environmental Permit issued by Food and Drugs Authority' },
          { key: 'valid_ep_gnfs',           label: 'Valid Environmental Permit issued by Ghana National Fire Service' },
          { key: 'permit_displayed',        label: 'Permit displayed in a visible location' },
          { key: 'aer_submitted',           label: 'Annual Environmental Report (AER) submitted to EPA' },
          { key: 'operates_within_scope',   label: 'Facility operates within scope of permit (no unauthorized expansion/modifications)' },
        ],
      },
      {
        title: 'Water Management',
        items: [
          { key: 'water_abstraction_metered',  label: 'Abstraction of water is metered and recorded' },
          { key: 'water_abstraction_permit',   label: 'Water source has a valid abstraction permit (from WRC, if applicable)' },
          { key: 'water_quality_gsa',          label: 'Raw and treated water quality meets GSA standards (GS 220:2014)' },
          { key: 'lab_analysis_conducted',     label: 'Laboratory analysis of water (physical, chemical, bacteriological) regularly conducted' },
          { key: 'wastewater_contained',       label: 'Wastewater from washing and production contained; not discharged into open drains' },
          { key: 'effluent_treated',           label: 'Effluent is treated or properly managed (e.g. soak-away/septic tank)' },
          { key: 'effluent_monitoring_reports',label: 'Effluent monitoring reports available (as required under GS 1212:2019)' },
        ],
      },
      {
        title: 'Waste Management',
        items: [
          { key: 'waste_segregated',        label: 'Waste is properly segregated (plastics, paper, organic, etc.)' },
          { key: 'bins_labeled_covered',    label: 'Waste bins are labeled and covered' },
          { key: 'plastic_waste_recycled',  label: 'Plastic waste (cuttings, defective sachets) collected for recycling or reuse' },
        ],
      },
      {
        title: 'Air Quality & Noise',
        items: [
          { key: 'generator_emissions_monitored', label: 'Standby generator emissions monitored (TPM, NOx, SO2, CO)' },
          { key: 'generator_maintained',          label: 'Generator properly maintained and fitted with mufflers' },
          { key: 'fuel_storage_no_leaks',         label: 'Fuel handling and storage areas free of leaks/spills' },
          { key: 'energy_consumption_recorded',   label: 'Electricity and diesel consumption recorded' },
          { key: 'noise_within_limits',           label: 'Ambient noise levels within EPA/GSA limits (GS 1222:2018)' },
          { key: 'noise_reduction_measures',      label: 'Measures taken to reduce noise from machinery and generator' },
          { key: 'no_nuisance_to_community',      label: 'No nuisance (noise, odour, discharge) to surrounding communities' },
        ],
      },
      {
        title: 'Chemical Management',
        items: [
          { key: 'chemicals_safely_stored',    label: 'Water treatment chemicals (e.g. chlorine) safely stored and labeled' },
          { key: 'sds_available',              label: 'Safety Data Sheets (SDS) available for all chemicals' },
          { key: 'chemicals_trained_personnel',label: 'Chemicals handled by trained personnel only' },
        ],
      },
      {
        title: 'Health, Safety & Worker Welfare',
        items: [
          { key: 'workers_use_ppe',          label: 'Workers have and use PPE (gloves, masks, boots, etc.)' },
          { key: 'first_aid_available',      label: 'First aid kit available and stocked' },
          { key: 'fire_extinguishers',       label: 'Fire extinguishers available and inspected regularly' },
          { key: 'emergency_exits_marked',   label: 'Emergency exits and signage clearly marked' },
          { key: 'incident_records',         label: 'Incident and accident records maintained' },
          { key: 'health_screening_workers', label: 'Health screening conducted for workers' },
        ],
      },
      {
        title: 'Community Engagement',
        items: [
          { key: 'grm_in_place',             label: 'Grievance redress mechanism (GRM) in place' },
          { key: 'complaints_records',       label: 'Records of complaints and resolutions maintained' },
          { key: 'community_engagement',     label: 'Facility engages with surrounding community (especially during disruptions)' },
        ],
      },
      {
        title: 'Reporting & Records',
        items: [
          { key: 'env_monitoring_reports',           label: 'Environmental monitoring reports (air, noise, effluent) available' },
          { key: 'monthly_waste_records',            label: 'Monthly waste records (quantities, disposal methods) maintained' },
          { key: 'emr_submitted_annually',           label: 'EMR submitted annually to EPA (before due date)' },
          { key: 'all_permit_conditions_met',        label: 'All EPA permit conditions are being met' },
          { key: 'previous_recommendations_addressed',label: 'Recommendations from previous monitoring exercise have been addressed' },
          { key: 'no_illegal_discharge',             label: 'No illegal discharge or environmentally harmful practices observed' },
        ],
      },
    ],
  },

  // ── Energy / Fuel Stations (CE) ──────────────────────────────
  CE: {
    label: 'Energy',
    extraFields: [
      { key: 'location',             label: 'Location',                  type: 'text' },
      { key: 'tank_capacity_petrol', label: 'Tank Capacity — Petrol',    type: 'text' },
      { key: 'tank_capacity_diesel', label: 'Tank Capacity — Diesel',    type: 'text' },
    ],
    sections: [
      {
        title: 'Permits & Compliance',
        items: [
          { key: 'valid_ep_issued',         label: 'Valid Environmental Permit issued' },
          { key: 'permit_displayed',        label: 'Permit displayed at the station' },
          { key: 'valid_fire_certificate',  label: 'Valid Fire Certificate (from GNFS) available' },
          { key: 'valid_bop',               label: 'Valid Business Operating Permit (from MMDs)' },
          { key: 'emr_submitted',           label: 'Annual Environmental Report (EMR) submitted to EPA' },
          { key: 'staff_trained_env_safety',label: 'Staff trained in environmental and safety management' },
        ],
      },
      {
        title: 'Underground Storage Tanks (USTs)',
        items: [
          { key: 'ust_double_walled',       label: 'USTs are double-walled and tested for leakage' },
          { key: 'leak_detection_system',   label: 'Leak detection system in place (ATG, SIR, or manual dip checks)' },
          { key: 'dispensers_checked',      label: 'Dispensers and pipelines regularly checked for leaks' },
          { key: 'spill_buckets_available', label: 'Spill buckets and overfill protection available and functional' },
          { key: 'tank_calibration_records',label: 'Records of tank calibration, fuel stock and deliveries kept' },
        ],
      },
      {
        title: 'Spill Management',
        items: [
          { key: 'spill_kits_available',       label: 'Spill control kits available and accessible' },
          { key: 'staff_trained_spill',        label: 'Staff trained on spill response' },
          { key: 'previous_spills_documented', label: 'Previous spills documented and cleaned up appropriately' },
          { key: 'fuel_delivery_bunded',       label: 'Fuel delivery area is bunded/sloped to contain spills' },
          { key: 'no_oil_stains_runoff',       label: 'No visible oil stains or hydrocarbon runoff to storm drains' },
        ],
      },
      {
        title: 'Wastewater & Effluent',
        items: [
          { key: 'washbay_effluent_contained', label: 'Effluent from wash bays or runoff is tested or contained' },
          { key: 'oil_interceptors_installed', label: 'Oil interceptors installed and maintained' },
          { key: 'no_oily_discharge',          label: 'No discharge of oily water to public drains' },
        ],
      },
      {
        title: 'Waste Management',
        items: [
          { key: 'waste_bins_segregated',    label: 'Waste bins provided and segregated (hazardous/non-hazardous)' },
          { key: 'waste_oils_stored',        label: 'Waste oils and lubricants stored in proper containers' },
          { key: 'used_oil_licensed',        label: 'Used oil collected and disposed by EPA-licensed contractors' },
          { key: 'no_open_burning',          label: 'No open burning or illegal dumping of waste' },
        ],
      },
      {
        title: 'Air Quality',
        items: [
          { key: 'vapour_recovery_installed',label: 'Vapour recovery system (VRS) installed for pumps (if required)' },
          { key: 'no_strong_fuel_odour',     label: 'No strong fuel odour around pumps and tanks' },
        ],
      },
    ],
  },

  // ── Hospitality (CT) ─────────────────────────────────────────
  CT: {
    label: 'Hospitality',
    extraFields: [
      { key: 'location', label: 'Location', type: 'text' },
    ],
    sections: [
      {
        title: 'Permits & Compliance',
        items: [
          { key: 'valid_ep',              label: 'Valid Environmental Permit from the EPA' },
          { key: 'permit_displayed',      label: 'Permit displayed in a visible location on the premises' },
          { key: 'aer_submitted',         label: 'Annual Environmental Report (AER/EMR-HF) submitted to EPA' },
          { key: 'operating_within_scope',label: 'Facility operating within approved scope (no expansion without notice)' },
          { key: 'env_records_maintained',label: 'Environmental records (waste logs, emissions monitoring) maintained and accessible' },
          { key: 'staff_trained',         label: 'Staff trained and aware of permit conditions and environmental responsibilities' },
        ],
      },
      {
        title: 'Air Quality & Noise',
        items: [
          { key: 'generator_on_site',           label: 'Standby generator on site' },
          { key: 'generator_emissions_monitored',label: 'Air emissions from generator monitored (TPM, NOx, SO2, CO)' },
          { key: 'valid_air_emissions_report',  label: 'Valid air emissions monitoring report (within 12 months)' },
          { key: 'generator_maintained',        label: 'Generator well maintained and fitted with silencers/mufflers' },
          { key: 'noise_monitoring_conducted',  label: 'Ambient noise monitoring conducted (LAeq, LAmax, etc.)' },
          { key: 'noise_within_limits',         label: 'Noise levels within EPA/GSA limits (55 dB(A) day, 48 dB(A) night)' },
          { key: 'noise_control_measures',      label: 'Noise control measures in place' },
        ],
      },
      {
        title: 'Waste Management',
        items: [
          { key: 'waste_segregated',       label: 'Waste properly segregated (plastic, paper, organic, hazardous)' },
          { key: 'color_coded_bins',       label: 'Colour-coded and clearly labelled bins in all key areas' },
          { key: 'approved_waste_provider',label: 'Waste collected by an approved waste service provider' },
          { key: 'hazardous_waste_managed',label: 'Hazardous waste (batteries, bulbs) properly stored and managed' },
        ],
      },
      {
        title: 'Wastewater & Effluent',
        items: [
          { key: 'septic_offsite',          label: 'Off-site septic tank or sewer system in place' },
          { key: 'desludging_documented',   label: 'Desludging of septic tanks done periodically (documented)' },
          { key: 'effluent_meets_standards',label: 'Effluent meets discharge standards (GS 1212:2029)' },
          { key: 'no_illegal_discharge',    label: 'No signs of illegal discharge or leaks around the property' },
          { key: 'oil_spills_controlled',   label: 'Oil/fuel spills controlled and managed properly' },
          { key: 'waste_oil_licensed',      label: 'Waste oil sent to licensed waste oil handlers' },
          { key: 'spill_kits_trained',      label: 'Spill kits available and staff trained on their use' },
        ],
      },
      {
        title: 'Fire Safety & Emergency',
        items: [
          { key: 'valid_fire_certificate',  label: 'Facility has a valid Fire Certificate' },
          { key: 'fire_extinguishers',      label: 'Fire extinguishers available, labeled and serviced' },
          { key: 'emergency_exits_marked',  label: 'Emergency exits clearly marked and unobstructed' },
          { key: 'fire_safety_training',    label: 'Emergency drills and fire safety training conducted' },
          { key: 'lpg_storage_compliant',   label: 'LPG storage area compliant (15m from ignition, leak checks)' },
          { key: 'adequate_car_park',       label: 'Facility has adequate car park' },
        ],
      },
      {
        title: 'Health, Safety & Worker Welfare',
        items: [
          { key: 'workers_ppe',           label: 'Workers provided with PPE (gloves, masks, boots, etc.)' },
          { key: 'first_aid_available',   label: 'Stocked first aid kit available on site' },
          { key: 'safety_signs_posted',   label: 'Safety signs posted in hazardous or high-risk areas' },
          { key: 'incident_records',      label: 'Record of injuries, incidents or near misses maintained' },
          { key: 'fumigation_licensed',   label: 'Fumigation conducted by licensed pest control companies' },
          { key: 'sds_available',         label: 'Safety Data Sheets (SDS) available for all chemicals used' },
          { key: 'fumigation_certificates',label: 'Fumigation certificates and licenses available for review' },
        ],
      },
      {
        title: 'Resource Efficiency',
        items: [
          { key: 'energy_saving_measures',    label: 'Energy-saving measures implemented (LEDs, timers)' },
          { key: 'water_saving_devices',      label: 'Water-saving devices in place (low-flow taps, dual flush)' },
          { key: 'reduce_single_use_plastics',label: 'Policy or initiative to reduce single-use plastics' },
          { key: 'organic_waste_composted',   label: 'Organic food waste used for compost or animal feed' },
        ],
      },
      {
        title: 'Community & Overall Compliance',
        items: [
          { key: 'grm_in_place',                   label: 'Grievance redress mechanism (GRM) in place' },
          { key: 'community_complaints_records',   label: 'Records of community complaints and resolutions maintained' },
          { key: 'neighbors_informed',             label: 'Neighbours informed before fumigation or other disruptive activities' },
          { key: 'full_permit_compliance',         label: 'Facility in full compliance with all permit conditions' },
          { key: 'no_breaches_reported',           label: 'No breaches or violations reported to EPA' },
          { key: 'previous_recommendations_addressed',label: 'Recommendations from last monitoring have been addressed' },
        ],
      },
    ],
  },

  // ── Agrochemical & Pesticide (PP) ────────────────────────────
  PP: {
    label: 'Agrochemical & Pesticide',
    extraFields: [
      { key: 'owner_name',     label: 'Owner of Company',    type: 'text' },
      { key: 'contact_person', label: 'Contact Person',      type: 'text' },
      { key: 'position',       label: 'Position',            type: 'text' },
      { key: 'location',       label: 'Location of Premise', type: 'text' },
      { key: 'postal_address', label: 'Postal Address',      type: 'text' },
      { key: 'license_number', label: 'License Number',      type: 'text' },
      { key: 'coordinates',    label: 'Coordinates',         type: 'text' },
      { key: 'town',           label: 'Town',                type: 'text' },
      { key: 'district',       label: 'District',            type: 'district' },
      { key: 'tel',            label: 'Tel',                 type: 'text' },
      { key: 'email',          label: 'Email',               type: 'text' },
    ],
    sections: [
      {
        title: 'Reporting & Training',
        items: [
          { key: 'annual_report_submitted', label: 'Pesticides annual report submitted for previous calendar year?' },
          { key: 'training_received',       label: 'Training organized and/or approved by the Agency received?' },
          { key: 'training_evidence',       label: 'If yes — provide evidence of training', type: 'text', conditional: { key: 'training_received', value: 'Yes' } },
          { key: 'last_training_info',      label: 'If yes — when was last training and who organized it?', type: 'text', conditional: { key: 'training_received', value: 'Yes' } },
        ],
      },
      {
        title: 'Storage & Safety',
        items: [
          { key: 'fifo_stock',              label: 'Stocks arranged FIFO (oldest first) to prevent accumulation?' },
          { key: 'timber_brick_pallets',    label: 'Timber or brick used as pallets on floor?' },
          { key: 'fire_extinguisher',       label: 'Fire extinguisher provided?' },
          { key: 'fire_extinguisher_positioned', label: 'Fire extinguisher at strategic, well-lit and clearly indicated points?' },
          { key: 'ramp_at_entrance',        label: 'Ramp at entrance to contain leakage/spills?' },
        ],
      },
      {
        title: 'Hygiene & Sanitation',
        items: [
          { key: 'soap_water_available',    label: 'Soap and water readily available for hand washing?' },
          { key: 'handwash_water_type',     label: 'Water used for hand washing is', type: 'select', options: ['', 'Running', 'Stagnant'] },
          { key: 'stagnant_disposal_freq',  label: 'If stagnant — how often is water disposed?', type: 'text', conditional: { key: 'handwash_water_type', value: 'Stagnant' } },
        ],
      },
      {
        title: 'Facility Conditions',
        items: [
          { key: 'proper_ventilation',   label: 'Proper ventilation in place?' },
          { key: 'store_illuminated',    label: 'Store well illuminated?' },
          { key: 'ppe_provided',         label: 'Gloves and nose masks provided for employees?' },
        ],
      },
    ],
  },
}

// Sectors without a provided checklist yet — basic placeholder
const PLACEHOLDER = (label) => ({
  label,
  extraFields: [],
  sections: [
    {
      title: 'General Compliance',
      items: [
        { key: 'valid_ep',            label: 'Valid Environmental Permit issued by EPA' },
        { key: 'permit_displayed',    label: 'Permit displayed in visible location' },
        { key: 'aer_submitted',       label: 'Annual Environmental Report submitted' },
        { key: 'no_illegal_discharge',label: 'No illegal discharge or harmful practices observed' },
      ],
    },
  ],
})

MONITORING_CHECKLISTS.CI = PLACEHOLDER('Infrastructure')
MONITORING_CHECKLISTS.CH = PLACEHOLDER('Health')
MONITORING_CHECKLISTS.CA = PLACEHOLDER('Agriculture')
MONITORING_CHECKLISTS.CM = PLACEHOLDER('Mining')
