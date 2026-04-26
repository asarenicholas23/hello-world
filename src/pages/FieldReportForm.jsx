import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, AlertCircle, Save, Loader, ChevronDown, ChevronUp, WifiOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSync } from '../context/SyncContext'
import { useGPS } from '../hooks/useGPS'
import { createFieldReport, getFieldReport, updateFieldReport } from '../firebase/fieldReports'
import { createSubRecord, updateSubRecord, deleteSubRecord } from '../firebase/subrecords'
import { inputToTs, tsToInput } from '../utils/records'
import { SECTORS, DISTRICTS, ENFORCEMENT_ACTIONS, ADMIN_ROLES, ADMIN_VIEW_ROLES } from '../data/constants'
import PhotoCapture from '../components/PhotoCapture'
import GPSField from '../components/GPSField'

const EMPTY = {
  facility_name:        '',
  type_of_undertaking:  '',
  location:             '',
  district:             '',
  sector_prefix:        '',
  contact_person:       '',
  phone:                '',
  permit_status:        '',
  reporting_status:     'pending',
  date_letter_served:   '',
  date_reported:        '',
  processing_fee_date:  '',
  processing_fee_status:'unpaid',
  processing_fee_amount:'',
  permit_fee_date:      '',
  permit_fee_status:    'unpaid',
  permit_fee_amount:    '',
  date:                 '',
  action_taken:         '',
  follow_up_date:       '',
  enforcement_location: '',
  notes:                '',
}

const YES_NO = ['', 'Yes', 'No']

const SCREENING_EMPTY = {
  date:                    '',
  proponent_name:          '',
  company_name:            '',
  type_of_undertaking:     '',
  components:              '',
  capacity:                '',
  liquid_waste:            '',
  solid_waste:             '',
  gaseous_waste:           '',
  description_comments:    '',
  street_area:             '',
  town:                    '',
  district:                '',
  major_landmark:          '',
  adjacent_land_use:       '',
  north:                   '',
  south:                   '',
  east:                    '',
  west:                    '',
  existing_infrastructure: '',
  construction_impacts:    '',
  operational_impacts:     '',
  impacts_in_ea1:          '',
  mitigation_measures:     '',
  neighbour_name:          '',
  neighbour_contact:       '',
  neighbour_location:      '',
  neighbour_comments:      '',
  observations:            '',
  comments:                '',
  permit_recommended:      '',
  additional_info_required:'',
  per_recommended:         '',
  eia_recommended:         '',
  permit_declined:         '',
  permit_declined_reason:  '',
}

function feeHasData({ date, amount }) {
  return Boolean(date || amount)
}

function normalizeFeeStatus(status) {
  return String(status ?? '').trim().toLowerCase() === 'paid' ? 'paid' : 'unpaid'
}

function deriveInvoiceStatusFromFees(processingFee, permitFee) {
  const fees = [processingFee, permitFee].filter(feeHasData)
  if (!fees.length) return 'pending'
  if (fees.every((fee) => normalizeFeeStatus(fee.status) === 'paid')) return 'paid'
  return 'invoiced'
}

function buildFinancePayload({ reportId, paymentType, date, amount, status, facilityName }) {
  return {
    date:             inputToTs(date),
    payment_type:     paymentType,
    payment_status:   normalizeFeeStatus(status),
    amount:           Number(amount),
    currency:         'GHS',
    permit_id:        '',
    permit_number:    '',
    reference_number: `${reportId}-${paymentType.toLowerCase().replace(/\s+/g, '-')}`,
    notes:            `Synced from field report for ${facilityName || 'facility'}`.trim(),
    source:           'field_report',
    source_record_id: reportId,
  }
}

export default function FieldReportForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { user, staff } = useAuth()
  const { isOnline } = useSync()
  const isAdmin = ADMIN_ROLES.has(staff?.role)
  const isFinance = staff?.role === 'finance'
  const canEditAllEntries = ADMIN_VIEW_ROLES.has(staff?.role)
  const canManageReportFields = isAdmin || isFinance

  const [reportType, setReportType] = useState((isAdmin || isFinance) ? 'walk_in' : 'enforcement')
  const [formData, setFormData]     = useState(EMPTY)
  const [photos, setPhotos]         = useState([])
  const { coordinates, loading: gpsLoading, error: gpsError, capture: captureGPS, clear: clearGPS } = useGPS()

  // Screening
  const [addScreening, setAddScreening] = useState(false)
  const [screening, setScreening]       = useState(SCREENING_EMPTY)
  const [screeningPhotos, setScreeningPhotos] = useState([])
  const {
    coordinates: screeningCoords,
    loading: sGpsLoading,
    error: sGpsError,
    capture: captureScreeningGPS,
    clear: clearScreeningGPS,
  } = useGPS()

  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading]       = useState(isEdit)
  const [error, setError]           = useState('')
  const [existingReport, setExistingReport] = useState(null)

  useEffect(() => {
    if (!isEdit) return
    getFieldReport(id)
      .then((data) => {
        if (!data) { navigate('/field-reports'); return }
        setExistingReport(data)
        setReportType(data.report_type ?? 'enforcement')
        setFormData({
          facility_name:        data.facility_name        ?? '',
          type_of_undertaking:  data.type_of_undertaking  ?? '',
          location:             data.location             ?? '',
          district:             data.district             ?? '',
          sector_prefix:        data.sector_prefix        ?? '',
          contact_person:       data.contact_person       ?? '',
          phone:                data.phone                ?? '',
          permit_status:        data.permit_status        ?? '',
          reporting_status:     data.reporting_status     ?? 'pending',
          date_letter_served:   tsToInput(data.date_letter_served),
          date_reported:        tsToInput(data.date_reported),
          processing_fee_date:  tsToInput(data.processing_fee_date ?? data.date_of_invoice),
          processing_fee_status:data.processing_fee_status ?? data.payment_status ?? 'unpaid',
          processing_fee_amount:data.processing_fee_amount ?? data.amount_invoice ?? '',
          permit_fee_date:      tsToInput(data.permit_fee_date),
          permit_fee_status:    data.permit_fee_status    ?? 'unpaid',
          permit_fee_amount:    data.permit_fee_amount    ?? '',
          date:                 tsToInput(data.date),
          action_taken:         data.action_taken         ?? '',
          follow_up_date:       tsToInput(data.follow_up_date),
          enforcement_location: data.enforcement_location ?? '',
          notes:                data.notes                ?? '',
        })
        setPhotos(data.photos ?? [])
        if (data.screening) {
          setAddScreening(true)
          const s = data.screening
          setScreening({
            date:                    tsToInput(s.date ?? s.inspection_date),
            proponent_name:          s.proponent_name          ?? '',
            company_name:            s.company_name            ?? '',
            type_of_undertaking:     s.type_of_undertaking     ?? '',
            components:              s.components              ?? '',
            capacity:                s.capacity                ?? '',
            liquid_waste:            s.liquid_waste            ?? '',
            solid_waste:             s.solid_waste             ?? '',
            gaseous_waste:           s.gaseous_waste           ?? '',
            description_comments:    s.description_comments    ?? '',
            street_area:             s.street_area             ?? '',
            town:                    s.town                    ?? '',
            district:                s.district                ?? '',
            major_landmark:          s.major_landmark          ?? '',
            adjacent_land_use:       s.adjacent_land_use       ?? '',
            north:                   s.north                   ?? '',
            south:                   s.south                   ?? '',
            east:                    s.east                    ?? '',
            west:                    s.west                    ?? '',
            existing_infrastructure: s.existing_infrastructure ?? '',
            construction_impacts:    s.construction_impacts    ?? '',
            operational_impacts:     s.operational_impacts     ?? '',
            impacts_in_ea1:          s.impacts_in_ea1          ?? '',
            mitigation_measures:     s.mitigation_measures     ?? '',
            neighbour_name:          s.neighbour_name          ?? '',
            neighbour_contact:       s.neighbour_contact       ?? '',
            neighbour_location:      s.neighbour_location      ?? '',
            neighbour_comments:      s.neighbour_comments      ?? '',
            observations:            s.observations ?? s.notes ?? '',
            comments:                s.comments                ?? '',
            permit_recommended:      s.permit_recommended      ?? '',
            additional_info_required:s.additional_info_required ?? '',
            per_recommended:         s.per_recommended         ?? '',
            eia_recommended:         s.eia_recommended         ?? '',
            permit_declined:         s.permit_declined         ?? '',
            permit_declined_reason:  s.permit_declined_reason  ?? '',
          })
          setScreeningPhotos(s.photos ?? [])
        }
      })
      .catch((err) => setError(`Failed to load field report: ${err.message}`))
      .finally(() => setLoading(false))
  }, [id, isEdit, navigate])

  function handleChange(e) {
    const { name, value } = e.target
    setFormData((p) => ({ ...p, [name]: value }))
  }

  function validate() {
    if (!formData.facility_name.trim()) return 'Facility name is required.'
    if (formData.processing_fee_amount && Number.isNaN(Number(formData.processing_fee_amount))) return 'Processing fee amount must be a number.'
    if (formData.permit_fee_amount && Number.isNaN(Number(formData.permit_fee_amount))) return 'Permit fee amount must be a number.'
    if (feeHasData({ date: formData.processing_fee_date, amount: formData.processing_fee_amount, status: formData.processing_fee_status })) {
      if (!formData.processing_fee_date) return 'Processing fee date is required.'
      if (!formData.processing_fee_amount || Number(formData.processing_fee_amount) <= 0) return 'Processing fee amount must be greater than 0.'
    }
    if (feeHasData({ date: formData.permit_fee_date, amount: formData.permit_fee_amount, status: formData.permit_fee_status })) {
      if (!formData.permit_fee_date) return 'Permit fee date is required.'
      if (!formData.permit_fee_amount || Number(formData.permit_fee_amount) <= 0) return 'Permit fee amount must be greater than 0.'
    }
    if (reportType === 'enforcement') {
      if (!formData.date)         return 'Enforcement date is required.'
      if (!formData.action_taken) return 'Action Taken is required.'
    }
    return null
  }

  async function syncFacilityFinance(reportId, assignedFileNumber) {
    if (!assignedFileNumber || !canManageReportFields) return {}

    const syncMap = [
      {
        linkIdKey: 'processing_fee_finance_id',
        paymentType: 'Processing Fee',
        date: formData.processing_fee_date,
        amount: formData.processing_fee_amount,
        status: formData.processing_fee_status,
      },
      {
        linkIdKey: 'permit_fee_finance_id',
        paymentType: 'Permit Fee',
        date: formData.permit_fee_date,
        amount: formData.permit_fee_amount,
        status: formData.permit_fee_status,
      },
    ]

    const patch = {}

    for (const item of syncMap) {
      const hasData = feeHasData(item)
      const existingFinanceId = existingReport?.[item.linkIdKey] ?? null

      if (!hasData) {
        if (existingFinanceId) {
          await deleteSubRecord(assignedFileNumber, 'finance', existingFinanceId)
          patch[item.linkIdKey] = null
        }
        continue
      }

      const financePayload = buildFinancePayload({
        reportId,
        paymentType: item.paymentType,
        date: item.date,
        amount: item.amount,
        status: item.status,
        facilityName: formData.facility_name.trim(),
      })

      if (existingFinanceId) {
        await updateSubRecord(assignedFileNumber, 'finance', existingFinanceId, financePayload, user.uid)
        patch[item.linkIdKey] = existingFinanceId
      } else {
        patch[item.linkIdKey] = await createSubRecord(assignedFileNumber, 'finance', financePayload, user.uid)
      }
    }

    return patch
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const err = validate()
    if (err) { setError(err); window.scrollTo({ top: 0, behavior: 'smooth' }); return }

    setSubmitting(true)
    setError('')

    const payload = {
      report_type:          reportType,
      facility_name:        formData.facility_name.trim(),
      type_of_undertaking:  formData.type_of_undertaking.trim(),
      location:             formData.location.trim(),
      district:             formData.district,
      sector_prefix:        formData.sector_prefix,
      contact_person:       formData.contact_person.trim(),
      phone:                formData.phone.trim(),
      permit_status:        formData.permit_status.trim(),
      date_letter_served:   inputToTs(formData.date_letter_served),
      date_reported:        inputToTs(formData.date_reported),
      notes:                formData.notes.trim(),
      ...(reportType === 'enforcement' ? {
        date:                 inputToTs(formData.date),
        officer_id:           existingReport?.officer_id ?? user.uid,
        officer_name:         existingReport?.officer_name ?? staff?.name ?? '',
        action_taken:         formData.action_taken,
        follow_up_date:       inputToTs(formData.follow_up_date),
        enforcement_location: formData.enforcement_location.trim(),
        coordinates:          coordinates ?? existingReport?.coordinates ?? null,
        photos,
      } : {
        date:                 inputToTs(formData.date_reported),
        officer_id:           null,
        officer_name:         null,
        action_taken:         '',
        follow_up_date:       null,
        enforcement_location: '',
        coordinates:          null,
        photos:               [],
      }),
      ...(addScreening && screening.date ? {
        screening: {
          date:                    inputToTs(screening.date),
          inspection_date:         inputToTs(screening.date),
          officer_id:              existingReport?.screening?.officer_id ?? user.uid,
          officer_name:            existingReport?.screening?.officer_name ?? staff?.name ?? '',
          proponent_name:          screening.proponent_name.trim(),
          company_name:            screening.company_name.trim(),
          type_of_undertaking:     screening.type_of_undertaking.trim(),
          components:              screening.components.trim(),
          capacity:                screening.capacity.trim(),
          liquid_waste:            screening.liquid_waste.trim(),
          solid_waste:             screening.solid_waste.trim(),
          gaseous_waste:           screening.gaseous_waste.trim(),
          description_comments:    screening.description_comments.trim(),
          street_area:             screening.street_area.trim(),
          town:                    screening.town.trim(),
          district:                screening.district,
          major_landmark:          screening.major_landmark.trim(),
          adjacent_land_use:       screening.adjacent_land_use.trim(),
          north:                   screening.north.trim(),
          south:                   screening.south.trim(),
          east:                    screening.east.trim(),
          west:                    screening.west.trim(),
          existing_infrastructure: screening.existing_infrastructure.trim(),
          construction_impacts:    screening.construction_impacts.trim(),
          operational_impacts:     screening.operational_impacts.trim(),
          impacts_in_ea1:          screening.impacts_in_ea1,
          mitigation_measures:     screening.mitigation_measures.trim(),
          neighbour_name:          screening.neighbour_name.trim(),
          neighbour_contact:       screening.neighbour_contact.trim(),
          neighbour_location:      screening.neighbour_location.trim(),
          neighbour_comments:      screening.neighbour_comments.trim(),
          observations:            screening.observations.trim(),
          comments:                screening.comments.trim(),
          permit_recommended:      screening.permit_recommended,
          additional_info_required:screening.additional_info_required,
          per_recommended:         screening.per_recommended,
          eia_recommended:         screening.eia_recommended,
          permit_declined:         screening.permit_declined,
          permit_declined_reason:  screening.permit_declined_reason.trim(),
          photos:                  screeningPhotos,
          coordinates:             screeningCoords ?? existingReport?.screening?.coordinates ?? null,
        },
      } : { screening: null }),
    }

    if (canManageReportFields || reportType === 'walk_in') {
      payload.reporting_status = formData.reporting_status || 'pending'
      payload.processing_fee_date = inputToTs(formData.processing_fee_date)
      payload.processing_fee_status = normalizeFeeStatus(formData.processing_fee_status)
      payload.processing_fee_amount = formData.processing_fee_amount === '' ? null : Number(formData.processing_fee_amount)
      payload.permit_fee_date = inputToTs(formData.permit_fee_date)
      payload.permit_fee_status = normalizeFeeStatus(formData.permit_fee_status)
      payload.permit_fee_amount = formData.permit_fee_amount === '' ? null : Number(formData.permit_fee_amount)
      // Keep the older generic fields populated from Processing Fee for import/backward compatibility.
      payload.date_of_invoice = inputToTs(formData.processing_fee_date)
      payload.amount_invoice = formData.processing_fee_amount === '' ? null : Number(formData.processing_fee_amount)
      payload.payment_status = normalizeFeeStatus(formData.processing_fee_status)
      payload.date_of_payment = normalizeFeeStatus(formData.processing_fee_status) === 'paid' ? inputToTs(formData.processing_fee_date) : null
      payload.amount = formData.processing_fee_amount === '' ? null : Number(formData.processing_fee_amount)
      payload.invoice_status = deriveInvoiceStatusFromFees(
        { date: formData.processing_fee_date, amount: formData.processing_fee_amount, status: formData.processing_fee_status },
        { date: formData.permit_fee_date, amount: formData.permit_fee_amount, status: formData.permit_fee_status },
      )
    }

    try {
      let reportId = id
      if (isEdit) await updateFieldReport(id, payload, user.uid)
      else reportId = await createFieldReport(payload, user.uid)

      const assignedFileNumber = existingReport?.assigned_file_number ?? null
      const financePatch = await syncFacilityFinance(reportId, assignedFileNumber)
      if (Object.keys(financePatch).length > 0) {
        await updateFieldReport(reportId, financePatch, user.uid)
      }

      navigate('/field-reports')
    } catch (err) {
      setError(`Failed to save: ${err.message}`)
      setSubmitting(false)
    }
  }

  const backPath  = '/field-reports'
  const backLabel = 'Field Reports'
  const showManagedFields = canManageReportFields || reportType === 'walk_in'

  if (loading) return <div className="page"><div className="empty-state">Loading…</div></div>
  if (!isEdit && isFinance) {
    return (
      <div className="page">
        <button className="btn btn--ghost btn--sm btn--back" onClick={() => navigate('/field-reports')}>
          <ArrowLeft size={14} /> Field Reports
        </button>
        <div className="login-error" style={{ marginTop: 12 }}>
          <AlertCircle size={15} /> Finance users can update existing field reports, but cannot create new ones.
        </div>
      </div>
    )
  }
  const isOwnReport = existingReport?.officer_id === user?.uid
  if (isEdit && existingReport && !canEditAllEntries && !isFinance && !isOwnReport) {
    return (
      <div className="page">
        <button className="btn btn--ghost btn--sm btn--back" onClick={() => navigate('/field-reports')}>
          <ArrowLeft size={14} /> Field Reports
        </button>
        <div className="login-error" style={{ marginTop: 12 }}>
          <AlertCircle size={15} /> You can only edit field reports that you created.
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <button className="btn btn--ghost btn--sm btn--back" onClick={() => navigate(backPath)}>
        <ArrowLeft size={14} /> {backLabel}
      </button>

      <div className="page-header" style={{ marginTop: 12 }}>
        <div>
          <div className="page-title">{isEdit ? 'Edit Field Report' : 'New Field Report'}</div>
          <div className="page-subtitle">Record details for a facility not yet registered in the system</div>
        </div>
      </div>

      {/* Report type toggle */}
      <div className="report-type-toggle">
        <button
          type="button"
          className={`report-type-btn${reportType === 'enforcement' ? ' report-type-btn--active' : ''}`}
          onClick={() => setReportType('enforcement')}
        >
          Enforcement Action
        </button>
        <button
          type="button"
          className={`report-type-btn${reportType === 'walk_in' ? ' report-type-btn--active' : ''}`}
          onClick={() => setReportType('walk_in')}
          disabled={!canManageReportFields}
        >
          Walk-in / Self-reporting
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {!isOnline && (
          <div className="offline-banner">
            <WifiOff size={15} style={{ flexShrink: 0 }} />
            You&apos;re offline — your submission will be saved locally and synced automatically when you reconnect.
          </div>
        )}

        {error && (
          <div className="login-error" style={{ marginBottom: 16 }}>
            <AlertCircle size={15} style={{ flexShrink: 0 }} /> {error}
          </div>
        )}

        {/* Facility info */}
        <div className="form-card">
          <div className="form-section">
            <div className="form-section-title">Facility Information</div>

            <div className="form-group">
              <label>Facility Name <span style={{ color: '#ef4444' }}>*</span></label>
              <input className="input" name="facility_name" value={formData.facility_name}
                onChange={handleChange} placeholder="Name of the facility" />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Sector</label>
                <select className="select" name="sector_prefix" value={formData.sector_prefix} onChange={handleChange}>
                  <option value="">Select sector…</option>
                  {SECTORS.map((s) => (
                    <option key={s.prefix} value={s.prefix}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Permit Status</label>
                <input className="input" name="permit_status" value={formData.permit_status}
                  onChange={handleChange} placeholder="e.g. Valid, Expired, No permit" />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Location</label>
                <input className="input" name="location" value={formData.location}
                  onChange={handleChange} placeholder="Town / Area" />
              </div>
              <div className="form-group">
                <label>District</label>
                <select className="select" name="district" value={formData.district} onChange={handleChange}>
                  <option value="">Select district…</option>
                  {DISTRICTS.map((d) => (
                    <option key={d.code} value={d.code}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Contact Person</label>
                <input className="input" name="contact_person" value={formData.contact_person}
                  onChange={handleChange} placeholder="Name of person on site" />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input className="input" name="phone" value={formData.phone}
                  onChange={handleChange} placeholder="+233 …" />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Date Letter Served</label>
                <input className="input" type="date" name="date_letter_served" value={formData.date_letter_served}
                  onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Date Reported</label>
                <input className="input" type="date" name="date_reported" value={formData.date_reported}
                  onChange={handleChange} />
              </div>
            </div>
          </div>
        </div>

        {showManagedFields && (
          <div className="form-card">
            <div className="form-section">
              <div className="form-section-title">Reporting & Finance Details</div>

              <div className="form-row">
                <div className="form-group">
                  <label>Reporting Status</label>
                  <select className="select" name="reporting_status" value={formData.reporting_status} onChange={handleChange}>
                    <option value="pending">Pending</option>
                    <option value="reported">Reported</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Linked Facility</label>
                  <input
                    className="input"
                    value={existingReport?.assigned_file_number ?? 'Not linked yet'}
                    readOnly
                    style={{ background: '#f9fafb', color: '#6b7280', cursor: 'not-allowed' }}
                  />
                </div>
              </div>

              <div className="form-section" style={{ borderTop: '1px solid #f3f4f6', marginTop: 8, paddingTop: 20 }}>
                <div className="form-section-title">Processing Fee</div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Processing Fee Date</label>
                    <input className="input" type="date" name="processing_fee_date" value={formData.processing_fee_date}
                      onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <label>Processing Fee Status</label>
                    <select className="select" name="processing_fee_status" value={formData.processing_fee_status} onChange={handleChange}>
                      <option value="paid">Paid</option>
                      <option value="unpaid">Unpaid / Outstanding</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Processing Fee Amount</label>
                    <input className="input" type="number" step="0.01" name="processing_fee_amount" value={formData.processing_fee_amount}
                      onChange={handleChange} placeholder="0.00" />
                  </div>
                </div>
              </div>

              <div className="form-section" style={{ borderTop: '1px solid #f3f4f6', marginTop: 8, paddingTop: 20 }}>
                <div className="form-section-title">Permit Fee</div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Permit Fee Date</label>
                    <input className="input" type="date" name="permit_fee_date" value={formData.permit_fee_date}
                      onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <label>Permit Fee Status</label>
                    <select className="select" name="permit_fee_status" value={formData.permit_fee_status} onChange={handleChange}>
                      <option value="paid">Paid</option>
                      <option value="unpaid">Unpaid / Outstanding</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Permit Fee Amount</label>
                    <input className="input" type="number" step="0.01" name="permit_fee_amount" value={formData.permit_fee_amount}
                      onChange={handleChange} placeholder="0.00" />
                  </div>
                </div>
              </div>

              {existingReport?.assigned_file_number && canManageReportFields && (
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
                  Saving these fee fields will also update the Finance tab for facility {existingReport.assigned_file_number}.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Enforcement details — only when report_type === 'enforcement' */}
        {reportType === 'enforcement' && (
          <div className="form-card">
            <div className="form-section">
              <div className="form-section-title">Enforcement Details</div>

              <div className="form-row">
                <div className="form-group">
                  <label>Date <span style={{ color: '#ef4444' }}>*</span></label>
                  <input className="input" type="date" name="date" value={formData.date} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label>Action Taken <span style={{ color: '#ef4444' }}>*</span></label>
                  <select className="select" name="action_taken" value={formData.action_taken} onChange={handleChange}>
                    <option value="">Select action…</option>
                    {ENFORCEMENT_ACTIONS.map((a) => (
                      <option key={a.value} value={a.value}>{a.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Follow-up Date</label>
                  <input className="input" type="date" name="follow_up_date" value={formData.follow_up_date} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label>Location Description</label>
                  <input className="input" name="enforcement_location" value={formData.enforcement_location}
                    onChange={handleChange} placeholder="Specific location of violation" />
                </div>
              </div>

              <div className="form-group">
                <label>Officer</label>
                <input className="input" value={staff?.name ?? '—'} readOnly
                  style={{ background: '#f9fafb', color: '#6b7280', cursor: 'not-allowed' }} />
              </div>

              <GPSField coordinates={coordinates} loading={gpsLoading} error={gpsError}
                onCapture={captureGPS} onClear={clearGPS} />

              <div className="form-group">
                <label>Notes</label>
                <textarea className="input textarea" name="notes" value={formData.notes}
                  onChange={handleChange} rows={3} placeholder="Details of violation and action taken…" />
              </div>
            </div>
          </div>
        )}

        {/* Walk-in notes */}
        {reportType === 'walk_in' && (
          <div className="form-card">
            <div className="form-section">
              <div className="form-section-title">Notes</div>
              <div className="form-group">
                <textarea className="input textarea" name="notes" value={formData.notes}
                  onChange={handleChange} rows={3} placeholder="Reason for visit, documents provided, next steps…" />
              </div>
            </div>
          </div>
        )}

        {/* Enforcement photos */}
        {reportType === 'enforcement' && (
          <div className="form-card">
            <div className="form-section">
              <div className="form-section-title">Photos</div>
              <PhotoCapture photos={photos} onPhotosChange={setPhotos}
                fileNumber="field-reports" category="enforcement" />
            </div>
          </div>
        )}

        {/* Optional screening section */}
        <div className="form-card">
          <div className="form-section">
            <div
              className="screening-toggle-header"
              onClick={() => setAddScreening((v) => !v)}
            >
              <div>
                <div className="form-section-title" style={{ marginBottom: 2 }}>
                  Screening Details <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span>
                </div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>
                  Record a pre-permit screening at the same time
                </div>
              </div>
              {addScreening ? <ChevronUp size={16} color="#6b7280" /> : <ChevronDown size={16} color="#6b7280" />}
            </div>

            {addScreening && (
              <div style={{ marginTop: 14 }}>
                {/* Inspection Details */}
                <div className="form-row">
                  <div className="form-group">
                    <label>Screening Date</label>
                    <input className="input" type="date" value={screening.date}
                      onChange={(e) => setScreening((p) => ({ ...p, date: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Officer</label>
                    <input className="input" value={staff?.name ?? '—'} readOnly
                      style={{ background: '#f9fafb', color: '#6b7280', cursor: 'not-allowed' }} />
                  </div>
                </div>

                {/* Proponent Information */}
                <div className="form-section-title" style={{ marginTop: 16, marginBottom: 8 }}>Proponent Information</div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Name of Proponent</label>
                    <input className="input" value={screening.proponent_name}
                      onChange={(e) => setScreening((p) => ({ ...p, proponent_name: e.target.value }))}
                      placeholder="Full name of applicant" />
                  </div>
                  <div className="form-group">
                    <label>Company's Name</label>
                    <input className="input" value={screening.company_name}
                      onChange={(e) => setScreening((p) => ({ ...p, company_name: e.target.value }))}
                      placeholder="Registered company name" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Type of Undertaking</label>
                  <input className="input" value={screening.type_of_undertaking}
                    onChange={(e) => setScreening((p) => ({ ...p, type_of_undertaking: e.target.value }))}
                    placeholder="e.g. Manufacturing, Hospitality, Mining…" />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Components</label>
                    <textarea className="input textarea" rows={3} value={screening.components}
                      onChange={(e) => setScreening((p) => ({ ...p, components: e.target.value }))}
                      placeholder="Main components of the project…" />
                  </div>
                  <div className="form-group">
                    <label>Capacity</label>
                    <textarea className="input textarea" rows={3} value={screening.capacity}
                      onChange={(e) => setScreening((p) => ({ ...p, capacity: e.target.value }))}
                      placeholder="Production/operational capacity…" />
                  </div>
                </div>

                {/* Waste Profile */}
                <div className="form-section-title" style={{ marginTop: 16, marginBottom: 8 }}>Waste Profile</div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Liquid Waste</label>
                    <textarea className="input textarea" rows={2} value={screening.liquid_waste}
                      onChange={(e) => setScreening((p) => ({ ...p, liquid_waste: e.target.value }))}
                      placeholder="Types and volumes of liquid waste…" />
                  </div>
                  <div className="form-group">
                    <label>Solid Waste</label>
                    <textarea className="input textarea" rows={2} value={screening.solid_waste}
                      onChange={(e) => setScreening((p) => ({ ...p, solid_waste: e.target.value }))}
                      placeholder="Types and volumes of solid waste…" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Gaseous Waste</label>
                  <textarea className="input textarea" rows={2} value={screening.gaseous_waste}
                    onChange={(e) => setScreening((p) => ({ ...p, gaseous_waste: e.target.value }))}
                    placeholder="Emissions and gaseous discharges…" />
                </div>
                <div className="form-group">
                  <label>Comments on Description of Undertaking</label>
                  <textarea className="input textarea" rows={3} value={screening.description_comments}
                    onChange={(e) => setScreening((p) => ({ ...p, description_comments: e.target.value }))} />
                </div>

                {/* Site Location */}
                <div className="form-section-title" style={{ marginTop: 16, marginBottom: 8 }}>Site Location</div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Street / Area Name</label>
                    <input className="input" value={screening.street_area}
                      onChange={(e) => setScreening((p) => ({ ...p, street_area: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Town</label>
                    <input className="input" value={screening.town}
                      onChange={(e) => setScreening((p) => ({ ...p, town: e.target.value }))} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>District</label>
                    <select className="select" value={screening.district}
                      onChange={(e) => setScreening((p) => ({ ...p, district: e.target.value }))}>
                      <option value="">Select district…</option>
                      {DISTRICTS.map((d) => (
                        <option key={d.code} value={d.code}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Major Landmark</label>
                    <input className="input" value={screening.major_landmark}
                      onChange={(e) => setScreening((p) => ({ ...p, major_landmark: e.target.value }))}
                      placeholder="Nearest major landmark" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Adjacent Land Use</label>
                  <input className="input" value={screening.adjacent_land_use}
                    onChange={(e) => setScreening((p) => ({ ...p, adjacent_land_use: e.target.value }))}
                    placeholder="e.g. Residential, Agricultural, Commercial…" />
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 8, marginTop: 12 }}>
                  Surrounding Land Use by Direction
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>North</label>
                    <input className="input" value={screening.north}
                      onChange={(e) => setScreening((p) => ({ ...p, north: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>South</label>
                    <input className="input" value={screening.south}
                      onChange={(e) => setScreening((p) => ({ ...p, south: e.target.value }))} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>East</label>
                    <input className="input" value={screening.east}
                      onChange={(e) => setScreening((p) => ({ ...p, east: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>West</label>
                    <input className="input" value={screening.west}
                      onChange={(e) => setScreening((p) => ({ ...p, west: e.target.value }))} />
                  </div>
                </div>
                <GPSField coordinates={screeningCoords} loading={sGpsLoading} error={sGpsError}
                  onCapture={captureScreeningGPS} onClear={clearScreeningGPS} />

                {/* Site Assessment */}
                <div className="form-section-title" style={{ marginTop: 16, marginBottom: 8 }}>Site Assessment</div>
                <div className="form-group">
                  <label>Existing Infrastructure and Facility on Site</label>
                  <textarea className="input textarea" rows={3} value={screening.existing_infrastructure}
                    onChange={(e) => setScreening((p) => ({ ...p, existing_infrastructure: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Construction Phase Impacts</label>
                  <textarea className="input textarea" rows={3} value={screening.construction_impacts}
                    onChange={(e) => setScreening((p) => ({ ...p, construction_impacts: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Operational Phase Impacts</label>
                  <textarea className="input textarea" rows={3} value={screening.operational_impacts}
                    onChange={(e) => setScreening((p) => ({ ...p, operational_impacts: e.target.value }))} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Impacts Addressed in EA1?</label>
                    <select className="select" value={screening.impacts_in_ea1}
                      onChange={(e) => setScreening((p) => ({ ...p, impacts_in_ea1: e.target.value }))}>
                      {YES_NO.map((v) => <option key={v} value={v}>{v || 'Select…'}</option>)}
                    </select>
                  </div>
                </div>
                {screening.impacts_in_ea1 === 'No' && (
                  <div className="form-group">
                    <label>Mitigation Measures</label>
                    <textarea className="input textarea" rows={3} value={screening.mitigation_measures}
                      onChange={(e) => setScreening((p) => ({ ...p, mitigation_measures: e.target.value }))}
                      placeholder="Proposed mitigation for unaddressed impacts…" />
                  </div>
                )}

                {/* Neighbour Information */}
                <div className="form-section-title" style={{ marginTop: 16, marginBottom: 8 }}>Neighbour Information</div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Name of Neighbour</label>
                    <input className="input" value={screening.neighbour_name}
                      onChange={(e) => setScreening((p) => ({ ...p, neighbour_name: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Contact of Neighbour</label>
                    <input className="input" value={screening.neighbour_contact}
                      onChange={(e) => setScreening((p) => ({ ...p, neighbour_contact: e.target.value }))} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Location in Relation to the Undertaking</label>
                  <input className="input" value={screening.neighbour_location}
                    onChange={(e) => setScreening((p) => ({ ...p, neighbour_location: e.target.value }))}
                    placeholder="e.g. North of the proposed facility" />
                </div>
                <div className="form-group">
                  <label>Their Comments</label>
                  <textarea className="input textarea" rows={3} value={screening.neighbour_comments}
                    onChange={(e) => setScreening((p) => ({ ...p, neighbour_comments: e.target.value }))} />
                </div>

                {/* Observations & Comments */}
                <div className="form-section-title" style={{ marginTop: 16, marginBottom: 8 }}>Observations & Comments</div>
                <div className="form-group">
                  <label>Observations</label>
                  <textarea className="input textarea" rows={4} value={screening.observations}
                    onChange={(e) => setScreening((p) => ({ ...p, observations: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Comments</label>
                  <textarea className="input textarea" rows={3} value={screening.comments}
                    onChange={(e) => setScreening((p) => ({ ...p, comments: e.target.value }))} />
                </div>

                {/* Screening Decision */}
                <div className="form-section-title" style={{ marginTop: 16, marginBottom: 8 }}>Screening Decision</div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Permit Recommended?</label>
                    <select className="select" value={screening.permit_recommended}
                      onChange={(e) => setScreening((p) => ({ ...p, permit_recommended: e.target.value }))}>
                      {YES_NO.map((v) => <option key={v} value={v}>{v || 'Select…'}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Additional Info Required?</label>
                    <select className="select" value={screening.additional_info_required}
                      onChange={(e) => setScreening((p) => ({ ...p, additional_info_required: e.target.value }))}>
                      {YES_NO.map((v) => <option key={v} value={v}>{v || 'Select…'}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>PER Recommended?</label>
                    <select className="select" value={screening.per_recommended}
                      onChange={(e) => setScreening((p) => ({ ...p, per_recommended: e.target.value }))}>
                      {YES_NO.map((v) => <option key={v} value={v}>{v || 'Select…'}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>EIA Recommended?</label>
                    <select className="select" value={screening.eia_recommended}
                      onChange={(e) => setScreening((p) => ({ ...p, eia_recommended: e.target.value }))}>
                      {YES_NO.map((v) => <option key={v} value={v}>{v || 'Select…'}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Permit Declined?</label>
                    <select className="select" value={screening.permit_declined}
                      onChange={(e) => setScreening((p) => ({ ...p, permit_declined: e.target.value }))}>
                      {YES_NO.map((v) => <option key={v} value={v}>{v || 'Select…'}</option>)}
                    </select>
                  </div>
                </div>
                {screening.permit_declined === 'Yes' && (
                  <div className="form-group">
                    <label>Reason for Permit Declined</label>
                    <textarea className="input textarea" rows={3} value={screening.permit_declined_reason}
                      onChange={(e) => setScreening((p) => ({ ...p, permit_declined_reason: e.target.value }))} />
                  </div>
                )}

                {/* Photos */}
                <div className="form-group" style={{ marginTop: 16 }}>
                  <label>Picture of Facility</label>
                  <PhotoCapture photos={screeningPhotos} onPhotosChange={setScreeningPhotos}
                    fileNumber="field-reports" category="screening" />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn--ghost" onClick={() => navigate(backPath)} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting
              ? <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</>
              : <><Save size={15} /> {isEdit ? 'Save Changes' : 'Submit Field Report'}</>
            }
          </button>
        </div>
      </form>
    </div>
  )
}
