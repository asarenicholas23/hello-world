import { useRef } from 'react'
import { Paperclip, Upload, X, ExternalLink, Loader } from 'lucide-react'

/**
 * A single file attachment slot.
 *
 * Props:
 *   label       — slot label, e.g. "Permit Image"
 *   existingUrl — current saved URL from Firestore (null if none)
 *   selectedFile — File object chosen by user but not yet uploaded (null if none)
 *   uploading   — show spinner while upload in progress
 *   onSelect    — (File) => void
 *   onRemove    — () => void  (clears both existing URL and selected file)
 *   accept      — MIME types string, default "image/*,application/pdf"
 */
export default function FileAttachmentField({
  label,
  existingUrl,
  selectedFile,
  uploading,
  onSelect,
  onRemove,
  accept = 'image/*,application/pdf',
}) {
  const inputRef = useRef()

  const hasFile = existingUrl || selectedFile

  function filenameFromUrl(url) {
    try {
      const decoded = decodeURIComponent(url.split('/').pop().split('?')[0])
      // strip Firebase storage path prefix up to last slash
      return decoded.split('/').pop()
    } catch {
      return 'attachment'
    }
  }

  return (
    <div className="attachment-field">
      <div className="attachment-field__label">{label}</div>

      {hasFile ? (
        <div className="attachment-field__preview">
          <Paperclip size={14} color="#6b7280" />
          <span className="attachment-field__filename">
            {selectedFile ? selectedFile.name : filenameFromUrl(existingUrl)}
          </span>

          {existingUrl && !selectedFile && (
            <a
              href={existingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="attachment-field__view"
              title="Open file"
            >
              <ExternalLink size={13} />
            </a>
          )}

          {uploading ? (
            <Loader size={14} style={{ animation: 'spin 1s linear infinite', color: '#059669' }} />
          ) : (
            <button
              type="button"
              className="attachment-field__remove"
              onClick={onRemove}
              title="Remove"
            >
              <X size={13} />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          className="attachment-field__upload-btn"
          onClick={() => inputRef.current?.click()}
        >
          <Upload size={13} />
          Choose file
        </button>
      )}

      {/* Allow replacing even when a file is shown */}
      {hasFile && !uploading && (
        <button
          type="button"
          className="attachment-field__replace"
          onClick={() => inputRef.current?.click()}
        >
          Replace
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={(e) => { if (e.target.files[0]) onSelect(e.target.files[0]) }}
      />
    </div>
  )
}
