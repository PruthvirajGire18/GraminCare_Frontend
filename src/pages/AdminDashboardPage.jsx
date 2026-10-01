import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminAuditPanel from '../components/AdminAuditPanel.jsx'
import AdminOverview from '../components/AdminOverview.jsx'
import AdminUsersPanel from '../components/AdminUsersPanel.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { getAdminAnalytics } from '../services/admin.service.js'
import '../admin.css'

function AdminDashboardPage() {
  const { user } = useAuth()
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  const loadAnalytics = useCallback(async () => {
    setRefreshing(true)
    setError('')
    try {
      setAnalytics(await getAdminAnalytics())
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load dashboard analytics.')
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    getAdminAnalytics()
      .then((result) => { if (active) setAnalytics(result) })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Unable to load dashboard analytics.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  function handleUsersChanged() {
    setRefreshKey((current) => current + 1)
    void loadAnalytics()
  }

  return (
    <main className="content-width dashboard-page admin-page">
      <p className="eyebrow"><span className="eyebrow-dot" /> FieldSync administration</p>
      <div className="admin-page-heading">
        <div>
          <h1>System overview</h1>
          <p>Monitor care operations, manage access, and review system activity.</p>
        </div>
        <div className="admin-heading-actions">
          <span className="admin-identity">Signed in as {user?.name || 'Administrator'}</span>
          <button className="admin-refresh" type="button" disabled={refreshing} onClick={() => { void loadAnalytics(); setRefreshKey((current) => current + 1) }}>
            {refreshing ? 'Refreshing…' : 'Refresh data'}
          </button>
        </div>
      </div>

      <nav className="admin-jump-links" aria-label="Admin dashboard sections">
        <a href="#admin-users-title">User management</a>
        <a href="#admin-audit-title">Audit log</a>
        <Link to="/admin/conflicts">Review clinical data conflicts</Link>
      </nav>

      {error && <p className="admin-error" role="alert">{error}</p>}
      {loading && !analytics ? <p className="admin-state admin-loading" role="status">Loading FieldSync overview…</p> : (
        <>
          {analytics && <AdminOverview analytics={analytics} />}
          <AdminUsersPanel onUsersChanged={handleUsersChanged} />
          <AdminAuditPanel refreshKey={refreshKey} />
        </>
      )}
    </main>
  )
}

export default AdminDashboardPage
