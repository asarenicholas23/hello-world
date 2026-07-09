import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, AlertCircle, Save, Loader, WifiOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSync } from '../context/SyncContext'
import { useGPS } from '../hooks/useGPS'
import { getSubRecord, createSubRecord, updateSubRecord, listSubRecords } from '../firebase/subrecords'
import { linkPermitWorkflowRecord } from '../firebase/workflow'
import { listStaff, getStaffMember } from '../firebase/staff'
import { tsToInput } from '../utils/records'
import { decodeFileNumberParam, facilityPath } from '../utils/fileNumbers'
import Spinner from '../components/Spinner'
import ScreeningFields from '../components/forms/ScreeningFields'
import { EMPTY_SCREENING_FORM, buildScreeningPayload } from '../data/screeningFieldMeta'

const EMPTY = EMPTY_SCREENING_FORM

export default function ScreeningForm() {
  const params = useParams()
  const fileNumber = decodeFileNumberParam(params.fileNumber)
  const { recordId } = params
  const isEditing = Boolean(recordId)
  const navigate  = useNavigate()
  const location = useLocation()
  const { user, staff } = useAuth()
  const { isOnline } = useSync()

  const [form, setForm]               = useState(EMPTY)
  const [screeningId, setScreeningId] = useState('')
  const [photos, setPhotos]           = useState([])
  const [allStaff, setAllStaff]       = useState([])
  const [secondOfficerUid, setSecondOfficerUid] = useState('')
  const { coordinates, setCoordinates, loading: gpsLoading, error: gpsError, capture: captureGPS, clear: clearGPS } = useGPS()
  const [initialLoading, setInitialLoading] = useState(isEditing)
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState('')

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }))
  const setManualCoordinates = (nextCoordinates) => {
    setCoordinates(nextCoordinates)
    setForm((f) => ({
      ...f,
      latitude: nextCoordinates ? String(nextCoordinates.lat) : '',
      longitude: nextCoordinates ? String(nextCoordinates.lng) : '',
    }))
  }

  useEffect(() => {
    listStaff().then(setAllStaff).catch(() => setAllStaff([]))
  }, [])

  useEffect(() => {
    if (isEditing) {
      getSubRecord(fileNumber, 'screenings', recordId)
        .then((rec) => {
          if (!rec) { setError('Record not found.'); return }
          setForm({
            ea1_receipt_date:        tsToInput(rec.ea1_receipt_date) ?? '',
            inspection_date:         tsToInput(rec.inspection_date ?? rec.date) ?? '',
            proponent_name:          rec.proponent_name         ?? '',
            company_name:            rec.company_name           ?? '',
            type_of_undertaking:     rec.type_of_undertaking    ?? '',
            components:              rec.components             ?? '',
            capacity:                rec.capacity               ?? '',
            land_take:               rec.land_take              ?? '',
            liquid_waste:            rec.liquid_waste           ?? '',
            solid_waste:             rec.solid_waste            ?? '',
            gaseous_waste:           rec.gaseous_waste          ?? '',
            description_comments:    rec.description_comments   ?? '',
            plot_no:                 rec.plot_no                ?? '',
            street_area:             rec.street_area            ?? '',
            town:                    rec.town                   ?? '',
            district:                rec.district               ?? '',
            major_landmark:          rec.major_landmark         ?? '',
            current_zoning:          rec.current_zoning         ?? '',
            adjacent_land_use:       rec.adjacent_land_use      ?? '',
            north:                   rec.north                  ?? '',
            south:                   rec.south                  ?? '',
            east:                    rec.east                   ?? '',
            west:                    rec.west                   ?? '',
            latitude:                rec.latitude               ?? '',
            longitude:               rec.longitude              ?? '',
            existing_infrastructure: rec.existing_infrastructure?? '',
            site_information_comments: rec.site_information_comments ?? '',
            construction_impacts:    rec.construction_impacts   ?? '',
            operational_impacts:     rec.operational_impacts    ?? '',
            impacts_in_ea1:          rec.impacts_in_ea1         ?? '',
            mitigation_measures:     rec.mitigation_measures    ?? '',
            neighbour_name:          rec.neighbour_name         ?? '',
            neighbour_contact:       rec.neighbour_contact      ?? '',
            neighbour_location:      rec.neighbour_location     ?? '',
            neighbour_comments:      rec.neighbour_comments     ?? '',
            observations:            rec.observations           ?? '',
            comments:                rec.comments               ?? '',
            permit_recommended:      rec.permit_recommended     ?? '',
            additional_info_required:rec.additional_info_required ?? '',
            per_recommended:         rec.per_recommended        ?? '',
            eia_recommended:         rec.eia_recommended        ?? '',
            permit_declined:         rec.permit_declined        ?? '',
            permit_declined_reason:  rec.permit_declined_reason ?? '',
          })
          setScreeningId(rec.screening_id ?? rec.id)
          setPhotos(rec.photos ?? [])
          setSecondOfficerUid(rec.second_officer_id ?? '')
          if (rec.coordinates) setCoordinates(rec.coordinates)
        })
        .catch(() => setError('Failed to load record.'))
        .finally(() => setInitialLoading(false))
    } else {
      // Generate screening_id: SCR-{fileNumber}-{padded count}
      listSubRecords(fileNumber, 'screenings')
        .then((existing) => {
          const next = String(existing.length + 1).padStart(3, '0')
          setScreeningId(`SCR-${fileNumber}-${next}`)
        })
        .catch(() => setScreeningId(`SCR-${fileNumber}-001`))
    }
  }, [fileNumber, recordId, isEditing, setCoordinates])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.inspection_date) { setError('Inspection date is required.'); return }

    setSubmitting(true)
    setError('')

    const secondOfficer = secondOfficerUid ? await getStaffMember(secondOfficerUid).catch(() => null) : null

    const payload = {
      ...buildScreeningPayload(form, coordinates),
      screening_id:                  screeningId,
      linked_permit_id:              location.state?.permitId ?? '',
      officer_id:                    user.uid,
      officer_name:                  staff?.name ?? '',
      officer_signature_url:         staff?.signature_url ?? '',
      second_officer_id:             secondOfficerUid || '',
      second_officer_name:           secondOfficer?.name ?? '',
      second_officer_signature_url:  secondOfficer?.signature_url ?? '',
      photos,
    }

    try {
      let savedId = recordId
      if (isEditing) {
        await updateSubRecord(fileNumber, 'screenings', recordId, payload, user.uid)
      } else {
        savedId = await createSubRecord(fileNumber, 'screenings', payload, user.uid)
      }
      if (location.state?.fromWorkflow && location.state?.permitId) {
        await linkPermitWorkflowRecord({
          fileNumber,
          permitId: location.state.permitId,
          category: 'screenings',
          recordId: savedId,
          uid: user.uid,
        })
      }
      navigate(facilityPath(fileNumber), { state: { tab: 'screenings' } })
    } catch (err) {
      setError(`Failed to save: ${err.message}`)
      setSubmitting(false)
    }
  }

  if (initialLoading) return <Spinner size={40} />

  return (
    <div className="page">
      <button className="btn btn--ghost btn--sm btn--back"
        onClick={() => navigate(facilityPath(fileNumber), { state: { tab: 'screenings' } })}>
        <ArrowLeft size={14} /> Back to Facility
      </button>

      <div className="page-header" style={{ marginTop: 12 }}>
        <div>
          <div className="page-title">{isEditing ? 'Edit Screening' : 'New Screening'}</div>
          <div className="page-subtitle">
            File: <span className="file-num">{fileNumber}</span>
            {screeningId && <> · ID: <span className="file-num">{screeningId}</span></>}
          </div>
        </div>
      </div>

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

      <form onSubmit={handleSubmit}>

        <ScreeningFields
          form={form}
          set={set}
          officerName={staff?.name}
          coordinates={coordinates}
          gpsLoading={gpsLoading}
          gpsError={gpsError}
          onCaptureGPS={captureGPS}
          onClearGPS={clearGPS}
          onManualCoordinates={setManualCoordinates}
          photos={photos}
          onPhotosChange={setPhotos}
          photoFileNumber={fileNumber}
          photoCategory="screenings"
          secondOfficerUid={secondOfficerUid}
          onSecondOfficerChange={setSecondOfficerUid}
          staffOptions={allStaff.filter((s) => s.id !== user.uid)}
        />

        <div className="form-actions">
          <button type="button" className="btn btn--ghost"
            onClick={() => navigate(facilityPath(fileNumber), { state: { tab: 'screenings' } })}
            disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting
              ? <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</>
              : <><Save size={15} /> {isEditing ? 'Save Changes' : 'Add Screening'}</>
            }
          </button>
        </div>
      </form>
    </div>
  )
}
