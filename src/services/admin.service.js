import api from './api.js'

export async function getUsers() {
  const { data } = await api.get('/admin/users')
  return data.users
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
