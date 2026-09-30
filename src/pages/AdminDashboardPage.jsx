import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import { Link } from 'react-router-dom'
import { approveUser, getUsers, rejectUser, setUserStatus } from '../services/admin.service.js'

function AdminDashboardPage() {
  const { user } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pendingId, setPendingId] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    getUsers()
      .then((result) => { if (active) setUsers(result) })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Unable to load accounts.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [reloadKey])

  async function runAction(targetUser, action) {
    setPendingId(targetUser.id)
    setError('')
    try {
      if (action === 'approve') await approveUser(targetUser.id)
      if (action === 'reject') await rejectUser(targetUser.id)
      if (action === 'status') {
        const status = targetUser.status === 'INACTIVE' ? 'APPROVED' : 'INACTIVE'
        await setUserStatus(targetUser.id, status)
      }
      setReloadKey((current) => current + 1)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update this account.')
    } finally {
      setPendingId('')
    }
  }

  return (
    <main className="content-width dashboard-page admin-page">
      <p className="eyebrow"><span className="eyebrow-dot" /> Administrator workspace</p>
      <div className="dashboard-heading">
        <div>
          <h1>Account approvals</h1>
          <p>Review registrations and manage account access.</p>
        </div>
        <span className="admin-identity">Signed in as {user.name}</span>
      </div>
      <p><Link className="asha-secondary-action" to="/admin/conflicts">Review clinical data conflicts</Link></p>
      {error && <p className="auth-error" role="alert">{error}</p>}
      {loading ? <p className="dashboard-message" role="status">Loading accounts...</p> : (
        <div className="user-table-wrap">
          <table className="user-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {users.map((account) => (
                <tr key={account.id}>
                  <td>{account.name}</td>
                  <td>{account.email}</td>
                  <td>{account.role.replace('_', ' ')}</td>
                  <td><span className={`status-label status-${account.status.toLowerCase()}`}>{account.status}</span></td>
                  <td className="user-actions">
                    {account.role !== 'ADMIN' && account.status === 'PENDING' && (
                      <>
                        <button type="button" onClick={() => runAction(account, 'approve')} disabled={pendingId === account.id}>Approve</button>
                        <button type="button" className="text-action" onClick={() => runAction(account, 'reject')} disabled={pendingId === account.id}>Reject</button>
                      </>
                    )}
                    {account.role !== 'ADMIN' && ['APPROVED', 'INACTIVE'].includes(account.status) && (
                      <button type="button" className="text-action" onClick={() => runAction(account, 'status')} disabled={pendingId === account.id}>
                        {account.status === 'INACTIVE' ? 'Reactivate' : 'Deactivate'}
                      </button>
                    )}
                    {account.role === 'ADMIN' && <span className="muted-action">Administrator</span>}
                  </td>
                </tr>
              ))}
              {!users.length && <tr><td colSpan="5">No accounts have registered yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}

export default AdminDashboardPage
