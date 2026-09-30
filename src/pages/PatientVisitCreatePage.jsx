import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { createPatientVisit, getPatient } from '../services/asha.service.js'

const EMPTY_VITALS = {
  temperatureC: '',
  heartRateBpm: '',
  respiratoryRatePerMinute: '',
  systolicMmHg: '',
  diastolicMmHg: '',
  oxygenSaturationPercent: '',
  weightKg: '',
  heightCm: '',
}

function dateInputValue() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

function splitLines(value) {
  return value.split('\n').map((item) => item.trim()).filter(Boolean)
}

function PatientVisitCreatePage() {
  const { patientId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedConsultationId = searchParams.get('followUpConsultation') || ''
  const [patient, setPatient] = useState(null)
  const [scheduledVisits, setScheduledVisits] = useState([])
  const [doctorFollowUps, setDoctorFollowUps] = useState([])
  const [visitType, setVisitType] = useState('INITIAL')
  const [followUpSelection, setFollowUpSelection] = useState('')
  const [form, setForm] = useState({
    visitDate: dateInputValue(),
    chiefComplaint: '',
    symptomDetails: '',
    symptomDurationDays: '',
    medicalHistory: '',
    allergies: '',
    currentMedicines: '',
    observations: '',
    followUpDate: '',
    vitals: EMPTY_VITALS,
  })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    getPatient(patientId)
      .then((result) => {
        if (!active) return
        setPatient(result.patient)
        setScheduledVisits(result.visits.filter((visit) => visit.followUp?.status === 'SCHEDULED'))
        setDoctorFollowUps(result.doctorFollowUps || [])
        if (requestedConsultationId && (result.doctorFollowUps || []).some((item) => item.consultationId.toString() === requestedConsultationId)) {
          setVisitType('FOLLOW_UP')
          setFollowUpSelection(`consultation:${requestedConsultationId}`)
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Patient could not be loaded.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [patientId, requestedConsultationId])

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function setVital(field, value) {
    setForm((current) => ({ ...current, vitals: { ...current.vitals, [field]: value } }))
  }

  function changeVisitType(value) {
    setVisitType(value)
    setFollowUpSelection('')
  }

  async function submitVisit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    const vitals = Object.fromEntries(Object.entries(form.vitals).map(([key, value]) => [key, value === '' ? null : Number(value)]))
    try {
      await createPatientVisit(patientId, {
        visitType,
        followUpOf: visitType === 'FOLLOW_UP' && followUpSelection.startsWith('visit:') ? followUpSelection.slice('visit:'.length) : null,
        followUpConsultationId: visitType === 'FOLLOW_UP' && followUpSelection.startsWith('consultation:') ? followUpSelection.slice('consultation:'.length) : null,
        visitDate: form.visitDate,
        symptoms: {
          chiefComplaint: form.chiefComplaint,
          details: form.symptomDetails,
          durationDays: form.symptomDurationDays === '' ? null : Number(form.symptomDurationDays),
        },
        medicalHistory: splitLines(form.medicalHistory),
        allergies: splitLines(form.allergies),
        currentMedicines: splitLines(form.currentMedicines),
        observations: form.observations,
        vitals,
        followUp: { date: form.followUpDate || null },
      })
      navigate(`/asha/patients/${patientId}`, {
        replace: true,
        state: {
          message: navigator.onLine
            ? (visitType === 'FOLLOW_UP' ? 'Follow-up saved. Sync status will update shortly.' : 'Visit saved. Sync status will update shortly.')
            : 'Visit saved on this device; it will sync when online.',
        },
      })
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Visit could not be saved. Check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <main className="content-width asha-dashboard patient-form-page"><p className="patient-state" role="status">Loading patient...</p></main>
  if (!patient) return <main className="content-width asha-dashboard patient-form-page"><p className="auth-error" role="alert">{error || 'Patient not found.'}</p><Link className="back-link" to="/asha/patients">Back to patients</Link></main>

  return (
    <main className="content-width asha-dashboard patient-form-page">
      <Link className="back-link" to={`/asha/patients/${patientId}`}>&#8592; Back to {patient.fullName}</Link>
      <section className="patient-form-panel visit-form-panel">
        <p className="eyebrow"><span className="eyebrow-dot" /> ASHA visit record</p>
        <h1>Record a visit</h1>
        <p className="form-intro">{patient.fullName}. Visit observations are recorded separately from doctor consultations.</p>
        <form className="patient-form" onSubmit={submitVisit}>
          <div className="form-grid-two">
            <div><label htmlFor="visit-type">Visit type</label><select id="visit-type" value={visitType} onChange={(event) => changeVisitType(event.target.value)}><option value="INITIAL">Visit</option><option value="FOLLOW_UP" disabled={!scheduledVisits.length && !doctorFollowUps.length}>Follow-up</option></select></div>
            <div><label htmlFor="visit-date">Visit date</label><input id="visit-date" type="date" max={dateInputValue()} required value={form.visitDate} onChange={(event) => setField('visitDate', event.target.value)} /></div>
          </div>
          {visitType === 'FOLLOW_UP' && <div><label htmlFor="follow-up-of">Scheduled follow-up to complete</label><select id="follow-up-of" required value={followUpSelection} onChange={(event) => setFollowUpSelection(event.target.value)}><option value="">Select a scheduled follow-up</option>{scheduledVisits.map((visit) => <option key={`visit-${visit._id}`} value={`visit:${visit._id}`}>{new Date(visit.followUp.date).toLocaleDateString()} · Existing visit · {visit.symptoms.chiefComplaint}</option>)}{doctorFollowUps.map((item) => <option key={`consultation-${item.consultationId}`} value={`consultation:${item.consultationId}`}>{new Date(item.dueDate).toLocaleDateString()} · Doctor follow-up · {item.status}</option>)}</select></div>}
          <label htmlFor="chief-complaint">Symptoms / chief complaint <span>Required</span></label>
          <input id="chief-complaint" required minLength="2" maxLength="1000" value={form.chiefComplaint} onChange={(event) => setField('chiefComplaint', event.target.value)} />
          <label htmlFor="symptom-details">Symptom details</label>
          <textarea id="symptom-details" rows="3" maxLength="4000" value={form.symptomDetails} onChange={(event) => setField('symptomDetails', event.target.value)} />
          <label htmlFor="symptom-duration">Symptom duration <span className="field-hint">Days, optional</span></label>
          <input id="symptom-duration" type="number" min="0" max="365" step="1" value={form.symptomDurationDays} onChange={(event) => setField('symptomDurationDays', event.target.value)} />
          <label htmlFor="medical-history">Medical history <span className="field-hint">One item per line</span></label>
          <textarea id="medical-history" rows="2" value={form.medicalHistory} onChange={(event) => setField('medicalHistory', event.target.value)} />
          <div className="form-grid-two">
            <div><label htmlFor="allergies">Allergies <span className="field-hint">One per line</span></label><textarea id="allergies" rows="3" value={form.allergies} onChange={(event) => setField('allergies', event.target.value)} /></div>
            <div><label htmlFor="current-medicines">Current medicines <span className="field-hint">One per line</span></label><textarea id="current-medicines" rows="3" value={form.currentMedicines} onChange={(event) => setField('currentMedicines', event.target.value)} /></div>
          </div>

          <fieldset className="vitals-fieldset">
            <legend>Vitals</legend>
            <div className="vitals-grid">
              <div><label htmlFor="temperature">Temperature (°C)</label><input id="temperature" type="number" min="25" max="45" step="0.1" value={form.vitals.temperatureC} onChange={(event) => setVital('temperatureC', event.target.value)} /></div>
              <div><label htmlFor="heart-rate">Heart rate (bpm)</label><input id="heart-rate" type="number" min="20" max="250" value={form.vitals.heartRateBpm} onChange={(event) => setVital('heartRateBpm', event.target.value)} /></div>
              <div><label htmlFor="respiratory-rate">Respiratory rate (/min)</label><input id="respiratory-rate" type="number" min="4" max="80" value={form.vitals.respiratoryRatePerMinute} onChange={(event) => setVital('respiratoryRatePerMinute', event.target.value)} /></div>
              <div><label htmlFor="systolic">Systolic (mmHg)</label><input id="systolic" type="number" min="40" max="300" value={form.vitals.systolicMmHg} onChange={(event) => setVital('systolicMmHg', event.target.value)} /></div>
              <div><label htmlFor="diastolic">Diastolic (mmHg)</label><input id="diastolic" type="number" min="20" max="200" value={form.vitals.diastolicMmHg} onChange={(event) => setVital('diastolicMmHg', event.target.value)} /></div>
              <div><label htmlFor="oxygen">Oxygen saturation (%)</label><input id="oxygen" type="number" min="50" max="100" value={form.vitals.oxygenSaturationPercent} onChange={(event) => setVital('oxygenSaturationPercent', event.target.value)} /></div>
              <div><label htmlFor="weight">Weight (kg)</label><input id="weight" type="number" min="0.3" max="500" step="0.1" value={form.vitals.weightKg} onChange={(event) => setVital('weightKg', event.target.value)} /></div>
              <div><label htmlFor="height">Height (cm)</label><input id="height" type="number" min="20" max="250" step="0.1" value={form.vitals.heightCm} onChange={(event) => setVital('heightCm', event.target.value)} /></div>
            </div>
          </fieldset>
          <label htmlFor="observations">Observations</label>
          <textarea id="observations" rows="3" maxLength="4000" value={form.observations} onChange={(event) => setField('observations', event.target.value)} />
          <label htmlFor="follow-up-date">Schedule a follow-up <span className="field-hint">Optional</span></label>
          <input id="follow-up-date" type="date" min={dateInputValue()} value={form.followUpDate} onChange={(event) => setField('followUpDate', event.target.value)} />
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" type="submit" disabled={submitting || (visitType === 'FOLLOW_UP' && !followUpSelection)}>{submitting ? 'Saving visit...' : visitType === 'FOLLOW_UP' ? 'Complete follow-up' : 'Save visit'}</button>
        </form>
      </section>
    </main>
  )
}

export default PatientVisitCreatePage
