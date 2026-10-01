import Dexie from 'dexie'
import { decryptOfflineRecord, encryptOfflineRecord } from './offlineVaultCrypto.js'

export const offlineDb = new Dexie('fieldsync-offline')

offlineDb.version(1).stores({
  patients: '&localId, serverId, workerId, fullName, phone, status, syncStatus, updatedAt',
  visits: '&localId, serverId, patientLocalId, workerId, visitDate, visitType, syncStatus, followUpStatus, followUpDate',
  syncQueue: '++queueId, &localId, workerId, entityType, operation, syncStatus, createdAt, nextRetryAt, [workerId+createdAt]',
  syncHistory: '++historyId, localId, workerId, entityType, operation, syncStatus, createdAt, syncedAt',
  session: '&key',
})

offlineDb.version(2).stores({ vaults: '&userId' })

offlineDb.use({
  stack: 'dbcore',
  name: 'OfflineRecordEncryption',
  level: 1,
  create(downCore) {
    return {
      ...downCore,
      table(tableName) {
        const downTable = downCore.table(tableName)
        if (!['patients', 'visits', 'syncQueue', 'syncHistory', 'session'].includes(tableName)) return downTable

        return {
          ...downTable,
          get(request) {
            return Dexie.waitFor(downTable.get(request).then((value) => decryptOfflineRecord(tableName, value)))
          },
          getMany(request) {
            return Dexie.waitFor(downTable.getMany(request).then((values) => (
              Promise.all(values.map((value) => decryptOfflineRecord(tableName, value)))
            )))
          },
          query(request) {
            return Dexie.waitFor(downTable.query(request).then((result) => {
              if (!request.values) return result
              return Promise.all(result.result.map((value) => decryptOfflineRecord(tableName, value)))
                .then((clearValues) => ({ ...result, result: clearValues }))
            }))
          },
          mutate(request) {
            if (request.type !== 'add' && request.type !== 'put') return downTable.mutate(request)
            const keepTransactionOpen = Promise.all(request.values.map((value) => encryptOfflineRecord(tableName, value)))
            return Dexie.waitFor(keepTransactionOpen).then((values) => downTable.mutate({
              ...request,
              values,
              // Avoid IndexedDB's partial-update optimization, which would bypass encryption.
              criteria: undefined,
              changeSpec: undefined,
            }))
          },
          async openCursor(request) {
            const cursor = await downTable.openCursor(request)
            if (!cursor) return null
            let clearValue
            const wrappedCursor = Object.create(cursor)
            Object.defineProperty(wrappedCursor, 'value', { get: () => clearValue })
            wrappedCursor.start = (callback) => cursor.start(() => {
              Dexie.waitFor(decryptOfflineRecord(tableName, cursor.value))
                .then((value) => {
                  clearValue = value
                  callback()
                })
                .catch((error) => cursor.fail(error))
            })
            for (const method of ['continue', 'continuePrimaryKey', 'advance', 'stop', 'fail']) {
              wrappedCursor[method] = (...args) => cursor[method](...args)
            }
            wrappedCursor.next = async () => {
              await wrappedCursor.start(() => wrappedCursor.continue())
              return wrappedCursor
            }
            return wrappedCursor
          },
        }
      },
    }
  },
})

export function notifyOfflineDataChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('fieldsync:data-change'))
  }
}
