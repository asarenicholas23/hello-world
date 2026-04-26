/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { waitForPendingWrites } from 'firebase/firestore'
import { db } from '../firebase/config'
import { createFacility } from '../firebase/facilities'

const STORAGE_KEY = 'epa_facility_drafts'
let nextToastId = 0

function loadDrafts() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function persistDraftsToStorage(drafts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts))
}

const SyncContext = createContext(null)

export function SyncProvider({ children }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [drafts, setDrafts] = useState(loadDrafts)
  const [syncing, setSyncing] = useState(false)
  const [toasts, setToasts] = useState([])

  const draftsRef = useRef(drafts)
  const syncingRef = useRef(syncing)
  const offlineToastIdRef = useRef(null)

  useEffect(() => { draftsRef.current = drafts }, [drafts])
  useEffect(() => { syncingRef.current = syncing }, [syncing])

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // duration=0 means persistent (must be manually dismissed)
  const pushToast = useCallback((message, type, duration = 4000) => {
    const id = ++nextToastId
    setToasts((prev) => [...prev, { id, message, type }])
    if (duration > 0) {
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration)
    }
    return id
  }, [])

  // Track online/offline transitions and fire toasts
  useEffect(() => {
    function goOffline() {
      setIsOnline(false)
      if (offlineToastIdRef.current === null) {
        offlineToastIdRef.current = pushToast(
          "You're offline — changes you make will be saved and synced automatically when you reconnect.",
          'offline',
          0,
        )
      }
    }

    function goOnline() {
      setIsOnline(true)
      // Dismiss the persistent offline toast
      if (offlineToastIdRef.current !== null) {
        dismissToast(offlineToastIdRef.current)
        offlineToastIdRef.current = null
      }
      // Show syncing toast until Firestore flushes pending writes
      const syncId = pushToast('Back online — syncing your changes…', 'syncing', 0)
      waitForPendingWrites(db)
        .then(() => {
          dismissToast(syncId)
          pushToast('All changes synced', 'success', 3500)
        })
        .catch(() => dismissToast(syncId))
    }

    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [pushToast, dismissToast])

  // Auto-sync facility drafts when coming back online
  useEffect(() => {
    if (!isOnline || draftsRef.current.length === 0 || syncingRef.current) return

    let cancelled = false

    async function process() {
      setSyncing(true)
      const pending = [...draftsRef.current]
      const failed = []

      for (const draft of pending) {
        const { _id, _user_id, _created_at, ...facilityData } = draft
        try {
          await createFacility(facilityData, _user_id)
          console.log(`[sync] Draft ${_id} → synced as ${facilityData.sector_prefix}*`)
        } catch (err) {
          console.warn(`[sync] Draft ${_id} failed:`, err.message)
          failed.push(draft)
        }
      }

      if (!cancelled) {
        persistDraftsToStorage(failed)
        setDrafts(failed)
        setSyncing(false)
      }
    }

    process()
    return () => { cancelled = true }
  }, [isOnline])

  function addDraft(facilityData, userId) {
    const draft = {
      _id: `draft_${Date.now()}`,
      _user_id: userId,
      _created_at: new Date().toISOString(),
      ...facilityData,
    }
    const updated = [...draftsRef.current, draft]
    persistDraftsToStorage(updated)
    setDrafts(updated)
    return draft._id
  }

  function removeDraft(draftId) {
    const updated = draftsRef.current.filter((d) => d._id !== draftId)
    persistDraftsToStorage(updated)
    setDrafts(updated)
  }

  const pendingCount = drafts.length

  const syncStatus = !isOnline
    ? {
        type: 'offline',
        label: pendingCount > 0
          ? `Offline · ${pendingCount} draft${pendingCount !== 1 ? 's' : ''}`
          : 'Offline',
      }
    : syncing
    ? { type: 'syncing', label: 'Syncing…' }
    : pendingCount > 0
    ? { type: 'pending', label: `${pendingCount} draft${pendingCount !== 1 ? 's' : ''} pending` }
    : { type: 'synced', label: 'All synced' }

  return (
    <SyncContext.Provider
      value={{
        isOnline, drafts, addDraft, removeDraft, syncing, syncStatus, pendingCount,
        toasts, pushToast, dismissToast,
      }}
    >
      {children}
    </SyncContext.Provider>
  )
}

export function useSync() {
  const ctx = useContext(SyncContext)
  if (!ctx) throw new Error('useSync must be used inside SyncProvider')
  return ctx
}
