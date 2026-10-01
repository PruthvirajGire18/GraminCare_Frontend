import { offlineDb } from './db.js'

export async function getSyncSnapshot(workerId) {
  if (!workerId) return { pendingCount: 0, syncedCount: 0, failedCount: 0, conflictCount: 0, queue: [], history: [] }
  const [queue, historyRows] = await Promise.all([
    offlineDb.syncQueue.where('workerId').equals(workerId).sortBy('createdAt'),
    offlineDb.syncHistory.where('workerId').equals(workerId).toArray(),
  ])
  const history = historyRows.sort((left, right) => (right.failedAt || right.syncedAt || '').localeCompare(left.failedAt || left.syncedAt || ''))
  const pendingCount = queue.filter((item) => ['PENDING', 'SYNCING'].includes(item.syncStatus)).length
  return {
    pendingCount,
    syncedCount: new Set(historyRows.filter((item) => item.syncStatus === 'SYNCED').map((item) => item.localId)).size,
    failedCount: queue.filter((item) => item.syncStatus === 'SYNC_FAILED').length,
    conflictCount: queue.filter((item) => item.syncStatus === 'CONFLICT').length,
    queue,
    history: history.slice(0, 30),
  }
}
