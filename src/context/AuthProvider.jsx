import { useEffect, useState } from 'react'
import { getCurrentUser, loginAccount, logoutAccount, registerAccount } from '../services/auth.service.js'
import { AuthContext } from './AuthContext.js'
import { clearCachedUser, getCachedUser, cacheUser } from '../offline/session.js'
import { startSyncManager } from '../offline/syncManager.js'

function canWorkOffline(user) {
  return user?.role === 'ASHA_WORKER' && user.status === 'APPROVED'
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function restoreSession() {
      const cachedUser = await getCachedUser().catch(() => null)
      if (!navigator.onLine && canWorkOffline(cachedUser)) {
        if (active) {
          setUser(cachedUser)
          setLoading(false)
        }
        startSyncManager()
        return
      }

      try {
        const data = await getCurrentUser()
        await cacheUser(data.user)
        if (active) setUser(data.user)
        if (data.user.role === 'ASHA_WORKER') startSyncManager()
      } catch (error) {
        if (!error.response && canWorkOffline(cachedUser)) {
          if (active) setUser(cachedUser)
          startSyncManager()
        } else {
          if (active) setUser(null)
          if (error.response?.status === 401 || error.response?.status === 403) {
            await clearCachedUser().catch(() => {})
          }
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    restoreSession()
    return () => { active = false }
  }, [])

  async function login(credentials) {
    const data = await loginAccount(credentials)
    setUser(data.user)
    await cacheUser(data.user)
    if (data.user.role === 'ASHA_WORKER') startSyncManager()
    return data.user
  }

  async function register(details) {
    return registerAccount(details)
  }

  async function logout() {
    try {
      await logoutAccount()
    } finally {
      setUser(null)
      await clearCachedUser().catch(() => {})
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
