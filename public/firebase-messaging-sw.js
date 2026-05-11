importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey:            'AIzaSyD-2lq_h2ILttVHnN3dIRuOBufE5-ZF_KU',
  authDomain:        'epa-kon-pms.firebaseapp.com',
  projectId:         'epa-kon-pms',
  storageBucket:     'epa-kon-pms.firebasestorage.app',
  messagingSenderId: '587824539288',
  appId:             '1:587824539288:web:b3e911276e756fd9e812ed',
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? 'EPA PMS'
  const body  = payload.notification?.body  ?? ''
  self.registration.showNotification(title, {
    body,
    icon:  '/favicon.svg',
    badge: '/favicon.svg',
    data:  { url: '/' },
  })
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(clients.openWindow(event.notification.data?.url ?? '/'))
})
