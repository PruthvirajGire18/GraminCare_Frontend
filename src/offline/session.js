import { offlineDb, notifyOfflineDataChanged } from './db.js'

const SESSION_KEY = 'currentUser'

export async function getCachedUser() {
  const session = await offlineDb.session.get(SESSION_KEY)
  return session?.user || null
}

export async function cacheUser(user) {
  await offlineDb.session.put({ key: SESSION_KEY, user })
  notifyOfflineDataChanged()
  window.dispatchEvent(new Event('fieldsync:session-change'))
}

export async function clearCachedUser() {
  await offlineDb.session.delete(SESSION_KEY)
  notifyOfflineDataChanged()
  window.dispatchEvent(new Event('fieldsync:session-change'))
}
