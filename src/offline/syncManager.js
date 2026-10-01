import api from '../services/api.js'
import { offlineDb, notifyOfflineDataChanged } from './db.js'
import { getCachedUser } from './session.js'

const MAX_RETRY_DELAY_MS = 5 * 60 * 1000
const RETRY_INTERVAL_MS = 15000
const SYNC_REPORT_INTERVAL_MS = 60 * 1000
let started = false
let syncing = false
let runtimeStatus = 'ONLINE'
let deviceIdCache = ''
const lastQueueReport = new Map()
const queuedReports = new Map()
const reportingWorkers = new Set()

function setRuntimeStatus(status) {
  runtimeStatus = status
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('fieldsync:sync-state'))
  }
}

function getErrorMessage(error) {
  return error.response?.data?.message || error.message || 'Synchronization failed'
}

function getSyncDeviceId() {
  if (deviceIdCache) return deviceIdCache
  const key = 'fieldsync-sync-device-id'
  try {
    const existing = window.localStorage.getItem(key)
    if (existing) {
      deviceIdCache = existing
      return existing
    }
    deviceIdCache = crypto.randomUUID()
    window.localStorage.setItem(key, deviceIdCache)
  } catch {
    deviceIdCache = crypto.randomUUID()
  }
  return deviceIdCache
}

async function reportPendingOperations(workerId, count) {
  try {
    if (!window.localStorage) return
  } catch {
    return
  }
  queuedReports.set(workerId, count)
  if (reportingWorkers.has(workerId)) return
  reportingWorkers.add(workerId)
  try {
    while (queuedReports.has(workerId)) {
      const pendingOperations = queuedReports.get(workerId)
      queuedReports.delete(workerId)
      const previous = lastQueueReport.get(workerId)
      if (previous?.count === pendingOperations && Date.now() - previous.at < SYNC_REPORT_INTERVAL_MS) continue
      try {
        await api.put('/asha/sync-report', { deviceId: getSyncDeviceId(), pendingOperations })
        lastQueueReport.set(workerId, { count: pendingOperations, at: Date.now() })
      } catch {
        // Reporting is best effort and must never delay patient synchronization.
        return
      }
    }
  } finally {
    reportingWorkers.delete(workerId)
  }
}

function canRetry(error) {
  return !error.response || [408, 425, 429].includes(error.response.status) || error.response.status >= 500
}

function retryDelay(retryCount) {
  return Math.min(1000 * (2 ** Math.min(retryCount, 9)), MAX_RETRY_DELAY_MS)
}

async function syncPatientCreate(operation) {
  const { data } = await api.post('/asha/patients', {
    ...operation.payload.patient,
    clientOperationId: operation.localId,
  })
  return { serverId: data.patient._id, serverRecord: data.patient }
}

async function syncPatientUpdate(operation) {
  const patient = await offlineDb.patients.get(operation.payload.localId)
  if (!patient?.serverId) throw new Error('Patient create must sync before this update')
  const { data } = await api.patch(`/asha/patients/${patient.serverId}`, {
    ...operation.payload,
    clientOperationId: operation.localId,
  })
  return { serverId: patient.serverId, serverRecord: data.patient, conflicts: data.conflicts || [], conflictCount: data.conflicts?.length || 0 }
}

async function syncPatientArchive(operation) {
  const patient = await offlineDb.patients.get(operation.payload.localId)
  if (!patient?.serverId) throw new Error('Patient create must sync before archiving')
  const { data } = await api.delete(`/asha/patients/${patient.serverId}`, {
    data: { baseVersion: patient.version ?? operation.payload.baseVersion, clientOperationId: operation.localId },
  })
  return { serverId: patient.serverId, serverRecord: data.patient }
}

async function syncVisitCreate(operation) {
  const visit = await offlineDb.visits.get(operation.payload.localId)
  const patient = visit && await offlineDb.patients.get(visit.patientLocalId)
  if (!visit || !patient?.serverId) throw new Error('Patient must sync before its visit')

  let followUpOf = null
  if (visit.followUpOfLocalId) {
    const sourceVisit = await offlineDb.visits.get(visit.followUpOfLocalId)
    if (!sourceVisit?.serverId) throw new Error('Scheduled visit must sync before its follow-up')
    followUpOf = sourceVisit.serverId
  }

  const visitPayload = { ...visit }
  for (const localField of ['localId', 'serverId', 'patient', 'patientLocalId', 'followUpOfLocalId', 'workerId', 'syncStatus', 'followUpStatus', 'followUpDate', 'lastSyncError', 'syncedAt']) {
    delete visitPayload[localField]
  }
  const { data } = await api.post(`/asha/patients/${patient.serverId}/visits`, {
    ...visitPayload,
    followUpOf,
    clientOperationId: operation.localId,
  })
  return { serverId: data.visit._id, serverRecord: data.visit }
}

async function syncVisitUpdate(operation) {
  const visit = await offlineDb.visits.get(operation.payload.localId)
  const patient = visit && await offlineDb.patients.get(visit.patientLocalId)
  if (!visit?.serverId || !patient?.serverId) throw new Error('Patient and visit must be synchronized before updating')
  const { data } = await api.patch(`/asha/patients/${patient.serverId}/visits/${visit.serverId}`, {
    ...operation.payload,
    clientOperationId: operation.localId,
  })
  return { serverId: visit.serverId, serverRecord: data.visit, conflicts: data.conflicts || [], conflictCount: data.conflicts?.length || 0 }
}

async function sendOperation(operation) {
  if (operation.entityType === 'PATIENT' && operation.operation === 'CREATE') {
    return syncPatientCreate(operation)
  }
  if (operation.entityType === 'PATIENT' && operation.operation === 'UPDATE') {
    return syncPatientUpdate(operation)
  }
  if (operation.entityType === 'PATIENT' && operation.operation === 'ARCHIVE') {
    return syncPatientArchive(operation)
  }
  if (operation.entityType === 'VISIT' && operation.operation === 'CREATE') {
    return syncVisitCreate(operation)
  }
  if (operation.entityType === 'VISIT' && operation.operation === 'UPDATE') {
    return syncVisitUpdate(operation)
  }
  throw new Error(`Unsupported queued operation: ${operation.entityType}/${operation.operation}`)
}

async function markEntity(operation, syncStatus, result = {}) {
  const table = operation.entityType === 'PATIENT' ? offlineDb.patients : offlineDb.visits
  const entity = await table.get(operation.payload.localId)
  if (!entity) return
  const lastSyncError = syncStatus === 'SYNCED'
    ? ''
    : Object.hasOwn(result, 'lastSyncError') ? result.lastSyncError : entity.lastSyncError || ''
  await table.put({ ...entity, syncStatus, ...result, lastSyncError })
}

async function updateOfflineRecord(table, id, changes) {
  const record = await table.get(id)
  if (!record) return false
  await table.put({ ...record, ...changes })
  return true
}

function flattenChangePaths(changes, prefix = '', flattened = {}) {
  for (const [key, value] of Object.entries(changes || {})) {
    const path = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      flattenChangePaths(value, path, flattened)
    } else {
      flattened[path] = value
    }
  }
  return flattened
}

function applyQueuedChanges(record, changes) {
  const updated = structuredClone(record)
  for (const [path, value] of Object.entries(flattenChangePaths(changes))) {
    const parts = path.split('.')
    const leaf = parts.pop()
    let target = updated
    for (const part of parts) {
      target[part] = target[part] && typeof target[part] === 'object' ? { ...target[part] } : {}
      target = target[part]
    }
    target[leaf] = value
  }
  return updated
}

async function recordSuccess(operation, result) {
  await offlineDb.transaction('rw', offlineDb.patients, offlineDb.visits, offlineDb.syncQueue, offlineDb.syncHistory, async () => {
    const entityTable = operation.entityType === 'PATIENT' ? offlineDb.patients : offlineDb.visits
    const entity = await entityTable.get(operation.payload.localId)
    if (entity) {
      const serverRecord = result.serverRecord || {}
      const laterOperations = (await offlineDb.syncQueue.where('workerId').equals(operation.workerId).toArray())
        .filter((queuedOperation) => queuedOperation.entityType === operation.entityType
          && queuedOperation.payload.localId === operation.payload.localId
          && queuedOperation.queueId > operation.queueId)
        .sort((left, right) => left.queueId - right.queueId)
      let merged = {
        ...entity,
        ...serverRecord,
        _id: entity.localId,
        localId: entity.localId,
        serverId: result.serverId,
        workerId: entity.workerId,
        patient: entity.patientLocalId || entity.patient,
        patientLocalId: entity.patientLocalId,
      }
      for (const queuedOperation of laterOperations) {
        if (queuedOperation.operation === 'UPDATE') {
          merged = applyQueuedChanges(merged, queuedOperation.payload.changes)
        } else if (queuedOperation.operation === 'ARCHIVE') {
          merged.status = 'ARCHIVED'
        }
      }
      await entityTable.put({
        ...merged,
        syncStatus: laterOperations.length ? 'PENDING' : 'SYNCED',
        lastSyncError: '',
        syncedAt: new Date().toISOString(),
      })
    }
    await offlineDb.syncQueue.delete(operation.queueId)
    await offlineDb.syncHistory.add({
      localId: operation.localId,
      workerId: operation.workerId,
      entityType: operation.entityType,
      operation: operation.operation,
      syncStatus: 'SYNCED',
      createdAt: operation.createdAt,
      syncedAt: new Date().toISOString(),
      serverId: result.serverId,
      conflictCount: result.conflictCount || 0,
    })
  })
  notifyOfflineDataChanged()
}

async function recordConflict(operation, result) {
  const conflicts = result.conflicts || []
  const now = new Date().toISOString()
  await offlineDb.transaction('rw', offlineDb.patients, offlineDb.visits, offlineDb.syncQueue, offlineDb.syncHistory, async () => {
    const entityTable = operation.entityType === 'PATIENT' ? offlineDb.patients : offlineDb.visits
    const entity = await entityTable.get(operation.payload.localId)
    if (entity) {
      const serverRecord = result.serverRecord || {}
      const laterOperations = (await offlineDb.syncQueue.where('workerId').equals(operation.workerId).toArray())
        .filter((queuedOperation) => queuedOperation.entityType === operation.entityType
          && queuedOperation.payload.localId === operation.payload.localId
          && queuedOperation.operation === 'UPDATE'
          && queuedOperation.queueId >= operation.queueId)
        .sort((left, right) => left.queueId - right.queueId)
      let merged = {
        ...entity,
        ...serverRecord,
        _id: entity.localId,
        localId: entity.localId,
        serverId: result.serverId || entity.serverId,
        workerId: entity.workerId,
        patient: entity.patientLocalId || entity.patient,
        patientLocalId: entity.patientLocalId,
      }
      for (const queuedOperation of laterOperations) {
        merged = applyQueuedChanges(merged, queuedOperation.payload.changes)
      }
      await entityTable.put({
        ...merged,
        syncStatus: 'CONFLICT',
        lastSyncError: '',
        syncedAt: now,
      })
    }
    await updateOfflineRecord(offlineDb.syncQueue, operation.queueId, {
      syncStatus: 'CONFLICT',
      retryable: false,
      nextRetryAt: null,
      lastError: 'Conflicting changes need review',
      conflicts,
      serverVersion: result.serverRecord?.version ?? null,
    })
    await offlineDb.syncHistory.add({
      localId: operation.localId,
      workerId: operation.workerId,
      entityType: operation.entityType,
      operation: operation.operation,
      syncStatus: 'CONFLICT',
      createdAt: operation.createdAt,
      failedAt: now,
      retryCount: operation.retryCount,
      conflictCount: conflicts.length,
      conflictFields: conflicts.map((conflict) => conflict.field),
    })
  })
  notifyOfflineDataChanged()
}

async function recordFailure(operation, error) {
  const retryCount = operation.retryCount + 1
  const retryable = canRetry(error)
  const delay = retryable ? retryDelay(retryCount) : null
  await offlineDb.transaction('rw', offlineDb.patients, offlineDb.visits, offlineDb.syncQueue, offlineDb.syncHistory, async () => {
    await updateOfflineRecord(offlineDb.syncQueue, operation.queueId, {
      retryCount,
      syncStatus: 'SYNC_FAILED',
      lastError: getErrorMessage(error),
      retryable,
      nextRetryAt: delay ? new Date(Date.now() + delay).toISOString() : null,
    })
    await markEntity(operation, 'SYNC_FAILED', { lastSyncError: getErrorMessage(error) })
    await offlineDb.syncHistory.add({
      localId: operation.localId,
      workerId: operation.workerId,
      entityType: operation.entityType,
      operation: operation.operation,
      syncStatus: 'SYNC_FAILED',
      createdAt: operation.createdAt,
      syncedAt: null,
      failedAt: new Date().toISOString(),
      retryCount,
      lastError: getErrorMessage(error),
    })
  })
  notifyOfflineDataChanged()
  return { retryable, nextRetryAt: delay ? Date.now() + delay : null }
}

async function runQueue({ recheckConflicts = false } = {}) {
  if (syncing || !navigator.onLine) {
    if (!navigator.onLine) setRuntimeStatus('OFFLINE')
    return
  }

  const user = await getCachedUser()
  if (!user || user.role !== 'ASHA_WORKER' || user.status !== 'APPROVED') {
    setRuntimeStatus('ONLINE')
    return
  }

  syncing = true
  setRuntimeStatus('SYNCING')
  try {
    const queued = (await offlineDb.syncQueue.orderBy('queueId').toArray())
      .filter((operation) => operation.workerId === user.id)
    void reportPendingOperations(user.id, queued.length)
    let hadFailure = false
    let hadConflict = false
    for (const operation of queued) {
      if (operation.syncStatus === 'CONFLICT' && !recheckConflicts) {
        hadConflict = true
        break
      }
      if (operation.syncStatus === 'SYNC_FAILED' && (!operation.retryable || Date.parse(operation.nextRetryAt) > Date.now())) {
        continue
      }
      await updateOfflineRecord(offlineDb.syncQueue, operation.queueId, {
        syncStatus: 'SYNCING',
        attemptedAt: operation.attemptedAt || new Date().toISOString(),
        lastError: '',
      })
      await markEntity(operation, 'SYNCING')
      notifyOfflineDataChanged()
      try {
        const result = await sendOperation(operation)
        const unresolvedConflicts = (result.conflicts || []).filter((conflict) => conflict.status !== 'RESOLVED')
        if (unresolvedConflicts.length) {
          await recordConflict(operation, { ...result, conflicts: unresolvedConflicts })
          hadConflict = true
          break
        }
        await recordSuccess(operation, result)
      } catch (error) {
        const failure = await recordFailure(operation, error)
        hadFailure = true
        if (failure.retryable || operation.entityType === 'PATIENT' || operation.entityType === 'VISIT') break
      }
    }
    const remaining = await offlineDb.syncQueue.where('workerId').equals(user.id).count()
    const failed = await offlineDb.syncQueue.where('workerId').equals(user.id).filter((item) => item.syncStatus === 'SYNC_FAILED').count()
    const conflicts = await offlineDb.syncQueue.where('workerId').equals(user.id).filter((item) => item.syncStatus === 'CONFLICT').count()
    void reportPendingOperations(user.id, remaining)
    if (hadConflict || conflicts > 0) setRuntimeStatus('CONFLICT')
    else if (hadFailure || failed > 0) setRuntimeStatus('SYNC_FAILED')
    else if (remaining === 0) setRuntimeStatus('SYNCED')
    else setRuntimeStatus('ONLINE')
  } finally {
    syncing = false
    notifyOfflineDataChanged()
    window.dispatchEvent(new Event('fieldsync:sync-state'))
  }
}

export function getSyncRuntimeStatus() {
  return runtimeStatus
}

export async function synchronizeNow({ recheckConflicts = true } = {}) {
  if (navigator.locks?.request) {
    try {
      return await navigator.locks.request('fieldsync-sync-queue', { mode: 'exclusive', ifAvailable: true }, (lock) => (
        lock ? runQueue({ recheckConflicts }) : undefined
      ))
    } catch {
      // Older or restricted browsers still use the per-tab single-run guard.
    }
  }
  return runQueue({ recheckConflicts })
}

export async function retrySyncOperation(localId, workerId) {
  const operation = await offlineDb.syncQueue.where('localId').equals(localId).first()
  if (!operation || operation.workerId !== workerId) return false
  await updateOfflineRecord(offlineDb.syncQueue, operation.queueId, {
    syncStatus: 'PENDING',
    retryCount: 0,
    retryable: true,
    nextRetryAt: new Date().toISOString(),
    lastError: '',
    conflicts: [],
    serverVersion: null,
  })
  await markEntity(operation, 'PENDING', { lastSyncError: '' })
  notifyOfflineDataChanged()
  void synchronizeNow({ recheckConflicts: false })
  return true
}

export function startSyncManager() {
  if (started || typeof window === 'undefined') return
  started = true
  const handleOnline = () => {
    setRuntimeStatus('ONLINE')
    void synchronizeNow({ recheckConflicts: false })
  }
  const handleOffline = () => setRuntimeStatus('OFFLINE')
  const handleSessionChange = () => { void synchronizeNow({ recheckConflicts: false }) }
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
  window.addEventListener('fieldsync:session-change', handleSessionChange)
  window.setInterval(() => { void synchronizeNow({ recheckConflicts: false }) }, RETRY_INTERVAL_MS)
  setRuntimeStatus(navigator.onLine ? 'ONLINE' : 'OFFLINE')
  if (navigator.onLine) void synchronizeNow({ recheckConflicts: false })
}
