import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Upload, Download, CheckCircle, XCircle,
  AlertCircle, Loader, ChevronRight, Building2, FileText,
} from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { useAuth } from '../context/AuthContext'
import { createFacility, createFacilityWithId, listFacilities } from '../firebase/facilities'
import { createSubRecord } from '../firebase/subrecords'
import { SECTORS, DISTRICTS } from '../data/constants'
import {
  parseCSV,
  detectColumnMapping, buildTemplateCSV,
  detectPermitMapping, buildPermitTemplateCSV,
} from '../utils/csvParser'
import { normalizeAttachmentUrl } from '../utils/attachments'

// ── Shared helpers ─────────────────────────────────────────────────────

function matchSector(value) {
  if (!value) return null
  const v = value.trim().toUpperCase()
  return (
    SECTORS.find((s) => s.prefix === v) ??
    SECTORS.find((s) => s.name.toUpperCase() === v) ??
    SECTORS.find((s) => s.name.toUpperCase().includes(v) || v.includes(s.prefix))
  )
}

function matchDistrict(value) {
  if (!value) return ''
  const v = value.trim().toUpperCase()
  return (
    DISTRICTS.find((d) => d.code === v)?.code ??
    DISTRICTS.find((d) => d.name.toUpperCase() === v)?.code ??
    DISTRICTS.find((d) => d.name.toUpperCase().includes(v))?.code ??
    value.trim()
  )
}

function parseCoordinates(value) {
  if (!value) return null
  const parts = value.split(/[\s,\/]+/).map(Number).filter((n) => !isNaN(n))
  if (parts.length === 2) return { lat: parts[0], lng: parts[1] }
  return null
}

// Parse flexible date strings from spreadsheets into Firestore Timestamp
function parseDateStr(raw) {
  if (!raw) return null
  const s = raw.trim()
  if (!s) return null

  // Try ISO first (YYYY-MM-DD or YYYY-MM-DDTHH:...)
  // Then DD/MM/YYYY, DD-MM-YYYY
  // Then "06 Feb 2026" / "Feb 06 2026"
  const iso = new Date(s)
  if (!isNaN(iso)) return Timestamp.fromDate(iso)

  // MM/DD/YYYY, DD/MM/YYYY, MM-DD-YYYY, DD-MM-YYYY
  const slashDate = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (slashDate) {
    const a = Number(slashDate[1])
    const b = Number(slashDate[2])
    const year = Number(slashDate[3])

    // If the first number cannot be a month, treat as DD/MM/YYYY.
    // Otherwise default to MM/DD/YYYY because that's the import format the office uses.
    const month = a > 12 ? b : a
    const day = a > 12 ? a : b
    const d = new Date(year, month - 1, day)
    if (!isNaN(d) && d.getMonth() === month - 1 && d.getDate() === day) {
      return Timestamp.fromDate(d)
    }
  }

  return null
}

const FILE_NUMBER_RE = /^[A-Z]{2,}[A-Z0-9\/\:\.\-]+$/i

// ── Facility helpers ───────────────────────────────────────────────────

function rowToFacility(row, mapping) {
  const get = (field) => (mapping[field] != null ? (row[mapping[field]] ?? '').trim() : '')
  const sectorRaw = get('sector')
  const sector = matchSector(sectorRaw)
  return {
    file_number:         get('file_number').replace(/\s+/g, '') || null,
    name:                get('name'),
    sector:              sector?.name ?? sectorRaw,
    sector_prefix:       sector?.prefix ?? '',
    type_of_undertaking: get('type_of_undertaking'),
    location:            get('location'),
    district:            matchDistrict(get('district')),
    email:               get('email'),
    entity_tin:          get('entity_tin'),
    contact_person:      get('contact_person'),
    designation:         get('designation'),
    address:             get('address'),
    phone:               get('phone'),
    coordinates:         parseCoordinates(get('coordinates')),
  }
}

function validateFacility(f) {
  const errors = []
  if (!f.name)          errors.push('Name is required')
  if (!f.sector_prefix) errors.push(`Unknown sector "${f.sector}" — use sector name or prefix (e.g. Manufacturing or CU)`)
  if (f.file_number && !FILE_NUMBER_RE.test(f.file_number))
    errors.push(`Invalid file number "${f.file_number}"`)
  return errors
}

function warnFacility(f) {
  const warnings = []
  if (!f.location) warnings.push('No location')
  if (!f.district) warnings.push('No district')
  return warnings
}

// ── Permit helpers ─────────────────────────────────────────────────────

function rowToPermit(row, mapping) {
  const get = (field) => (mapping[field] != null ? (row[mapping[field]] ?? '').trim() : '')
  return {
    permit_id:      get('permit_id'),
    entity_name:    get('entity_name'),
    file_number:    get('file_number').replace(/\s+/g, ''),
    permit_number:  get('permit_number'),
    issue_date:     parseDateStr(get('issue_date')),
    effective_date: parseDateStr(get('effective_date')),
    expiry_date:    parseDateStr(get('expiry_date')),
    issue_location: get('issue_location'),
    permit_image_url: normalizeAttachmentUrl(get('permit_image_url')),
    notes:          get('notes'),
    // display helpers for preview
    _entity_name_raw:    get('entity_name'),
    _issue_date_raw:     get('issue_date'),
    _effective_date_raw: get('effective_date'),
    _expiry_date_raw:    get('expiry_date'),
  }
}

function validatePermit(p) {
  const errors = []
  if (!p.file_number)   errors.push('File number is required (to link permit to a facility)')
  if (!p.permit_number) errors.push('Permit number is required')
  if (p._issue_date_raw && !p.issue_date) {
    errors.push(`Cannot parse issue date "${p._issue_date_raw}"`)
  }
  if (p._effective_date_raw && !p.effective_date) {
    errors.push(`Cannot parse effective date "${p._effective_date_raw}"`)
  }
  if (p._expiry_date_raw && !p.expiry_date) {
    errors.push(`Cannot parse expiry date "${p._expiry_date_raw}"`)
  }
  return errors
}

// ── Component ──────────────────────────────────────────────────────────

const STAGES = { idle: 'idle', preview: 'preview', importing: 'importing', done: 'done' }

export default function ImportPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const fileInputRef = useRef()

  const [importType, setImportType] = useState('facilities') // 'facilities' | 'permits'
  const [stage, setStage]           = useState(STAGES.idle)
  const [dragOver, setDragOver]     = useState(false)
  const [parseError, setParseError] = useState('')

  const [headers, setHeaders]   = useState([])
  const [mapping, setMapping]   = useState({})
  const [records, setRecords]   = useState([])
  const [existingFacilitiesById, setExistingFacilitiesById] = useState(new Map())
  const [facilityLinkLoading, setFacilityLinkLoading] = useState(false)

  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [results, setResults]   = useState([])

  function reset() {
    setStage(STAGES.idle)
    setHeaders([])
    setMapping({})
    setRecords([])
    setResults([])
    setParseError('')
  }

  useEffect(() => {
    if (importType !== 'permits') return

    let cancelled = false
    setFacilityLinkLoading(true)

    listFacilities()
      .then((rows) => {
        if (cancelled) return
        setExistingFacilitiesById(new Map(
          rows
            .map((f) => [String(f.file_number ?? '').trim(), String(f.name ?? '').trim()])
            .filter(([fileNumber]) => fileNumber)
        ))
      })
      .catch(() => {
        if (cancelled) return
        setExistingFacilitiesById(new Map())
      })
      .finally(() => {
        if (!cancelled) setFacilityLinkLoading(false)
      })

    return () => { cancelled = true }
  }, [importType])

  function switchType(t) {
    setImportType(t)
    reset()
  }

  // ── File handling ────────────────────────────────────────────────────

  function handleFile(file) {
    if (!file) return
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      setParseError('Please upload a CSV file (.csv).')
      return
    }
    setParseError('')
    const reader = new FileReader()
    reader.onload = (e) => processCSV(e.target.result)
    reader.readAsText(file)
  }

  function processCSV(text) {
    const { headers: h, rows } = parseCSV(text)
    if (!h.length) { setParseError('File appears empty or has no header row.'); return }

    if (importType === 'permits') {
      const map = detectPermitMapping(h)
      if (!('permit_number' in map) && !('file_number' in map)) {
        setParseError('Could not recognise permit columns. Download the template to see the expected format.')
        return
      }
      setHeaders(h)
      setMapping(map)
      setRecords(rows.map((row) => rowToPermit(row, map)))
    } else {
      const map = detectColumnMapping(h)
      if (!('name' in map) && !('sector' in map)) {
        setParseError('Could not recognise facility columns. Download the template to see the expected format.')
        return
      }
      setHeaders(h)
      setMapping(map)
      setRecords(rows.map((row) => rowToFacility(row, map)))
    }
    setStage(STAGES.preview)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    handleFile(e.dataTransfer.files[0])
  }

  // ── Import ───────────────────────────────────────────────────────────

  function validateRecord(record) {
    if (importType !== 'permits') return validateFacility(record)

    const errors = validatePermit(record)
    if (record.file_number && !facilityLinkLoading && !existingFacilitiesById.has(record.file_number)) {
      errors.push(`No facility found with file number "${record.file_number}"`)
    }
    return errors
  }

  function getLinkedFacilityName(fileNumber) {
    return existingFacilitiesById.get(fileNumber) ?? ''
  }

  const validRecords = records.filter((r) => validateRecord(r).length === 0)

  async function handleImport() {
    setProgress({ done: 0, total: validRecords.length })
    setResults([])
    setStage(STAGES.importing)

    const out = []
    for (let i = 0; i < validRecords.length; i++) {
      const r = validRecords[i]
      try {
        if (importType === 'permits') {
          const { file_number, _entity_name_raw, _issue_date_raw, _effective_date_raw, _expiry_date_raw, ...permitData } = r
          const linkedFacilityName = getLinkedFacilityName(file_number)
          permitData.entity_name = linkedFacilityName || permitData.entity_name || ''
          await createSubRecord(file_number, 'permits', permitData, user.uid)
          out.push({ name: r.permit_number, fileNumber: file_number, facilityName: linkedFacilityName, success: true })
        } else {
          const { file_number: explicitId, ...facilityData } = r
          const fn = explicitId
            ? await createFacilityWithId(explicitId, facilityData, user.uid)
            : await createFacility(facilityData, user.uid)
          out.push({ name: r.name, fileNumber: fn, success: true })
        }
      } catch (err) {
        out.push({ name: importType === 'permits' ? r.permit_number : r.name, error: err.message, success: false })
      }
      setProgress({ done: i + 1, total: validRecords.length })
      setResults([...out])
    }
    setStage(STAGES.done)
  }

  // ── Template download ────────────────────────────────────────────────

  function downloadTemplate() {
    const [content, filename] = importType === 'permits'
      ? [buildPermitTemplateCSV(), 'epa-permits-template.csv']
      : [buildTemplateCSV(),       'epa-facilities-template.csv']
    const blob = new Blob([content], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Computed counts ───────────────────────────────────────────────────

  const invalidCount = records.length - validRecords.length
  const warnCount    = importType === 'facilities'
    ? records.filter((r) => validateRecord(r).length === 0 && warnFacility(r).length > 0).length
    : 0
  const successCount = results.filter((r) => r.success).length
  const failCount    = results.filter((r) => !r.success).length

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="page">
      <button className="btn btn--ghost btn--sm btn--back" onClick={() => navigate('/')}>
        <ArrowLeft size={14} /> Back to Dashboard
      </button>

      <div className="page-header" style={{ marginTop: 12 }}>
        <div>
          <div className="page-title">Import Data</div>
          <div className="page-subtitle">Bulk-import facilities or permits from a CSV file.</div>
        </div>
        {stage === STAGES.idle && (
          <button className="btn btn--ghost" onClick={downloadTemplate}>
            <Download size={14} /> Download Template
          </button>
        )}
      </div>

      {/* ── Type selector ── */}
      {stage === STAGES.idle && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 4 }}>
          <button
            className={`btn ${importType === 'facilities' ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => switchType('facilities')}
          >
            <Building2 size={14} /> Facilities
          </button>
          <button
            className={`btn ${importType === 'permits' ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => switchType('permits')}
          >
            <FileText size={14} /> Permits
          </button>
        </div>
      )}

      {/* ── Stage: Idle ── */}
      {stage === STAGES.idle && (
        <>
          {parseError && (
            <div className="login-error" style={{ marginBottom: 16 }}>
              <AlertCircle size={15} style={{ flexShrink: 0 }} /> {parseError}
            </div>
          )}

          <div
            className={`import-dropzone${dragOver ? ' import-dropzone--over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={36} color="#9ca3af" />
            <div className="import-dropzone__label">Drop your CSV here, or click to browse</div>
            <div className="import-dropzone__hint">CSV files only · columns auto-detected from headers</div>
            <input ref={fileInputRef} type="file" accept=".csv,text/csv"
              style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files[0])} />
          </div>

          <div className="import-help-card">
            {importType === 'facilities' ? (
              <>
                <div className="import-help-card__title">Importing Facilities</div>
                <ol className="import-help-card__steps">
                  <li>Open your facilities spreadsheet in Google Sheets</li>
                  <li>Go to <strong>File → Download → Comma-separated values (.csv)</strong></li>
                  <li>Make sure row 1 contains column headers (see template for expected names)</li>
                  <li>Upload the downloaded file above</li>
                </ol>
                <div className="import-help-card__sectors">
                  <strong>Valid sector values:</strong>{' '}
                  {SECTORS.map((s) => `${s.name} (${s.prefix})`).join(' · ')}
                </div>
              </>
            ) : (
              <>
                <div className="import-help-card__title">Importing Permits</div>
                <ol className="import-help-card__steps">
                  <li>Each row must have the <strong>file number</strong> of the facility the permit belongs to</li>
                  <li>Dates can be in any common format: <code>2025-01-15</code>, <code>15/01/2025</code>, <code>15 Jan 2025</code></li>
                  <li>Facilities must already exist in the system before importing their permits</li>
                  <li>Download the template to see required column names</li>
                </ol>
                <div className="import-help-card__sectors">
                  <strong>Supported headers:</strong> PermID, Entity Name, File No., PERMIT NO., Date of Issue, Effective Date, Date of Expiry, Place of Issue, Permit Image
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* ── Stage: Preview ── */}
      {stage === STAGES.preview && (
        <>
          <div className="import-summary-bar">
            <span className="import-summary-bar__count">{records.length} rows detected</span>
            <span className="import-summary-bar__valid">
              <CheckCircle size={13} /> {validRecords.length} ready to import
            </span>
            {importType === 'permits' && facilityLinkLoading && (
              <span style={{ fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> Checking facility file numbers…
              </span>
            )}
            {warnCount > 0 && (
              <span style={{ fontSize: 12, color: '#b45309', display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertCircle size={13} /> {warnCount} with warnings (will still import)
              </span>
            )}
            {invalidCount > 0 && (
              <span className="import-summary-bar__invalid">
                <XCircle size={13} /> {invalidCount} with errors (will be skipped)
              </span>
            )}
            <button className="btn btn--ghost btn--sm" style={{ marginLeft: 'auto' }} onClick={reset}>
              Upload different file
            </button>
          </div>

          {/* Column mapping */}
          <div className="card" style={{ padding: '14px 18px', marginBottom: 12 }}>
            <div className="card-title" style={{ marginBottom: 10 }}>Detected column mapping</div>
            <div className="import-mapping-grid">
              {Object.entries(mapping).map(([field, idx]) => (
                <div key={field} className="import-mapping-row">
                  <span className="import-mapping-row__csv">{headers[idx]}</span>
                  <ChevronRight size={12} color="#9ca3af" />
                  <span className="import-mapping-row__field">{field}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Error breakdown */}
          {invalidCount > 0 && (() => {
            const errorCounts = {}
            const sectorCounts = {}
            records.forEach((r) => {
              const errs = validateRecord(r)
              if (errs.length === 0) return
              errs.forEach((e) => { errorCounts[e] = (errorCounts[e] ?? 0) + 1 })
              if (importType === 'facilities' && !r.sector_prefix && r.sector) {
                sectorCounts[r.sector] = (sectorCounts[r.sector] ?? 0) + 1
              }
            })
            const unknownSectors = Object.entries(sectorCounts).sort((a, b) => b[1] - a[1])
            return (
              <div className="card" style={{ padding: '14px 18px', marginBottom: 12, borderLeft: '3px solid #f87171' }}>
                <div className="card-title" style={{ marginBottom: 10, color: '#dc2626' }}>
                  Error breakdown ({invalidCount} rows skipped)
                </div>
                {Object.entries(errorCounts).map(([msg, count]) => (
                  <div key={msg} style={{ fontSize: 13, color: '#374151', marginBottom: 4 }}>
                    <strong style={{ color: '#dc2626' }}>{count}×</strong> {msg}
                  </div>
                ))}
                {unknownSectors.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>
                      Unrecognised sector values in your CSV:
                    </div>
                    {unknownSectors.map(([name, count]) => (
                      <div key={name} style={{ fontSize: 12, color: '#374151', fontFamily: 'monospace', marginBottom: 2 }}>
                        "{name}" — {count} row{count !== 1 ? 's' : ''}
                      </div>
                    ))}
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
                      Valid sectors: {SECTORS.map((s) => `${s.name} (${s.prefix})`).join(', ')}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}

          {/* Preview table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', fontWeight: 600, fontSize: 13 }}>
              Preview (first 5 rows)
            </div>
            <div style={{ overflowX: 'auto' }}>
              {importType === 'permits' ? (
                <table className="import-table">
                  <thead>
                    <tr>
                      <th>#</th><th>File No.</th><th>Entity</th><th>Permit Number</th>
                      <th>Issue Date</th><th>Effective Date</th><th>Expiry Date</th>
                      <th>Permit Image</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.slice(0, 5).map((r, i) => {
                      const errors = validateRecord(r)
                      const linkedFacilityName = getLinkedFacilityName(r.file_number)
                      const fmt = (ts) => ts ? new Date(ts.seconds * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
                      return (
                        <tr key={i} className={errors.length ? 'import-table__row--error' : ''}>
                          <td style={{ color: '#9ca3af' }}>{i + 1}</td>
                          <td><span className="file-num" style={{ fontSize: 11 }}>{r.file_number || <em style={{ color: '#dc2626' }}>missing</em>}</span></td>
                          <td>{linkedFacilityName || <em style={{ color: '#9ca3af' }}>{r._entity_name_raw || 'linked from file no.'}</em>}</td>
                          <td><strong>{r.permit_number || <em style={{ color: '#9ca3af' }}>—</em>}</strong></td>
                          <td>{fmt(r.issue_date)}</td>
                          <td>{fmt(r.effective_date)}</td>
                          <td>{fmt(r.expiry_date)}</td>
                          <td>
                            {r.permit_image_url
                              ? <a href={normalizeAttachmentUrl(r.permit_image_url)} target="_blank" rel="noopener noreferrer" className="attachment-link">Drive Link</a>
                              : <em style={{ color: '#9ca3af' }}>—</em>}
                          </td>
                          <td>
                            {errors.length === 0
                              ? <span style={{ color: '#16a34a', fontSize: 12 }}>✓ Ready</span>
                              : <span style={{ color: '#dc2626', fontSize: 12 }} title={errors.join('\n')}>✗ {errors[0]}</span>
                            }
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              ) : (
                <table className="import-table">
                  <thead>
                    <tr>
                      <th>#</th><th>Name</th><th>Sector</th><th>Location</th>
                      <th>District</th><th>Phone</th><th>Coordinates</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.slice(0, 5).map((f, i) => {
                      const errors   = validateRecord(f)
                      const warnings = warnFacility(f)
                      const hasError = errors.length > 0
                      const hasWarn  = !hasError && warnings.length > 0
                      return (
                        <tr key={i} className={hasError ? 'import-table__row--error' : hasWarn ? 'import-table__row--warn' : ''}>
                          <td style={{ color: '#9ca3af' }}>{i + 1}</td>
                          <td><strong>{f.name || <em style={{ color: '#9ca3af' }}>—</em>}</strong></td>
                          <td>{f.sector_prefix ? `${f.sector} (${f.sector_prefix})` : <span style={{ color: '#dc2626' }}>{f.sector || '—'}</span>}</td>
                          <td>{f.location || <em style={{ color: '#9ca3af' }}>—</em>}</td>
                          <td>{f.district || <em style={{ color: '#9ca3af' }}>—</em>}</td>
                          <td>{f.phone || <em style={{ color: '#9ca3af' }}>—</em>}</td>
                          <td>{f.coordinates ? `${f.coordinates.lat}, ${f.coordinates.lng}` : <em style={{ color: '#9ca3af' }}>—</em>}</td>
                          <td>
                            {hasError
                              ? <span style={{ color: '#dc2626', fontSize: 12 }} title={errors.join('\n')}>✗ {errors[0]}</span>
                              : hasWarn
                                ? <span style={{ color: '#b45309', fontSize: 12 }} title={warnings.join('\n')}>⚠ {warnings[0]}</span>
                                : <span style={{ color: '#16a34a', fontSize: 12 }}>✓ Ready</span>
                            }
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
            {records.length > 5 && (
              <div style={{ padding: '10px 16px', fontSize: 12, color: '#9ca3af', borderTop: '1px solid #f3f4f6' }}>
                … and {records.length - 5} more rows
              </div>
            )}
          </div>

          {validRecords.length === 0 ? (
            <div className="login-error">
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              No valid rows to import. Fix the errors above and re-upload.
            </div>
          ) : (
            <div className="form-actions">
              <button className="btn btn--ghost" onClick={reset}>Cancel</button>
              <button className="btn btn--primary" onClick={handleImport} disabled={importType === 'permits' && facilityLinkLoading}>
                {importType === 'permits' && facilityLinkLoading
                  ? 'Checking facility links…'
                  : `Import ${validRecords.length} ${importType === 'permits'
                  ? (validRecords.length === 1 ? 'Permit' : 'Permits')
                  : (validRecords.length === 1 ? 'Facility' : 'Facilities')}`}
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Stage: Importing ── */}
      {stage === STAGES.importing && (
        <div className="import-progress-wrap">
          <Loader size={32} style={{ animation: 'spin 1s linear infinite', color: '#059669' }} />
          <div className="import-progress-label">
            Importing {progress.done} of {progress.total}…
          </div>
          <div className="import-progress-bar-wrap">
            <div className="import-progress-bar"
              style={{ width: `${(progress.done / progress.total) * 100}%` }} />
          </div>
          {results.length > 0 && (
            <div className="import-live-results">
              {results.slice(-5).reverse().map((r, i) => (
                <div key={i} className={`import-live-row${r.success ? '' : ' import-live-row--err'}`}>
                  {r.success
                    ? <><CheckCircle size={13} /> <strong>{r.fileNumber}</strong> — {r.facilityName ? `${r.facilityName} · ` : ''}{r.name}</>
                    : <><XCircle size={13} /> {r.name}: {r.error}</>
                  }
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Stage: Done ── */}
      {stage === STAGES.done && (
        <>
          <div className="import-done-banner">
            <CheckCircle size={24} color="#16a34a" />
            <div>
              <div className="import-done-banner__title">Import complete</div>
              <div className="import-done-banner__sub">
                {successCount} imported successfully{failCount > 0 ? ` · ${failCount} failed` : ''}
              </div>
            </div>
          </div>

          <div className="record-list">
            {results.map((r, i) => (
              <div key={i} className={`record-item${r.success ? '' : ' record-item--error'}`}>
                <div className="record-item__header">
                  <span className="record-item__title">{r.name}</span>
                  {r.success
                    ? <span className="record-badge" style={{ background: '#dcfce7', color: '#166534' }}>
                        <CheckCircle size={11} style={{ marginRight: 4 }} />{r.fileNumber}
                      </span>
                    : <span className="record-badge" style={{ background: '#fee2e2', color: '#991b1b' }}>
                        <XCircle size={11} style={{ marginRight: 4 }} />Failed
                      </span>
                  }
                </div>
                {!r.success && <div className="record-item__note" style={{ color: '#dc2626' }}>{r.error}</div>}
              </div>
            ))}
          </div>

          <div className="form-actions" style={{ marginTop: 16 }}>
            <button className="btn btn--ghost" onClick={() => { reset(); }}>Import More</button>
            <button className="btn btn--primary"
              onClick={() => navigate(importType === 'permits' ? '/permits' : '/facilities')}>
              View {importType === 'permits' ? 'Permits' : 'Facilities'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
