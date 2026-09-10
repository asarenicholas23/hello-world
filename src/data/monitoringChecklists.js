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
      { key: 'location',             label: 'Location',                  type: 'text', autofill: 'location' },
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
      { key: 'location', label: 'Location', type: 'text', autofill: 'location' },
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

  // ── Health / Healthcare Facilities (CH) ──────────────────────
  // Official EPA form: "Health Environmental Monitoring and Inspection Checklist"
  CH: {
    label: 'Health',
    // `autofill` pulls the value from the facility profile when starting a new
    // visit (still editable). Inspecting officers are chosen in the
    // "Inspecting Officers" section, not typed here.
    extraFields: [
      { key: 'facility_name',            label: 'Name of Facility',          type: 'text',     autofill: 'name' },
      { key: 'location',                 label: 'Location',                  type: 'text',     autofill: 'location' },
      { key: 'municipality_district',    label: 'Municipality / District',   type: 'district', autofill: 'district' },
      { key: 'region',                   label: 'Region',                    type: 'readonly', default: 'Ashanti', autofill: 'region' },
      { key: 'epa_permit_number',        label: 'EPA Permit Number',         type: 'text',     autofill: 'permit_number' },
      { key: 'time_inspection',          label: 'Time of Inspection',        type: 'text' },
      { key: 'type_of_facility',         label: 'Type of Facility',          type: 'select', options: ['', 'Government Hospital', 'Private Hospital', 'Clinic', 'Specialist Hospital'] },
      { key: 'contact_person',           label: 'Contact Person',            type: 'text',     autofill: 'contact_person' },
      { key: 'contact_position',         label: 'Position',                  type: 'text',     autofill: 'designation' },
      { key: 'telephone',                label: 'Telephone Number',          type: 'text',     autofill: 'phone' },
      { key: 'number_of_beds',           label: 'Number of Beds',            type: 'text' },
      { key: 'average_daily_attendance', label: 'Average Daily Attendance',  type: 'text' },
    ],
    sections: [
      {
        title: 'A: Environmental Permit and Regulatory Compliance',
        items: [
          { key: 'a1_valid_epa_permit',           label: 'Valid EPA Environmental Permit available' },
          { key: 'a2_permit_conditions_complied', label: 'Permit conditions complied with' },
          { key: 'a3_environmental_records',       label: 'Environmental records maintained' },
          { key: 'a4_annual_report_submitted',    label: 'Annual Environmental Report submitted to EPA' },
          { key: 'a5_environmental_mgmt_plan',     label: 'Environmental Management Plan available' },
          { key: 'a6_healthcare_waste_plan',      label: 'Healthcare Waste Management Plan available' },
          { key: 'a7_environmental_officer',      label: 'Environmental officer/designate appointed' },
        ],
      },
      {
        title: 'B: Healthcare Waste Management',
        items: [
          { key: 'b1_colour_coded_bins',       label: 'Colour-coded bins available at all service points' },
          { key: 'b2_segregation_at_source',   label: 'Waste segregation practiced at source' },
          { key: 'b3_infectious_segregated',   label: 'Infectious waste properly segregated' },
          { key: 'b4_sharps_containers',       label: 'Sharps containers available and properly used' },
          { key: 'b5_bins_labelled',           label: 'Waste bins properly labelled' },
          { key: 'b6_temporary_storage',       label: 'Temporary waste storage facility available' },
          { key: 'b7_storage_secured',         label: 'Waste storage area secured against scavengers and pests' },
          { key: 'b8_collected_regularly',     label: 'Healthcare waste collected regularly' },
          { key: 'b9_transport_carts_covered', label: 'Waste transportation carts available and covered' },
          { key: 'b10_generation_records',     label: 'Waste generation records maintained' },
          { key: 'b11_licensed_contractor',    label: 'Licensed waste contractor engaged' },
          { key: 'b12_waste_manifests',        label: 'Waste manifests available for verification' },
        ],
      },
      {
        title: 'C: Incinerator and Air Emissions',
        items: [
          { key: 'c1_incinerator_available',       label: 'Incinerator available' },
          { key: 'c2_incinerator_operational',     label: 'Incinerator in good operational condition' },
          { key: 'c3_stack_height_adequate',       label: 'Incinerator stack height adequate' },
          { key: 'c4_no_excessive_smoke',          label: 'No excessive smoke emissions observed' },
          { key: 'c5_ash_disposal_managed',        label: 'Ash disposal properly managed' },
          { key: 'c6_incinerator_maint_records',   label: 'Incinerator maintenance records available' },
          { key: 'c7_generator_emissions_ok',      label: 'Generator emissions acceptable' },
          { key: 'c8_no_excessive_generator_noise',label: 'Excessive noise from generators absent' },
          { key: 'c9_no_offensive_odours',         label: 'Offensive odours absent' },
        ],
      },
      {
        title: 'D: Effluent and Wastewater Management',
        items: [
          { key: 'd1_connected_sewer_treatment',  label: 'Hospital connected to sewer or treatment facility' },
          { key: 'd2_wwtp_operational',           label: 'Wastewater treatment plant operational' },
          { key: 'd3_septic_biodigesters_ok',     label: 'Septic tanks/biodigesters functioning properly' },
          { key: 'd4_no_discharge_open_drains',   label: 'No wastewater discharge to open drains' },
          { key: 'd5_effluent_monitoring',        label: 'Effluent quality monitoring conducted' },
          { key: 'd6_drainage_free_blockages',    label: 'Drainage systems free from blockages' },
          { key: 'd7_no_stagnant_wastewater',     label: 'No stagnant wastewater observed' },
        ],
      },
      {
        title: 'E: Chemicals and Hazardous Materials Management',
        items: [
          { key: 'e1_chemicals_labelled',       label: 'Chemicals properly labelled' },
          { key: 'e2_msds_available',           label: 'Material Safety Data Sheets available' },
          { key: 'e3_chemical_storage_secured', label: 'Chemical storage area secured' },
          { key: 'e4_secondary_containment',    label: 'Secondary containment available' },
          { key: 'e5_spill_kits',               label: 'Spill kits available' },
          { key: 'e6_expired_chemicals_managed',label: 'Expired chemicals properly managed' },
          { key: 'e7_chemical_inventory',       label: 'Chemical inventory maintained' },
        ],
      },
      {
        title: 'F: Laboratory and Mortuary Operations',
        items: [
          { key: 'f1_lab_waste_managed',            label: 'Laboratory waste properly managed' },
          { key: 'f2_chemical_waste_segregated',    label: 'Chemical waste segregated and stored safely' },
          { key: 'f3_biological_specimens_disposed',label: 'Biological specimens disposed safely' },
          { key: 'f4_fume_hoods_operational',       label: 'Fume hoods operational' },
          { key: 'f5_mortuary_waste_managed',       label: 'Mortuary waste properly managed' },
          { key: 'f6_embalming_chemicals_stored',   label: 'Embalming chemicals stored safely' },
          { key: 'f7_mortuary_wastewater_managed',  label: 'Mortuary wastewater properly managed' },
        ],
      },
      {
        title: 'G: Occupational Health and Safety',
        items: [
          { key: 'g1_adequate_ppe',           label: 'Adequate PPE available' },
          { key: 'g2_staff_using_ppe',        label: 'Staff observed using PPE' },
          { key: 'g3_fire_extinguishers',     label: 'Fire extinguishers available and serviced' },
          { key: 'g4_fire_exits_marked',      label: 'Fire exits clearly marked' },
          { key: 'g5_emergency_response_plan',label: 'Emergency response plan available' },
          { key: 'g6_first_aid_kits',         label: 'First aid kits available' },
          { key: 'g7_incident_register',      label: 'Incident register maintained' },
          { key: 'g8_staff_trained_emergency',label: 'Staff trained in emergency response' },
        ],
      },
      {
        title: 'H: Water Supply and Sanitation',
        items: [
          { key: 'h1_potable_water',         label: 'Adequate potable water available' },
          { key: 'h2_water_storage_clean',   label: 'Water storage facilities clean' },
          { key: 'h3_water_quality_records', label: 'Water quality testing records available' },
          { key: 'h4_toilets_clean',         label: 'Toilets clean and functional' },
          { key: 'h5_handwashing_facilities',label: 'Handwashing facilities available' },
          { key: 'h6_soap_sanitizers',       label: 'Soap and sanitizers available' },
        ],
      },
      {
        title: 'I: General Environmental Sanitation',
        items: [
          { key: 'i1_compound_clean',           label: 'Compound clean and well maintained' },
          { key: 'i2_no_indiscriminate_dumping',label: 'No indiscriminate dumping observed' },
          { key: 'i3_adequate_waste_bins',      label: 'Adequate number of waste bins provided' },
          { key: 'i4_vegetation_maintained',    label: 'Vegetation properly maintained' },
          { key: 'i5_vector_pest_control',      label: 'Vector and pest control programme in place' },
          { key: 'i6_no_stagnant_water',        label: 'No stagnant water observed' },
        ],
      },
    ],
  },

  // ── Agrochemical & Pesticide (PP) ────────────────────────────
  PP: {
    label: 'Agrochemical & Pesticide',
    extraFields: [
      { key: 'owner_name',     label: 'Owner of Company',    type: 'text' },
      { key: 'contact_person', label: 'Contact Person',      type: 'text',     autofill: 'contact_person' },
      { key: 'position',       label: 'Position',            type: 'text',     autofill: 'designation' },
      { key: 'location',       label: 'Location of Premise', type: 'text',     autofill: 'location' },
      { key: 'postal_address', label: 'Postal Address',      type: 'text',     autofill: 'address' },
      { key: 'license_number', label: 'License Number',      type: 'text' },
      { key: 'coordinates',    label: 'Coordinates',         type: 'text' },
      { key: 'town',           label: 'Town',                type: 'text' },
      { key: 'district',       label: 'District',            type: 'district', autofill: 'district' },
      { key: 'tel',            label: 'Tel',                 type: 'text',     autofill: 'phone' },
      { key: 'email',          label: 'Email',               type: 'text',     autofill: 'email' },
    ],
    sections: [
      {
        title: 'Reporting & Training',
        items: [
          { key: 'annual_report_submitted', label: 'Pesticides annual report submitted for previous calendar year?' },
          { key: 'training_received',       label: 'Training organized and/or approved by the Authority received?' },
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
MONITORING_CHECKLISTS.CA = PLACEHOLDER('Agriculture')
MONITORING_CHECKLISTS.CM = PLACEHOLDER('Mining')

// ── Inspection Summary scoring ───────────────────────────────
// Compliance Rate = compliant items ÷ applicable items, where an applicable
// item is one marked 'Yes' or 'No' ('N/A' and blank are excluded). The rate
// maps to a band using the thresholds below.
export const COMPLIANCE_BANDS = [
  { label: 'Excellent', min: 80, color: '#15803d' },
  { label: 'Good',      min: 60, color: '#4d7c0f' },
  { label: 'Fair',      min: 40, color: '#b45309' },
  { label: 'Poor',      min: 0,  color: '#b91c1c' },
]

export function complianceBand(rate) {
  if (rate == null || Number.isNaN(rate)) return null
  return COMPLIANCE_BANDS.find((b) => rate >= b.min) ?? COMPLIANCE_BANDS[COMPLIANCE_BANDS.length - 1]
}

/**
 * Tally Yes/No checklist answers across a checklist's sections.
 * @param checklist  a MONITORING_CHECKLISTS entry
 * @param data       flat map of item key -> answer
 * @param isVisible  optional (item) => bool to skip hidden conditional rows
 * @returns { applicable, compliant, rate, band }
 */
export function computeCompliance(checklist, data, isVisible = () => true) {
  let applicable = 0
  let compliant = 0
  for (const section of checklist?.sections ?? []) {
    for (const item of section.items) {
      if (item.type === 'text' || item.type === 'select' || item.conditional) continue
      if (!isVisible(item)) continue
      const v = data?.[item.key]
      if (v === 'Yes') { applicable++; compliant++ }
      else if (v === 'No') { applicable++ }
    }
  }
  const rate = applicable > 0 ? Math.round((compliant / applicable) * 100) : null
  return { applicable, compliant, rate, band: complianceBand(rate) }
}
