import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { useSyncStatus } from '../hooks/useSyncStatus.js'
import { retrySyncOperation } from '../offline/syncManager.js'
import { useLanguage } from '../context/LanguageContext.jsx'

const STATUS_LABELS = {
  OFFLINE: 'Offline',
  ONLINE: 'Online',
  SYNCING: 'Syncing',
  SYNCED: 'Synced',
  SYNC_FAILED: 'Sync Failed',
  CONFLICT: 'Conflict',
}

const FIELD_LABELS = {
  fullName: 'Full name',
  dateOfBirth: 'Date of birth',
  gender: 'Gender',
  phone: 'Phone number',
  'address.village': 'Village',
  'address.district': 'District',
  'address.state': 'State',
  'address.details': 'Address details',
  'symptoms.chiefComplaint': 'Symptoms / chief complaint',
  'symptoms.details': 'Symptom details',
  'symptoms.durationDays': 'Symptom duration',
  medicalHistory: 'Medical history',
  allergies: 'Allergies',
  currentMedicines: 'Current medicines',
  observations: 'Observations',
  'followUp.date': 'Follow-up date',
  temperatureC: 'Temperature (°C)',
  heartRateBpm: 'Heart rate (bpm)',
  respiratoryRatePerMinute: 'Respiratory rate (/min)',
  systolicMmHg: 'Systolic (mmHg)',
  diastolicMmHg: 'Diastolic (mmHg)',
  oxygenSaturationPercent: 'Oxygen saturation (%)',
  weightKg: 'Weight (kg)',
  heightCm: 'Height (cm)',
}

function displayValue(value, t) {
  if (value === null || value === undefined) return t('Not recorded')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function SyncDebugPage() {
  const { t, translateError, formatDateTime } = useLanguage()
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
      <Link className="back-link" to="/asha">&#8592; {t('Back to dashboard')}</Link>
      <div className="asha-page-heading sync-heading">
        <div>
          <p className="eyebrow"><span className="eyebrow-dot" /> {t('Developer tools')}</p>
          <h1>{t('Sync queue')}</h1>
        </div>
        <span className={`network-status network-${status.toLowerCase().replace('_', '-')}`} role="status"><span aria-hidden="true" />{t(STATUS_LABELS[status])}</span>
      </div>
      <div className="sync-toolbar">
        <p><strong>{pendingCount}</strong> {t(pendingCount === 1 ? 'pending operation' : 'pending operations')}{!isOnline ? ` · ${t('changes remain on this device')}` : ''}</p>
        <button type="button" onClick={syncNow} disabled={!isOnline || running || status === 'SYNCING'}>{running || status === 'SYNCING' ? t('Syncing...') : t('Sync now')}</button>
      </div>
      {conflictCount > 0 && <p className="sync-conflict-notice" role="status">{t('The incoming values are still saved on this device. An administrator or doctor must review these conflicts before later updates can sync.')}</p>}

      <section className="sync-section" aria-labelledby="queue-title">
        <div className="profile-section-heading"><span className="empty-index">{t('LOCAL INDEXEDDB')}</span><h2 id="queue-title">{t('Queued operations')}</h2></div>
        {queue.length ? (
          <div className="sync-table-wrap"><table className="sync-table"><thead><tr><th>{t('Operation ID')}</th><th>{t('Record')}</th><th>{t('Action')}</th><th>{t('Status')}</th><th>{t('Retries')}</th><th>{t('Updated')}</th><th></th></tr></thead>
            <tbody>{queue.map((operation) => (
              <tr key={operation.localId}>
                <td><code title={operation.localId}>{operation.localId.slice(0, 8)}...</code></td>
                <td>{t(operation.entityType === 'PATIENT' ? 'Patient' : 'Visit')}</td>
                <td>{t(operation.operation === 'CREATE' ? 'Create' : operation.operation === 'UPDATE' ? 'Update' : 'Archive')}</td>
                <td><span className={`status-label status-${operation.syncStatus.toLowerCase().replace('_', '-')}`}>{t(STATUS_LABELS[operation.syncStatus] || operation.syncStatus)}</span>{operation.lastError && <small className="sync-error-detail">{translateError(operation.lastError)}</small>}{operation.syncStatus === 'CONFLICT' && operation.conflicts?.map((conflict) => <small className="sync-conflict-detail" key={`${conflict.id}-${conflict.field}`}>{t(FIELD_LABELS[conflict.field] || FIELD_LABELS[conflict.field.replace(/^vitals\./, '')] || conflict.field)}: {t('current')} {displayValue(conflict.currentValue, t)} · {t('incoming')} {displayValue(conflict.incomingValue, t)}</small>)}</td>
                <td>{operation.retryCount}</td>
                <td>{formatDateTime(operation.createdAt)}</td>
                <td>{['SYNC_FAILED', 'CONFLICT'].includes(operation.syncStatus) && <button className="retry-operation" type="button" disabled={!isOnline || retryingId === operation.localId} onClick={() => retry(operation.localId)}>{retryingId === operation.localId ? t('Checking...') : operation.syncStatus === 'CONFLICT' ? t('Check status') : t('Retry')}</button>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <p className="patient-state">{t('No pending operations.')}</p>}
      </section>

      <section className="sync-section" aria-labelledby="history-title">
        <div className="profile-section-heading"><span className="empty-index">{t('RECENT ACTIVITY')}</span><h2 id="history-title">{t('Sync history')}</h2></div>
        {history.length ? (
          <div className="sync-table-wrap"><table className="sync-table"><thead><tr><th>{t('Operation ID')}</th><th>{t('Record')}</th><th>{t('Action')}</th><th>{t('Status')}</th><th>{t('Attempts')}</th><th>{t('Conflicts')}</th><th>{t('Time')}</th></tr></thead>
            <tbody>{history.map((operation, index) => (
              <tr key={`${operation.localId}-${operation.failedAt || operation.syncedAt}-${index}`}>
                <td><code title={operation.localId}>{operation.localId.slice(0, 8)}...</code></td>
                <td>{t(operation.entityType === 'PATIENT' ? 'Patient' : 'Visit')}</td>
                <td>{t(operation.operation === 'CREATE' ? 'Create' : operation.operation === 'UPDATE' ? 'Update' : 'Archive')}</td>
                <td><span className={`status-label status-${operation.syncStatus.toLowerCase().replace('_', '-')}`}>{t(STATUS_LABELS[operation.syncStatus] || operation.syncStatus)}</span></td>
                <td>{operation.retryCount ?? 0}</td>
                <td>{operation.conflictCount ?? 0}</td>
                <td>{formatDateTime(operation.syncedAt || operation.failedAt)}</td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <p className="patient-state">{t('No sync activity yet.')}</p>}
      </section>
    </main>
  )
}

export default SyncDebugPage
