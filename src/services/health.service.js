import api from './api.js'

export async function getApiHealth() {
  const { data } = await api.get('/health')
  return data
}
