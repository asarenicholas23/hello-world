import { useState } from 'react'
import { Geolocation } from '@capacitor/geolocation'
import { Capacitor } from '@capacitor/core'

export function useGPS(initial = null) {
  const [coordinates, setCoordinates] = useState(initial)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function capture() {
    setLoading(true)
    setError('')

    try {
      // On native, request permission explicitly first
      if (Capacitor.isNativePlatform()) {
        const perms = await Geolocation.requestPermissions()
        if (perms.location === 'denied') {
          setError('Location permission denied. Go to Settings → Apps → EPA Permit → Permissions and enable Location.')
          return
        }
      }

      const pos = await Geolocation.getCurrentPosition({
        timeout: 20000,
        enableHighAccuracy: true,
      })

      setCoordinates({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      })
    } catch (err) {
      const msg = (err?.message ?? '').toLowerCase()
      if (msg.includes('denied') || msg.includes('permission') || msg.includes('not authorized')) {
        setError('Location access denied. Enable Location in device Settings → Apps → EPA Permit → Permissions.')
      } else if (msg.includes('timeout') || msg.includes('timed out')) {
        setError('GPS timed out. Move to an open area, ensure Location is on, and try again.')
      } else if (
        msg.includes('unavailable') ||
        msg.includes('not available') ||
        msg.includes('disabled') ||
        msg.includes('turned off') ||
        msg.includes('location services')
      ) {
        setError('Location services are off. Turn on Location in device Settings and try again.')
      } else {
        // Catch-all — also covers "Location services are not enabled"
        setError('Could not get location. Make sure Location is turned on in device Settings, then try again.')
        console.error('GPS error:', err)
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
