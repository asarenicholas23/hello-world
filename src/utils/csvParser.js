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
  const normalize = (s) => s.toLowerCase().replace(/[\s_\-\/]/g, '')

  const ALIASES = {
    name:                ['name', 'facilityname', 'nameofundertaking', 'undertakingname', 'entityname'],
    sector:              ['sector', 'industry', 'sectorname', 'sectortype'],
    type_of_undertaking: ['typeofundertaking', 'type', 'undertaking', 'businesstype', 'activitytype'],
    location:            ['location', 'physicallocation', 'addressdescription', 'sitelocation', 'area'],
    district:            ['district', 'districtcode', 'localitydistrict'],
    email:               ['email', 'emailaddress', 'mail'],
    entity_tin:          ['tin', 'entitytin', 'taxpayerid', 'taxid', 'taxidentification'],
    contact_person:      ['contactperson', 'contact', 'contactname', 'representative'],
    designation:         ['designation', 'title', 'position', 'jobtitle', 'role'],
    address:             ['address', 'mailingaddress', 'postaladdress', 'pobox'],
    phone:               ['phone', 'telephone', 'tel', 'phonenumber', 'mobile'],
  }

  const mapping = {}
  headers.forEach((header, idx) => {
    const norm = normalize(header)
    for (const [field, aliases] of Object.entries(ALIASES)) {
      if (aliases.some((a) => norm === a || norm.includes(a))) {
        if (!(field in mapping)) mapping[field] = idx
        break
      }
    }
  })
  return mapping
}

/** Generate template CSV content for facilities. */
export function buildTemplateCSV() {
  const headers = [
    'name', 'sector', 'type_of_undertaking', 'location',
    'district', 'email', 'entity_tin', 'contact_person',
    'designation', 'address', 'phone',
  ]
  const example = [
    'Kumasi Plastic Industries Ltd',
    'Manufacturing',
    'Plastic Products Manufacturing',
    'Industrial Area, Suame, Kumasi',
    'KMA',
    'env@kumaplastic.gh',
    'C0012345678',
    'Yaw Owusu',
    'Plant Manager',
    'P.O. Box KS 500, Kumasi',
    '+233 322 041 100',
  ]
  return [headers.join(','), example.map((v) => `"${v}"`).join(',')].join('\n')
}
