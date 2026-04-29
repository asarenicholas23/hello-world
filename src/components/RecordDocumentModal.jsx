import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { X, Printer, Edit2 } from 'lucide-react'
import { getFacility } from '../firebase/facilities'
import { SITE_VERIFICATION_CHECKLISTS } from '../data/siteVerificationChecklists'
import { MONITORING_CHECKLISTS } from '../data/monitoringChecklists'
import { DISTRICTS, ENFORCEMENT_ACTIONS } from '../data/constants'
import { fmtDate } from '../utils/records'

function val(v) { return v && String(v).trim() ? String(v).trim() : '—' }
function districtName(code) { return DISTRICTS.find((d) => d.code === code)?.name ?? code ?? '—' }
function enforcementLabel(v) { return ENFORCEMENT_ACTIONS.find((a) => a.value === v)?.label ?? val(v) }

function Row({ label, value }) {
  const display = (value == null || String(value).trim() === '') ? '—' : String(value)
  return (
    <tr>
      <td className="doc-td doc-td--label">{label}</td>
      <td className="doc-td doc-td--value">{display}</td>
    </tr>
  )
}

function SecTitle({ children }) {
  return <div className="doc-sec-title">{children}</div>
}

function ChecklistValue({ v }) {
  if (!v || v === '') return <span className="doc-check doc-check--blank">—</span>
  if (v === 'Yes')    return <span className="doc-check doc-check--yes">Yes</span>
  if (v === 'No')     return <span className="doc-check doc-check--no">No</span>
  if (v === 'N/A')    return <span className="doc-check doc-check--na">N/A</span>
  return <span className="doc-check doc-check--text">{v}</span>
}

const DOC_TITLES = {
  screening:          'SCREENING REPORT',
  site_verification:  'SITE VERIFICATION REPORT',
  monitoring:         'ENVIRONMENTAL MONITORING VISIT REPORT',
  enforcement:        'ENFORCEMENT ACTION RECORD',
}

const EDIT_ROUTES = {
  screening:         (fn, id) => `/facilities/${fn}/screenings/${id}/edit`,
  site_verification: (fn, id) => `/facilities/${fn}/site-verifications/${id}/edit`,
  monitoring:        (fn, id) => `/facilities/${fn}/monitoring/${id}/edit`,
  enforcement:       (fn, id) => `/facilities/${fn}/enforcement/${id}/edit`,
}

// ── Screening document — matches official EPA Screening Report form ──────────
function ScreeningDoc({ record: r, facility: f }) {
  const gps = (r.latitude && r.longitude)
    ? `${r.latitude}, ${r.longitude}`
    : (r.coordinates?.lat != null)
      ? `${r.coordinates.lat}, ${r.coordinates.lng ?? r.coordinates.longitude ?? ''}`
      : '—'

  return (
    <div className="srd">
      <p className="srd-note">
        <em><strong>This Form must be completed by two (2) officers only after visiting the project site.</strong></em>
      </p>

      {/* Top header fields */}
      <table className="srd-info-table">
        <tbody>
          <tr>
            <td className="srd-il">Date of Receipt of Form EA1:</td>
            <td className="srd-iv">__________</td>
            <td className="srd-il">Inspection Date:</td>
            <td className="srd-iv">{fmtDate(r.inspection_date ?? r.date)}</td>
          </tr>
          <tr>
            <td className="srd-il">Name of Proponent/Contact Person</td>
            <td className="srd-iv" colSpan={3}>{val(r.proponent_name)}</td>
          </tr>
          <tr>
            <td className="srd-il">Company&#39;s Name</td>
            <td className="srd-iv" colSpan={3}>{val(r.company_name || f?.name)}</td>
          </tr>
        </tbody>
      </table>

      {/* ── Section A ── */}
      <div className="srd-sec-hd"><span className="srd-sec-label">Section A</span> Information Analysis and Inspection Results</div>
      <div className="srd-sub-hd">1.0&nbsp;&nbsp;Description of Proposed Undertaking</div>
      <table className="srd-data-table">
        <tbody>
          <tr>
            <td className="srd-dl">1.1 Type of Undertaking</td>
            <td className="srd-dv">{val(r.type_of_undertaking)}</td>
          </tr>
          <tr>
            <td className="srd-dl">1.2 Components</td>
            <td className="srd-dv srd-dv--wrap">{val(r.components)}</td>
          </tr>
          <tr>
            <td className="srd-dl">1.3 Capacity (Installed/Production/Volumes)</td>
            <td className="srd-dv srd-dv--wrap">{val(r.capacity)}</td>
          </tr>
          <tr>
            <td className="srd-dl">1.4 Land Take</td>
            <td className="srd-dv">—</td>
          </tr>
        </tbody>
      </table>

      <div className="srd-sub-hd">1.3&nbsp;&nbsp;Wastes (type, quantity and the receiving medium), if applicable;</div>
      <table className="srd-data-table">
        <tbody>
          <tr>
            <td className="srd-dl">Liquid Waste:</td>
            <td className="srd-dv srd-dv--wrap">{val(r.liquid_waste)}</td>
          </tr>
          <tr>
            <td className="srd-dl">Solid Waste:</td>
            <td className="srd-dv srd-dv--wrap">{val(r.solid_waste)}</td>
          </tr>
          <tr>
            <td className="srd-dl">Gaseous Waste:</td>
            <td className="srd-dv">{val(r.gaseous_waste)}</td>
          </tr>
        </tbody>
      </table>

      <div className="srd-field-lbl">Comments on the description of the undertaking</div>
      <div className="srd-box">{r.description_comments || ' '}</div>

      {/* ── Section B ── */}
      <div className="srd-sec-hd"><span className="srd-sec-label">Section B</span> Site Information</div>
      <div className="srd-sub-hd">2.0&nbsp;&nbsp;Location and Surrounding</div>

      <table className="srd-info-table">
        <tbody>
          <tr>
            <td className="srd-il">2.1 Plot No.</td>
            <td className="srd-iv">—</td>
            <td className="srd-il">Street/Area name:</td>
            <td className="srd-iv">{val(r.street_area)}</td>
          </tr>
          <tr>
            <td className="srd-il">Town</td>
            <td className="srd-iv">{val(r.town)}</td>
            <td className="srd-il">District</td>
            <td className="srd-iv">{districtName(r.district)}</td>
          </tr>
          <tr>
            <td className="srd-il">Region</td>
            <td className="srd-iv">Ashanti</td>
            <td className="srd-il">Major Landmark (if any)</td>
            <td className="srd-iv">{val(r.major_landmark)}</td>
          </tr>
        </tbody>
      </table>

      <table className="srd-data-table" style={{ marginTop: 6 }}>
        <tbody>
          <tr>
            <td className="srd-dl">2.2 Current Zoning</td>
            <td className="srd-dv">—</td>
          </tr>
          <tr>
            <td className="srd-dl srd-dl--sub">Adjacent Land Use</td>
            <td className="srd-dv">{val(r.adjacent_land_use)}</td>
          </tr>
          <tr>
            <td className="srd-dl srd-dl--sub">North</td>
            <td className="srd-dv">{val(r.north)}</td>
          </tr>
          <tr>
            <td className="srd-dl srd-dl--sub">South</td>
            <td className="srd-dv">{val(r.south)}</td>
          </tr>
          <tr>
            <td className="srd-dl srd-dl--sub">East</td>
            <td className="srd-dv">{val(r.east)}</td>
          </tr>
          <tr>
            <td className="srd-dl srd-dl--sub">West</td>
            <td className="srd-dv">{val(r.west)}</td>
          </tr>
          <tr>
            <td className="srd-dl">2.3 Geographical Coordinates:</td>
            <td className="srd-dv">{gps}</td>
          </tr>
          <tr>
            <td className="srd-dl">2.4 Existing Infrastructure &amp; Facilities on Site</td>
            <td className="srd-dv srd-dv--wrap">{val(r.existing_infrastructure)}</td>
          </tr>
        </tbody>
      </table>

      <div className="srd-field-lbl">2.5 Comment on site Information (appropriateness, sensitivity, compatibility, etc.)</div>
      <div className="srd-box srd-box--tall">{' '}</div>

      {/* ── Section C ── */}
      <div className="srd-sec-hd"><span className="srd-sec-label">Section C</span> Environmental Impacts</div>
      <div className="srd-field-lbl">3.0 List possible potential Environmental Impacts of the proposed undertaking</div>
      <div className="srd-field-lbl">3.1 Constructional Phase</div>
      <div className="srd-box">{r.construction_impacts || 'N/A'}</div>
      <div className="srd-field-lbl">3.2 Operational Phase</div>
      <div className="srd-box srd-box--tall">{r.operational_impacts || ' '}</div>
      <table className="srd-data-table" style={{ marginTop: 6 }}>
        <tbody>
          <tr>
            <td className="srd-dl">3.3 Have these impacts been addressed by the proponent in the Form EA1?</td>
            <td className="srd-dv srd-yn">{val(r.impacts_in_ea1)}</td>
          </tr>
        </tbody>
      </table>
      <div className="srd-field-lbl">If not, indicate potential mitigation measures to be adopted</div>
      <div className="srd-box">{r.mitigation_measures || 'N/A'}</div>

      {/* ── Section D ── */}
      <div className="srd-sec-hd"><span className="srd-sec-label">Section D</span> Consultations</div>
      <div className="srd-field-lbl">4.0 Indicate persons consulted and their views in the Table below.</div>
      <table className="srd-consult-table">
        <thead>
          <tr>
            <th className="srd-cth srd-cth--no">No</th>
            <th className="srd-cth">Name</th>
            <th className="srd-cth">Contact</th>
            <th className="srd-cth">Location in relation to the project site</th>
            <th className="srd-cth">Comments</th>
          </tr>
        </thead>
        <tbody>
          {r.neighbour_name ? (
            <tr>
              <td className="srd-ctd srd-ctd--no">1</td>
              <td className="srd-ctd">{r.neighbour_name}</td>
              <td className="srd-ctd">{val(r.neighbour_contact)}</td>
              <td className="srd-ctd">{val(r.neighbour_location)}</td>
              <td className="srd-ctd">{val(r.neighbour_comments)}</td>
            </tr>
          ) : (
            <tr>
              <td className="srd-ctd srd-ctd--no">&nbsp;</td>
              <td className="srd-ctd">&nbsp;</td>
              <td className="srd-ctd">&nbsp;</td>
              <td className="srd-ctd">&nbsp;</td>
              <td className="srd-ctd">&nbsp;</td>
            </tr>
          )}
          <tr>
            <td className="srd-ctd srd-ctd--no">&nbsp;</td>
            <td className="srd-ctd">&nbsp;</td>
            <td className="srd-ctd">&nbsp;</td>
            <td className="srd-ctd">&nbsp;</td>
            <td className="srd-ctd">&nbsp;</td>
          </tr>
          <tr>
            <td className="srd-ctd srd-ctd--no">&nbsp;</td>
            <td className="srd-ctd">&nbsp;</td>
            <td className="srd-ctd">&nbsp;</td>
            <td className="srd-ctd">&nbsp;</td>
            <td className="srd-ctd">&nbsp;</td>
          </tr>
        </tbody>
      </table>

      {/* ── Section E ── */}
      <div className="srd-sec-hd"><span className="srd-sec-label">Section E</span> Observations, Comments and Recommendations</div>
      <div className="srd-sub-hd">5.0 Observations and comments</div>
      <div className="srd-sub-lbl">5.1&nbsp;&nbsp;Observations</div>
      <div className="srd-box srd-box--tall">{r.observations || ' '}</div>
      <div className="srd-sub-lbl">5.2&nbsp;&nbsp;Comments</div>
      <div className="srd-box srd-box--tall">{r.comments || ' '}</div>

      <div className="srd-sub-lbl">5.3&nbsp;&nbsp;Recommendation</div>
      <table className="srd-data-table">
        <tbody>
          <tr>
            <td className="srd-dl">Permit Recommended</td>
            <td className="srd-dv srd-yn">{val(r.permit_recommended)}</td>
          </tr>
          <tr>
            <td className="srd-dl">Additional Information required</td>
            <td className="srd-dv srd-yn">{val(r.additional_info_required)}</td>
          </tr>
          <tr>
            <td className="srd-dl">PER Recommended</td>
            <td className="srd-dv srd-yn">{val(r.per_recommended)}</td>
          </tr>
          <tr>
            <td className="srd-dl">EIA Recommended</td>
            <td className="srd-dv srd-yn">{val(r.eia_recommended)}</td>
          </tr>
          <tr>
            <td className="srd-dl">Permit Declined</td>
            <td className="srd-dv srd-yn">{val(r.permit_declined)}</td>
          </tr>
        </tbody>
      </table>
      <div className="srd-field-lbl">If permit is declined, give reasons</div>
      <div className="srd-box">{r.permit_declined_reason || 'N/A'}</div>
    </div>
  )
}

// ── Site Verification document ────────────────────────────────
function SiteVerificationDoc({ record: r, facility: f }) {
  const sectorPrefix = f?.sector_prefix ?? r.sector_prefix ?? 'CI'
  const checklistKey = r.facility_sub_type ?? sectorPrefix
  const checklist = SITE_VERIFICATION_CHECKLISTS[checklistKey] ?? SITE_VERIFICATION_CHECKLISTS.CI

  if (!checklist) return <div className="doc-notes-block">No checklist available for this sector.</div>

  const gps = r.coordinates?.lat != null
    ? `${r.coordinates.lat.toFixed(6)}, ${r.coordinates.lng.toFixed(6)}`
    : '—'

  return (
    <div className="srd">
      {/* 1.0 Company Profile */}
      <div className="srd-sec-hd"><span className="srd-sec-label">1.0</span>&nbsp;&nbsp;Company Profile</div>
      <table className="srd-info-table"><tbody>
        <tr>
          <td className="srd-il">Name of Company / Facility</td>
          <td className="srd-iv" colSpan={3}>{val(f?.name)}</td>
        </tr>
        <tr>
          <td className="srd-il">File Number</td>
          <td className="srd-iv">{val(f?.file_number)}</td>
          <td className="srd-il">Facility Type</td>
          <td className="srd-iv">{checklist.label}</td>
        </tr>
        <tr>
          <td className="srd-il">Location</td>
          <td className="srd-iv" colSpan={3}>{val(f?.location)}</td>
        </tr>
        <tr>
          <td className="srd-il">District</td>
          <td className="srd-iv">{districtName(f?.district)}</td>
          <td className="srd-il">Region</td>
          <td className="srd-iv">Ashanti</td>
        </tr>
        <tr>
          <td className="srd-il">Contact Person</td>
          <td className="srd-iv">{val(f?.contact_person)}</td>
          <td className="srd-il">Phone</td>
          <td className="srd-iv">{val(f?.phone)}</td>
        </tr>
        {gps !== '—' && (
          <tr>
            <td className="srd-il">GPS Coordinates</td>
            <td className="srd-iv" colSpan={3}>{gps}</td>
          </tr>
        )}
        {r.linked_permit_id && (
          <tr>
            <td className="srd-il">Linked Permit</td>
            <td className="srd-iv" colSpan={3}>{r.linked_permit_id}</td>
          </tr>
        )}
      </tbody></table>

      {/* Extra fields (facility details) */}
      {checklist.extraFields?.length > 0 && (
        <>
          <div className="srd-sub-hd">Facility Details</div>
          <table className="srd-data-table"><tbody>
            {checklist.extraFields.map((field) => (
              <tr key={field.key}>
                <td className="srd-dl">{field.label}</td>
                <td className="srd-dv">{val(r[field.key])}</td>
              </tr>
            ))}
          </tbody></table>
        </>
      )}

      {/* Checklist sections — numbered from 2.0 */}
      {checklist.sections.map((section, sIdx) => (
        <div key={section.title}>
          <div className="srd-sec-hd">
            <span className="srd-sec-label">{sIdx + 2}.0</span>&nbsp;&nbsp;{section.title}
          </div>
          <table className="srd-data-table"><tbody>
            {section.items.map((item) => {
              if (item.conditional) {
                if (r[item.conditional.key] !== item.conditional.value) return null
              }
              return (
                <tr key={item.key}>
                  <td className="srd-dl">{item.label}</td>
                  <td className="srd-dv">
                    {item.type === 'text' || item.type === 'select'
                      ? <span>{val(r[item.key])}</span>
                      : <ChecklistValue v={r[item.key]} />
                    }
                  </td>
                </tr>
              )
            })}
          </tbody></table>
        </div>
      ))}

      {/* Notes */}
      {r.notes && (
        <>
          <div className="srd-sec-hd">Notes / Recommendations</div>
          <div className="srd-box srd-box--tall">{r.notes}</div>
        </>
      )}

      {/* Declaration */}
      <div className="srd-sec-hd">Declaration</div>
      <table className="srd-data-table"><tbody>
        <tr>
          <td className="srd-dl">Inspecting Officer</td>
          <td className="srd-dv">{val(r.officer_name)}</td>
        </tr>
        <tr>
          <td className="srd-dl">Date of Verification</td>
          <td className="srd-dv">{fmtDate(r.date)}</td>
        </tr>
      </tbody></table>
    </div>
  )
}

// ── Monitoring document ───────────────────────────────────────
function MonitoringDoc({ record: r, facility: f }) {
  const sectorPrefix = f?.sector_prefix ?? r.sector_prefix ?? 'CI'
  const checklist = MONITORING_CHECKLISTS[sectorPrefix] ?? MONITORING_CHECKLISTS.CI

  let yesCount = 0; let totalCount = 0
  if (checklist) {
    for (const section of checklist.sections) {
      for (const item of section.items) {
        if (item.type === 'text' || item.type === 'select' || item.conditional) continue
        totalCount++
        if (r[item.key] === 'Yes') yesCount++
      }
    }
  }
  const pct = totalCount > 0 ? Math.round((yesCount / totalCount) * 100) : null

  return (
    <>
      <SecTitle>Visit Details</SecTitle>
      <table className="doc-table"><tbody>
        <Row label="File No."          value={f?.file_number} />
        <Row label="Facility Name"     value={f?.name} />
        <Row label="Sector"            value={f?.sector ?? sectorPrefix} />
        <Row label="Location"          value={r.location ?? f?.location} />
        <Row label="Monitoring ID"     value={r.mon_id} />
        {pct !== null && (
          <Row label="Compliance Score"
            value={`${yesCount}/${totalCount} items compliant (${pct}%)`} />
        )}
      </tbody></table>

      {checklist?.extraFields?.length > 0 && (
        <>
          <SecTitle>Facility Info</SecTitle>
          <table className="doc-table"><tbody>
            {checklist.extraFields.map((field) => (
              <Row key={field.key} label={field.label} value={r[field.key]} />
            ))}
          </tbody></table>
        </>
      )}

      {checklist?.sections.map((section) => (
        <div key={section.title}>
          <SecTitle>{section.title}</SecTitle>
          <table className="doc-table doc-checklist-table">
            <thead>
              <tr>
                <th className="doc-th doc-th--item">Item</th>
                <th className="doc-th doc-th--result">Result</th>
              </tr>
            </thead>
            <tbody>
              {section.items.map((item) => {
                if (item.conditional) {
                  if (r[item.conditional.key] !== item.conditional.value) return null
                }
                return (
                  <tr key={item.key}>
                    <td className="doc-td doc-td--item">{item.label}</td>
                    <td className="doc-td doc-td--result">
                      {item.type === 'text' || item.type === 'select'
                        ? <span>{val(r[item.key])}</span>
                        : <ChecklistValue v={r[item.key]} />
                      }
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}

      {r.notes && (
        <>
          <SecTitle>Notes</SecTitle>
          <div className="doc-notes-block">{r.notes}</div>
        </>
      )}
    </>
  )
}

// ── Enforcement document ──────────────────────────────────────
function EnforcementDoc({ record: r, facility: f }) {
  return (
    <>
      <SecTitle>Facility Details</SecTitle>
      <table className="doc-table"><tbody>
        <Row label="File No."          value={f?.file_number} />
        <Row label="Facility Name"     value={f?.name} />
        <Row label="Location"          value={f?.location} />
        <Row label="District"          value={districtName(f?.district)} />
      </tbody></table>

      <SecTitle>Enforcement Details</SecTitle>
      <table className="doc-table"><tbody>
        <Row label="Action Taken"      value={enforcementLabel(r.action_taken)} />
        <Row label="Location"          value={r.location} />
        <Row label="Contact Person"    value={r.contact_person} />
        <Row label="Follow-up Date"    value={fmtDate(r.follow_up_date)} />
        {r.coordinates && (
          <>
            <Row label="GPS Latitude"  value={r.coordinates.latitude} />
            <Row label="GPS Longitude" value={r.coordinates.longitude} />
          </>
        )}
      </tbody></table>

      {r.notes && (
        <>
          <SecTitle>Notes / Description</SecTitle>
          <div className="doc-notes-block">{r.notes}</div>
        </>
      )}
    </>
  )
}

// ── Print CSS ─────────────────────────────────────────────────
const PRINT_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10.5pt; color: #000; background: #fff; }
  @page { margin: 15mm; size: A4; }

  /* EPA header */
  .doc-header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 14px; }
  .doc-header__org  { font-size: 12pt; font-weight: 700; text-transform: uppercase; }
  .doc-header__office { font-size: 9.5pt; color: #444; margin-top: 2px; }
  .doc-header__title  { font-size: 13pt; font-weight: 700; margin-top: 8px; text-transform: uppercase; }
  .doc-header__fileno { font-size: 10pt; margin-top: 4px; }
  .doc-header__meta   { display: flex; justify-content: space-between; margin-top: 8px; font-size: 9.5pt; color: #444; }

  /* Screening report (srd) */
  .srd { font-size: 10pt; }
  .srd-note { font-style: italic; font-weight: 700; margin-bottom: 10px; font-size: 9.5pt; }

  .srd-info-table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
  .srd-il { background: #dce3f0; font-weight: 600; font-size: 9.5pt; padding: 5px 7px; border: 1px solid #bbb; width: 28%; white-space: nowrap; }
  .srd-iv { padding: 5px 7px; border: 1px solid #bbb; font-size: 9.5pt; width: 22%; }

  .srd-sec-hd { font-weight: 700; font-size: 10.5pt; margin-top: 14px; margin-bottom: 4px; border-bottom: 1.5px solid #555; padding-bottom: 3px; }
  .srd-sec-label { }
  .srd-sub-hd { font-weight: 600; font-size: 10pt; margin-top: 8px; margin-bottom: 3px; }
  .srd-sub-lbl { font-weight: 600; font-size: 10pt; margin-top: 8px; margin-bottom: 3px; }
  .srd-field-lbl { font-size: 9.5pt; margin-top: 6px; margin-bottom: 2px; }

  .srd-data-table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  .srd-dl { background: #dce3f0; font-weight: 600; font-size: 9.5pt; padding: 5px 7px; border: 1px solid #bbb; width: 42%; vertical-align: top; }
  .srd-dl--sub { padding-left: 20px; }
  .srd-dv { padding: 5px 7px; border: 1px solid #bbb; font-size: 9.5pt; vertical-align: top; }
  .srd-dv--wrap { white-space: pre-wrap; }
  .srd-yn { font-weight: 700; text-align: center; width: 60px; }

  .srd-box { border: 1px solid #bbb; padding: 6px 8px; font-size: 9.5pt; min-height: 28px; margin-bottom: 4px; white-space: pre-wrap; }
  .srd-box--tall { min-height: 56px; }

  .srd-consult-table { width: 100%; border-collapse: collapse; margin-bottom: 6px; font-size: 9.5pt; }
  .srd-cth { background: #dce3f0; font-weight: 700; padding: 5px 6px; border: 1px solid #bbb; text-align: left; }
  .srd-cth--no { width: 30px; text-align: center; }
  .srd-ctd { padding: 5px 6px; border: 1px solid #bbb; min-height: 22px; vertical-align: top; }
  .srd-ctd--no { text-align: center; width: 30px; }

  /* Generic doc table (site verification, monitoring, enforcement) */
  .doc-sec-title { font-size: 10.5pt; font-weight: 700; background: #e8f5e9; padding: 4px 7px; margin: 14px 0 3px; border-left: 4px solid #2e7d32; color: #1b5e20; }
  .doc-table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  .doc-table thead tr { background: #f5f5f5; }
  .doc-th { padding: 5px 7px; font-size: 9.5pt; font-weight: 700; border: 1px solid #ccc; text-align: left; }
  .doc-th--item { width: 70%; }
  .doc-th--result { width: 30%; text-align: center; }
  .doc-td { padding: 5px 7px; font-size: 9.5pt; border: 1px solid #ddd; vertical-align: top; }
  .doc-td--label { width: 38%; font-weight: 600; background: #fafafa; color: #333; white-space: nowrap; }
  .doc-td--value { width: 62%; }
  .doc-td--item { width: 70%; }
  .doc-td--result { width: 30%; text-align: center; }

  .doc-check { display: inline-block; padding: 1px 7px; border-radius: 3px; font-weight: 700; font-size: 9pt; }
  .doc-check--yes  { background: #e8f5e9; color: #1b5e20; }
  .doc-check--no   { background: #ffebee; color: #b71c1c; }
  .doc-check--na   { background: #f5f5f5; color: #666; }
  .doc-check--text { color: #111; }
  .doc-check--blank { color: #999; }

  .doc-notes-block { border: 1px solid #ddd; padding: 7px 9px; font-size: 9.5pt; line-height: 1.5; background: #fafafa; min-height: 30px; margin-bottom: 4px; }

  .doc-sig-block { margin-top: 28px; border-top: 1px solid #bbb; padding-top: 14px; }
  .doc-sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 10px; }
  .doc-sig-item { display: flex; flex-direction: column; gap: 3px; }
  .doc-sig-item__label { font-size: 8.5pt; color: #555; font-weight: 600; text-transform: uppercase; }
  .doc-sig-item__value { font-size: 10.5pt; font-weight: 600; }
  .doc-sig-item__line { border-bottom: 1px solid #333; height: 26px; margin-top: 3px; }

  .doc-photos { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 8px; }
  .doc-photo { width: 120px; height: 90px; object-fit: cover; border: 1px solid #ccc; border-radius: 3px; }
`

const DOC_COMPONENTS = {
  screening:         ScreeningDoc,
  site_verification: SiteVerificationDoc,
  monitoring:        MonitoringDoc,
  enforcement:       EnforcementDoc,
}

// ── Main modal ────────────────────────────────────────────────
export default function RecordDocumentModal({ type, record, fileNumber, onClose }) {
  const navigate   = useNavigate()
  const [facility, setFacility] = useState(null)
  const docRef     = useRef(null)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  useEffect(() => {
    getFacility(fileNumber).then(setFacility).catch(() => {})
  }, [fileNumber])

  function handlePrint() {
    if (!docRef.current) return
    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) { alert('Please allow pop-ups for this site to print.'); return }
    const docDate = fmtDate(record.date ?? record.inspection_date)
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${DOC_TITLES[type]} — ${facility?.name ?? fileNumber}</title>
  <style>${PRINT_CSS}</style>
</head>
<body>
  <div class="doc-header">
    <div class="doc-header__org">Environmental Protection Authority</div>
    <div class="doc-header__office">Konongo Area Office &middot; Ashanti Region</div>
    <div class="doc-header__title">${DOC_TITLES[type]}</div>
    <div class="doc-header__fileno">REGISTRATION/FILE NO: <strong>${fileNumber}</strong></div>
    <div class="doc-header__meta">
      <span>Date: ${docDate}</span>
      <span>Officer: ${record.officer_name || '—'}</span>
    </div>
  </div>
  ${docRef.current.innerHTML}
</body>
</html>`)
    win.document.close()
    win.onload = () => setTimeout(() => win.print(), 200)
  }

  function handleEdit() {
    const routeFn = EDIT_ROUTES[type]
    if (routeFn) navigate(routeFn(fileNumber, record.id))
    onClose()
  }

  const DocContent = DOC_COMPONENTS[type]
  const docDate    = fmtDate(record.date ?? record.inspection_date)

  return createPortal(
    <div className="doc-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="doc-modal" role="dialog" aria-modal="true">

        <div className="doc-modal-toolbar">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="doc-modal-toolbar__title">{DOC_TITLES[type]}</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn--ghost btn--sm" onClick={handlePrint} title="Print or save as PDF">
              <Printer size={14} /> Print / PDF
            </button>
            <button className="btn btn--ghost btn--sm" onClick={handleEdit} title="Edit this record">
              <Edit2 size={14} /> Edit
            </button>
            <button className="btn btn--ghost btn--sm" onClick={onClose} title="Close">
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="doc-modal-scroll">
          <div className="doc-paper">

            {/* Document header */}
            <div className="doc-paper-header">
              <div className="doc-paper-header__org">ENVIRONMENTAL PROTECTION AUTHORITY</div>
              <div className="doc-paper-header__office">Konongo Area Office · Ashanti Region</div>
              <div className="doc-paper-header__title">{DOC_TITLES[type]}</div>
              <div className="doc-paper-header__fileno">
                REGISTRATION/FILE NO: <strong>{fileNumber}</strong>
              </div>
              <div className="doc-paper-header__meta">
                <span>Date: <strong>{docDate}</strong></span>
                <span>Officer: <strong>{record.officer_name || '—'}</strong></span>
              </div>
            </div>

            <div ref={docRef}>
              {DocContent ? (
                <DocContent record={record} facility={facility} />
              ) : (
                <div style={{ color: '#6b7280', padding: 16 }}>Unknown document type.</div>
              )}
            </div>

            {/* Signature block */}
            <div className="doc-sig-block">
              <div className="doc-sig-grid">
                <div className="doc-sig-item">
                  <span className="doc-sig-item__label">Officer Name</span>
                  <span className="doc-sig-item__value">{record.officer_name || '—'}</span>
                </div>
                <div className="doc-sig-item">
                  <span className="doc-sig-item__label">Date</span>
                  <span className="doc-sig-item__value">{docDate}</span>
                </div>
                <div className="doc-sig-item">
                  <span className="doc-sig-item__label">Signature</span>
                  <div className="doc-sig-item__line" />
                </div>
                <div className="doc-sig-item">
                  <span className="doc-sig-item__label">Official Stamp</span>
                  <div className="doc-sig-item__line" />
                </div>
              </div>
            </div>

            {record.photos?.length > 0 && (
              <>
                <div className="doc-sec-title" style={{ marginTop: 20 }}>Photos ({record.photos.length})</div>
                <div className="doc-photos-grid">
                  {record.photos.map((p, i) => (
                    <img
                      key={i}
                      src={typeof p === 'string' ? p : p.url}
                      alt={`Photo ${i + 1}`}
                      className="doc-photo-thumb"
                    />
                  ))}
                </div>
              </>
            )}

          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
