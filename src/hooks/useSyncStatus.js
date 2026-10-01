import { useEffect, useState } from 'react'
import { useAuth } from './useAuth.js'
import { getSyncRuntimeStatus, synchronizeNow } from '../offline/syncManager.js'
import { getSyncSnapshot } from '../offline/syncStatus.js'

const EMPTY_SNAPSHOT = { pendingCount: 0, syncedCount: 0, failedCount: 0, conflictCount: 0, queue: [], history: [] }

function currentStatus(isOnline, runtimeStatus, snapshot) {
  if (!isOnline) return 'OFFLINE'
  if (runtimeStatus === 'SYNCING') return 'SYNCING'
  if (snapshot.conflictCount > 0 || runtimeStatus === 'CONFLICT') return 'CONFLICT'
  if (snapshot.failedCount > 0 || runtimeStatus === 'SYNC_FAILED') return 'SYNC_FAILED'
  if (snapshot.pendingCount === 0 && snapshot.history.some((item) => item.syncStatus === 'SYNCED')) return 'SYNCED'
  return 'ONLINE'
}

export function useSyncStatus() {
  const { user } = useAuth()
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  const [runtimeStatus, setRuntimeStatus] = useState(getSyncRuntimeStatus())
  const [snapshot, setSnapshot] = useState(EMPTY_SNAPSHOT)

  useEffect(() => {
    let active = true
    const workerId = user?.role === 'ASHA_WORKER' ? user.id : null

    async function refresh() {
      const result = await getSyncSnapshot(workerId).catch(() => EMPTY_SNAPSHOT)
      if (active) setSnapshot(result)
    }
    function handleOnline() { setIsOnline(true); void refresh() }
    function handleOffline() { setIsOnline(false); void refresh() }
    function handleDataChange() { void refresh() }
    function handleSyncState() { setRuntimeStatus(getSyncRuntimeStatus()); void refresh() }

    void refresh()
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('fieldsync:data-change', handleDataChange)
    window.addEventListener('fieldsync:sync-state', handleSyncState)
    return () => {
      active = false
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('fieldsync:data-change', handleDataChange)
      window.removeEventListener('fieldsync:sync-state', handleSyncState)
    }
  }, [user?.id, user?.role])

  return {
    status: currentStatus(isOnline, runtimeStatus, snapshot),
    isOnline,
    pendingCount: snapshot.pendingCount,
    syncedCount: snapshot.syncedCount,
    failedCount: snapshot.failedCount,
    conflictCount: snapshot.conflictCount,
    queue: snapshot.queue,
    history: snapshot.history,
    synchronizeNow,
  }
}
