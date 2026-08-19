import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, AlertCircle, Save, Loader, WifiOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSync } from '../context/SyncContext'
import { useGPS } from '../hooks/useGPS'
import { getSubRecord, createSubRecord, updateSubRecord, listSubRecords } from '../firebase/subrecords'
import { linkPermitWorkflowRecord } from '../firebase/workflow'
import { getFacility } from '../firebase/facilities'
import { listStaff, getStaffMember } from '../firebase/staff'
import { tsToInput, inputToTs } from '../utils/records'
import { decodeFileNumberParam, facilityPath } from '../utils/fileNumbers'
import { SITE_VERIFICATION_CHECKLISTS } from '../data/siteVerificationChecklists'
import ChecklistFields from '../components/forms/ChecklistFields'
import Spinner from '../components/Spinner'

function buildDefaults(checklist) {
  const defaults = {}
  if (!checklist) return defaults
  for (const section of checklist.sections) {
    for (const item of section.items) {
      defaults[item.key] = item.default ?? ''
    }
  }
  for (const field of checklist.extraFields ?? []) {
    defaults[field.key] = field.default ?? ''
  }
  return defaults
}

export default function SiteVerificationForm() {
  const params = useParams()
  const fileNumber = decodeFileNumberParam(params.fileNumber)
  const { recordId } = params
  const isEditing = Boolean(recordId)
  const navigate = useNavigate()
  const location = useLocation()
  const { user, staff } = useAuth()
  const { isOnline } = useSync()

  const [sectorPrefix, setSectorPrefix] = useState('CI')
  const [subType, setSubType] = useState(sectorPrefix === 'CE' ? 'CE' : sectorPrefix)
  const checklistKey = sectorPrefix === 'CE' ? subType : sectorPrefix
  const checklist = SITE_VERIFICATION_CHECKLISTS[checklistKey] ?? SITE_VERIFICATION_CHECKLISTS.CI

  const [formData, setFormData] = useState({
    date: '',
    linked_permit_id: '',
    notes: '',
    ...buildDefaults(checklist),
  })
  const [photos, setPhotos] = useState([])
  const [permits, setPermits] = useState([])
  const [allStaff, setAllStaff] = useState([])
  const [secondOfficerUid, setSecondOfficerUid] = useState('')
  const { coordinates, setCoordinates, loading: gpsLoading, error: gpsError, capture: captureGPS, clear: clearGPS } = useGPS()
  const [initialLoading, setInitialLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    listStaff().then(setAllStaff).catch(() => setAllStaff([]))
  }, [])

  useEffect(() => {
    async function load() {
      try {
        const [facility, permitList, rec] = await Promise.all([
          getFacility(fileNumber).catch(() => null),
          listSubRecords(fileNumber, 'permits'),
          isEditing ? getSubRecord(fileNumber, 'site_verifications', recordId) : Promise.resolve(null),
        ])
        const loadedSectorPrefix = facility?.sector_prefix ?? 'CI'
        setSectorPrefix(loadedSectorPrefix)
        if (!isEditing) setSubType(loadedSectorPrefix === 'CE' ? 'CE' : loadedSectorPrefix)
        setPermits(permitList)
        if (!isEditing && location.state?.permitId) {
          setFormData((p) => ({ ...p, linked_permit_id: location.state.permitId }))
        }
        if (isEditing) {
          if (!rec) { setError('Record not found.'); return }
          const loadedSubType = loadedSectorPrefix === 'CE'
            ? (rec.facility_sub_type ?? 'CE')
            : (rec.facility_sub_type ?? loadedSectorPrefix)
          if (loadedSectorPrefix === 'CE') setSubType(loadedSubType)
          const loadedChecklist = SITE_VERIFICATION_CHECKLISTS[loadedSubType] ?? SITE_VERIFICATION_CHECKLISTS.CI
          const defaults = buildDefaults(loadedChecklist)
          const merged = { ...defaults }
          for (const key of Object.keys(defaults)) {
            if (rec[key] !== undefined) merged[key] = rec[key]
          }
          setFormData({
            date:             tsToInput(rec.date),
            linked_permit_id: rec.linked_permit_id ?? '',
            notes:            rec.notes ?? '',
            ...merged,
          })
          setPhotos(rec.photos ?? [])
          setSecondOfficerUid(rec.second_officer_id ?? '')
          if (rec.coordinates) setCoordinates(rec.coordinates)
        }
      } catch {
        setError('Failed to load data.')
      } finally {
        setInitialLoading(false)
      }
    }
    load()
  }, [fileNumber, recordId, isEditing, setCoordinates, location.state?.permitId]) // eslint-disable-line react-hooks/exhaustive-deps

  function set(key, value) {
    setFormData((p) => ({ ...p, [key]: value }))
  }

  function handleSubTypeChange(newSubType) {
    const newChecklist = SITE_VERIFICATION_CHECKLISTS[newSubType] ?? SITE_VERIFICATION_CHECKLISTS.CI
    setSubType(newSubType)
    setFormData((prev) => ({
      date:             prev.date,
      linked_permit_id: prev.linked_permit_id,
      notes:            prev.notes,
      ...buildDefaults(newChecklist),
    }))
  }

  function isVisible(item) {
    if (!item.conditional) return true
    return formData[item.conditional.key] === item.conditional.value
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!formData.date) { setError('Date is required.'); return }

    setSubmitting(true)
    setError('')

    const secondOfficer = secondOfficerUid ? await getStaffMember(secondOfficerUid).catch(() => null) : null

    const payload = {
      date:                          inputToTs(formData.date),
      officer_id:                    user.uid,
      officer_name:                  staff?.name ?? '',
      officer_signature_url:         staff?.signature_url ?? '',
      second_officer_id:             secondOfficerUid || '',
      second_officer_name:           secondOfficer?.name ?? '',
      second_officer_signature_url:  secondOfficer?.signature_url ?? '',
      linked_permit_id: formData.linked_permit_id,
      coordinates:      coordinates ?? null,
      photos,
      notes:            formData.notes.trim(),
      sector_prefix:    sectorPrefix,
      facility_sub_type: checklistKey,
    }

    for (const section of checklist.sections) {
      for (const item of section.items) {
        if (isVisible(item)) {
          payload[item.key] = formData[item.key] ?? ''
        }
      }
    }
    for (const field of checklist.extraFields ?? []) {
      payload[field.key] = formData[field.key] ?? ''
    }

    try {
      let savedId = recordId
      if (isEditing) {
        await updateSubRecord(fileNumber, 'site_verifications', recordId, payload, user.uid)
      } else {
        savedId = await createSubRecord(fileNumber, 'site_verifications', payload, user.uid)
      }
      if (location.state?.fromWorkflow && location.state?.permitId) {
        await linkPermitWorkflowRecord({
          fileNumber,
          permitId: location.state.permitId,
          category: 'site_verifications',
          recordId: savedId,
          uid: user.uid,
        })
      }
      navigate(facilityPath(fileNumber), { state: { tab: 'site_verifications' } })
    } catch (err) {
      setError(`Failed to save: ${err.message}`)
      setSubmitting(false)
    }
  }

  if (initialLoading) return <Spinner size={40} />

  return (
    <div className="page">
      <button className="btn btn--ghost btn--sm btn--back" onClick={() => navigate(facilityPath(fileNumber), { state: { tab: 'site_verifications' } })}>
        <ArrowLeft size={14} /> Back to Facility
      </button>

      <div className="page-header" style={{ marginTop: 12 }}>
        <div className="page-title">{isEditing ? 'Edit Site Verification' : 'New Site Verification'}</div>
        <div className="page-subtitle">File Number: <span className="file-num">{fileNumber}</span></div>
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

        {/* ── CE Sub-type selector ── */}
        {sectorPrefix === 'CE' && (
          <div className="card form-card">
            <div className="form-section-title">Facility Sub-type</div>
            <div className="form-group">
              <label>Select facility type <span style={{ color: '#ef4444' }}>*</span></label>
              <select className="select" value={subType} onChange={(e) => handleSubTypeChange(e.target.value)} disabled={isEditing}>
                <option value="CE">Car Washing Bay</option>
                <option value="CE_FUEL_STATION">Fuel Service and Filling Station</option>
                <option value="CE_LPG">LPG Re-filling Plant</option>
              </select>
              {isEditing && (
                <p style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Sub-type cannot be changed when editing.</p>
              )}
            </div>
          </div>
        )}

        <ChecklistFields
          checklist={checklist}
          detailsTitle="Verification Details"
          dateLabel="Date"
          date={formData.date}
          onDateChange={(v) => set('date', v)}
          officerName={staff?.name}
          secondOfficerUid={secondOfficerUid}
          onSecondOfficerChange={setSecondOfficerUid}
          staffOptions={allStaff.filter((s) => s.id !== user.uid)}
          permits={permits}
          linkedPermitId={formData.linked_permit_id}
          onLinkedPermitChange={(v) => set('linked_permit_id', v)}
          coordinates={coordinates}
          gpsLoading={gpsLoading}
          gpsError={gpsError}
          onCaptureGPS={captureGPS}
          onClearGPS={clearGPS}
          onManualCoordinates={setCoordinates}
          formData={formData}
          set={set}
          notes={formData.notes}
          onNotesChange={(v) => set('notes', v)}
          photos={photos}
          onPhotosChange={setPhotos}
          photoFileNumber={fileNumber}
          photoCategory="site_verifications"
        />

        <div className="form-actions">
          <button type="button" className="btn btn--ghost"
            onClick={() => navigate(facilityPath(fileNumber), { state: { tab: 'site_verifications' } })}
            disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting
              ? <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</>
              : <><Save size={15} /> {isEditing ? 'Save Changes' : 'Add Verification'}</>
            }
          </button>
        </div>
      </form>
    </div>
  )
}
