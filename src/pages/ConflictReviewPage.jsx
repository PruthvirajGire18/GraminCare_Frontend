import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getPendingConflicts, resolveConflict } from '../services/conflict.service.js'

function displayValue(value) {
  if (value === null || value === undefined) return 'Not recorded'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function ConflictReviewPage() {
  const [conflicts, setConflicts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busyId, setBusyId] = useState('')
  const [customValues, setCustomValues] = useState({})
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    getPendingConflicts()
      .then((result) => { if (active) setConflicts(result) })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Conflicts could not be loaded.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [reloadKey])

  async function decide(conflict, resolution) {
    setBusyId(conflict.id)
    setError('')
    setSuccess('')
    let customValue
    if (resolution === 'CUSTOM') {
      const input = customValues[conflict.id] ?? ''
      try { customValue = JSON.parse(input) } catch { customValue = input }
    }
    try {
      await resolveConflict(conflict.id, resolution, customValue)
      setConflicts((current) => current.filter((item) => item.id !== conflict.id))
      setSuccess(`Conflict for ${conflict.field} resolved; the decision was added to the audit log.`)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Conflict could not be resolved.')
      setReloadKey((current) => current + 1)
    } finally {
      setBusyId('')
    }
  }

  return (
    <main className="content-width asha-dashboard conflict-review-page">
      <Link className="back-link" to="/dashboard">&#8592; Back to workspace</Link>
      <div className="asha-page-heading">
        <div>
          <p className="eyebrow"><span className="eyebrow-dot" /> Clinical data review</p>
          <h1>Concurrent update conflicts</h1>
        </div>
        <span className="network-status"><span aria-hidden="true" />{conflicts.length} pending</span>
      </div>
      <p className="conflict-intro">Conflicting ASHA observations are preserved until an authorized reviewer chooses the final value.</p>
      {success && <p className="success-message" role="status">{success}</p>}
      {error && <p className="auth-error" role="alert">{error}</p>}
      {loading ? <p className="patient-state" role="status">Loading conflict records...</p> : conflicts.length ? (
        <div className="conflict-list">
          {conflicts.map((conflict) => (
            <article className="conflict-item" key={conflict.id}>
              <div className="conflict-item-heading">
                <div><span className="conflict-type">{conflict.recordType.replace('_', ' ')}</span><h2>{conflict.field}</h2></div>
                <span className="status-label status-pending">PENDING</span>
              </div>
              <p className="conflict-context">Patient <code>{conflict.patientId}</code> · base version {conflict.baseVersion}, current version {conflict.currentVersion}</p>
              <div className="conflict-values">
                <div><span>Originally observed</span><strong>{displayValue(conflict.oldValue)}</strong></div>
                <div><span>Current record</span><strong>{displayValue(conflict.currentValue)}</strong><small>{conflict.currentUser?.name || 'Another ASHA worker'}</small></div>
                <div><span>Incoming offline value</span><strong>{displayValue(conflict.incomingValue)}</strong><small>{conflict.conflictingUser?.name || 'ASHA worker'}</small></div>
              </div>
              <label className="custom-conflict-label" htmlFor={`custom-${conflict.id}`}>Custom final value (JSON for arrays/numbers)</label>
              <input id={`custom-${conflict.id}`} className="custom-conflict-input" value={customValues[conflict.id] ?? displayValue(conflict.currentValue)} onChange={(event) => setCustomValues((current) => ({ ...current, [conflict.id]: event.target.value }))} />
              <div className="conflict-actions">
                <button type="button" className="keep-current-button" disabled={busyId === conflict.id} onClick={() => decide(conflict, 'KEEP_CURRENT')}>Keep current</button>
                <button type="button" className="use-incoming-button" disabled={busyId === conflict.id} onClick={() => decide(conflict, 'USE_INCOMING')}>Use incoming</button>
                <button type="button" className="custom-value-button" disabled={busyId === conflict.id} onClick={() => decide(conflict, 'CUSTOM')}>{busyId === conflict.id ? 'Saving...' : 'Use custom value'}</button>
              </div>
            </article>
          ))}
        </div>
      ) : <section className="asha-empty-state"><span className="empty-index">ALL CLEAR</span><h2>No pending conflicts</h2><p>New concurrent field updates requiring review will appear here.</p></section>}
    </main>
  )
}

export default ConflictReviewPage
