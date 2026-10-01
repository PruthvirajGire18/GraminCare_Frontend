import api from './api.js'
import { getCachedUser } from '../offline/session.js'
import { offlineDb } from '../offline/db.js'
import {
  cacheServerPatient,
  cacheServerVisits,
  enqueuePatientArchive,
  enqueuePatientCreate,
  enqueuePatientUpdate,
  enqueueVisitCreate,
  enqueueVisitUpdate,
  getLocalPatient,
  getLocalPatients,
  getLocalSyncCounts,
  getLocalVisits,
} from '../offline/ashaData.js'
import { synchronizeNow } from '../offline/syncManager.js'

const DASHBOARD_CACHE_TTL_MS = 30_000

function currentWorkerId(user) {
  if (!user || user.role !== 'ASHA_WORKER' || user.status !== 'APPROVED') {
    throw new Error('An approved ASHA worker session is required')
  }
  return user.id
}

function canUseLocalFallback(error) {
  return !error.response || error.response.status >= 500
}

function requestSync() {
  if (navigator.onLine) void synchronizeNow()
}

export async function getAshaDashboard() {
  const workerId = currentWorkerId(await getCachedUser())
  const localCounts = await getLocalSyncCounts(workerId)
  const summaryKey = `dashboard:${workerId}`
  const cachedSummary = await offlineDb.session.get(summaryKey)
  const cacheAge = Date.now() - Date.parse(cachedSummary?.cachedAt || '')

  if (navigator.onLine) {
    if (cachedSummary?.summary && cacheAge >= 0 && cacheAge < DASHBOARD_CACHE_TTL_MS) {
      const localChanges = await getPendingDashboardChanges(workerId)
      return {
        ...cachedSummary.summary,
        totalPatients: cachedSummary.summary.totalPatients + localChanges.newPatients,
        todaysVisits: cachedSummary.summary.todaysVisits + localChanges.todaysVisits,
        followUps: cachedSummary.summary.followUps + localChanges.followUps,
        pendingSync: localCounts.pendingSync,
        syncEnabled: true,
      }
    }
    try {
      const { data } = await api.get('/asha/dashboard')
      await offlineDb.session.put({ key: summaryKey, summary: data.summary, cachedAt: new Date().toISOString() })
      const localChanges = await getPendingDashboardChanges(workerId)
      return {
        ...data.summary,
        totalPatients: data.summary.totalPatients + localChanges.newPatients,
        todaysVisits: data.summary.todaysVisits + localChanges.todaysVisits,
        followUps: data.summary.followUps + localChanges.followUps,
        pendingSync: localCounts.pendingSync,
        syncEnabled: true,
      }
    } catch (error) {
      if (!canUseLocalFallback(error)) throw error
    }
  }
  if (cachedSummary?.summary) {
    const localChanges = await getPendingDashboardChanges(workerId)
    return {
      ...cachedSummary.summary,
      totalPatients: cachedSummary.summary.totalPatients + localChanges.newPatients,
      todaysVisits: cachedSummary.summary.todaysVisits + localChanges.todaysVisits,
      followUps: cachedSummary.summary.followUps + localChanges.followUps,
      pendingSync: localCounts.pendingSync,
      syncEnabled: true,
    }
  }
  return { ...localCounts, referrals: 0, syncEnabled: true }
}

async function getPendingDashboardChanges(workerId) {
  const [patients, visits] = await Promise.all([
    getLocalPatients(workerId),
    offlineDb.visits.where('workerId').equals(workerId).toArray(),
  ])
  const unsyncedVisits = visits.filter((visit) => visit.syncStatus !== 'SYNCED')
  return {
    newPatients: patients.filter((patient) => patient.status === 'ACTIVE' && !patient.serverId).length,
    todaysVisits: unsyncedVisits.filter((visit) => visit.visitDate?.slice(0, 10) === new Date().toISOString().slice(0, 10)).length,
    followUps: unsyncedVisits.filter((visit) => visit.followUpStatus === 'SCHEDULED').length,
  }
}

export async function getPatients(params = {}) {
  const workerId = currentWorkerId(await getCachedUser())
  const query = typeof params.q === 'string' ? params.q.trim().toLocaleLowerCase() : ''
  const page = Math.max(1, Number.parseInt(params.page, 10) || 1)
  const limit = Math.min(50, Math.max(1, Number.parseInt(params.limit, 10) || 20))

  if (navigator.onLine) {
    try {
      const { data } = await api.get('/asha/patients', { params: { ...params, page, limit } })
      const remotePatients = await Promise.all(data.patients.map((patient) => cacheServerPatient(patient, workerId)))
      const localPatients = await getLocalPatients(workerId)
      const remoteServerIds = new Set(remotePatients.map((patient) => patient.serverId))
      const pendingLocalPatients = localPatients.filter((patient) => (
        patient.status === 'ACTIVE'
        && !patient.serverId
        && (!query || `${patient.fullName} ${patient.phone || ''}`.toLocaleLowerCase().includes(query))
      ))
      return {
        patients: [...remotePatients, ...pendingLocalPatients].sort((left, right) => left.fullName.localeCompare(right.fullName)),
        total: data.total + pendingLocalPatients.filter((patient) => !remoteServerIds.has(patient.serverId)).length,
        page: data.page,
        limit: data.limit,
      }
    } catch (error) {
      if (!canUseLocalFallback(error)) throw error
    }
  }

  const allPatients = await getLocalPatients(workerId)
  const filtered = allPatients
    .filter((patient) => patient.status === 'ACTIVE')
    .filter((patient) => !query || `${patient.fullName} ${patient.phone || ''}`.toLocaleLowerCase().includes(query))
    .sort((left, right) => left.fullName.localeCompare(right.fullName))
  const start = (page - 1) * limit
  return { patients: filtered.slice(start, start + limit), total: filtered.length, page, limit }
}

export async function getAshaReferralQr(referralId) {
  const { data } = await api.get(`/asha/referrals/${referralId}/qr`)
  return data
}

export async function createPatient(payload) {
  const workerId = currentWorkerId(await getCachedUser())
  const patient = await enqueuePatientCreate(payload, workerId)
  requestSync()
  return patient
}

export async function getPatient(patientId) {
  const workerId = currentWorkerId(await getCachedUser())
  let patient = await getLocalPatient(patientId, workerId)
  let doctorFollowUps = []
  let receivedDoctorFollowUps = false
  let lastError

  if (navigator.onLine && (!patient || (patient.syncStatus === 'SYNCED' && patient.serverId))) {
    const serverId = patient?.serverId || patientId
    try {
      const { data } = await api.get(`/asha/patients/${serverId}`)
      patient = await cacheServerPatient(data.patient, workerId)
      await cacheServerVisits(data.visits, patient, workerId)
      doctorFollowUps = data.doctorFollowUps || []
      receivedDoctorFollowUps = true
      await offlineDb.session.put({
        key: `doctor-follow-ups:${workerId}:${patient.localId}`,
        followUps: doctorFollowUps,
        cachedAt: new Date().toISOString(),
      })
    } catch (error) {
      lastError = error
      if (!canUseLocalFallback(error)) throw error
    }
  }

  if (!patient && lastError) throw lastError
  if (!patient) throw new Error('Patient is not available in this device cache')
  if (!receivedDoctorFollowUps) {
    const cachedFollowUps = await offlineDb.session.get(`doctor-follow-ups:${workerId}:${patient.localId}`)
    doctorFollowUps = cachedFollowUps?.followUps || []
  }
  const visits = await getLocalVisits(patient.localId, workerId)
  return { patient, visits, doctorFollowUps }
}

export async function updatePatient(patientId, payload) {
  const workerId = currentWorkerId(await getCachedUser())
  const patient = await getLocalPatient(patientId, workerId)
  if (!patient) throw new Error('Patient is not available in this device cache')
  const updated = await enqueuePatientUpdate(patient, payload, workerId)
  requestSync()
  return updated
}

export async function archivePatient(patientId) {
  const workerId = currentWorkerId(await getCachedUser())
  const patient = await getLocalPatient(patientId, workerId)
  if (!patient) throw new Error('Patient is not available in this device cache')
  await enqueuePatientArchive(patient, workerId)
  requestSync()
}

export async function sharePatientWithAsha(patientId, payload) {
  const { data } = await api.post(`/asha/patients/${patientId}/share`, payload)
  return data.patient
}

export async function createPatientVisit(patientId, payload) {
  const workerId = currentWorkerId(await getCachedUser())
  const patient = await getLocalPatient(patientId, workerId)
  if (!patient) throw new Error('Patient is not available in this device cache')
  const visit = await enqueueVisitCreate(patient, payload, workerId)
  requestSync()
  return visit
}

export async function updatePatientVisit(patientId, visitId, changes) {
  const workerId = currentWorkerId(await getCachedUser())
  const { visits } = await getPatient(patientId)
  const visit = visits.find((item) => item.localId === visitId || item.serverId === visitId)
  if (!visit || visit.workerId !== workerId) throw new Error('Visit is not available in this device cache')
  const updated = await enqueueVisitUpdate(visit, changes, workerId)
  requestSync()
  return updated
}
