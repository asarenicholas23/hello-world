import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X, Check, AlertTriangle, Users, RotateCcw, CheckSquare,
  FileText, Banknote, ClipboardList, Activity, Plus, Edit2,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  addPermitWorkflowQAApproval,
  advancePermitWorkflowStep,
  ensurePermitWorkflow,
  getPermitWorkflow,
  resetPermitWorkflow,
  tickAllPermitWorkflowSteps,
} from '../firebase/workflow'
import { listSubRecords, createSubRecord } from '../firebase/subrecords'
import { WORKFLOW_STEPS, isPermitStuck } from '../data/workflow'
import { ADMIN_ROLES, FIELD_ROLES } from '../data/constants'
import { facilityPath } from '../utils/fileNumbers'

function fmtTs(ts) {
  if (!ts) return ''
  try {
    const d = ts.toDate ? ts.toDate() : ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts)
    return d.toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return '' }
}

const WORKFLOW_RECORD_CONFIG = {
  finance: {
    label: 'Finance',
    linkedLabel: 'Finance details',
    icon: Banknote,
    route: 'finance',
  },
  screenings: {
    label: 'Screening',
    linkedLabel: 'Screening form',
    icon: ClipboardList,
    route: 'screenings',
  },
  site_verifications: {
    label: 'Site Visit',
    linkedLabel: 'Site verification',
    icon: CheckSquare,
    route: 'site-verifications',
  },
  monitoring: {
    label: 'Monitoring',
    linkedLabel: 'Monitoring record',
    icon: Activity,
    route: 'monitoring',
  },
}

function workflowRecordPath(fileNumber, category, recordId) {
  const route = WORKFLOW_RECORD_CONFIG[category]?.route
  if (!route) return facilityPath(fileNumber)
  return recordId
    ? facilityPath(fileNumber, `/${route}/${recordId}/edit`)
    : facilityPath(fileNumber, `/${route}/new`)
}

export default function WorkflowPanel({ facility, onClose }) {
  const { user, staff, role } = useAuth()
  const navigate = useNavigate()
  const [saving, setSaving]           = useState(false)
  const [notes, setNotes]             = useState('')
  const [pendingSkip, setPendingSkip] = useState(null)
  const [permits, setPermits]         = useState([])
  const [permitsLoading, setPermitsLoading] = useState(true)
  const [selectedPermitId, setSelectedPermitId] = useState('')
  const [workflow, setWorkflow]       = useState(null)
  const [workflowLoading, setWorkflowLoading] = useState(false)
  const [creatingPermit, setCreatingPermit] = useState(false)

  const fileNumber   = facility.file_number
  const currentStep  = workflow?.current_step ?? 0
  const nextStep     = currentStep < 10 ? currentStep + 1 : null
  const isAllDone    = currentStep >= 10
  const stuck        = isPermitStuck({
    workflow_current_step: currentStep,
    workflow_updated_at: workflow?.updated_at,
  })
  const canAdvance   = user.uid === facility.primary_officer
                    || (facility.supporting_officers ?? []).includes(user.uid)
                    || ADMIN_ROLES.has(role)
  const canApproveQA = ADMIN_ROLES.has(role) || FIELD_ROLES.has(role)

  const qaStep      = workflow?.steps?.['7'] ?? {}
  const qaApprovals = qaStep.approvals ?? []
  const qaComplete  = qaApprovals.length >= 2 || qaStep.status === 'complete'
  const hasApprovedQA = qaApprovals.some((a) => a.uid === user.uid)
  const selectedPermit = permits.find((p) => p.id === selectedPermitId)
  const hasPermitCase = Boolean(selectedPermitId)
  const linkedRecords = workflow?.linked_records ?? {}

  useEffect(() => {
    let cancelled = false
    setPermitsLoading(true)
    listSubRecords(fileNumber, 'permits')
      .then((rows) => {
        if (cancelled) return
        setPermits(rows)
        setSelectedPermitId((current) => current || rows[0]?.id || '')
      })
      .catch(() => {
        if (!cancelled) setPermits([])
      })
      .finally(() => {
        if (!cancelled) setPermitsLoading(false)
      })
    return () => { cancelled = true }
  }, [fileNumber])

  useEffect(() => {
    let cancelled = false
    if (!selectedPermitId) {
      setWorkflow(null)
      return () => { cancelled = true }
    }
    setWorkflowLoading(true)
    getPermitWorkflow(fileNumber, selectedPermitId)
      .then((data) => {
        if (!cancelled) setWorkflow(data)
      })
      .catch(() => {
        if (!cancelled) setWorkflow(null)
      })
      .finally(() => {
        if (!cancelled) setWorkflowLoading(false)
      })
    return () => { cancelled = true }
  }, [fileNumber, selectedPermitId])

  function getStep(n) { return workflow?.steps?.[String(n)] ?? {} }

  function isStepDone(n) {
    if (n === 7) return qaComplete
    return getStep(n).status === 'complete' || n <= currentStep
  }

  function mockNow() { return { toDate: () => new Date(), seconds: Date.now() / 1000 } }

  function localWorkflowPatch(patch = {}) {
    return {
      ...(workflow ?? {
        id: selectedPermitId,
        facility_id: fileNumber,
        facility_name: facility.name,
        permit_id: selectedPermitId,
        permit_number: selectedPermit?.permit_number ?? '',
        current_step: 0,
        status: 'not_started',
        steps: {},
        linked_records: {},
      }),
      updated_at: mockNow(),
      updated_by: user.uid,
      ...patch,
    }
  }

  async function doAdvance(step) {
    if (!selectedPermitId) return
    setSaving(true)
    try {
      await advancePermitWorkflowStep({
        fileNumber,
        facilityName: facility.name,
        permitId: selectedPermitId,
        permitNumber: selectedPermit?.permit_number ?? '',
        step,
        uid: user.uid,
        name: staff?.name ?? '',
        notes,
      })
      setWorkflow(localWorkflowPatch({
        current_step: Math.max(currentStep, step),
        status: step >= 10 ? 'complete' : 'in_progress',
        steps: {
          ...(workflow?.steps ?? {}),
          [String(step)]: {
            status: 'complete', completed_by: user.uid,
            completed_by_name: staff?.name, completed_at: mockNow(), notes,
          },
        },
      }))
      setNotes('')
      setPendingSkip(null)
    } finally { setSaving(false) }
  }

  async function handleMarkComplete(step) {
    if (!hasPermitCase || workflowLoading) return
    if (step !== nextStep) {
      if (pendingSkip === step) await doAdvance(step)
      else setPendingSkip(step)
    } else {
      await doAdvance(step)
    }
  }

  async function handleReset() {
    if (!selectedPermitId) return
    if (!window.confirm('Reset workflow progress for this permit case? This cannot be undone.')) return
    setSaving(true)
    try {
      await ensurePermitWorkflow({
        fileNumber,
        facilityName: facility.name,
        permitId: selectedPermitId,
        permitNumber: selectedPermit?.permit_number ?? '',
        uid: user.uid,
      })
      await resetPermitWorkflow({ fileNumber, permitId: selectedPermitId, uid: user.uid })
      setWorkflow(localWorkflowPatch({ current_step: 0, status: 'not_started', steps: {} }))
    } finally { setSaving(false) }
  }

  async function handleCreateDraftPermit() {
    setCreatingPermit(true)
    try {
      const newPermitId = await createSubRecord(fileNumber, 'permits', {
        permit_number: '',
        issue_date: null,
        effective_date: null,
        expiry_date: null,
        issue_location: '',
        notes: '',
      }, user.uid)
      const newPermit = {
        id: newPermitId,
        permit_number: '',
      }
      setPermits((prev) => [...prev, newPermit])
      setSelectedPermitId(newPermitId)
    } finally {
      setCreatingPermit(false)
    }
  }

  async function handleTickAll() {
    if (!selectedPermitId) return
    if (!window.confirm('Mark all 10 steps complete?')) return
    setSaving(true)
    try {
      await tickAllPermitWorkflowSteps({
        fileNumber,
        facilityName: facility.name,
        permitId: selectedPermitId,
        permitNumber: selectedPermit?.permit_number ?? '',
        uid: user.uid,
        name: staff?.name ?? '',
      })
      const steps = {}
      for (let i = 1; i <= 10; i++) {
        steps[String(i)] = { status: 'complete', completed_by: user.uid, completed_by_name: staff?.name, completed_at: mockNow(), notes: '' }
      }
      setWorkflow(localWorkflowPatch({ current_step: 10, status: 'complete', steps }))
    } finally { setSaving(false) }
  }

  async function handleQAApproval() {
    if (!selectedPermitId) return
    setSaving(true)
    try {
      const result = await addPermitWorkflowQAApproval({
        fileNumber,
        facilityName: facility.name,
        permitId: selectedPermitId,
        permitNumber: selectedPermit?.permit_number ?? '',
        uid: user.uid,
        name: staff?.name ?? '',
      })
      if (result?.alreadyApproved) return
      const newApprovals = result?.approvals ?? [...qaApprovals, { uid: user.uid, name: staff?.name }]
      const complete = newApprovals.length >= 2
      setWorkflow(localWorkflowPatch({
        steps: {
          ...(workflow?.steps ?? {}),
          '7': {
            ...qaStep,
            approvals: newApprovals,
            ...(complete ? { status: 'complete', completed_at: mockNow() } : {}),
          },
        },
        ...(complete ? { current_step: Math.max(currentStep, 7), status: 'in_progress' } : {}),
      }))
    } finally { setSaving(false) }
  }

  function goToWorkflowForm(path, extraState = {}) {
    navigate(path, {
      state: {
        fromWorkflow: true,
        workflowFileNumber: fileNumber,
        workflowFacilityName: facility.name,
        permitId: selectedPermitId || null,
        permitNumber: selectedPermit?.permit_number ?? '',
        ...extraState,
      },
    })
    onClose()
  }

  function permitLabel(p) {
    return p.permit_number || p.id
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog workflow-dialog" onClick={(e) => e.stopPropagation()}>

        <div className="dialog__header">
          <div>
            <span className="dialog__title">Permit Workflow</span>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
              {facility.file_number} · {facility.name}
            </div>
          </div>
          <button className="dialog__close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="workflow-body">
          <div className="workflow-case-panel">
            <div className="workflow-case-panel__header">
              <div>
                <div className="workflow-case-panel__eyebrow">Permit case</div>
                <div className="workflow-case-panel__title">
                  {selectedPermit ? permitLabel(selectedPermit) : 'No permit selected'}
                </div>
              </div>
              <button
                className="btn btn--primary btn--xs"
                disabled={creatingPermit}
                onClick={handleCreateDraftPermit}
              >
                <Plus size={12} /> {creatingPermit ? 'Creating…' : 'New Permit'}
              </button>
            </div>

            <div className="workflow-case-panel__select-row">
              <select
                className="select"
                value={selectedPermitId}
                onChange={(e) => setSelectedPermitId(e.target.value)}
                disabled={permitsLoading || permits.length === 0}
              >
                {permitsLoading && <option>Loading permits...</option>}
                {!permitsLoading && permits.length === 0 && <option value="">No permits recorded</option>}
                {!permitsLoading && permits.map((p) => (
                  <option key={p.id} value={p.id}>{permitLabel(p)}</option>
                ))}
              </select>
              <button
                className="btn btn--ghost btn--xs"
                disabled={!selectedPermitId}
                onClick={() => goToWorkflowForm(facilityPath(fileNumber, `/permits/${selectedPermitId}/edit`))}
              >
                <Edit2 size={12} /> Edit Permit
              </button>
            </div>

            <div className="workflow-action-grid">
              {Object.entries(WORKFLOW_RECORD_CONFIG).map(([category, cfg]) => {
                const Icon = cfg.icon
                const linkedId = linkedRecords[category]
                return (
                  <button
                    key={category}
                    className={`workflow-action-btn${linkedId ? ' workflow-action-btn--linked' : ''}`}
                    disabled={!hasPermitCase}
                    onClick={() => goToWorkflowForm(workflowRecordPath(fileNumber, category, linkedId))}
                  >
                    <Icon size={14} /> {linkedId ? `Edit ${cfg.label}` : cfg.label}
                  </button>
                )
              })}
            </div>
            <LinkedWorkflowRecords
              fileNumber={fileNumber}
              linkedRecords={linkedRecords}
              goToWorkflowForm={goToWorkflowForm}
            />
            {!hasPermitCase && !permitsLoading && (
              <div className="workflow-case-panel__hint">
                Create or select a permit before recording workflow progress. New permits can be created as drafts and completed later.
              </div>
            )}
          </div>

          {/* Progress bar */}
          <div className="workflow-progress-wrap">
            <div className="workflow-progress-bar" style={{ width: `${(currentStep / 10) * 100}%` }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7280', marginBottom: 12 }}>
            <span>{isAllDone ? 'All steps complete' : `${currentStep} of 10 steps done`}</span>
            {stuck && (
              <span style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: 3 }}>
                <AlertTriangle size={11} /> Stuck
              </span>
            )}
          </div>

          {pendingSkip && (
            <div className="workflow-ooo-warning">
              <AlertTriangle size={13} style={{ flexShrink: 0 }} />
              <span>
                Step {pendingSkip} is out of sequence. Click again to confirm, or{' '}
                <button className="btn btn--ghost btn--xs" onClick={() => setPendingSkip(null)}>cancel</button>.
              </span>
            </div>
          )}

          <div className="workflow-steps">
            {WORKFLOW_STEPS.map(({ step, label, qa }) => {
              const done    = isStepDone(step)
              const isNext  = !isAllDone && step === nextStep && !done
              const isFut   = !done && !isNext
              const skipped = !done && step < currentStep

              const cls = done ? 'workflow-step--done'
                        : isNext ? 'workflow-step--active'
                        : 'workflow-step--pending'

              return (
                <div key={step} className={`workflow-step ${cls}`}>
                  <div className="workflow-step__indicator">
                    <div className="workflow-step__dot">
                      {done ? <Check size={12} /> : step}
                    </div>
                    {step < 10 && <div className="workflow-step__line" />}
                  </div>

                  <div className="workflow-step__content">
                    <div className="workflow-step__label">
                      {label}
                      {skipped && <span className="workflow-skipped-tag">⚠ skipped</span>}
                    </div>

                    {/* Completed info (non-QA) */}
                    {done && !qa && getStep(step).completed_by_name && (
                      <div className="workflow-step__meta">
                        {getStep(step).completed_by_name} · {fmtTs(getStep(step).completed_at)}
                        {getStep(step).notes && ` · ${getStep(step).notes}`}
                      </div>
                    )}

                    {/* QA approvals */}
                    {qa && (
                      <div style={{ marginTop: 4 }}>
                        {qaApprovals.map((a, i) => (
                          <div key={i} className="workflow-step__meta">
                            <Check size={10} style={{ color: '#16a34a' }} />
                            {' '}{a.name}
                            {a.approved_at && ` · ${new Date(a.approved_at).toLocaleDateString('en-GH', { day: 'numeric', month: 'short' })}`}
                          </div>
                        ))}
                        {!qaComplete && (
                          <div className="workflow-step__meta" style={{ color: '#9ca3af' }}>
                            <Users size={10} /> {2 - qaApprovals.length} more approval{2 - qaApprovals.length !== 1 ? 's' : ''} needed
                          </div>
                        )}
                      </div>
                    )}

                    {/* Mark complete — in sequence */}
                    {isNext && canAdvance && !qa && (
                      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <WorkflowStepActions
                          step={step}
                          fileNumber={fileNumber}
                          selectedPermitId={selectedPermitId}
                          linkedRecords={linkedRecords}
                          goToWorkflowForm={goToWorkflowForm}
                        />
                        <input
                          className="input"
                          style={{ fontSize: 12, padding: '5px 8px' }}
                          placeholder="Notes (optional)"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                        />
                        <button className="btn btn--primary btn--sm" disabled={saving || !hasPermitCase || workflowLoading} onClick={() => handleMarkComplete(step)}>
                          {saving ? 'Saving…' : workflowLoading ? 'Loading…' : 'Mark Complete'}
                        </button>
                      </div>
                    )}

                    {/* QA approval */}
                    {qa && !qaComplete && currentStep >= 6 && canApproveQA && !hasApprovedQA && (
                      <button className="btn btn--primary btn--sm" style={{ marginTop: 8 }} disabled={saving || !hasPermitCase || workflowLoading} onClick={handleQAApproval}>
                        {saving ? 'Saving…' : 'Add My Approval'}
                      </button>
                    )}
                    {qa && !qaComplete && hasApprovedQA && (
                      <div className="workflow-step__meta" style={{ marginTop: 4, color: '#059669' }}>
                        <Check size={10} /> You've approved. Waiting for one more officer.
                      </div>
                    )}

                    {/* Skip to future step */}
                    {isFut && !isAllDone && canAdvance && !qa && step > (nextStep ?? 0) && (
                      <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-start' }}>
                        <WorkflowStepActions
                          step={step}
                          fileNumber={fileNumber}
                          selectedPermitId={selectedPermitId}
                          linkedRecords={linkedRecords}
                          goToWorkflowForm={goToWorkflowForm}
                        />
                        <button
                          className="btn btn--ghost btn--xs"
                          style={{ fontSize: 11, color: '#9ca3af' }}
                          disabled={saving || !hasPermitCase || workflowLoading}
                          onClick={() => handleMarkComplete(step)}
                        >
                          {pendingSkip === step ? '⚠ Confirm (out of sequence)' : 'Skip to this step'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {canAdvance && (
          <div className="dialog__footer">
            <button
              className="btn btn--ghost btn--sm"
              style={{ color: '#dc2626' }}
              disabled={saving || !hasPermitCase || workflowLoading}
              onClick={handleReset}
            >
              <RotateCcw size={13} /> Reset
            </button>
            <div style={{ flex: 1 }} />
            {!isAllDone && (
              <button
                className="btn btn--primary btn--sm"
                disabled={saving || !hasPermitCase || workflowLoading}
                onClick={handleTickAll}
              >
                <CheckSquare size={13} /> Tick All
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function LinkedWorkflowRecords({ fileNumber, linkedRecords, goToWorkflowForm }) {
  const entries = Object.entries(linkedRecords).filter(([, id]) => Boolean(id))
  if (!entries.length) return null

  return (
    <div className="workflow-linked-records">
      {entries.map(([category, id]) => {
        const cfg = WORKFLOW_RECORD_CONFIG[category]
        if (!cfg) return null
        const Icon = cfg.icon
        return (
          <button
            key={category}
            className="workflow-linked-record"
            onClick={() => goToWorkflowForm(workflowRecordPath(fileNumber, category, id))}
          >
            <Icon size={12} />
            <span>{cfg.linkedLabel}</span>
            <Check size={11} />
          </button>
        )
      })}
    </div>
  )
}

function WorkflowStepActions({ step, fileNumber, selectedPermitId, linkedRecords, goToWorkflowForm }) {
  const actions = []

  if (step === 2) {
    actions.push({ category: 'screenings' })
  }
  if (step === 4) {
    actions.push({ category: 'finance' })
  }
  if (step === 5) {
    actions.push(
      { category: 'screenings' },
      { category: 'site_verifications' },
    )
  }
  if (step === 6 || step === 8 || step === 9) {
    actions.push({
      label: selectedPermitId ? 'Edit Permit Details' : 'Create Permit',
      icon: FileText,
      path: selectedPermitId
        ? facilityPath(fileNumber, `/permits/${selectedPermitId}/edit`)
        : facilityPath(fileNumber, '/permits/new'),
    })
  }

  if (!actions.length) return null

  return (
    <div className="workflow-step-actions">
      {actions.map((action) => {
        if (action.category) {
          const cfg = WORKFLOW_RECORD_CONFIG[action.category]
          const linkedId = linkedRecords[action.category]
          const Icon = cfg.icon
          return (
            <button
              key={action.category}
              className={`btn btn--ghost btn--xs${linkedId ? ' btn--active' : ''}`}
              onClick={() => goToWorkflowForm(workflowRecordPath(fileNumber, action.category, linkedId))}
            >
              <Icon size={12} /> {linkedId ? `Edit ${cfg.label}` : `Add ${cfg.label}`}
            </button>
          )
        }
        const Icon = action.icon
        return (
          <button
            key={action.label}
            className="btn btn--ghost btn--xs"
            onClick={() => goToWorkflowForm(action.path)}
          >
            <Icon size={12} /> {action.label}
          </button>
        )
      })}
    </div>
  )
}
