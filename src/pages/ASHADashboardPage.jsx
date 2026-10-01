import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSyncStatus } from '../hooks/useSyncStatus.js'
import { getAshaDashboard, getAshaDoctorCareUpdates, getAshaReferralQr } from '../services/asha.service.js'
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
  const [doctorCare, setDoctorCare] = useState({ consultations: [], prescriptions: [], referrals: [] })
  const [doctorCareLoading, setDoctorCareLoading] = useState(true)
  const [doctorCareError, setDoctorCareError] = useState('')
  const [doctorCareRefreshKey, setDoctorCareRefreshKey] = useState(0)

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

  useEffect(() => {
    let active = true
    async function loadDoctorCare() {
      setDoctorCareLoading(true)
      setDoctorCareError('')
      if (!navigator.onLine) {
        setDoctorCareError('Doctor care updates are available when you are online.')
        setDoctorCareLoading(false)
        return
      }
      try {
        const result = await getAshaDoctorCareUpdates()
        if (active) setDoctorCare({
          consultations: result.consultations || [],
          prescriptions: result.prescriptions || [],
          referrals: result.referrals || [],
        })
      } catch (requestError) {
        if (active) setDoctorCareError(requestError.response?.data?.message || 'Doctor care updates could not be loaded.')
      } finally {
        if (active) setDoctorCareLoading(false)
      }
    }
    void loadDoctorCare()
    window.addEventListener('online', loadDoctorCare)
    return () => {
      active = false
      window.removeEventListener('online', loadDoctorCare)
    }
  }, [doctorCareRefreshKey])

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

      <section className="asha-queue-section doctor-care-updates" aria-labelledby="asha-doctor-care-heading">
        <div className="asha-page-heading">
          <div><p className="eyebrow"><span className="eyebrow-dot" /> {t('Care coordination')}</p><h2 id="asha-doctor-care-heading">{t('Doctor care updates')}</h2></div>
          <button className="asha-secondary-action" type="button" disabled={doctorCareLoading} onClick={() => setDoctorCareRefreshKey((current) => current + 1)}>{doctorCareLoading ? t('Loading doctor updates...') : t('Refresh updates')}</button>
        </div>
        {doctorCareError && <p className="auth-error" role="alert">{translateError(doctorCareError)}</p>}
        {doctorCareLoading ? <p className="patient-state" role="status">{t('Loading doctor updates...')}</p> : (
          <>
            {doctorCare.prescriptions.map((prescription) => <article className="doctor-care-card" key={`prescription-${prescription.id}`}>
              <div className="doctor-care-card-heading"><div><strong>{prescription.patientName}</strong><p>{t('Doctor')}: {prescription.doctorName} · {formatDateTime(prescription.createdAt)}</p></div><span>{t('Prescriptions')}</span></div>
              {prescription.items.length ? <ul className="doctor-care-medicines">{prescription.items.map((medicine, index) => <li key={`${prescription.id}-${index}`}>
                <strong>{medicine.medicine}</strong> · {t('Dosage:')} {medicine.dosage} · {t('Frequency:')} {medicine.frequency}{medicine.duration ? ` · ${t('Duration:')} ${medicine.duration}` : ''}{medicine.instructions ? ` · ${t('Instructions:')} ${medicine.instructions}` : ''}
              </li>)}</ul> : <p className="doctor-care-copy">{t('No prescription items recorded.')}</p>}
              {prescription.notes && <p className="doctor-care-copy"><strong>{t('Prescription notes:')}</strong> {prescription.notes}</p>}
              <Link className="asha-secondary-action" to={`/asha/patients/${prescription.patientId}`}>{t('Open patient')} <span aria-hidden="true">→</span></Link>
            </article>)}
            {doctorCare.consultations.map((consultation) => <article className="doctor-care-card" key={`consultation-${consultation.id}`}>
              <div className="doctor-care-card-heading"><div><strong>{consultation.patientName}</strong><p>{t('Doctor')}: {consultation.doctorName} · {formatDateTime(consultation.createdAt)}</p></div><span>{t('Consultation care plans')} · {t(consultation.priority)}</span></div>
              {consultation.assessment && <p className="doctor-care-copy"><strong>{t('Assessment:')}</strong> {consultation.assessment}</p>}
              {consultation.treatmentPlan && <p className="doctor-care-copy"><strong>{t('Treatment plan:')}</strong> {consultation.treatmentPlan}</p>}
              {consultation.followUpDate && <p className="doctor-care-copy"><strong>{t('Follow-up')}:</strong> {formatDate(consultation.followUpDate)}{consultation.followUpStatus ? ` · ${t(consultation.followUpStatus)}` : ''}</p>}
              <Link className="asha-secondary-action" to={`/asha/patients/${consultation.patientId}`}>{t('Open patient')} <span aria-hidden="true">→</span></Link>
            </article>)}
            {doctorCare.referrals.map((referral) => <article className="doctor-care-card" key={`doctor-referral-${referral.id}`}>
              <div className="doctor-care-card-heading"><div><strong>{referral.patientName}</strong><p>{t('Doctor')}: {referral.doctorName} · {formatDateTime(referral.createdAt)}</p></div><span>{t(referral.status)} · {t(referral.priority)}</span></div>
              <p className="doctor-care-copy"><strong>{t('Referral reason:')}</strong> {referral.reason}</p>
              {referral.destination?.facilityName && <p className="doctor-care-copy"><strong>{t('Destination:')}</strong> {referral.destination.facilityName}{referral.destination.address ? ` · ${referral.destination.address}` : ''}</p>}
              <p className="doctor-care-copy"><strong>{t('Expires')}:</strong> {formatDate(referral.expiresAt)}</p>
              <Link className="asha-secondary-action" to={`/asha/patients/${referral.patientId}`}>{t('Open patient')} <span aria-hidden="true">→</span></Link>
            </article>)}
            {!doctorCare.prescriptions.length && !doctorCare.consultations.length && !doctorCare.referrals.length && !doctorCareError && <p className="patient-state">{t('No doctor care updates yet.')}</p>}
          </>
        )}
      </section>

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
