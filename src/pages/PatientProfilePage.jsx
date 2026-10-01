import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { archivePatient, getPatient, sharePatientWithAsha, updatePatient } from '../services/asha.service.js'
import { createLocalId } from '../offline/ids.js'
import { useLanguage } from '../context/LanguageContext.jsx'

const VITAL_LABELS = {
  temperatureC: 'Temperature (°C)',
  heartRateBpm: 'Heart rate (bpm)',
  respiratoryRatePerMinute: 'Respiratory rate (/min)',
  systolicMmHg: 'Systolic (mmHg)',
  diastolicMmHg: 'Diastolic (mmHg)',
  oxygenSaturationPercent: 'Oxygen saturation (%)',
  weightKg: 'Weight (kg)',
  heightCm: 'Height (cm)',
}

function PatientProfilePage() {
  const { patientId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t, translateError, formatDate } = useLanguage()
  const [patient, setPatient] = useState(null)
  const [visits, setVisits] = useState([])
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [shareEmail, setShareEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(location.state?.message || '')

  useEffect(() => {
    let active = true
    getPatient(patientId)
      .then((result) => {
        if (!active) return
        setPatient(result.patient)
        setVisits(result.visits)
        setForm({
          fullName: result.patient.fullName,
          dateOfBirth: result.patient.dateOfBirth ? result.patient.dateOfBirth.slice(0, 10) : '',
          gender: result.patient.gender,
          phone: result.patient.phone || '',
          address: {
            village: result.patient.address?.village || '',
            district: result.patient.address?.district || '',
            state: result.patient.address?.state || '',
            details: result.patient.address?.details || '',
          },
        })
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || requestError.message || 'Patient profile could not be loaded.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [patientId])

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function updateAddress(field, value) {
    setForm((current) => ({ ...current, address: { ...current.address, [field]: value } }))
  }

  async function savePatient(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const updated = await updatePatient(patientId, { ...form, dateOfBirth: form.dateOfBirth || null })
      setPatient(updated)
      setSuccess('Patient details saved.')
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Patient details could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  async function handleArchive() {
    if (!window.confirm(t('Archive this patient? Visit records will be retained.'))) return
    setError('')
    try {
      await archivePatient(patientId)
      navigate('/asha/patients', { replace: true })
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Patient could not be archived.')
    }
  }

  async function shareWithWorker(event) {
    event.preventDefault()
    setSharing(true)
    setError('')
    setSuccess('')
    try {
      const updated = await sharePatientWithAsha(patientId, {
        email: shareEmail,
        baseVersion: patient.version,
        clientOperationId: createLocalId(),
      })
      setPatient(updated)
      setShareEmail('')
      setSuccess('Patient record shared with the approved ASHA worker.')
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Patient could not be shared.')
    } finally {
      setSharing(false)
    }
  }

  if (loading) return <main className="content-width asha-dashboard patient-profile-page"><p className="patient-state" role="status">{t('Loading patient...')}</p></main>
  if (!patient) return <main className="content-width asha-dashboard patient-profile-page"><p className="auth-error" role="alert">{translateError(error || 'Patient not found.')}</p><Link className="back-link" to="/asha/patients">{t('Back to patients')}</Link></main>

  return (
    <main className="content-width asha-dashboard patient-profile-page">
      <Link className="back-link" to="/asha/patients">&#8592; {t('Back to patients')}</Link>
      <div className="asha-page-heading profile-heading">
        <div>
          <p className="eyebrow"><span className="eyebrow-dot" /> {t('Patient profile')}</p>
          <h1>{patient.fullName}</h1>
          <p className="profile-subtitle">{t('Added')} {formatDate(patient.createdAt)}</p>
        </div>
        <Link className="asha-primary-action" to={`/asha/patients/${patientId}/visits/new`}>{t('Record visit')} <span aria-hidden="true">+</span></Link>
      </div>
      {success && <p className="success-message" role="status">{t(success)}</p>}
      {error && <p className="auth-error" role="alert">{translateError(error)}</p>}

      <div className="profile-grid">
        <section className="profile-section">
          <div className="profile-section-heading"><span className="empty-index">{t('DEMOGRAPHICS')}</span><h2>{t('Patient details')}</h2></div>
          <form className="patient-form profile-edit-form" onSubmit={savePatient}>
            <label htmlFor="profile-name">{t('Full name')}</label>
            <input id="profile-name" required minLength="2" maxLength="120" value={form.fullName} onChange={(event) => updateField('fullName', event.target.value)} />
            <div className="form-grid-two">
              <div><label htmlFor="profile-dob">{t('Date of birth')}</label><input id="profile-dob" type="date" max={new Date().toISOString().slice(0, 10)} value={form.dateOfBirth} onChange={(event) => updateField('dateOfBirth', event.target.value)} /></div>
              <div><label htmlFor="profile-gender">{t('Gender')}</label><select id="profile-gender" value={form.gender} onChange={(event) => updateField('gender', event.target.value)}><option value="UNKNOWN">{t('Not specified')}</option><option value="FEMALE">{t('Female')}</option><option value="MALE">{t('Male')}</option><option value="OTHER">{t('Other')}</option></select></div>
            </div>
            <label htmlFor="profile-phone">{t('Phone number')}</label>
            <input id="profile-phone" type="tel" maxLength="25" value={form.phone} onChange={(event) => updateField('phone', event.target.value)} />
            <div className="form-grid-two">
              <div><label htmlFor="profile-village">{t('Village')}</label><input id="profile-village" maxLength="120" value={form.address.village} onChange={(event) => updateAddress('village', event.target.value)} /></div>
              <div><label htmlFor="profile-district">{t('District')}</label><input id="profile-district" maxLength="120" value={form.address.district} onChange={(event) => updateAddress('district', event.target.value)} /></div>
            </div>
            <label htmlFor="profile-state">{t('State')}</label>
            <input id="profile-state" maxLength="120" value={form.address.state} onChange={(event) => updateAddress('state', event.target.value)} />
            <label htmlFor="profile-address">{t('Address details')}</label>
            <input id="profile-address" maxLength="300" value={form.address.details} onChange={(event) => updateAddress('details', event.target.value)} />
            <button className="auth-submit" type="submit" disabled={saving}>{saving ? t('Saving...') : t('Save changes')}</button>
            <button className="archive-button" type="button" onClick={handleArchive}>{t('Archive patient')}</button>
          </form>
          {patient.createdBy === user.id && <form className="share-patient-form" onSubmit={shareWithWorker}>
            <h3>{t('Share with ASHA worker')}</h3>
            <p>{t('Only an approved ASHA worker can be added to this patient’s care team.')}</p>
            <label htmlFor="share-asha-email">{t('ASHA worker email')}</label>
            <input id="share-asha-email" type="email" required maxLength="254" value={shareEmail} onChange={(event) => setShareEmail(event.target.value)} />
            <button type="submit" disabled={sharing}>{sharing ? t('Sharing...') : t('Share patient')}</button>
          </form>}
        </section>

        <section className="profile-section visit-history-section">
          <div className="profile-section-heading"><span className="empty-index">{t('ASHA FIELD RECORDS')}</span><h2>{t('Visit history')} <span>{visits.length}</span></h2></div>
          {visits.length ? (
            <div className="visit-history-list">
              {visits.map((visit) => (
                <article className="visit-history-item" key={visit._id}>
                  <div className="visit-date-line"><time dateTime={visit.visitDate}>{formatDate(visit.visitDate)}</time><span>{t(visit.visitType === 'FOLLOW_UP' ? 'Follow-up' : 'Visit')}</span></div>
                  <h3>{visit.symptoms.chiefComplaint}</h3>
                  {visit.symptoms.details && <p>{visit.symptoms.details}</p>}
                  <div className="visit-tags">
                    {visit.followUp?.status === 'SCHEDULED' && <span className="followup-tag">{t('Follow-up')} {formatDate(visit.followUp.date)}</span>}
                    {visit.followUp?.status === 'COMPLETED' && <span className="completed-tag">{t('Follow-up completed')}</span>}
                  </div>
                  <Link className="visit-edit-link" to={`/asha/patients/${patientId}/visits/${visit.localId}/edit`}>{t('Edit field observations')}</Link>
                  <details><summary>{t('Visit details')}</summary>
                    {Object.entries(visit.vitals || {}).some(([, value]) => value !== null) && <p><strong>{t('Vitals')}:</strong> {Object.entries(visit.vitals).filter(([, value]) => value !== null).map(([key, value]) => `${t(VITAL_LABELS[key] || key)}: ${value}`).join(' · ')}</p>}
                    {visit.medicalHistory?.length > 0 && <p><strong>{t('Medical history:')}</strong> {visit.medicalHistory.join(', ')}</p>}
                    {visit.allergies?.length > 0 && <p><strong>{t('Allergies:')}</strong> {visit.allergies.join(', ')}</p>}
                    {visit.currentMedicines?.length > 0 && <p><strong>{t('Current medicines:')}</strong> {visit.currentMedicines.join(', ')}</p>}
                    {visit.observations && <p><strong>{t('Observations:')}</strong> {visit.observations}</p>}
                  </details>
                </article>
              ))}
            </div>
          ) : <p className="patient-state">{t('No visits recorded yet.')}</p>}
        </section>
      </div>
    </main>
  )
}

export default PatientProfilePage
