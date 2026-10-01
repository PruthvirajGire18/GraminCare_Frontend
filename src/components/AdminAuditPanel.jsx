import { useEffect, useState } from 'react'
import { getAuditLogs } from '../services/admin.service.js'

const AUDIT_ROLES = ['ADMIN', 'ASHA_WORKER', 'DOCTOR']
const AUDIT_ACTIONS = [
  'LOGIN', 'LOGOUT', 'USER_APPROVED', 'USER_REJECTED', 'USER_STATUS_CHANGED',
  'PATIENT_CREATED', 'PATIENT_UPDATED', 'PATIENT_SHARED', 'PATIENT_ARCHIVED',
  'VISIT_CREATED', 'VISIT_UPDATED', 'SYNC_COMPLETED', 'SYNC_FAILED',
  'CASE_ASSIGNED', 'CONSULTATION_CREATED', 'PRESCRIPTION_CREATED',
]

function readable(value) {
  return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatTimestamp(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Unknown time' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export default function AdminAuditPanel({ refreshKey = 0 }) {
  const [filters, setFilters] = useState({ from: '', to: '', role: '', action: '' })
  const [page, setPage] = useState(1)
  const [result, setResult] = useState({ entries: [], total: 0, totalPages: 0, page: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    getAuditLogs({ ...filters, page, pageSize: 25 })
      .then((data) => { if (active) { setResult(data); setError('') } })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Unable to load audit events.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [filters, page, refreshKey])

  function updateFilter(key, value) {
    setPage(1)
    setLoading(true)
    setError('')
    setFilters((current) => ({ ...current, [key]: value }))
  }

  function clearFilters() {
    setLoading(true)
    setError('')
    setFilters({ from: '', to: '', role: '', action: '' })
    setPage(1)
  }

  const maxPage = Math.max(1, result.totalPages)

  return (
    <section className="admin-section" aria-labelledby="admin-audit-title">
      <div className="admin-section-heading">
        <div><p className="eyebrow">Accountability</p><h2 id="admin-audit-title">Audit log</h2><p>Recent access and administrative events, without patient details.</p></div>
        <span className="admin-result-count">{result.total.toLocaleString()} events</span>
      </div>
      <div className="admin-filters admin-audit-filters">
        <label><span>From</span><input type="date" value={filters.from} max={filters.to || undefined} onChange={(event) => updateFilter('from', event.target.value)} /></label>
        <label><span>To</span><input type="date" value={filters.to} min={filters.from || undefined} onChange={(event) => updateFilter('to', event.target.value)} /></label>
        <label><span>Role</span><select value={filters.role} onChange={(event) => updateFilter('role', event.target.value)}><option value="">All roles</option>{AUDIT_ROLES.map((role) => <option key={role}>{role}</option>)}</select></label>
        <label><span>Action</span><select value={filters.action} onChange={(event) => updateFilter('action', event.target.value)}><option value="">All actions</option>{AUDIT_ACTIONS.map((action) => <option key={action}>{action}</option>)}</select></label>
        <button type="button" className="admin-action-secondary" onClick={clearFilters}>Clear filters</button>
      </div>
      {error && <p className="admin-error" role="alert">{error}</p>}
      {loading ? <p className="admin-state" role="status">Loading audit events…</p> : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table admin-audit-table">
              <thead><tr><th>Date and time</th><th>Actor</th><th>Role</th><th>Action</th><th>Area</th></tr></thead>
              <tbody>
                {result.entries.map((entry) => (
                  <tr key={entry.id}>
                    <td data-label="Date and time">{formatTimestamp(entry.occurredAt)}</td>
                    <td data-label="Actor">{entry.actorName}</td>
                    <td data-label="Role">{readable(entry.role)}</td>
                    <td data-label="Action">{readable(entry.action)}</td>
                    <td data-label="Area">{readable(entry.resourceType)}</td>
                  </tr>
                ))}
                {!result.entries.length && <tr><td className="admin-empty-cell" colSpan="5">No audit events match these filters.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="admin-pagination">
            <span>Page {result.totalPages ? page : 0} of {result.totalPages} · {result.total.toLocaleString()} events</span>
            <div>
              <button type="button" className="admin-action-secondary" disabled={page <= 1 || loading} onClick={() => { setLoading(true); setPage((current) => Math.max(1, current - 1)) }}>Previous</button>
              <button type="button" className="admin-action-secondary" disabled={page >= maxPage || loading || !result.totalPages} onClick={() => { setLoading(true); setPage((current) => Math.min(maxPage, current + 1)) }}>Next</button>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
