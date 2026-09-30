import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { useSyncStatus } from '../hooks/useSyncStatus.js'
import { retrySyncOperation } from '../offline/syncManager.js'

const STATUS_LABELS = {
  OFFLINE: 'Offline',
  ONLINE: 'Online',
  SYNCING: 'Syncing',
  SYNCED: 'Synced',
  SYNC_FAILED: 'Sync Failed',
  CONFLICT: 'Conflict',
}

function displayValue(value) {
  if (value === null || value === undefined) return 'Not recorded'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function SyncDebugPage() {
  const { user } = useAuth()
  const { status, isOnline, pendingCount, conflictCount, queue, history, synchronizeNow } = useSyncStatus()
  const [retryingId, setRetryingId] = useState('')
  const [running, setRunning] = useState(false)

  async function retry(localId) {
    setRetryingId(localId)
    await retrySyncOperation(localId, user.id)
    setRetryingId('')
  }

  async function syncNow() {
    setRunning(true)
    await synchronizeNow()
    setRunning(false)
  }

  return (
    <main className="content-width asha-dashboard sync-debug-page">
      <Link className="back-link" to="/asha">&#8592; Back to dashboard</Link>
      <div className="asha-page-heading sync-heading">
        <div>
          <p className="eyebrow"><span className="eyebrow-dot" /> Developer tools</p>
          <h1>Sync queue</h1>
        </div>
        <span className={`network-status network-${status.toLowerCase().replace('_', '-')}`} role="status"><span aria-hidden="true" />{STATUS_LABELS[status]}</span>
      </div>
      <div className="sync-toolbar">
        <p><strong>{pendingCount}</strong> pending operation{pendingCount === 1 ? '' : 's'}{!isOnline ? ' · changes remain on this device' : ''}</p>
        <button type="button" onClick={syncNow} disabled={!isOnline || running || status === 'SYNCING'}>{running || status === 'SYNCING' ? 'Syncing...' : 'Sync now'}</button>
      </div>
      {conflictCount > 0 && <p className="sync-conflict-notice" role="status">The incoming values are still saved on this device. An administrator or doctor must review these conflicts before later updates can sync.</p>}

      <section className="sync-section" aria-labelledby="queue-title">
        <div className="profile-section-heading"><span className="empty-index">LOCAL INDEXEDDB</span><h2 id="queue-title">Queued operations</h2></div>
        {queue.length ? (
          <div className="sync-table-wrap"><table className="sync-table"><thead><tr><th>Operation ID</th><th>Record</th><th>Action</th><th>Status</th><th>Retries</th><th>Updated</th><th></th></tr></thead>
            <tbody>{queue.map((operation) => (
              <tr key={operation.localId}>
                <td><code title={operation.localId}>{operation.localId.slice(0, 8)}...</code></td>
                <td>{operation.entityType}</td>
                <td>{operation.operation}</td>
                <td><span className={`status-label status-${operation.syncStatus.toLowerCase().replace('_', '-')}`}>{STATUS_LABELS[operation.syncStatus] || operation.syncStatus}</span>{operation.lastError && <small className="sync-error-detail">{operation.lastError}</small>}{operation.syncStatus === 'CONFLICT' && operation.conflicts?.map((conflict) => <small className="sync-conflict-detail" key={`${conflict.id}-${conflict.field}`}>{conflict.field}: current {displayValue(conflict.currentValue)} · incoming {displayValue(conflict.incomingValue)}</small>)}</td>
                <td>{operation.retryCount}</td>
                <td>{new Date(operation.createdAt).toLocaleString()}</td>
                <td>{['SYNC_FAILED', 'CONFLICT'].includes(operation.syncStatus) && <button className="retry-operation" type="button" disabled={!isOnline || retryingId === operation.localId} onClick={() => retry(operation.localId)}>{retryingId === operation.localId ? 'Checking...' : operation.syncStatus === 'CONFLICT' ? 'Check status' : 'Retry'}</button>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <p className="patient-state">No pending operations.</p>}
      </section>

      <section className="sync-section" aria-labelledby="history-title">
        <div className="profile-section-heading"><span className="empty-index">RECENT ACTIVITY</span><h2 id="history-title">Sync history</h2></div>
        {history.length ? (
          <div className="sync-table-wrap"><table className="sync-table"><thead><tr><th>Operation ID</th><th>Record</th><th>Action</th><th>Status</th><th>Attempts</th><th>Conflicts</th><th>Time</th></tr></thead>
            <tbody>{history.map((operation, index) => (
              <tr key={`${operation.localId}-${operation.failedAt || operation.syncedAt}-${index}`}>
                <td><code title={operation.localId}>{operation.localId.slice(0, 8)}...</code></td>
                <td>{operation.entityType}</td>
                <td>{operation.operation}</td>
                <td><span className={`status-label status-${operation.syncStatus.toLowerCase().replace('_', '-')}`}>{STATUS_LABELS[operation.syncStatus] || operation.syncStatus}</span></td>
                <td>{operation.retryCount ?? 0}</td>
                <td>{operation.conflictCount ?? 0}</td>
                <td>{new Date(operation.syncedAt || operation.failedAt).toLocaleString()}</td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <p className="patient-state">No sync activity yet.</p>}
      </section>
    </main>
  )
}

export default SyncDebugPage
