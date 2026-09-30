import Dexie from 'dexie'

export const offlineDb = new Dexie('fieldsync-offline')

offlineDb.version(1).stores({
  patients: '&localId, serverId, workerId, fullName, phone, status, syncStatus, updatedAt',
  visits: '&localId, serverId, patientLocalId, workerId, visitDate, visitType, syncStatus, followUpStatus, followUpDate',
  syncQueue: '++queueId, &localId, workerId, entityType, operation, syncStatus, createdAt, nextRetryAt, [workerId+createdAt]',
  syncHistory: '++historyId, localId, workerId, entityType, operation, syncStatus, createdAt, syncedAt',
  session: '&key',
})

export function notifyOfflineDataChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('fieldsync:data-change'))
  }
}
