import api from './api.js'

export async function getUsers(filters = {}) {
  const { data } = await api.get('/admin/users', { params: filters })
  return data.users
}

export async function getAdminAnalytics() {
  const { data } = await api.get('/admin/analytics')
  return data.analytics
}

export async function getAuditLogs(filters = {}) {
  const { data } = await api.get('/admin/audit', { params: filters })
  return data
}

export async function approveUser(userId) {
  const { data } = await api.patch(`/admin/users/${userId}/approve`)
  return data.user
}

export async function rejectUser(userId) {
  const { data } = await api.patch(`/admin/users/${userId}/reject`)
  return data.user
}

export async function setUserStatus(userId, status) {
  const { data } = await api.patch(`/admin/users/${userId}/status`, { status })
  return data.user
}
