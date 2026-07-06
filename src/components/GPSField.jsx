import { useEffect, useState } from 'react'
import { Crosshair, Loader, MapPin, AlertCircle } from 'lucide-react'

function normalizeCoordinates(value) {
  if (!value) return null
  const lat = Number(value.lat ?? value.latitude)
  const lng = Number(value.lng ?? value.longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

/**
 * Reusable GPS capture field.
 * Props: coordinates/value, loading, error, onCapture, onClear, onChange
 */
export default function GPSField({ coordinates, value, loading, error, onCapture, onClear, onChange }) {
  const current = normalizeCoordinates(coordinates ?? value)
  const [manual, setManual] = useState({ lat: '', lng: '' })
  const [manualError, setManualError] = useState('')

  useEffect(() => {
    if (!current) return
    setManual({
      lat: String(current.lat),
      lng: String(current.lng),
    })
  }, [current?.lat, current?.lng])

  function setManualField(field, nextValue) {
    setManual((prev) => ({ ...prev, [field]: nextValue }))
    setManualError('')
  }

  function applyManualCoordinates() {
    const lat = Number(manual.lat)
    const lng = Number(manual.lng)

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setManualError('Enter valid latitude and longitude numbers.')
      return
    }
    if (lat < -90 || lat > 90) {
      setManualError('Latitude must be between -90 and 90.')
      return
    }
    if (lng < -180 || lng > 180) {
      setManualError('Longitude must be between -180 and 180.')
      return
    }

    onChange?.({ lat, lng })
    setManualError('')
  }

  function clearCoordinates() {
    setManual({ lat: '', lng: '' })
    setManualError('')
    onClear?.()
    onChange?.(null)
  }

  return (
    <div className="form-group">
      <label>GPS Coordinates</label>
      <div className="gps-row">
        {onCapture && (
          <button type="button" className="btn btn--ghost" onClick={onCapture} disabled={loading} style={{ flexShrink: 0 }}>
            {loading
              ? <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> Getting location…</>
              : <><Crosshair size={15} /> Capture GPS</>
            }
          </button>
        )}

        {current ? (
          <div className="gps-coords">
            <MapPin size={12} style={{ marginRight: 4, color: '#065f46' }} />
            {current.lat.toFixed(6)}, {current.lng.toFixed(6)}
            <a
              href={`https://www.google.com/maps?q=${current.lat},${current.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ marginLeft: 10 }}
            >
              View in Maps ↗
            </a>
            <button
              type="button"
              onClick={clearCoordinates}
              style={{ marginLeft: 10, background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 12 }}
            >
              ✕ Clear
            </button>
          </div>
        ) : (
          <span style={{ fontSize: 13, color: '#9ca3af' }}>No coordinates captured</span>
        )}
      </div>

      <div className="gps-manual-row">
        <input
          className="input"
          type="number"
          step="any"
          value={manual.lat}
          onChange={(e) => setManualField('lat', e.target.value)}
          placeholder="Latitude"
        />
        <input
          className="input"
          type="number"
          step="any"
          value={manual.lng}
          onChange={(e) => setManualField('lng', e.target.value)}
          placeholder="Longitude"
        />
        <button
          type="button"
          className="btn btn--ghost"
          onClick={applyManualCoordinates}
          disabled={!onChange}
        >
          Set
        </button>
      </div>

      {error && (
        <div style={{ fontSize: 12, color: '#dc2626', marginTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
          <AlertCircle size={12} /> {error}
        </div>
      )}

      {manualError && (
        <div style={{ fontSize: 12, color: '#dc2626', marginTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
          <AlertCircle size={12} /> {manualError}
        </div>
      )}

      {current && (
        <iframe
          title="Location preview"
          src={`https://maps.google.com/maps?q=${current.lat},${current.lng}&z=16&output=embed`}
          style={{ width: '100%', height: 220, border: 0, borderRadius: 8, marginTop: 10 }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      )}
    </div>
  )
}
