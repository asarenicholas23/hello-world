/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { createFacility } from '../firebase/facilities'

const STORAGE_KEY = 'epa_facility_drafts'

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

  // Keep refs so the processing effect always reads the latest values
  // without needing them as dependencies (avoids re-triggering on every change).
  const draftsRef = useRef(drafts)
  const syncingRef = useRef(syncing)
  useEffect(() => { draftsRef.current = drafts }, [drafts])
  useEffect(() => { syncingRef.current = syncing }, [syncing])

  // Track online/offline
  useEffect(() => {
    function goOnline() { setIsOnline(true) }
    function goOffline() { setIsOnline(false) }
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  // Auto-sync drafts when coming back online
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
  }, [isOnline]) // draftsRef/syncingRef intentionally omitted — they're refs

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
      value={{ isOnline, drafts, addDraft, removeDraft, syncing, syncStatus, pendingCount }}
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
