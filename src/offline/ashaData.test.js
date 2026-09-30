import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { offlineDb } from './db.js'
import {
  enqueuePatientArchive,
  enqueuePatientCreate,
  enqueuePatientUpdate,
  enqueueVisitCreate,
} from './ashaData.js'

const WORKER_ID = 'asha-user-test-id'

beforeEach(async () => {
  await offlineDb.delete()
  await offlineDb.open()
})

afterEach(async () => {
  await offlineDb.delete()
})

test('patient creation commits demographics and a complete pending queue operation', async () => {
  const patient = await enqueuePatientCreate({
    fullName: 'Example Patient',
    dateOfBirth: null,
    gender: 'UNKNOWN',
    phone: '',
    address: { village: 'Example village', district: '', state: '', details: '' },
  }, WORKER_ID)

  const storedPatient = await offlineDb.patients.get(patient.localId)
  const [operation] = await offlineDb.syncQueue.toArray()
  assert.equal(storedPatient.fullName, 'Example Patient')
  assert.equal(storedPatient.serverId, null)
  assert.equal(operation.entityType, 'PATIENT')
  assert.equal(operation.operation, 'CREATE')
  assert.equal(operation.payload.patient.fullName, 'Example Patient')
  assert.equal(operation.retryCount, 0)
  assert.equal(operation.syncStatus, 'PENDING')
  assert.ok(operation.localId)
  assert.ok(operation.createdAt)
})

test('visit creation preserves field data and references the local patient', async () => {
  const patient = await enqueuePatientCreate({ fullName: 'Example Patient', gender: 'UNKNOWN', address: {} }, WORKER_ID)
  const visit = await enqueueVisitCreate(patient, {
    visitType: 'INITIAL',
    visitDate: '2026-09-30',
    symptoms: { chiefComplaint: 'Fever', details: 'Since yesterday' },
    medicalHistory: ['Asthma'],
    allergies: ['Pollen'],
    currentMedicines: ['Example medicine'],
    vitals: { temperatureC: 38.1 },
    observations: 'Alert',
    followUp: { date: '2026-10-07', status: 'SCHEDULED' },
  }, WORKER_ID)

  const storedVisit = await offlineDb.visits.get(visit.localId)
  const operations = await offlineDb.syncQueue.toArray()
  assert.equal(storedVisit.patientLocalId, patient.localId)
  assert.equal(storedVisit.symptoms.chiefComplaint, 'Fever')
  assert.equal(storedVisit.vitals.temperatureC, 38.1)
  assert.equal(storedVisit.followUpStatus, 'SCHEDULED')
  assert.equal(operations.length, 2)
  assert.equal(operations[1].entityType, 'VISIT')
  assert.equal(operations[1].operation, 'CREATE')
  assert.equal(operations[1].syncStatus, 'PENDING')
})

test('local edits and archive are persisted as queued operations', async () => {
  const patient = await enqueuePatientCreate({ fullName: 'Example Patient', gender: 'UNKNOWN', address: {} }, WORKER_ID)
  await enqueuePatientUpdate(patient, { phone: '+1 555 0100' }, WORKER_ID)
  await enqueuePatientArchive({ ...patient, phone: '+1 555 0100' }, WORKER_ID)

  const updated = await offlineDb.patients.get(patient.localId)
  const operations = await offlineDb.syncQueue.orderBy('queueId').toArray()
  assert.equal(updated.status, 'ARCHIVED')
  assert.equal(operations[0].payload.patient.phone, '+1 555 0100')
  assert.deepEqual(operations.map(({ entityType, operation }) => [entityType, operation]), [
    ['PATIENT', 'CREATE'],
    ['PATIENT', 'ARCHIVE'],
  ])
})

test('invalid visit data is rejected before an offline record or queue item is stored', async () => {
  const patient = await enqueuePatientCreate({ fullName: 'Example Patient', gender: 'UNKNOWN', address: {} }, WORKER_ID)
  await assert.rejects(enqueueVisitCreate(patient, {
    visitType: 'INITIAL',
    visitDate: '2026-09-30',
    symptoms: { chiefComplaint: 'Fever' },
    vitals: { oxygenSaturationPercent: 101 },
    followUp: { status: 'NOT_SCHEDULED', date: null },
  }, WORKER_ID), /oxygenSaturationPercent/)

  assert.equal(await offlineDb.visits.count(), 0)
  assert.equal(await offlineDb.syncQueue.count(), 1)
})

test('completing a follow-up marks its scheduled local visit completed', async () => {
  const patient = await enqueuePatientCreate({ fullName: 'Example Patient', gender: 'UNKNOWN', address: {} }, WORKER_ID)
  const scheduled = await enqueueVisitCreate(patient, {
    visitType: 'INITIAL',
    visitDate: '2026-09-30',
    symptoms: { chiefComplaint: 'Initial assessment' },
    followUp: { date: '2026-10-07', status: 'SCHEDULED' },
  }, WORKER_ID)
  const followUp = await enqueueVisitCreate(patient, {
    visitType: 'FOLLOW_UP',
    followUpOf: scheduled.localId,
    visitDate: '2026-09-30',
    symptoms: { chiefComplaint: 'Follow-up review' },
    followUp: { status: 'NOT_SCHEDULED', date: null },
  }, WORKER_ID)

  const completedSource = await offlineDb.visits.get(scheduled.localId)
  assert.equal(followUp.followUpOfLocalId, scheduled.localId)
  assert.equal(completedSource.followUpStatus, 'COMPLETED')
  assert.equal(completedSource.followUp.completedByVisit, followUp.localId)
})

test('offline doctor follow-up completion is queued once for a patient', async () => {
  const patient = await enqueuePatientCreate({ fullName: 'Example Patient', gender: 'UNKNOWN', address: {} }, WORKER_ID)
  const payload = {
    visitType: 'FOLLOW_UP',
    followUpConsultationId: '507f1f77bcf86cd799439013',
    visitDate: new Date().toISOString(),
    symptoms: { chiefComplaint: 'Follow-up review' },
  }
  const visit = await enqueueVisitCreate(patient, payload, WORKER_ID)
  await assert.rejects(enqueueVisitCreate(patient, payload, WORKER_ID), /already recorded/i)

  assert.equal(visit.followUpConsultationId, payload.followUpConsultationId)
  assert.equal(await offlineDb.visits.count(), 1)
  assert.equal(await offlineDb.syncQueue.count(), 2)
})
