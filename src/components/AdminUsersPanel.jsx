import { useEffect, useState } from 'react'
import { approveUser, getUsers, rejectUser, setUserStatus } from '../services/admin.service.js'

const USER_ROLES = [
  { value: 'ASHA_WORKER', label: 'ASHA worker' },
  { value: 'DOCTOR', label: 'Doctor' },
  { value: 'ADMIN', label: 'Admin' },
]
const USER_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'INACTIVE']

function formatRole(role) {
  return role.replaceAll('_', ' ')
}

export default function AdminUsersPanel({ onUsersChanged }) {
  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pendingAction, setPendingAction] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const timeout = window.setTimeout(() => setAppliedSearch(search.trim()), 250)
    return () => window.clearTimeout(timeout)
  }, [search])

  useEffect(() => {
    let active = true
    getUsers({ search: appliedSearch, role, status })
      .then((result) => { if (active) { setUsers(result); setError('') } })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Unable to load accounts.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [appliedSearch, role, status, reloadKey])

  async function runAction(account, action) {
    setPendingAction(`${account.id}:${action}`)
    setError('')
    try {
      if (action === 'approve') await approveUser(account.id)
      if (action === 'reject') await rejectUser(account.id)
      if (action === 'status') {
        await setUserStatus(account.id, account.status === 'INACTIVE' ? 'APPROVED' : 'INACTIVE')
      }
      setLoading(true)
      setReloadKey((current) => current + 1)
      onUsersChanged()
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update this account.')
    } finally {
      setPendingAction('')
    }
  }

  return (
    <section className="admin-section" aria-labelledby="admin-users-title">
      <div className="admin-section-heading">
        <div><p className="eyebrow">Access control</p><h2 id="admin-users-title">User management</h2><p>Review pending ASHA and doctor registrations, then manage approved accounts.</p></div>
        <span className="admin-result-count">{users.length} shown</span>
      </div>
      <div className="admin-filters" role="search">
        <label className="admin-search"><span>Search users</span><input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setLoading(true); setError('') }} placeholder="Name or email" /></label>
        <label><span>Role</span><select value={role} onChange={(event) => { setRole(event.target.value); setLoading(true); setError('') }}><option value="">All roles</option>{USER_ROLES.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
        <label><span>Status</span><select value={status} onChange={(event) => { setStatus(event.target.value); setLoading(true); setError('') }}><option value="">All statuses</option>{USER_STATUSES.map((item) => <option key={item}>{item}</option>)}</select></label>
      </div>
      {error && <p className="admin-error" role="alert">{error}</p>}
      {loading ? <p className="admin-state" role="status">Loading users…</p> : (
        <div className="admin-table-wrap" aria-busy={Boolean(pendingAction)}>
          <table className="admin-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {users.map((account) => (
                <tr key={account.id}>
                  <td data-label="Name">{account.name}</td>
                  <td data-label="Email">{account.email}</td>
                  <td data-label="Role">{formatRole(account.role)}</td>
                  <td data-label="Status"><span className={`admin-status status-${account.status.toLowerCase()}`}>{account.status}</span></td>
                  <td data-label="Actions" className="admin-user-actions">
                    {account.role !== 'ADMIN' && account.status === 'PENDING' && <>
                      <button type="button" className="admin-action-primary" disabled={Boolean(pendingAction)} onClick={() => runAction(account, 'approve')}>{pendingAction === `${account.id}:approve` ? 'Approving…' : 'Approve'}</button>
                      <button type="button" className="admin-action-danger" disabled={Boolean(pendingAction)} onClick={() => runAction(account, 'reject')}>{pendingAction === `${account.id}:reject` ? 'Rejecting…' : 'Reject'}</button>
                    </>}
                    {account.role !== 'ADMIN' && ['APPROVED', 'INACTIVE'].includes(account.status) && (
                      <button type="button" className="admin-action-secondary" disabled={Boolean(pendingAction)} onClick={() => runAction(account, 'status')}>
                        {pendingAction === `${account.id}:status` ? 'Saving…' : account.status === 'INACTIVE' ? 'Reactivate' : 'Deactivate'}
                      </button>
                    )}
                    {account.role === 'ADMIN' && <span className="admin-action-muted">Admin account</span>}
                  </td>
                </tr>
              ))}
              {!users.length && <tr><td className="admin-empty-cell" colSpan="5">No users match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
