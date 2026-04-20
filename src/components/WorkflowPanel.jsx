import { useState } from 'react'
import { X, Check, AlertTriangle, Users } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { advanceStep, addQAApproval } from '../firebase/workflow'
import { WORKFLOW_STEPS, isPermitStuck } from '../data/workflow'
import { ADMIN_ROLES, FIELD_ROLES } from '../data/constants'

function fmtTs(ts) {
  if (!ts) return ''
  try {
    const d = ts.toDate ? ts.toDate() : ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts)
    return d.toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return '' }
}

// facility: the full facility object (has workflow_current_step, workflow_steps, etc.)
export default function WorkflowPanel({ facility, onClose, onUpdated }) {
  const { user, staff, role } = useAuth()
  const [saving, setSaving]           = useState(false)
  const [notes, setNotes]             = useState('')
  const [pendingSkip, setPendingSkip] = useState(null)

  const fileNumber   = facility.file_number
  const currentStep  = facility.workflow_current_step ?? 0
  const nextStep     = currentStep < 10 ? currentStep + 1 : null
  const isAllDone    = currentStep >= 10
  const stuck        = isPermitStuck(facility)
  const canAdvance   = user.uid === facility.primary_officer || ADMIN_ROLES.has(role)
  const canApproveQA = ADMIN_ROLES.has(role) || FIELD_ROLES.has(role)

  const qaStep      = facility.workflow_steps?.['7'] ?? {}
  const qaApprovals = qaStep.approvals ?? []
  const qaComplete  = qaApprovals.length >= 2 || qaStep.status === 'complete'
  const hasApprovedQA = qaApprovals.some((a) => a.uid === user.uid)

  function getStep(n) { return facility.workflow_steps?.[String(n)] ?? {} }

  function isStepDone(n) {
    if (n === 7) return qaComplete
    return getStep(n).status === 'complete' || n <= currentStep
  }

  function mockNow() { return { toDate: () => new Date(), seconds: Date.now() / 1000 } }

  async function doAdvance(step) {
    setSaving(true)
    try {
      await advanceStep({ fileNumber, step, uid: user.uid, name: staff?.name ?? '', notes })
      onUpdated({
        ...facility,
        workflow_current_step: Math.max(currentStep, step),
        workflow_updated_at:   mockNow(),
        workflow_steps: {
          ...(facility.workflow_steps ?? {}),
          [String(step)]: {
            status: 'complete', completed_by: user.uid,
            completed_by_name: staff?.name, completed_at: mockNow(), notes,
          },
        },
      })
      setNotes('')
      setPendingSkip(null)
    } finally { setSaving(false) }
  }

  async function handleMarkComplete(step) {
    if (step !== nextStep) {
      if (pendingSkip === step) await doAdvance(step)
      else setPendingSkip(step)
    } else {
      await doAdvance(step)
    }
  }

  async function handleQAApproval() {
    setSaving(true)
    try {
      const result = await addQAApproval({ fileNumber, uid: user.uid, name: staff?.name ?? '' })
      if (result?.alreadyApproved) return
      const newApprovals = result?.approvals ?? [...qaApprovals, { uid: user.uid, name: staff?.name }]
      const complete = newApprovals.length >= 2
      onUpdated({
        ...facility,
        workflow_updated_at: mockNow(),
        workflow_steps: {
          ...(facility.workflow_steps ?? {}),
          '7': {
            ...qaStep,
            approvals: newApprovals,
            ...(complete ? { status: 'complete', completed_at: mockNow() } : {}),
          },
        },
        ...(complete ? { workflow_current_step: Math.max(currentStep, 7) } : {}),
      })
    } finally { setSaving(false) }
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
                        <input
                          className="input"
                          style={{ fontSize: 12, padding: '5px 8px' }}
                          placeholder="Notes (optional)"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                        />
                        <button className="btn btn--primary btn--sm" disabled={saving} onClick={() => handleMarkComplete(step)}>
                          {saving ? 'Saving…' : 'Mark Complete'}
                        </button>
                      </div>
                    )}

                    {/* QA approval */}
                    {qa && !qaComplete && currentStep >= 6 && canApproveQA && !hasApprovedQA && (
                      <button className="btn btn--primary btn--sm" style={{ marginTop: 8 }} disabled={saving} onClick={handleQAApproval}>
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
                      <button
                        className="btn btn--ghost btn--xs"
                        style={{ marginTop: 4, fontSize: 11, color: '#9ca3af' }}
                        disabled={saving}
                        onClick={() => handleMarkComplete(step)}
                      >
                        {pendingSkip === step ? '⚠ Confirm (out of sequence)' : 'Skip to this step'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
