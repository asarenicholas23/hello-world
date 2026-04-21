import { useState } from 'react'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { Capacitor } from '@capacitor/core'

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function useCamera() {
  const [capturing, setCapturing] = useState(false)
  const [error, setError]         = useState('')

  async function capturePhoto(source = CameraSource.Prompt) {
    setCapturing(true)
    setError('')

    try {
      // ── Native (APK / iOS app) ────────────────────────────
      if (Capacitor.isNativePlatform()) {
        const perms = await Camera.requestPermissions({ permissions: ['camera', 'photos'] })
        if (perms.camera === 'denied' && perms.photos === 'denied') {
          setError('Camera permission denied. Go to Settings → Apps → EPA Permit → Permissions.')
          return null
        }
        const photo = await Camera.getPhoto({
          resultType:   CameraResultType.DataUrl,
          source,
          quality:      75,
          allowEditing: false,
          width:        1280,
        })
        return photo.dataUrl ?? null
      }

      // ── Web / PWA ─────────────────────────────────────────
      // Capacitor's web Camera impl uses a programmatic input.click() which
      // iOS Safari PWA blocks. Instead we create and click a raw file input
      // synchronously within this user-gesture call frame.
      return await new Promise((resolve) => {
        const input    = document.createElement('input')
        input.type     = 'file'
        input.accept   = 'image/*'
        // 'capture' omitted intentionally — lets user choose camera OR gallery
        input.onchange = async (e) => {
          const file = e.target.files?.[0]
          if (!file) { resolve(null); return }
          try   { resolve(await fileToDataUrl(file)) }
          catch { setError('Could not read image file.'); resolve(null) }
        }
        // Cancelled without selecting
        input.addEventListener('cancel', () => resolve(null), { once: true })
        input.click()
      })

    } catch (err) {
      const msg = (err?.message ?? '').toLowerCase()
      if (msg.includes('cancel') || msg.includes('no image') ||
          msg.includes('user denied') || msg.includes('dismissed')) {
        return null
      }
      console.error('Camera error:', err)
      setError('Could not open camera. Check camera permissions in device Settings.')
      return null
    } finally {
      setCapturing(false)
    }
  }

  return { capturePhoto, capturing, cameraError: error, CameraSource }
}
