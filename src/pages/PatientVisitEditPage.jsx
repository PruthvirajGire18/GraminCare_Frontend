import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getPatient, updatePatientVisit } from '../services/asha.service.js'
import { useLanguage } from '../context/LanguageContext.jsx'

const VITAL_FIELDS = [
  ['temperatureC', 'Temperature (°C)', 25, 45, '0.1'],
  ['heartRateBpm', 'Heart rate (bpm)', 20, 250, '1'],
  ['respiratoryRatePerMinute', 'Respiratory rate (/min)', 4, 80, '1'],
  ['systolicMmHg', 'Systolic (mmHg)', 40, 300, '1'],
  ['diastolicMmHg', 'Diastolic (mmHg)', 20, 200, '1'],
  ['oxygenSaturationPercent', 'Oxygen saturation (%)', 50, 100, '1'],
  ['weightKg', 'Weight (kg)', 0.3, 500, '0.1'],
  ['heightCm', 'Height (cm)', 20, 250, '0.1'],
]

function PatientVisitEditPage() {
  const { t, translateError } = useLanguage()
  const { patientId, visitId } = useParams()
  const navigate = useNavigate()
  const [patient, setPatient] = useState(null)
  const [visit, setVisit] = useState(null)
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    getPatient(patientId)
      .then(({ patient: resultPatient, visits }) => {
        const resultVisit = visits.find((item) => item.localId === visitId || item.serverId === visitId)
        if (!resultVisit) throw new Error('Visit not found in this patient record')
        if (!active) return
        setPatient(resultPatient)
        setVisit(resultVisit)
        setForm({
          chiefComplaint: resultVisit.symptoms.chiefComplaint,
          symptomDetails: resultVisit.symptoms.details || '',
          symptomDurationDays: resultVisit.symptoms.durationDays ?? '',
          medicalHistory: (resultVisit.medicalHistory || []).join('\n'),
          allergies: (resultVisit.allergies || []).join('\n'),
          currentMedicines: (resultVisit.currentMedicines || []).join('\n'),
          observations: resultVisit.observations || '',
          vitals: Object.fromEntries(VITAL_FIELDS.map(([field]) => [field, resultVisit.vitals?.[field] ?? ''])),
        })
      })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.message || requestError.message || 'Visit could not be loaded.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [patientId, visitId])

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function setVital(field, value) {
    setForm((current) => ({ ...current, vitals: { ...current.vitals, [field]: value } }))
  }

  async function saveVisit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    const vitals = Object.fromEntries(Object.entries(form.vitals).map(([key, value]) => [key, value === '' ? null : Number(value)]))
    try {
      await updatePatientVisit(patientId, visit.localId, {
        symptoms: {
          chiefComplaint: form.chiefComplaint,
          details: form.symptomDetails,
          durationDays: form.symptomDurationDays === '' ? null : Number(form.symptomDurationDays),
        },
        medicalHistory: form.medicalHistory.split('\n').map((item) => item.trim()).filter(Boolean),
        allergies: form.allergies.split('\n').map((item) => item.trim()).filter(Boolean),
        currentMedicines: form.currentMedicines.split('\n').map((item) => item.trim()).filter(Boolean),
        vitals,
        observations: form.observations,
      })
      navigate(`/asha/patients/${patientId}`, {
        replace: true,
        state: { message: navigator.onLine ? 'Visit update queued; sync status will update shortly.' : 'Visit update saved on this device; it will sync when online.' },
      })
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Visit could not be updated.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <main className="content-width asha-dashboard patient-form-page"><p className="patient-state" role="status">{t('Loading visit...')}</p></main>
  if (!form || !patient) return <main className="content-width asha-dashboard patient-form-page"><p className="auth-error" role="alert">{translateError(error || 'Visit not found.')}</p><Link className="back-link" to={`/asha/patients/${patientId}`}>{t('Back to patient')}</Link></main>

  return (
    <main className="content-width asha-dashboard patient-form-page">
      <Link className="back-link" to={`/asha/patients/${patientId}`}>&#8592; {t('Back to patient')}</Link>
      <section className="patient-form-panel visit-form-panel">
        <p className="eyebrow"><span className="eyebrow-dot" /> {t('Version')} {visit.version} · {t('ASHA visit')}</p>
        <h1>{t('Edit field observations')}</h1>
        <p className="form-intro">{t('Your original version is attached to this update. If another worker changed the same field, both values will be preserved for review.')}</p>
        <form className="patient-form" onSubmit={saveVisit}>
          <label htmlFor="edit-chief-complaint">{t('Symptoms / chief complaint')}</label>
          <input id="edit-chief-complaint" required minLength="2" maxLength="1000" value={form.chiefComplaint} onChange={(event) => setField('chiefComplaint', event.target.value)} />
          <label htmlFor="edit-symptom-details">{t('Symptom details')}</label>
          <textarea id="edit-symptom-details" rows="3" maxLength="4000" value={form.symptomDetails} onChange={(event) => setField('symptomDetails', event.target.value)} />
          <label htmlFor="edit-symptom-duration">{t('Symptom duration')} <span className="field-hint">{t('Days, optional')}</span></label>
          <input id="edit-symptom-duration" type="number" min="0" max="365" step="1" value={form.symptomDurationDays} onChange={(event) => setField('symptomDurationDays', event.target.value)} />
          <label htmlFor="edit-medical-history">{t('Medical history')} <span className="field-hint">{t('One item per line')}</span></label>
          <textarea id="edit-medical-history" rows="2" value={form.medicalHistory} onChange={(event) => setField('medicalHistory', event.target.value)} />
          <div className="form-grid-two">
            <div><label htmlFor="edit-allergies">{t('Allergies')} <span className="field-hint">{t('One per line')}</span></label><textarea id="edit-allergies" rows="3" value={form.allergies} onChange={(event) => setField('allergies', event.target.value)} /></div>
            <div><label htmlFor="edit-medicines">{t('Current medicines')} <span className="field-hint">{t('One per line')}</span></label><textarea id="edit-medicines" rows="3" value={form.currentMedicines} onChange={(event) => setField('currentMedicines', event.target.value)} /></div>
          </div>
          <fieldset className="vitals-fieldset"><legend>{t('Vitals')}</legend><div className="vitals-grid">
            {VITAL_FIELDS.map(([field, label, min, max, step]) => <div key={field}><label htmlFor={`edit-${field}`}>{t(label)}</label><input id={`edit-${field}`} type="number" min={min} max={max} step={step} value={form.vitals[field]} onChange={(event) => setVital(field, event.target.value)} /></div>)}
          </div></fieldset>
          <label htmlFor="edit-observations">{t('Observations')}</label>
          <textarea id="edit-observations" rows="3" maxLength="4000" value={form.observations} onChange={(event) => setField('observations', event.target.value)} />
          {error && <p className="auth-error" role="alert">{translateError(error)}</p>}
          <button className="auth-submit" type="submit" disabled={saving}>{saving ? t('Saving update...') : t('Save field updates')}</button>
        </form>
      </section>
    </main>
  )
}

export default PatientVisitEditPage
