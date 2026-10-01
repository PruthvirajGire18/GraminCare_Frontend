import { useEffect, useState } from 'react'
import { getCurrentUser, loginAccount, logoutAccount, registerAccount } from '../services/auth.service.js'
import { AuthContext } from './AuthContext.js'
import { clearCachedUser, getCachedUser, cacheUser } from '../offline/session.js'
import { startSyncManager } from '../offline/syncManager.js'
import { initializeOrUnlockOfflineVault, lockOfflineData, unlockOfflineData } from '../offline/offlineVault.js'

function canWorkOffline(user) {
  return user?.role === 'ASHA_WORKER' && user.status === 'APPROVED'
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function restoreSession() {
      lockOfflineData()
      if (!navigator.onLine) {
        // Offline ASHA access requires the account password to unlock the encrypted local vault.
        // Leave the login form available so the worker can authenticate locally.
        if (active) setUser(null)
        if (active) setLoading(false)
        return
      }

      try {
        const data = await getCurrentUser()
        await cacheUser(data.user)
        if (data.user.role === 'ASHA_WORKER') {
          if (active) setUser(null)
        } else if (active) {
          setUser(data.user)
        }
      } catch (error) {
        if (active) setUser(null)
        if (error.response?.status === 401 || error.response?.status === 403) {
          await clearCachedUser().catch(() => {})
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    restoreSession()
    return () => { active = false }
  }, [])

  async function login(credentials) {
    lockOfflineData()
    async function loginFromLocalVault() {
      const cachedUser = await getCachedUser()
      if (!canWorkOffline(cachedUser) || cachedUser.email?.trim().toLowerCase() !== credentials.email?.trim().toLowerCase()) {
        throw new Error('This account is not available for offline access. Sign in while online first.')
      }
      const claims = await unlockOfflineData(cachedUser.id, credentials.password)
      if (claims.role !== 'ASHA_WORKER' || claims.status !== 'APPROVED' || claims.email?.toLowerCase() !== cachedUser.email?.toLowerCase()) {
        throw new Error('This account is not available for offline access')
      }
      return { user: { ...cachedUser, role: claims.role, status: claims.status } }
    }

    let data
    let usedLocalVault = false
    if (!navigator.onLine) {
      try {
        data = await loginFromLocalVault()
        usedLocalVault = true
      } catch (error) {
        lockOfflineData()
        throw error
      }
    } else {
      try {
        data = await loginAccount(credentials)
      } catch (networkError) {
        if (networkError.response) throw networkError
        try {
          data = await loginFromLocalVault()
          usedLocalVault = true
        } catch (offlineError) {
          lockOfflineData()
          throw offlineError
        }
      }
      if (data.user.role === 'ASHA_WORKER' && !usedLocalVault) {
        try {
          await initializeOrUnlockOfflineVault(data.user, credentials.password)
        } catch (vaultError) {
          lockOfflineData()
          await logoutAccount().catch(() => {})
          throw vaultError
        }
      }
    }
    setUser(data.user)
    await cacheUser(data.user)
    if (data.user.role === 'ASHA_WORKER') startSyncManager()
    return data.user
  }

  async function register(details) {
    return registerAccount(details)
  }

  async function logout() {
    const preserveOfflineIdentity = user?.role === 'ASHA_WORKER'
    try {
      await logoutAccount()
    } finally {
      lockOfflineData()
      setUser(null)
      if (!preserveOfflineIdentity) await clearCachedUser().catch(() => {})
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
