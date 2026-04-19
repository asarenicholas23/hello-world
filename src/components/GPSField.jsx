import { Crosshair, Loader, MapPin, AlertCircle } from 'lucide-react'

/**
 * Reusable GPS capture field.
 * Props: coordinates, loading, error, onCapture, onClear
 */
export default function GPSField({ coordinates, loading, error, onCapture, onClear }) {
  return (
    <div className="form-group">
      <label>GPS Coordinates</label>
      <div className="gps-row">
        <button type="button" className="btn btn--ghost" onClick={onCapture} disabled={loading} style={{ flexShrink: 0 }}>
          {loading
            ? <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> Getting location…</>
            : <><Crosshair size={15} /> Capture GPS</>
          }
        </button>

        {coordinates ? (
          <div className="gps-coords">
            <MapPin size={12} style={{ marginRight: 4, color: '#065f46' }} />
            {coordinates.lat.toFixed(6)}, {coordinates.lng.toFixed(6)}
            <a
              href={`https://www.google.com/maps?q=${coordinates.lat},${coordinates.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ marginLeft: 10 }}
            >
              View in Maps ↗
            </a>
            <button
              type="button"
              onClick={onClear}
              style={{ marginLeft: 10, background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 12 }}
            >
              ✕ Clear
            </button>
          </div>
        ) : (
          <span style={{ fontSize: 13, color: '#9ca3af' }}>No coordinates captured</span>
        )}
      </div>

      {error && (
        <div style={{ fontSize: 12, color: '#dc2626', marginTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
          <AlertCircle size={12} /> {error}
        </div>
      )}

      {coordinates && (
        <iframe
          title="Location preview"
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${coordinates.lng - 0.005},${coordinates.lat - 0.005},${coordinates.lng + 0.005},${coordinates.lat + 0.005}&layer=mapnik&marker=${coordinates.lat},${coordinates.lng}`}
          style={{ width: '100%', height: 200, border: 0, borderRadius: 8, marginTop: 10 }}
        />
      )}
    </div>
  )
}
