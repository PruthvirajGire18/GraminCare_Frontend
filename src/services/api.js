import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env?.VITE_API_BASE_URL || 'http://localhost:5000/api',
  timeout: 20000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

const inFlightGetRequests = new Map()
const axiosGet = api.get.bind(api)

// React development mode and fast route transitions can request the same
// read more than once at the same time. Share only the in-flight request;
// sensitive API responses are never kept in a browser cache here.
api.get = (url, config = {}) => {
  if (config.signal || config.cancelToken || config.adapter) return axiosGet(url, config)

  let key
  try {
    key = JSON.stringify([url, config.params ?? null, config.responseType ?? 'json'])
  } catch {
    return axiosGet(url, config)
  }

  const existing = inFlightGetRequests.get(key)
  if (existing) return existing

  const request = axiosGet(url, config).finally(() => {
    if (inFlightGetRequests.get(key) === request) inFlightGetRequests.delete(key)
  })
  inFlightGetRequests.set(key, request)
  return request
}

export default api
