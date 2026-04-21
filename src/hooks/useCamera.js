import { useState } from 'react'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { Capacitor } from '@capacitor/core'

export function useCamera() {
  const [capturing, setCapturing] = useState(false)
  const [error, setError] = useState('')

  async function capturePhoto(source = CameraSource.Prompt) {
    setCapturing(true)
    setError('')

    try {
      // On native (Android/iOS), explicitly request permissions first.
      // On web, skip — getPhoto() handles the file picker directly.
      if (Capacitor.isNativePlatform()) {
        const perms = await Camera.requestPermissions({ permissions: ['camera', 'photos'] })
        if (perms.camera === 'denied' && perms.photos === 'denied') {
          setError('Camera permission denied. Go to Settings → Apps → EPA Permit → Permissions and enable Camera.')
          return null
        }
      }

      const photo = await Camera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source,
        quality: 75,
        allowEditing: false,
        width: 1280,
      })
      return photo.dataUrl ?? null
    } catch (err) {
      const msg = (err?.message ?? '').toLowerCase()
      // User cancelled — silent
      if (
        msg.includes('cancel') ||
        msg.includes('no image') ||
        msg.includes('user denied') ||
        msg.includes('dismissed')
      ) {
        return null
      }
      console.error('Camera error:', err)
      setError('Could not open camera. Check that the app has Camera permission in device Settings.')
      return null
    } finally {
      setCapturing(false)
    }
  }

  return { capturePhoto, capturing, cameraError: error, CameraSource }
}
