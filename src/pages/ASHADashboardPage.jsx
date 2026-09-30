import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSyncStatus } from '../hooks/useSyncStatus.js'
import { getAshaDashboard } from '../services/asha.service.js'

const metrics = [
  { key: 'totalPatients', label: 'My patients', href: '/asha/patients' },
  { key: 'todaysVisits', label: "Today's visits", href: '/asha/patients' },
  { key: 'followUps', label: 'Follow-ups due', href: '/asha/patients' },
  { key: 'referrals', label: 'Active referrals', href: '/asha/patients' },
]

function ASHADashboardPage() {
  const { isOnline, status: syncStatus, pendingCount } = useSyncStatus()
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    getAshaDashboard()
      .then((result) => { if (active) setSummary(result) })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Dashboard data could not be loaded.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  return (
    <main className="content-width asha-dashboard">
      <div className="asha-page-heading">
        <div>
          <p className="eyebrow"><span className="eyebrow-dot" /> ASHA worker workspace</p>
          <h1>Field overview</h1>
        </div>
        <span className={`network-status network-${syncStatus.toLowerCase().replace('_', '-')}`} role="status">
          <span aria-hidden="true" />{syncStatus === 'SYNC_FAILED' ? 'Sync Failed' : syncStatus === 'OFFLINE' ? 'Offline' : syncStatus === 'SYNCING' ? 'Syncing' : syncStatus === 'SYNCED' ? 'Synced' : 'Online'}
        </span>
      </div>

      <nav className="asha-actions" aria-label="Patient actions">
        <Link className="asha-primary-action" to="/asha/patients/new">Register patient <span aria-hidden="true">+</span></Link>
        <Link className="asha-secondary-action" to="/asha/patients">Search patients <span aria-hidden="true">&#8594;</span></Link>
        <Link className="asha-secondary-action" to="/asha/sync">Sync details <span aria-hidden="true">&#8594;</span></Link>
      </nav>

      {error && <p className="auth-error" role="alert">{error}</p>}
      <section className="metric-grid" aria-label="Field activity">
        {metrics.map((metric) => (
          <Link className="metric-item" to={metric.href} key={metric.key}>
            <span className="metric-label">{metric.label}</span>
            <strong>{loading ? '...' : summary?.[metric.key] ?? '—'}</strong>
          </Link>
        ))}
        <div className="metric-item sync-metric">
          <span className="metric-label">Pending sync</span>
          <strong>{pendingCount}</strong>
          <span className="metric-note">{isOnline ? 'Waiting to sync' : 'Saved on this device'}</span>
        </div>
      </section>

      {(summary?.doctorFollowUps?.length > 0 || summary?.followUpVisits?.length > 0) && <section className="asha-queue-section" aria-labelledby="asha-follow-ups-heading">
        <div className="asha-page-heading"><div><p className="eyebrow"><span className="eyebrow-dot" /> Care coordination</p><h2 id="asha-follow-ups-heading">Follow-up due</h2></div></div>
        <div className="asha-patient-list">
          {summary.doctorFollowUps?.map((item) => <article className="asha-patient-card" key={`consultation-${item.consultationId}`}>
            <div><strong>{item.patientName}</strong><p>{item.doctorName} · Due {new Date(item.dueDate).toLocaleDateString()}</p><span className={`follow-up-status follow-up-${item.status.toLowerCase()}`}>{item.status}</span></div>
            <Link className="asha-secondary-action" to={`/asha/patients/${item.patientId}/visits/new?followUpConsultation=${encodeURIComponent(item.consultationId)}`}>Record follow-up <span aria-hidden="true">→</span></Link>
          </article>)}
          {summary.followUpVisits?.map((item, index) => <article className="asha-patient-card" key={`visit-${item.patientId}-${index}`}>
            <div><strong>{item.patientName}</strong><p>Existing visit follow-up · Due {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : 'date not set'}</p><span className="follow-up-status follow-up-pending">PENDING</span></div>
            <Link className="asha-secondary-action" to={`/asha/patients/${item.patientId}`}>Open patient <span aria-hidden="true">→</span></Link>
          </article>)}
        </div>
      </section>}

      {summary?.notifications?.length > 0 && <section className="asha-queue-section" aria-labelledby="asha-notifications-heading">
        <div className="asha-page-heading"><div><p className="eyebrow"><span className="eyebrow-dot" /> Notifications</p><h2 id="asha-notifications-heading">Recent reminders</h2></div></div>
        <div className="asha-patient-list">{summary.notifications.map((item) => <article className="asha-patient-card" key={item._id}>
          <div><strong>{item.title}</strong><p>{item.message}</p><small>{new Date(item.createdAt).toLocaleString()}</small></div>
          <Link className="asha-secondary-action" to={`/asha/patients/${item.patient}`}>Open patient <span aria-hidden="true">→</span></Link>
        </article>)}</div>
      </section>}

      {!loading && !error && summary?.totalPatients === 0 && (
        <section className="asha-empty-state">
          <span className="empty-index">FIRST STEP / 001</span>
          <h2>Start with a patient record</h2>
          <p>Register a patient to begin recording visits and follow-ups.</p>
          <Link to="/asha/patients/new">Register your first patient</Link>
        </section>
      )}
    </main>
  )
}

export default ASHADashboardPage
