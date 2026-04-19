import { useState } from 'react'
import { Geolocation } from '@capacitor/geolocation'

/**
 * useGPS — wraps @capacitor/geolocation.
 *
 * On native: uses the device's GPS (more accurate, works without browser prompt).
 * On web: Capacitor delegates to navigator.geolocation.
 *
 * Exposes setCoordinates so the caller can pre-fill coordinates (e.g. in edit mode).
 */
export function useGPS(initial = null) {
  const [coordinates, setCoordinates] = useState(initial)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function capture() {
    setLoading(true)
    setError('')

    try {
      // Request permissions — required on native; no-op on web
      const perms = await Geolocation.requestPermissions()
      if (perms.location === 'denied') {
        setError('Location permission denied. Enable it in your device settings.')
        return
      }

      const pos = await Geolocation.getCurrentPosition({
        timeout: 15000,
        enableHighAccuracy: true,
      })

      setCoordinates({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      })
    } catch (err) {
      const msg = err?.message ?? ''
      if (msg.includes('denied') || msg.includes('permission')) {
        setError('Location access denied. Allow location in device settings.')
      } else if (msg.includes('timeout') || msg.includes('Timeout')) {
        setError('Location timed out. Move to an open area and try again.')
      } else if (msg.includes('unavailable') || msg.includes('not available')) {
        setError('Location unavailable. Try again.')
      } else {
        setError('Could not get location. Try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  function clear() {
    setCoordinates(null)
    setError('')
  }

  return { coordinates, setCoordinates, loading, error, capture, clear }
}
