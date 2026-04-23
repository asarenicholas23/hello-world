/**
 * Parse a CSV string into headers + rows.
 * Handles quoted fields (including commas inside quotes).
 */
export function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n')
  if (lines.length < 2) return { headers: [], rows: [] }

  const headers = parseLine(lines[0]).map((h) => h.trim())
  const rows = lines.slice(1).filter(Boolean).map(parseLine)

  return { headers, rows }
}

function parseLine(line) {
  const result = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      // Escaped quote inside quoted field
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

/**
 * Auto-detect which CSV header maps to which facility field.
 * Returns { fieldKey: columnIndex } for matched columns.
 */
export function detectColumnMapping(headers) {
  const normalize = (s) => s.toLowerCase().replace(/[\s_\-\/\.]/g, '')

  const ALIASES = {
    file_number:         ['fileno', 'filenumber', 'filenum', 'filecode', 'facilityid'],
    name:                ['entityname', 'facilityname', 'nameofundertaking', 'undertakingname', 'name'],
    sector:              ['sector', 'industry', 'sectorname', 'sectortype'],
    type_of_undertaking: ['typeofundertaking', 'undertaking', 'businesstype', 'activitytype'],
    location:            ['location', 'physicallocation', 'addressdescription', 'sitelocation', 'area'],
    district:            ['district', 'districtcode', 'localitydistrict', 'mmda'],
    email:               ['emailaddress', 'email', 'mail'],
    entity_tin:          ['entitytin', 'tin', 'taxpayerid', 'taxid', 'taxidentification'],
    // phone before contact_person so "Contact No." matches phone not contact_person
    phone:               ['phonenumber', 'phone', 'telephone', 'telnumber', 'mobilenumber', 'contactnumber', 'contactno', 'tel', 'mobile'],
    contact_person:      ['contactperson', 'contactname', 'representative', 'contact'],
    designation:         ['designation', 'jobtitle', 'position', 'title', 'role'],
    address:             ['mailingaddress', 'postaladdress', 'pobox', 'address'],
    coordinates:         ['gpscoordinates', 'coordinates', 'cordinates', 'gpslocation', 'latlong', 'latlng', 'coords', 'gps'],
  }

  const mapping = {}
  headers.forEach((header, idx) => {
    const norm = normalize(header)
    for (const [field, aliases] of Object.entries(ALIASES)) {
      if (aliases.some((a) => norm === a || norm.includes(a))) {
        // Only assign if not yet mapped; if already mapped keep looking for this header's field
        if (!(field in mapping)) {
          mapping[field] = idx
          break  // header successfully assigned — stop
        }
        // field already taken — continue to next field to find another match
      }
    }
  })
  return mapping
}

/**
 * Auto-detect which CSV header maps to which permit field.
 */
export function detectPermitMapping(headers) {
  const normalize = (s) => s.toLowerCase().replace(/[\s_\-\/\.]/g, '')

  const ALIASES = {
    permit_id:       ['permid', 'permitid', 'id'],
    entity_name:     ['entityname', 'facilityname', 'nameofundertaking', 'undertakingname', 'name'],
    file_number:    ['fileno', 'filenumber', 'filenum', 'filecode', 'facilityid'],
    permit_number:  ['permitnumber', 'permitno', 'permit', 'eapermit', 'eano', 'licensenumber', 'licenseno'],
    issue_date:     ['issuedate', 'dateissued', 'dateofissue', 'dategranted', 'grantdate', 'issued'],
    effective_date: ['effectivedate', 'startdate', 'commencementdate', 'dateeffective', 'effective'],
    expiry_date:    ['expirydate', 'expirationdate', 'dateofexpiry', 'expiry', 'expiration', 'expires', 'validuntil', 'validto', 'duedate'],
    issue_location: ['issuelocation', 'placeofissue', 'issuedlocation', 'issuedby', 'office', 'issuingoffice'],
    permit_image_url: ['permitimage', 'permitimagelink', 'permitimageurl', 'permitlink', 'imageurl', 'drivelink', 'googledrivelink'],
    notes:          ['notes', 'remarks', 'comments', 'description', 'details'],
  }

  const mapping = {}
  headers.forEach((header, idx) => {
    const norm = normalize(header)
    for (const [field, aliases] of Object.entries(ALIASES)) {
      if (aliases.some((a) => norm === a || norm.includes(a))) {
        if (!(field in mapping)) {
          mapping[field] = idx
          break
        }
      }
    }
  })
  return mapping
}

/** Generate template CSV content for facilities. */
export function buildTemplateCSV() {
  const headers = [
    'file_number', 'name', 'sector', 'type_of_undertaking', 'location',
    'district', 'coordinates', 'email', 'entity_tin', 'contact_person',
    'designation', 'address', 'phone',
  ]
  const example = [
    'CI266',
    'Kumasi Plastic Industries Ltd',
    'Manufacturing',
    'Plastic Products Manufacturing',
    'Industrial Area, Suame, Kumasi',
    'AAC',
    '6.6885, -1.6244',
    'env@kumaplastic.gh',
    'C0012345678',
    'Yaw Owusu',
    'Plant Manager',
    'P.O. Box KS 500, Kumasi',
    '+233 322 041 100',
  ]
  return [headers.join(','), example.map((v) => `"${v}"`).join(',')].join('\n')
}

/** Generate template CSV content for permits. */
export function buildPermitTemplateCSV() {
  const headers = ['PermID', 'Entity Name', 'File No.', 'PERMIT NO.', 'Date of Issue', 'Effective Date', 'Date of Expiry', 'Place of Issue', 'Permit Image', 'Notes']
  const example = ['P-001', 'Kumasi Plastic Industries Ltd', 'CI266', 'EPA/ASH/KON/EA1/CI266/25/00266', '2025-01-15', '2025-02-01', '2028-01-31', 'Konongo', 'https://drive.google.com/file/d/example/view', '']
  return [headers.join(','), example.map((v) => `"${v}"`).join(',')].join('\n')
}
