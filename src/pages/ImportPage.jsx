import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Upload, Download, CheckCircle, XCircle,
  AlertCircle, FileText, Loader, ChevronRight,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { createFacility } from '../firebase/facilities'
import { SECTORS, DISTRICTS } from '../data/constants'
import { parseCSV, detectColumnMapping, buildTemplateCSV } from '../utils/csvParser'

// ── Normalisation helpers ──────────────────────────────────────────────

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
    ''
  )
}

function rowToFacility(row, mapping) {
  const get = (field) => (mapping[field] != null ? (row[mapping[field]] ?? '').trim() : '')

  const sectorRaw = get('sector')
  const sector = matchSector(sectorRaw)

  return {
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
    coordinates:         null,
  }
}

function validateFacility(f) {
  const errors = []
  if (!f.name)           errors.push('Name is required')
  if (!f.sector_prefix)  errors.push(`Unknown sector "${f.sector}" — use sector name or prefix`)
  if (!f.location)       errors.push('Location is required')
  if (!f.district)       errors.push('District is required or unrecognised')
  return errors
}

// ── Component ──────────────────────────────────────────────────────────

const STAGES = { idle: 'idle', preview: 'preview', importing: 'importing', done: 'done' }

export default function ImportPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const fileInputRef = useRef()

  const [stage, setStage]           = useState(STAGES.idle)
  const [dragOver, setDragOver]     = useState(false)
  const [parseError, setParseError] = useState('')

  // parsed state
  const [headers, setHeaders]       = useState([])
  const [rawRows, setRawRows]       = useState([])
  const [mapping, setMapping]       = useState({})
  const [facilities, setFacilities] = useState([]) // mapped + validated

  // import state
  const [progress, setProgress]     = useState({ done: 0, total: 0 })
  const [results, setResults]       = useState([]) // { name, fileNumber?, error? }

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
    if (!h.length) {
      setParseError('File appears empty or has no header row.')
      return
    }

    const map = detectColumnMapping(h)
    if (!('name' in map) && !('sector' in map)) {
      setParseError('Could not recognise CSV columns. Download the template to see the expected format.')
      return
    }

    const mapped = rows.map((row) => rowToFacility(row, map))
    setHeaders(h)
    setRawRows(rows)
    setMapping(map)
    setFacilities(mapped)
    setStage(STAGES.preview)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    handleFile(e.dataTransfer.files[0])
  }

  // ── Import ───────────────────────────────────────────────────────────

  async function handleImport() {
    const valid = facilities.filter((f) => validateFacility(f).length === 0)
    setProgress({ done: 0, total: valid.length })
    setResults([])
    setStage(STAGES.importing)

    const out = []
    for (let i = 0; i < valid.length; i++) {
      const f = valid[i]
      try {
        const fn = await createFacility(f, user.uid)
        out.push({ name: f.name, fileNumber: fn, success: true })
      } catch (err) {
        out.push({ name: f.name, error: err.message, success: false })
      }
      setProgress({ done: i + 1, total: valid.length })
      setResults([...out])
    }
    setStage(STAGES.done)
  }

  // ── Template download ────────────────────────────────────────────────

  function downloadTemplate() {
    const blob = new Blob([buildTemplateCSV()], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = 'epa-facilities-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Render ────────────────────────────────────────────────────────────

  const validCount   = facilities.filter((f) => validateFacility(f).length === 0).length
  const invalidCount = facilities.length - validCount
  const successCount = results.filter((r) => r.success).length
  const failCount    = results.filter((r) => !r.success).length

  return (
    <div className="page">
      <button className="btn btn--ghost btn--sm btn--back" onClick={() => navigate('/')}>
        <ArrowLeft size={14} /> Back to Dashboard
      </button>

      <div className="page-header" style={{ marginTop: 12 }}>
        <div>
          <div className="page-title">Import Facilities</div>
          <div className="page-subtitle">Upload a CSV export from Google Sheets or Excel to bulk-register facilities.</div>
        </div>
        <button className="btn btn--ghost" onClick={downloadTemplate}>
          <Download size={14} /> Download Template
        </button>
      </div>

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
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              style={{ display: 'none' }}
              onChange={(e) => handleFile(e.target.files[0])}
            />
          </div>

          <div className="import-help-card">
            <div className="import-help-card__title">How to export from Google Sheets</div>
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
            <div className="import-help-card__sectors">
              <strong>Valid district values:</strong>{' '}
              {DISTRICTS.map((d) => `${d.name} (${d.code})`).join(' · ')}
            </div>
          </div>
        </>
      )}

      {/* ── Stage: Preview ── */}
      {stage === STAGES.preview && (
        <>
          <div className="import-summary-bar">
            <span className="import-summary-bar__count">{facilities.length} rows detected</span>
            <span className="import-summary-bar__valid">
              <CheckCircle size={13} /> {validCount} ready to import
            </span>
            {invalidCount > 0 && (
              <span className="import-summary-bar__invalid">
                <XCircle size={13} /> {invalidCount} with errors (will be skipped)
              </span>
            )}
            <button
              className="btn btn--ghost btn--sm"
              style={{ marginLeft: 'auto' }}
              onClick={() => { setStage(STAGES.idle); setFacilities([]) }}
            >
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

          {/* Preview table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', fontWeight: 600, fontSize: 13 }}>
              Preview (first 5 rows)
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="import-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Sector</th>
                    <th>Location</th>
                    <th>District</th>
                    <th>Contact</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {facilities.slice(0, 5).map((f, i) => {
                    const errors = validateFacility(f)
                    return (
                      <tr key={i} className={errors.length ? 'import-table__row--error' : ''}>
                        <td style={{ color: '#9ca3af' }}>{i + 1}</td>
                        <td><strong>{f.name || <em style={{ color: '#9ca3af' }}>—</em>}</strong></td>
                        <td>{f.sector_prefix ? `${f.sector} (${f.sector_prefix})` : <span style={{ color: '#dc2626' }}>{f.sector || '—'}</span>}</td>
                        <td>{f.location || <em style={{ color: '#9ca3af' }}>—</em>}</td>
                        <td>{f.district || <span style={{ color: '#dc2626' }}>—</span>}</td>
                        <td>{f.contact_person || <em style={{ color: '#9ca3af' }}>—</em>}</td>
                        <td>
                          {errors.length === 0
                            ? <span style={{ color: '#16a34a', fontSize: 12 }}>✓ Ready</span>
                            : <span style={{ color: '#dc2626', fontSize: 12 }} title={errors.join('\n')}>⚠ {errors[0]}</span>
                          }
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {facilities.length > 5 && (
              <div style={{ padding: '10px 16px', fontSize: 12, color: '#9ca3af', borderTop: '1px solid #f3f4f6' }}>
                … and {facilities.length - 5} more rows
              </div>
            )}
          </div>

          {validCount === 0 ? (
            <div className="login-error">
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              No valid rows to import. Fix the errors above and re-upload.
            </div>
          ) : (
            <div className="form-actions">
              <button className="btn btn--ghost" onClick={() => { setStage(STAGES.idle); setFacilities([]) }}>
                Cancel
              </button>
              <button className="btn btn--primary" onClick={handleImport}>
                Import {validCount} {validCount === 1 ? 'Facility' : 'Facilities'}
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
            <div
              className="import-progress-bar"
              style={{ width: `${(progress.done / progress.total) * 100}%` }}
            />
          </div>
          {results.length > 0 && (
            <div className="import-live-results">
              {results.slice(-5).reverse().map((r, i) => (
                <div key={i} className={`import-live-row${r.success ? '' : ' import-live-row--err'}`}>
                  {r.success
                    ? <><CheckCircle size={13} /> <strong>{r.fileNumber}</strong> — {r.name}</>
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
                {successCount} imported successfully
                {failCount > 0 ? ` · ${failCount} failed` : ''}
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
            <button className="btn btn--ghost" onClick={() => { setStage(STAGES.idle); setFacilities([]); setResults([]) }}>
              Import More
            </button>
            <button className="btn btn--primary" onClick={() => navigate('/facilities')}>
              View Facilities
            </button>
          </div>
        </>
      )}
    </div>
  )
}
