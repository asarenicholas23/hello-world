import { useState } from 'react'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'

/**
 * useCamera — wraps @capacitor/camera.
 *
 * On native (iOS / Android): opens the native camera or photo picker.
 * On web: falls back to the browser file picker (input[type=file]).
 *
 * Returns a base64 data URL (string) or null if the user cancelled.
 */
export function useCamera() {
  const [capturing, setCapturing] = useState(false)
  const [error, setError] = useState('')

  /**
   * @param {CameraSource} source  Prompt | Camera | Photos
   * @returns {Promise<string|null>}  data URL or null
   */
  async function capturePhoto(source = CameraSource.Prompt) {
    setCapturing(true)
    setError('')

    try {
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source,
        quality: 80,
        allowEditing: false,
        width: 1280,
      })
      return photo.dataUrl ?? null
    } catch (err) {
      // User cancelled — not an error we need to surface
      const msg = err?.message ?? ''
      if (
        msg.includes('cancelled') ||
        msg.includes('canceled') ||
        msg.includes('No image') ||
        msg.includes('User denied')
      ) {
        return null
      }
      setError('Could not capture photo. Check camera permissions and try again.')
      return null
    } finally {
      setCapturing(false)
    }
  }

  return { capturePhoto, capturing, cameraError: error, CameraSource }
}
