import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { offlineDb } from './db.js'
import { enqueuePatientCreate } from './ashaData.js'
import { initializeOrUnlockOfflineVault, lockOfflineData, unlockOfflineData } from './offlineVault.js'

const WORKER = { id: 'offline-vault-worker', email: 'asha@example.test', role: 'ASHA_WORKER', status: 'APPROVED' }
const PASSWORD = 'offline-vault-test-password-123'

function requestValue(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function readRawRow(tableName, id) {
  const connection = await requestValue(indexedDB.open('fieldsync-offline'))
  try {
    const transaction = connection.transaction(tableName, 'readonly')
    return await requestValue(transaction.objectStore(tableName).get(id))
  } finally {
    connection.close()
  }
}

beforeEach(async () => {
  lockOfflineData()
  await offlineDb.delete()
  await offlineDb.open()
})

afterEach(async () => {
  lockOfflineData()
  await offlineDb.delete()
})

test('patient rows and sync payloads are AES-GCM ciphertext in IndexedDB', async () => {
  await initializeOrUnlockOfflineVault(WORKER, PASSWORD)
  const patient = await enqueuePatientCreate({
    fullName: 'Encrypted Patient',
    gender: 'UNKNOWN',
    phone: '+1 555 0100',
    address: { village: 'Private Village' },
  }, WORKER.id)

  const storedPatient = await readRawRow('patients', patient.localId)
  const [operation] = await offlineDb.syncQueue.toArray()
  const storedOperation = await readRawRow('syncQueue', operation.queueId)
  assert.equal(storedPatient.fullName, undefined)
  assert.equal(storedPatient.__fieldsyncEncrypted.version, 1)
  assert.equal(storedOperation.payload, undefined)
  assert.equal(JSON.stringify(storedPatient).includes('Encrypted Patient'), false)
  assert.equal(JSON.stringify(storedOperation).includes('Private Village'), false)
  assert.equal((await offlineDb.patients.get(patient.localId)).fullName, 'Encrypted Patient')
  assert.equal((await offlineDb.syncQueue.get(operation.queueId)).payload.patient.fullName, 'Encrypted Patient')
})

test('password-derived vault key unlocks offline records and rejects an incorrect password', async () => {
  await initializeOrUnlockOfflineVault(WORKER, PASSWORD)
  const patient = await enqueuePatientCreate({ fullName: 'Offline Patient', gender: 'UNKNOWN' }, WORKER.id)
  lockOfflineData()

  await assert.rejects(unlockOfflineData(WORKER.id, 'incorrect-password'), /could not be unlocked/)
  const claims = await unlockOfflineData(WORKER.id, PASSWORD)
  assert.equal(claims.userId, WORKER.id)
  assert.equal(claims.role, 'ASHA_WORKER')
  assert.equal((await offlineDb.patients.get(patient.localId)).fullName, 'Offline Patient')
})

test('locked vault withholds patient data and AES-GCM rejects modified ciphertext', async () => {
  await initializeOrUnlockOfflineVault(WORKER, PASSWORD)
  const patient = await enqueuePatientCreate({ fullName: 'Protected Patient', gender: 'UNKNOWN' }, WORKER.id)
  lockOfflineData()

  const lockedRecord = await offlineDb.patients.get(patient.localId)
  assert.equal(lockedRecord.fullName, undefined)
  await unlockOfflineData(WORKER.id, PASSWORD)

  const stored = await readRawRow('patients', patient.localId)
  stored.__fieldsyncEncrypted.ciphertext[0] ^= 1
  const connection = await requestValue(indexedDB.open('fieldsync-offline'))
  await new Promise((resolve, reject) => {
    const transaction = connection.transaction('patients', 'readwrite')
    transaction.objectStore('patients').put(stored)
    transaction.oncomplete = resolve
    transaction.onerror = () => reject(transaction.error)
  })
  connection.close()

  await assert.rejects(offlineDb.patients.get(patient.localId))
})

test('first authenticated unlock migrates existing plaintext patient rows without deleting them', async () => {
  const legacyPatient = {
    localId: 'legacy-local-patient',
    _id: 'legacy-local-patient',
    serverId: null,
    workerId: WORKER.id,
    fullName: 'Legacy Patient',
    gender: 'UNKNOWN',
    phone: '+1 555 0101',
    address: { village: 'Legacy Village' },
    status: 'ACTIVE',
    syncStatus: 'PENDING',
    updatedAt: new Date().toISOString(),
  }
  const connection = await requestValue(indexedDB.open('fieldsync-offline'))
  await new Promise((resolve, reject) => {
    const transaction = connection.transaction('patients', 'readwrite')
    transaction.objectStore('patients').add(legacyPatient)
    transaction.oncomplete = resolve
    transaction.onerror = () => reject(transaction.error)
  })
  connection.close()

  await initializeOrUnlockOfflineVault(WORKER, PASSWORD)
  const stored = await readRawRow('patients', legacyPatient.localId)
  assert.equal(stored.fullName, undefined)
  assert.equal((await offlineDb.patients.get(legacyPatient.localId)).fullName, 'Legacy Patient')
})

test('legacy plaintext from another ASHA account must be migrated by that account before access', async () => {
  const secondWorker = { id: 'offline-vault-worker-2', email: 'asha2@example.test', role: 'ASHA_WORKER', status: 'APPROVED' }
  const records = [WORKER, secondWorker].map((worker, index) => ({
    localId: `legacy-patient-${index}`,
    _id: `legacy-patient-${index}`,
    serverId: null,
    workerId: worker.id,
    fullName: `Legacy patient ${index}`,
    gender: 'UNKNOWN',
    phone: '',
    address: {},
    status: 'ACTIVE',
    syncStatus: 'SYNCED',
    updatedAt: new Date().toISOString(),
  }))
  const connection = await requestValue(indexedDB.open('fieldsync-offline'))
  await new Promise((resolve, reject) => {
    const transaction = connection.transaction('patients', 'readwrite')
    const store = transaction.objectStore('patients')
    records.forEach((record) => store.add(record))
    transaction.oncomplete = resolve
    transaction.onerror = () => reject(transaction.error)
  })
  connection.close()

  await assert.rejects(
    initializeOrUnlockOfflineVault(WORKER, PASSWORD),
    /another or unidentified ASHA account.*Sign in online/,
  )
  assert.ok((await readRawRow('patients', records[0].localId)).__fieldsyncEncrypted)
  assert.equal((await readRawRow('patients', records[1].localId)).fullName, 'Legacy patient 1')

  await initializeOrUnlockOfflineVault(secondWorker, 'offline-vault-second-password-123')
  await initializeOrUnlockOfflineVault(WORKER, PASSWORD)
  assert.ok((await readRawRow('patients', records[0].localId)).__fieldsyncEncrypted)
  assert.ok((await readRawRow('patients', records[1].localId)).__fieldsyncEncrypted)
})
