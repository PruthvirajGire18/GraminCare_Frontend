import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSyncStatus } from '../hooks/useSyncStatus.js'
import { getAshaDashboard, getAshaReferralQr } from '../services/asha.service.js'
import { createReferralQrDataUrl } from '../utils/referralQr.js'
import { useLanguage } from '../context/LanguageContext.jsx'

const metrics = [
  { key: 'totalPatients', label: 'My patients', href: '/asha/patients' },
  { key: 'todaysVisits', label: "Today's visits", href: '/asha/patients' },
  { key: 'followUps', label: 'Follow-ups due', href: '/asha/patients' },
  { key: 'referrals', label: 'Active referrals', href: '/asha/patients' },
]

function notificationMessage(item, t, formatDate) {
  const patientCode = item.message.match(/Patient (P[A-Z0-9]+)/)?.[1]
  if (!patientCode) return item.message
  if (item.message.startsWith('Follow-up due for')) return `${t('Follow-up due')} · ${t('Patient:')} ${patientCode} · ${t('Due')} ${item.dueDate ? formatDate(item.dueDate) : t('date not set')}`
  if (item.message.startsWith('Follow-up visit required for')) return `${t('Follow-up visit required')} · ${t('Patient:')} ${patientCode} · ${t('Due')} ${item.dueDate ? formatDate(item.dueDate) : t('date not set')}`
  if (item.message.startsWith('Follow-up visit overdue for')) return `${t('Follow-up overdue')} · ${t('Patient:')} ${patientCode}`
  if (item.message.startsWith('Follow-up missed for')) return `${t('Follow-up missed')} · ${t('Patient:')} ${patientCode}`
  if (item.message.startsWith('Follow-up completed for')) return `${t('Follow-up completed')} · ${t('Patient:')} ${patientCode}`
  if (item.type === 'REFERRAL_GENERATED') {
    const priority = item.message.match(/· ([A-Z]+) priority$/)?.[1]
    return `${t('Patient:')} ${patientCode}${priority ? ` · ${t(priority)} ${t('priority')}` : ''}`
  }
  return item.message
}

function ASHADashboardPage() {
  const { isOnline, pendingCount } = useSyncStatus()
  const { t, translateError, formatDate, formatDateTime } = useLanguage()
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [qrReferral, setQrReferral] = useState(null)
  const [qrLoadingId, setQrLoadingId] = useState('')
  const [qrError, setQrError] = useState('')

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

  async function showReferralQr(referralId) {
    setQrLoadingId(referralId)
    setQrError('')
    setQrReferral(null)
    try {
      const result = await getAshaReferralQr(referralId)
      const image = await createReferralQrDataUrl(result.verificationUrl)
      setQrReferral({ id: referralId, image, expiresAt: result.expiresAt })
    } catch (requestError) {
      setQrReferral(null)
      setQrError(requestError.response?.data?.message || requestError.message || 'Referral QR could not be loaded.')
    } finally {
      setQrLoadingId('')
    }
  }

  return (
    <main className="content-width asha-dashboard">
      <div className="asha-page-heading">
        <div>
          <p className="eyebrow"><span className="eyebrow-dot" /> {t('ASHA worker workspace')}</p>
          <h1>{t('Field overview')}</h1>
        </div>
      </div>

      <nav className="asha-actions" aria-label={t('Patient actions')}>
        <Link className="asha-primary-action" to="/asha/patients/new">{t('Register patient')} <span aria-hidden="true">+</span></Link>
        <Link className="asha-secondary-action" to="/asha/patients">{t('Search patients')} <span aria-hidden="true">&#8594;</span></Link>
        <Link className="asha-secondary-action" to="/asha/sync">{t('Sync details')} <span aria-hidden="true">&#8594;</span></Link>
      </nav>

      {error && <p className="auth-error" role="alert">{translateError(error)}</p>}
      <section className="metric-grid" aria-label={t('Field activity')}>
        {metrics.map((metric) => (
          <Link className="metric-item" to={metric.href} key={metric.key}>
            <span className="metric-label">{t(metric.label)}</span>
            <strong>{loading ? '...' : summary?.[metric.key] ?? '—'}</strong>
          </Link>
        ))}
        <div className="metric-item sync-metric">
          <span className="metric-label">{t('Pending sync')}</span>
          <strong>{pendingCount}</strong>
          <span className="metric-note">{isOnline ? t('Waiting to sync') : t('Saved on this device')}</span>
        </div>
      </section>

      {summary?.referralItems?.length > 0 && <section className="asha-queue-section" aria-labelledby="asha-referrals-heading">
        <div className="asha-page-heading"><div><p className="eyebrow"><span className="eyebrow-dot" /> {t('Care coordination')}</p><h2 id="asha-referrals-heading">🚨 {t('Referral Generated')}</h2></div></div>
        <div className="asha-patient-list">{summary.referralItems.map((referral) => <article className="asha-patient-card" key={referral.id}>
          <div>
            <strong>{t('Patient:')} {referral.patientCode}</strong>
            <p>{t('Priority:')} <span className={`referral-priority referral-${referral.priority.toLowerCase()}`}>{t(referral.priority)}</span></p>
            {referral.destination?.facilityName && <p>{t('Destination:')} {referral.destination.facilityName}{referral.destination.address ? ` · ${referral.destination.address}` : ''}</p>}
            <small>{t('Created')} {formatDateTime(referral.createdAt)} · {t('Expires')} {formatDateTime(referral.expiresAt)}</small>
          </div>
          <button className="asha-secondary-action" type="button" disabled={qrLoadingId === referral.id} onClick={() => void showReferralQr(referral.id)}>{qrLoadingId === referral.id ? t('Loading QR…') : t('View QR')}</button>
          {qrReferral?.id === referral.id && <div className="referral-qr-panel">
            <img src={qrReferral.image} alt={`${t('Secure referral QR for')} ${referral.patientCode}`} />
            <p>{t('Show this QR to the patient for referral verification. It contains only a one-time secure token.')}</p>
            <button className="doctor-clear-filters" type="button" onClick={() => setQrReferral(null)}>{t('Close QR')}</button>
          </div>}
        </article>)}</div>
        {qrError && <p className="auth-error" role="alert">{translateError(qrError)}</p>}
      </section>}

      {(summary?.doctorFollowUps?.length > 0 || summary?.followUpVisits?.length > 0) && <section className="asha-queue-section" aria-labelledby="asha-follow-ups-heading">
        <div className="asha-page-heading"><div><p className="eyebrow"><span className="eyebrow-dot" /> {t('Care coordination')}</p><h2 id="asha-follow-ups-heading">{t('Follow-up due')}</h2></div></div>
        <div className="asha-patient-list">
          {summary.doctorFollowUps?.map((item) => <article className="asha-patient-card" key={`consultation-${item.consultationId}`}>
            <div><strong>{item.patientName}</strong><p>{item.doctorName} · {t('Due')} {formatDate(item.dueDate)}</p><span className={`follow-up-status follow-up-${item.status.toLowerCase()}`}>{t(item.status)}</span></div>
            <Link className="asha-secondary-action" to={`/asha/patients/${item.patientId}/visits/new?followUpConsultation=${encodeURIComponent(item.consultationId)}`}>{t('Record follow-up')} <span aria-hidden="true">→</span></Link>
          </article>)}
          {summary.followUpVisits?.map((item, index) => <article className="asha-patient-card" key={`visit-${item.patientId}-${index}`}>
            <div><strong>{item.patientName}</strong><p>{t('Existing visit follow-up')} · {t('Due')} {item.dueDate ? formatDate(item.dueDate) : t('date not set')}</p><span className="follow-up-status follow-up-pending">{t('PENDING')}</span></div>
            <Link className="asha-secondary-action" to={`/asha/patients/${item.patientId}`}>{t('Open patient')} <span aria-hidden="true">→</span></Link>
          </article>)}
        </div>
      </section>}

      {summary?.notifications?.length > 0 && <section className="asha-queue-section" aria-labelledby="asha-notifications-heading">
        <div className="asha-page-heading"><div><p className="eyebrow"><span className="eyebrow-dot" /> {t('Notifications')}</p><h2 id="asha-notifications-heading">{t('Recent reminders')}</h2></div></div>
        <div className="asha-patient-list">{summary.notifications.map((item) => <article className="asha-patient-card" key={item._id}>
          <div><strong>{t(item.title)}</strong><p>{notificationMessage(item, t, formatDate)}</p><small>{formatDateTime(item.createdAt)}</small></div>
          <Link className="asha-secondary-action" to={`/asha/patients/${item.patient}`}>{t('Open patient')} <span aria-hidden="true">→</span></Link>
        </article>)}</div>
      </section>}

      {!loading && !error && summary?.totalPatients === 0 && (
        <section className="asha-empty-state">
          <span className="empty-index">{t('First step')} / 001</span>
          <h2>{t('Start with a patient record')}</h2>
          <p>{t('Register a patient to begin recording visits and follow-ups.')}</p>
          <Link to="/asha/patients/new">{t('Register your first patient')}</Link>
        </section>
      )}
    </main>
  )
}

export default ASHADashboardPage
