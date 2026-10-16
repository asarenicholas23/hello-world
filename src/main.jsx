import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import './index.css'
import App from './App.jsx'

// In the Android/iOS app, behave like a native app: no pinch/double-tap zoom.
// The `native-app` class scopes mobile-only CSS fixes (see index.css) so the
// desktop web build is untouched.
if (Capacitor.isNativePlatform()) {
  document.documentElement.classList.add('native-app')
  document.querySelector('meta[name="viewport"]')?.setAttribute(
    'content',
    'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover',
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
