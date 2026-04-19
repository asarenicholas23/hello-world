import { useState } from 'react'
import { Camera as CameraIcon, Trash2, AlertCircle, Loader, WifiOff, Image } from 'lucide-react'
import { useCamera } from '../hooks/useCamera'
import { useSync } from '../context/SyncContext'
import { uploadPhoto, deletePhoto, makePhotoPath, uniquePhotoName } from '../firebase/storage'

/**
 * Reusable photo capture component for sub-record forms.
 *
 * Props:
 *   photos       string[]  — current list of Firebase Storage download URLs
 *   onPhotosChange fn      — called with the new photos array after add/remove
 *   fileNumber   string    — used to build the Storage path
 *   category     string    — 'enforcement' | 'monitoring' | 'screening' | 'site_verifications'
 *   maxPhotos    number    — default 10
 *   disabled     bool      — hides capture controls (view-only mode)
 */
export default function PhotoCapture({
  photos = [],
  onPhotosChange,
  fileNumber,
  category,
  maxPhotos = 10,
  disabled = false,
}) {
  const { capturePhoto, capturing } = useCamera()
  const { isOnline } = useSync()
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [lightboxUrl, setLightboxUrl] = useState(null)

  async function handleCapture() {
    setUploadError('')

    if (!isOnline) {
      setUploadError('Photos require an internet connection. Connect and try again.')
      return
    }

    if (photos.length >= maxPhotos) {
      setUploadError(`Maximum ${maxPhotos} photos allowed.`)
      return
    }

    const dataUrl = await capturePhoto()
    if (!dataUrl) return // user cancelled

    setUploading(true)
    try {
      const path = makePhotoPath(fileNumber, category, uniquePhotoName())
      const downloadUrl = await uploadPhoto(dataUrl, path)
      onPhotosChange([...photos, downloadUrl])
    } catch (err) {
      setUploadError(`Upload failed: ${err.message}`)
    } finally {
      setUploading(false)
    }
  }

  async function handleRemove(index) {
    const url = photos[index]
    onPhotosChange(photos.filter((_, i) => i !== index))
    // Best-effort delete from Storage; don't block the UI
    deletePhoto(url)
  }

  const busy = capturing || uploading

  return (
    <div className="photo-capture">
      {/* Thumbnail grid */}
      <div className="photo-grid">
        {photos.map((url, i) => (
          <div key={url} className="photo-thumb" onClick={() => setLightboxUrl(url)}>
            <img src={url} alt={`Photo ${i + 1}`} />
            {!disabled && (
              <button
                type="button"
                className="photo-thumb__delete"
                onClick={(e) => { e.stopPropagation(); handleRemove(i) }}
                title="Remove photo"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        ))}

        {/* Add button */}
        {!disabled && photos.length < maxPhotos && (
          <button
            type="button"
            className={`photo-add-btn${busy ? ' photo-add-btn--busy' : ''}`}
            onClick={handleCapture}
            disabled={busy}
            title={isOnline ? 'Take or choose a photo' : 'No internet connection'}
          >
            {busy ? (
              <Loader size={22} style={{ animation: 'spin 0.8s linear infinite' }} />
            ) : !isOnline ? (
              <WifiOff size={22} color="#9ca3af" />
            ) : (
              <CameraIcon size={22} />
            )}
            <span>{capturing ? 'Opening camera…' : uploading ? 'Uploading…' : 'Add Photo'}</span>
          </button>
        )}

        {/* Empty state */}
        {photos.length === 0 && disabled && (
          <div className="photo-empty">
            <Image size={28} color="#d1d5db" />
            <span>No photos</span>
          </div>
        )}
      </div>

      {/* Photo count */}
      {photos.length > 0 && (
        <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>
          {photos.length} of {maxPhotos} photos
        </div>
      )}

      {/* Errors */}
      {uploadError && (
        <div className="login-error" style={{ marginTop: 8 }}>
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          {uploadError}
        </div>
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <div className="lightbox" onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt="Full size" className="lightbox__img" />
          <button className="lightbox__close" onClick={() => setLightboxUrl(null)}>✕</button>
        </div>
      )}
    </div>
  )
}
