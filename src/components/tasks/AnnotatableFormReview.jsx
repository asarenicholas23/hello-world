import { useState } from 'react'
import { MessageSquare, X, Send } from 'lucide-react'

function val(v) {
  return v && String(v).trim() ? String(v).trim() : '—'
}

/**
 * Read-only submission view for the assigner's review step, used by every
 * form-based task type (Screening, Site Verification, Pesticides Checklist).
 * `sections` is a { title, fields: [{ key, label }] }[] describing which
 * fields to render — see SCREENING_FIELD_SECTIONS and checklistFieldSections().
 * Clicking a field opens a small popover to leave a per-field comment.
 * Pass `readOnly` to hide the comment affordance (e.g. after approval).
 */
export default function AnnotatableFormReview({ formData, sections, annotations = [], onAddComment, readOnly = false }) {
  const [openField, setOpenField] = useState(null) // { key, label }
  const [draft, setDraft] = useState('')

  const unresolvedByField = {}
  for (const a of annotations) {
    if (!a.resolved) unresolvedByField[a.field_key] = a
  }

  function openPopover(key, label) {
    if (readOnly) return
    setOpenField(openField?.key === key ? null : { key, label })
    setDraft('')
  }

  function submitComment() {
    if (!draft.trim() || !openField) return
    onAddComment(openField.key, openField.label, draft.trim())
    setOpenField(null)
    setDraft('')
  }

  return (
    <div className="annotatable-doc">
      {sections.map((section) => (
        <div key={section.title}>
          <div className="doc-sec-title" style={{ marginTop: 14 }}>{section.title}</div>
          <table className="doc-table">
            <tbody>
              {section.fields.map((f) => {
                const note = unresolvedByField[f.key]
                const isOpen = openField?.key === f.key
                return (
                  <tr key={f.key}>
                    <td
                      className={`doc-td doc-td--label${!readOnly ? ' doc-row--annotatable' : ''}${note ? ' doc-row--has-annotation' : ''}`}
                      onClick={() => openPopover(f.key, f.label)}
                    >
                      {f.label}
                      {note && (
                        <span className="doc-annotation-marker"><MessageSquare size={11} /> comment</span>
                      )}
                    </td>
                    <td className="doc-td doc-td--value">
                      <div style={f.format ? { whiteSpace: 'pre-wrap' } : undefined}>
                        {f.format ? f.format(formData?.[f.key]) : val(formData?.[f.key])}
                      </div>
                      {note && <div className="task-field-note" style={{ marginTop: 6 }}>{note.comment}</div>}
                      {isOpen && (
                        <div className="task-annotation-popover">
                          <textarea
                            className="input textarea"
                            rows={2}
                            autoFocus
                            placeholder={`Comment on "${f.label}"…`}
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                          />
                          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                            <button type="button" className="btn btn--primary btn--xs" onClick={submitComment} disabled={!draft.trim()}>
                              <Send size={11} /> Add Comment
                            </button>
                            <button type="button" className="btn btn--ghost btn--xs" onClick={() => setOpenField(null)}>
                              <X size={11} /> Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
