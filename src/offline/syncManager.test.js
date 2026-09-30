import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import api from '../services/api.js'
import { offlineDb } from './db.js'
import { cacheUser } from './session.js'
import { enqueuePatientCreate, enqueuePatientUpdate, enqueueVisitCreate, enqueueVisitUpdate } from './ashaData.js'
import { getSyncSnapshot } from './syncStatus.js'
import { synchronizeNow, retrySyncOperation } from './syncManager.js'

const WORKER = { id: 'asha-sync-test-user', role: 'ASHA_WORKER', status: 'APPROVED' }
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
const originalWindow = globalThis.window
let originalPost
let originalPatch
let originalDelete

beforeEach(async () => {
  await offlineDb.delete()
  await offlineDb.open()
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } })
  globalThis.window = new EventTarget()
  originalPost = api.post
  originalPatch = api.patch
  originalDelete = api.delete
  await cacheUser(WORKER)
})

afterEach(async () => {
  api.post = originalPost
  api.patch = originalPatch
  api.delete = originalDelete
  await offlineDb.delete()
  if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator)
  else delete globalThis.navigator
  if (originalWindow === undefined) delete globalThis.window
  else globalThis.window = originalWindow
})

test('sync manager uploads patient before visit and removes successful queue entries', async () => {
  const requests = []
  api.post = async (path, payload) => {
    requests.push({ path, payload })
    if (path === '/asha/patients') return { data: { patient: { _id: 'remote-patient-id' } } }
    return { data: { visit: { _id: 'remote-visit-id' } } }
  }
  const patient = await enqueuePatientCreate({ fullName: 'Example Patient', gender: 'UNKNOWN', address: {} }, WORKER.id)
  const visit = await enqueueVisitCreate(patient, {
    visitType: 'INITIAL',
    visitDate: '2026-09-30',
    symptoms: { chiefComplaint: 'Fever' },
    vitals: { temperatureC: 38.2 },
    followUp: { status: 'NOT_SCHEDULED', date: null },
  }, WORKER.id)
  const queued = await offlineDb.syncQueue.orderBy('queueId').toArray()

  await synchronizeNow()

  assert.deepEqual(requests.map((request) => request.path), [
    '/asha/patients',
    '/asha/patients/remote-patient-id/visits',
  ])
  assert.equal(requests[0].payload.clientOperationId, queued[0].localId)
  assert.equal(requests[1].payload.clientOperationId, queued[1].localId)
  assert.equal((await offlineDb.patients.get(patient.localId)).serverId, 'remote-patient-id')
  assert.equal((await offlineDb.visits.get(visit.localId)).serverId, 'remote-visit-id')
  assert.equal(await offlineDb.syncQueue.count(), 0)
  assert.equal((await getSyncSnapshot(WORKER.id)).history.filter((item) => item.syncStatus === 'SYNCED').length, 2)
})

test('failed network sync preserves local data and retry succeeds later', async () => {
  api.post = async () => { throw new Error('Network unavailable') }
  const patient = await enqueuePatientCreate({ fullName: 'Offline Patient', gender: 'UNKNOWN', address: {} }, WORKER.id)
  await synchronizeNow()

  const [failedOperation] = await offlineDb.syncQueue.toArray()
  assert.equal(failedOperation.syncStatus, 'SYNC_FAILED')
  assert.equal(failedOperation.retryCount, 1)
  assert.equal((await offlineDb.patients.get(patient.localId)).fullName, 'Offline Patient')

  globalThis.navigator.onLine = false
  await retrySyncOperation(failedOperation.localId, WORKER.id)
  globalThis.navigator.onLine = true
  api.post = async () => ({ data: { patient: { _id: 'remote-retried-patient' } } })
  await synchronizeNow()

  assert.equal(await offlineDb.syncQueue.count(), 0)
  assert.equal((await offlineDb.patients.get(patient.localId)).serverId, 'remote-retried-patient')
})

test('patient update sync includes the original base version and values', async () => {
  let uploaded
  api.post = async () => ({ data: { patient: { _id: 'remote-patient', version: 1, fullName: 'Example Patient', gender: 'UNKNOWN', phone: '', address: {}, updatedBy: WORKER.id } } })
  api.patch = async (_path, payload) => {
    uploaded = payload
    return { data: { patient: { _id: 'remote-patient', version: 2, phone: '+1 555 0100', fullName: 'Example Patient', gender: 'UNKNOWN', address: {}, updatedBy: WORKER.id }, conflicts: [] } }
  }
  const patient = await enqueuePatientCreate({ fullName: 'Example Patient', gender: 'UNKNOWN', phone: '', address: {} }, WORKER.id)
  await synchronizeNow()
  const cached = await offlineDb.patients.get(patient.localId)
  const updated = await enqueuePatientUpdate(cached, { phone: '+1 555 0100' }, WORKER.id)
  const [operation] = await offlineDb.syncQueue.toArray()

  await synchronizeNow()

  assert.equal(uploaded.baseVersion, 1)
  assert.deepEqual(uploaded.baseValues, { phone: '' })
  assert.equal(uploaded.changes.phone, '+1 555 0100')
  assert.equal(uploaded.clientOperationId, operation.localId)
  assert.equal((await offlineDb.patients.get(patient.localId)).version, 2)
  assert.equal(updated.phone, '+1 555 0100')
})

test('visit update sync includes original vital values and base version', async () => {
  const patchRequests = []
  api.post = async (path) => path === '/asha/patients'
    ? { data: { patient: { _id: 'remote-patient', version: 1, fullName: 'Example Patient', gender: 'UNKNOWN', address: {}, updatedBy: WORKER.id } } }
    : { data: { visit: { _id: 'remote-visit', version: 1, patient: 'remote-patient', visitType: 'INITIAL', visitDate: '2026-09-30', symptoms: { chiefComplaint: 'Fever', details: '' }, vitals: { temperatureC: 37, oxygenSaturationPercent: 98 }, medicalHistory: [], allergies: [], currentMedicines: [], observations: '', followUp: { status: 'NOT_SCHEDULED', date: null }, updatedBy: WORKER.id } } }
  api.patch = async (path, payload) => {
    patchRequests.push({ path, payload })
    return { data: { visit: { _id: 'remote-visit', version: 2, patient: 'remote-patient', visitType: 'INITIAL', visitDate: '2026-09-30', symptoms: { chiefComplaint: 'Fever', details: '' }, vitals: { temperatureC: 38.2, oxygenSaturationPercent: 98 }, medicalHistory: [], allergies: [], currentMedicines: [], observations: '', followUp: { status: 'NOT_SCHEDULED', date: null }, updatedBy: WORKER.id }, conflicts: [] } }
  }
  const patient = await enqueuePatientCreate({ fullName: 'Example Patient', gender: 'UNKNOWN', address: {} }, WORKER.id)
  await synchronizeNow()
  const cachedPatient = await offlineDb.patients.get(patient.localId)
  const visit = await enqueueVisitCreate(cachedPatient, {
    visitType: 'INITIAL', visitDate: '2026-09-30', symptoms: { chiefComplaint: 'Fever' },
    vitals: { temperatureC: 37, oxygenSaturationPercent: 98 }, followUp: { status: 'NOT_SCHEDULED' },
  }, WORKER.id)
  await synchronizeNow()
  const cachedVisit = await offlineDb.visits.get(visit.localId)
  await enqueueVisitUpdate(cachedVisit, { vitals: { temperatureC: 38.2 } }, WORKER.id)
  const [operation] = await offlineDb.syncQueue.toArray()

  await synchronizeNow()

  assert.equal(patchRequests.length, 1)
  assert.equal(patchRequests[0].payload.baseVersion, 1)
  assert.deepEqual(patchRequests[0].payload.baseValues, { 'vitals.temperatureC': 37 })
  assert.equal(patchRequests[0].payload.changes['vitals.temperatureC'], 38.2)
  assert.equal(patchRequests[0].payload.clientOperationId, operation.localId)
  assert.equal((await offlineDb.visits.get(visit.localId)).version, 2)
})

test('sync manager sends the linked doctor consultation with an ASHA follow-up visit', async () => {
  let uploadedVisit
  api.post = async (path, payload) => {
    if (path === '/asha/patients') return { data: { patient: { _id: 'remote-patient-id' } } }
    uploadedVisit = payload
    return { data: { visit: { _id: 'remote-follow-up-visit-id' } } }
  }
  const patient = await enqueuePatientCreate({ fullName: 'Example Patient', gender: 'UNKNOWN', address: {} }, WORKER.id)
  await enqueueVisitCreate(patient, {
    visitType: 'FOLLOW_UP',
    followUpConsultationId: '507f1f77bcf86cd799439013',
    visitDate: new Date().toISOString(),
    symptoms: { chiefComplaint: 'Follow-up review' },
    vitals: { oxygenSaturationPercent: 98 },
    observations: 'Stable today',
  }, WORKER.id)

  await synchronizeNow()

  assert.equal(uploadedVisit.followUpConsultationId, '507f1f77bcf86cd799439013')
  assert.equal(uploadedVisit.visitType, 'FOLLOW_UP')
  assert.equal(uploadedVisit.symptoms.chiefComplaint, 'Follow-up review')
  assert.equal(await offlineDb.syncQueue.count(), 0)
})

test('conflict stays queued until a reviewer resolves it, then syncs the resolved record', async () => {
  let patchCount = 0
  let conflictResolved = false
  api.post = async () => ({ data: { patient: {
    _id: 'remote-patient',
    version: 1,
    fullName: 'Example Patient',
    gender: 'UNKNOWN',
    phone: '',
    address: { village: '', district: '', state: '', details: '' },
    updatedBy: WORKER.id,
  } } })
  api.patch = async (_path, payload) => {
    patchCount += 1
    return { data: {
      patient: {
        _id: 'remote-patient',
        version: conflictResolved ? 4 : 2,
        fullName: 'Example Patient',
        gender: 'UNKNOWN',
        phone: conflictResolved ? '+1 555 0100' : '+1 555 0199',
        address: {
          village: payload.changes.address?.village || (conflictResolved ? 'Offline village' : 'Server village'),
          district: 'Example district',
          state: '',
          details: '',
        },
        updatedBy: 'another-asha-worker',
      },
      conflicts: [{
        id: 'conflict-1',
        field: 'phone',
        oldValue: '',
        currentValue: '+1 555 0199',
        incomingValue: '+1 555 0100',
        status: conflictResolved ? 'RESOLVED' : 'PENDING',
      }],
    } }
  }

  const patient = await enqueuePatientCreate({ fullName: 'Example Patient', gender: 'UNKNOWN', phone: '', address: {} }, WORKER.id)
  await synchronizeNow()
  const cached = await offlineDb.patients.get(patient.localId)
  const phoneUpdate = await enqueuePatientUpdate(cached, { phone: '+1 555 0100' }, WORKER.id)
  await enqueuePatientUpdate(phoneUpdate, { address: { village: 'Offline village' } }, WORKER.id)

  await synchronizeNow()

  const [operation] = await offlineDb.syncQueue.toArray()
  const conflictedPatient = await offlineDb.patients.get(patient.localId)
  const snapshot = await getSyncSnapshot(WORKER.id)
  assert.equal(patchCount, 1)
  assert.equal(operation.syncStatus, 'CONFLICT')
  assert.equal(operation.conflicts[0].incomingValue, '+1 555 0100')
  assert.equal(conflictedPatient.syncStatus, 'CONFLICT')
  assert.equal(conflictedPatient.phone, '+1 555 0100')
  assert.equal(conflictedPatient.address.village, 'Offline village')
  assert.equal(conflictedPatient.address.district, 'Example district')
  assert.equal(conflictedPatient.version, 2)
  assert.equal(snapshot.conflictCount, 1)
  assert.equal(snapshot.history[0].syncStatus, 'CONFLICT')

  await synchronizeNow()
  assert.equal(patchCount, 2)
  assert.equal((await offlineDb.syncQueue.get(operation.queueId)).syncStatus, 'CONFLICT')

  conflictResolved = true
  await synchronizeNow()
  assert.equal(patchCount, 4)
  assert.equal(await offlineDb.syncQueue.count(), 0)
  const resolvedPatient = await offlineDb.patients.get(patient.localId)
  assert.equal(resolvedPatient.syncStatus, 'SYNCED')
  assert.equal(resolvedPatient.phone, '+1 555 0100')
  assert.equal(resolvedPatient.address.village, 'Offline village')
  assert.equal(resolvedPatient.address.district, 'Example district')
})
