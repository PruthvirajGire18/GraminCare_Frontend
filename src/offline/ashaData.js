import { offlineDb, notifyOfflineDataChanged } from './db.js'
import { createLocalId } from './ids.js'
import { normalizePatientForOffline, normalizeVisitForOffline } from './validation.js'

function requireWorkerId(workerId) {
  if (!workerId) throw new Error('An authenticated ASHA worker session is required for offline records')
}

function makeQueueOperation({ workerId, entityType, operation, payload, localId = createLocalId() }) {
  return {
    localId,
    workerId,
    entityType,
    operation,
    payload,
    createdAt: new Date().toISOString(),
    retryCount: 0,
    attemptedAt: null,
    syncStatus: 'PENDING',
    retryable: true,
    nextRetryAt: new Date().toISOString(),
    lastError: '',
  }
}

export async function enqueuePatientCreate(payload, workerId) {
  requireWorkerId(workerId)
  const normalizedPatient = normalizePatientForOffline(payload)
  const localId = createLocalId()
  const now = new Date().toISOString()
  const patient = {
    localId,
    _id: localId,
    serverId: null,
    workerId,
    ...normalizedPatient,
    status: 'ACTIVE',
    syncStatus: 'PENDING',
    lastSyncError: '',
    createdAt: now,
    updatedAt: now,
  }
  const operation = makeQueueOperation({
    localId: createLocalId(),
    workerId,
    entityType: 'PATIENT',
    operation: 'CREATE',
    payload: {
      localId,
      patient: {
        fullName: patient.fullName,
        dateOfBirth: patient.dateOfBirth,
        gender: patient.gender,
        phone: patient.phone,
        address: patient.address,
      },
    },
  })
  patient.version = 1
  patient.updatedBy = workerId
  patient.clientOperationId = operation.localId

  await offlineDb.transaction('rw', offlineDb.patients, offlineDb.syncQueue, async () => {
    await offlineDb.patients.add(patient)
    await offlineDb.syncQueue.add(operation)
  })
  notifyOfflineDataChanged()
  return patient
}

function valuesEqual(left, right) {
  const normalize = (value) => value instanceof Date ? value.toISOString() : value ?? null
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right))
}

export async function enqueuePatientUpdate(patient, changes, workerId) {
  requireWorkerId(workerId)
  const normalizedPatient = normalizePatientForOffline({ ...patient, ...changes })
  const normalizedChanges = {}
  const baseValues = {}
  for (const field of ['fullName', 'dateOfBirth', 'gender', 'phone']) {
    if (Object.hasOwn(changes, field) && !valuesEqual(patient[field], normalizedPatient[field])) {
      normalizedChanges[field] = normalizedPatient[field]
      baseValues[field] = patient[field] ?? null
    }
  }
  if (Object.hasOwn(changes, 'address')) {
    const changedAddress = {}
    for (const field of ['village', 'district', 'state', 'details']) {
      if (!valuesEqual(patient.address?.[field], normalizedPatient.address[field])) {
        changedAddress[field] = normalizedPatient.address[field]
        baseValues[`address.${field}`] = patient.address?.[field] ?? ''
      }
    }
    if (Object.keys(changedAddress).length) normalizedChanges.address = changedAddress
  }
  if (Object.keys(baseValues).length === 0) return patient

  const updated = {
    ...patient,
    ...normalizedChanges,
    address: normalizedChanges.address ? { ...patient.address, ...normalizedChanges.address } : patient.address,
    localId: patient.localId,
    _id: patient.localId,
    syncStatus: 'PENDING',
    lastSyncError: '',
    updatedAt: new Date().toISOString(),
  }
  await offlineDb.transaction('rw', offlineDb.patients, offlineDb.syncQueue, async () => {
    const pendingCreate = !patient.serverId
      ? await offlineDb.syncQueue.where('workerId').equals(workerId).filter((item) => (
        item.entityType === 'PATIENT'
        && item.operation === 'CREATE'
        && item.payload.localId === patient.localId
        && item.syncStatus === 'PENDING'
        && item.retryCount === 0
        && !item.attemptedAt
      )).first()
      : null

    if (pendingCreate) {
      updated.clientOperationId = pendingCreate.localId
      await offlineDb.syncQueue.put({
        ...pendingCreate,
        payload: {
          ...pendingCreate.payload,
          patient: {
            ...pendingCreate.payload.patient,
            ...normalizedChanges,
            address: normalizedChanges.address
              ? { ...pendingCreate.payload.patient.address, ...normalizedChanges.address }
              : pendingCreate.payload.patient.address,
          },
        },
      })
    } else {
      const pendingUpdate = await offlineDb.syncQueue.where('workerId').equals(workerId).filter((item) => (
        item.entityType === 'PATIENT'
        && item.operation === 'UPDATE'
        && item.payload.localId === patient.localId
        && item.syncStatus === 'PENDING'
        && item.retryCount === 0
        && !item.attemptedAt
      )).last()

      if (pendingUpdate) {
        const mergedPayload = mergeQueuedChanges(pendingUpdate, normalizedChanges, baseValues)
        if (mergedPayload) {
          updated.clientOperationId = pendingUpdate.localId
          await offlineDb.syncQueue.put({ ...pendingUpdate, payload: mergedPayload })
        } else {
          await offlineDb.syncQueue.delete(pendingUpdate.queueId)
          const remaining = await offlineDb.syncQueue.where('workerId').equals(workerId).filter((item) => (
            item.entityType === 'PATIENT' && item.payload.localId === patient.localId
          )).count()
          updated.syncStatus = remaining ? 'PENDING' : 'SYNCED'
          updated.clientOperationId = patient.clientOperationId
        }
      } else {
        const operation = makeQueueOperation({
          workerId,
          entityType: 'PATIENT',
          operation: 'UPDATE',
          payload: { localId: patient.localId, baseVersion: patient.version, baseValues, changes: normalizedChanges },
        })
        updated.clientOperationId = operation.localId
        await offlineDb.syncQueue.add(operation)
      }
    }
    await offlineDb.patients.put(updated)
  })
  notifyOfflineDataChanged()
  return updated
}

export async function enqueuePatientArchive(patient, workerId) {
  requireWorkerId(workerId)
  const operation = makeQueueOperation({
    workerId,
    entityType: 'PATIENT',
    operation: 'ARCHIVE',
    payload: { localId: patient.localId, baseVersion: patient.version },
  })
  const archived = {
    ...patient,
    status: 'ARCHIVED',
    version: (patient.version || 1) + 1,
    updatedBy: workerId,
    clientOperationId: operation.localId,
    syncStatus: 'PENDING',
    lastSyncError: '',
  }
  await offlineDb.transaction('rw', offlineDb.patients, offlineDb.syncQueue, async () => {
    await offlineDb.patients.put(archived)
    await offlineDb.syncQueue.add(operation)
  })
  notifyOfflineDataChanged()
  return archived
}

export async function enqueueVisitCreate(patient, payload, workerId) {
  requireWorkerId(workerId)
  const normalizedVisit = normalizeVisitForOffline(payload)
  const localId = createLocalId()
  const visit = {
    localId,
    _id: localId,
    serverId: null,
    workerId,
    patientLocalId: patient.localId,
    patient: patient.localId,
    ...normalizedVisit,
    followUpOfLocalId: normalizedVisit.followUpOf || null,
    followUpStatus: normalizedVisit.followUp.status,
    followUpDate: normalizedVisit.followUp.date,
    syncStatus: 'PENDING',
    lastSyncError: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  const operation = makeQueueOperation({
    localId: createLocalId(),
    workerId,
    entityType: 'VISIT',
    operation: 'CREATE',
    payload: {
      localId,
      visit: { ...normalizedVisit, patientLocalId: patient.localId },
    },
  })
  visit.version = 1
  visit.updatedBy = workerId
  visit.clientOperationId = operation.localId
  const tables = [offlineDb.patients, offlineDb.visits, offlineDb.syncQueue]

  await offlineDb.transaction('rw', ...tables, async () => {
    if (visit.visitType === 'FOLLOW_UP' && visit.followUpConsultationId) {
      const completedConsultation = await offlineDb.visits
        .where('patientLocalId')
        .equals(patient.localId)
        .filter((item) => item.followUpConsultationId === visit.followUpConsultationId)
        .first()
      if (completedConsultation) throw new Error('This doctor follow-up is already recorded on this device')
    }
    await offlineDb.visits.add(visit)
    if (visit.visitType === 'FOLLOW_UP' && visit.followUpOfLocalId) {
      const previousVisit = await offlineDb.visits.get(visit.followUpOfLocalId)
      if (!previousVisit || previousVisit.patientLocalId !== patient.localId || previousVisit.workerId !== workerId || previousVisit.followUpStatus !== 'SCHEDULED') {
        throw new Error('The scheduled follow-up was not found or was already completed')
      }
      previousVisit.followUp.status = 'COMPLETED'
      previousVisit.followUp.completedByVisit = localId
      previousVisit.followUpStatus = 'COMPLETED'
      await offlineDb.visits.put(previousVisit)
    }
    await offlineDb.syncQueue.add(operation)
  })
  notifyOfflineDataChanged()
  return visit
}

function flattenChanges(value, prefix = '', result = {}) {
  for (const [key, item] of Object.entries(value || {})) {
    const path = prefix ? `${prefix}.${key}` : key
    if (item && typeof item === 'object' && !Array.isArray(item) && !(item instanceof Date)) {
      flattenChanges(item, path, result)
    } else {
      result[path] = item
    }
  }
  return result
}

function readPath(record, path) {
  return path.split('.').reduce((value, segment) => value?.[segment], record)
}

function applyChanges(record, changes) {
  const updated = structuredClone(record)
  for (const [path, value] of Object.entries(changes)) {
    const parts = path.split('.')
    const leaf = parts.pop()
    let target = updated
    for (const part of parts) {
      target[part] = target[part] ? { ...target[part] } : {}
      target = target[part]
    }
    target[leaf] = value
  }
  return updated
}

function nestChanges(changes) {
  const nested = {}
  for (const [path, value] of Object.entries(changes)) {
    const parts = path.split('.')
    const leaf = parts.pop()
    let target = nested
    for (const part of parts) {
      target[part] ||= {}
      target = target[part]
    }
    target[leaf] = value
  }
  return nested
}

function mergeQueuedChanges(operation, changes, baseValues) {
  const mergedChanges = { ...flattenChanges(operation.payload.changes), ...flattenChanges(changes) }
  const mergedBaseValues = { ...operation.payload.baseValues }
  for (const [field, value] of Object.entries(baseValues)) {
    if (!Object.hasOwn(mergedBaseValues, field)) mergedBaseValues[field] = value
  }
  for (const [field, value] of Object.entries(mergedChanges)) {
    if (!valuesEqual(value, mergedBaseValues[field])) continue
    delete mergedChanges[field]
    delete mergedBaseValues[field]
  }
  if (Object.keys(mergedChanges).length === 0) return null
  return {
    ...operation.payload,
    baseValues: mergedBaseValues,
    changes: nestChanges(mergedChanges),
  }
}

export async function enqueueVisitUpdate(visit, changes, workerId) {
  requireWorkerId(workerId)
  const mergedInput = {
    ...visit,
    ...changes,
    symptoms: { ...visit.symptoms, ...changes.symptoms },
    vitals: { ...visit.vitals, ...changes.vitals },
    followUp: { ...visit.followUp, ...changes.followUp },
  }
  const normalized = normalizeVisitForOffline(mergedInput)
  normalized.followUp = visit.followUp
  const requested = flattenChanges(changes)
  const baseValues = {}
  const normalizedChanges = {}
  for (const field of Object.keys(requested)) {
    const value = readPath(normalized, field)
    const baseValue = readPath(visit, field)
    if (valuesEqual(value, baseValue)) continue
    normalizedChanges[field] = value
    baseValues[field] = baseValue ?? null
  }
  if (Object.keys(normalizedChanges).length === 0) return visit

  const updated = applyChanges(visit, normalizedChanges)
  updated.syncStatus = 'PENDING'
  updated.lastSyncError = ''
  updated.updatedAt = new Date().toISOString()
  await offlineDb.transaction('rw', offlineDb.visits, offlineDb.syncQueue, async () => {
    const pendingCreate = !visit.serverId
      ? await offlineDb.syncQueue.where('workerId').equals(workerId).filter((item) => (
        item.entityType === 'VISIT'
        && item.operation === 'CREATE'
        && item.payload.localId === visit.localId
        && item.syncStatus === 'PENDING'
        && item.retryCount === 0
        && !item.attemptedAt
      )).first()
      : null

    if (pendingCreate) {
      updated.clientOperationId = pendingCreate.localId
      await offlineDb.syncQueue.put({
        ...pendingCreate,
        payload: { ...pendingCreate.payload, visit: applyChanges(pendingCreate.payload.visit, normalizedChanges) },
      })
    } else {
      const pendingUpdate = await offlineDb.syncQueue.where('workerId').equals(workerId).filter((item) => (
        item.entityType === 'VISIT'
        && item.operation === 'UPDATE'
        && item.payload.localId === visit.localId
        && item.syncStatus === 'PENDING'
        && item.retryCount === 0
        && !item.attemptedAt
      )).last()

      if (pendingUpdate) {
        const mergedPayload = mergeQueuedChanges(pendingUpdate, normalizedChanges, baseValues)
        if (mergedPayload) {
          updated.clientOperationId = pendingUpdate.localId
          await offlineDb.syncQueue.put({ ...pendingUpdate, payload: mergedPayload })
        } else {
          await offlineDb.syncQueue.delete(pendingUpdate.queueId)
          const remaining = await offlineDb.syncQueue.where('workerId').equals(workerId).filter((item) => (
            item.entityType === 'VISIT' && item.payload.localId === visit.localId
          )).count()
          updated.syncStatus = remaining ? 'PENDING' : 'SYNCED'
          updated.clientOperationId = visit.clientOperationId
        }
      } else {
        const operation = makeQueueOperation({
          workerId,
          entityType: 'VISIT',
          operation: 'UPDATE',
          payload: {
            localId: visit.localId,
            baseVersion: visit.version,
            baseValues,
            changes: normalizedChanges,
          },
        })
        updated.clientOperationId = operation.localId
        await offlineDb.syncQueue.add(operation)
      }
    }
    await offlineDb.visits.put(updated)
  })
  notifyOfflineDataChanged()
  return updated
}

export async function getLocalPatients(workerId) {
  requireWorkerId(workerId)
  return offlineDb.patients.where('workerId').equals(workerId).toArray()
}

export async function getLocalPatient(patientId, workerId) {
  requireWorkerId(workerId)
  const patient = await offlineDb.patients.get(patientId)
    || await offlineDb.patients.where('serverId').equals(patientId).first()
  if (!patient || patient.workerId !== workerId || patient.status !== 'ACTIVE') return null
  return patient
}

export async function getLocalVisits(patientLocalId, workerId) {
  requireWorkerId(workerId)
  const visits = await offlineDb.visits.where('patientLocalId').equals(patientLocalId).toArray()
  return visits.filter((visit) => visit.workerId === workerId).sort((left, right) => right.visitDate.localeCompare(left.visitDate))
}

export async function cacheServerPatient(serverPatient, workerId) {
  requireWorkerId(workerId)
  const serverId = serverPatient._id.toString()
  const existing = await offlineDb.patients.where('serverId').equals(serverId).first()
    || await offlineDb.patients.get(serverId)
  if (existing && existing.syncStatus !== 'SYNCED') return existing
  const localId = existing?.localId || serverId
  const patient = {
    ...serverPatient,
    _id: localId,
    localId,
    serverId,
    workerId,
    syncStatus: 'SYNCED',
    lastSyncError: '',
    dateOfBirth: serverPatient.dateOfBirth ? new Date(serverPatient.dateOfBirth).toISOString() : null,
    createdAt: serverPatient.createdAt || new Date().toISOString(),
    updatedAt: serverPatient.updatedAt || new Date().toISOString(),
  }
  await offlineDb.patients.put(patient)
  return patient
}

export async function cacheServerVisits(serverVisits, patient, workerId) {
  requireWorkerId(workerId)
  const cached = []
  for (const serverVisit of serverVisits) {
    const serverId = serverVisit._id.toString()
    const existing = await offlineDb.visits.where('serverId').equals(serverId).first()
      || await offlineDb.visits.get(serverId)
    if (existing && existing.syncStatus !== 'SYNCED') {
      cached.push(existing)
      continue
    }
    const localId = existing?.localId || serverId
    const visit = {
      ...serverVisit,
      _id: localId,
      localId,
      serverId,
      patient: patient.localId,
      patientLocalId: patient.localId,
      workerId,
      followUpOfLocalId: null,
      followUpStatus: serverVisit.followUp?.status || 'NOT_SCHEDULED',
      followUpDate: serverVisit.followUp?.date || null,
      syncStatus: 'SYNCED',
      lastSyncError: '',
    }
    await offlineDb.visits.put(visit)
    cached.push(visit)
  }
  return cached
}

export async function getLocalSyncCounts(workerId) {
  requireWorkerId(workerId)
  const [patients, visits, pendingSync] = await Promise.all([
    getLocalPatients(workerId),
    offlineDb.visits.where('workerId').equals(workerId).toArray(),
    offlineDb.syncQueue.where('workerId').equals(workerId).count(),
  ])
  const today = new Date().toISOString().slice(0, 10)
  return {
    totalPatients: patients.filter((patient) => patient.status === 'ACTIVE').length,
    todaysVisits: visits.filter((visit) => visit.visitDate?.slice(0, 10) === today).length,
    followUps: visits.filter((visit) => visit.followUpStatus === 'SCHEDULED').length,
    pendingSync,
  }
}
