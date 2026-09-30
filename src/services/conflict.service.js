import api from './api.js'

export async function getPendingConflicts() {
  const { data } = await api.get('/conflicts')
  return data.conflicts
}

export async function resolveConflict(conflictId, resolution, value) {
  const body = { resolution }
  if (resolution === 'CUSTOM') body.value = value
  const { data } = await api.patch(`/conflicts/${conflictId}/resolve`, body)
  return data.conflict
}
