import api from './api.js'

export async function getDoctorDashboard() {
  const { data } = await api.get('/doctor/dashboard')
  return data
}

export async function getDoctorCases(params = {}) {
  const { data } = await api.get('/doctor/cases', { params })
  return data.cases
}

export async function getDoctorCase(patientId) {
  const { data } = await api.get(`/doctor/cases/${patientId}`)
  return data
}

export async function takeDoctorCase(patientId) {
  const { data } = await api.post(`/doctor/cases/${patientId}/take`)
  return data
}

export async function createConsultation(patientId, payload) {
  const { data } = await api.post(`/doctor/cases/${patientId}/consultations`, payload)
  return data.consultation
}

export async function createPrescription(patientId, payload) {
  const { data } = await api.post(`/doctor/cases/${patientId}/prescriptions`, payload)
  return data.prescription
}

export async function createReferral(patientId, payload) {
  const { data } = await api.post(`/doctor/cases/${patientId}/referrals`, payload)
  return data
}

export async function getDoctorAssessments() {
  const { data } = await api.get('/doctor/assessments')
  return data.assessments
}
