import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  createConsultation,
  createPrescription,
  createReferral,
  getDoctorCase,
  revokeReferral,
  takeDoctorCase,
} from '../services/doctor.service.js'

const RISK_BADGES = {
  LOW: { icon: '🟢', label: 'LOW' },
  MEDIUM: { icon: '🟡', label: 'MEDIUM' },
  HIGH: { icon: '🟠', label: 'HIGH' },
  CRITICAL: { icon: '🔴', label: 'CRITICAL' },
}

const VITAL_LABELS = [
  ['temperatureC', 'Temperature', '°C'],
  ['oxygenSaturationPercent', 'SpO2', '%'],
  ['heartRateBpm', 'Heart rate', 'bpm'],
  ['respiratoryRatePerMinute', 'Breathing rate', '/min'],
  ['systolicMmHg', 'Systolic BP', 'mmHg'],
  ['diastolicMmHg', 'Diastolic BP', 'mmHg'],
]

const blankMedicine = () => ({ medicine: '', dosage: '', frequency: '', duration: '', instructions: '' })

function displayDate(value) {
  if (!value) return 'Not recorded'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Not recorded' : date.toLocaleString()
}

function displayList(values) {
  return Array.isArray(values) && values.length ? <ul className="doctor-detail-list">{values.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul> : <p className="doctor-muted">None recorded</p>
}

function VisitPanel({ visit }) {
  const assessment = visit.aiAssessment
  const badge = assessment?.riskLevel ? RISK_BADGES[assessment.riskLevel] : null
  const vitals = VITAL_LABELS.filter(([field]) => visit.vitals?.[field] !== null && visit.vitals?.[field] !== undefined)
  return (
    <article className="doctor-visit-panel">
      <div className="doctor-section-title"><div><p className="doctor-case-date">{visit.visitType === 'FOLLOW_UP' ? 'ASHA follow-up visit' : 'ASHA field visit'} · {displayDate(visit.visitDate)}</p><h3>{visit.symptoms?.chiefComplaint || 'Symptoms not recorded'}</h3></div>
        {badge && <span className={`risk-badge risk-${assessment.riskLevel.toLowerCase()}`}><span aria-hidden="true">{badge.icon}</span> {badge.label}</span>}
      </div>
      {visit.symptoms?.details && <p className="doctor-visit-detail">{visit.symptoms.details}</p>}
      {visit.symptoms?.durationDays !== null && visit.symptoms?.durationDays !== undefined && <p className="doctor-visit-detail"><strong>Duration:</strong> {visit.symptoms.durationDays} days</p>}
      {vitals.length > 0 && <dl className="doctor-vitals-grid">{vitals.map(([field, label, unit]) => <div key={field}><dt>{label}</dt><dd>{visit.vitals[field]} {unit}</dd></div>)}</dl>}
      {visit.observations && <div className="doctor-observation"><strong>ASHA observations</strong><p>{visit.observations}</p></div>}
      <div className="doctor-visit-records">
        <div><h4>Medical history</h4>{displayList(visit.medicalHistory)}</div>
        <div><h4>Allergies</h4>{displayList(visit.allergies)}</div>
        <div><h4>Current medicines</h4>{displayList(visit.currentMedicines)}</div>
      </div>
      {assessment?.status === 'AI_ASSESSED' ? <section className="doctor-assessment-panel">
        <div className="doctor-section-title"><h3>AI-assisted preliminary assessment</h3><span>Score {assessment.riskScore}/100 · {assessment.priority}</span></div>
        {assessment.factors?.length ? displayList(assessment.factors) : <p className="doctor-muted">No contributing factors returned.</p>}
        <p><strong>AI recommendation:</strong> {assessment.recommendation}</p>
        <small>Assessed {displayDate(assessment.assessedAt)}. For prioritization only; the doctor makes the final clinical assessment.</small>
      </section> : <p className="doctor-assessment-pending">AI preliminary assessment is pending or unavailable. Review the recorded clinical information directly.</p>}
    </article>
  )
}

function DoctorCasePage() {
  const { patientId } = useParams()
  const [caseData, setCaseData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [taking, setTaking] = useState(false)
  const [savingConsultation, setSavingConsultation] = useState(false)
  const [savingPrescription, setSavingPrescription] = useState(false)
  const [savingReferral, setSavingReferral] = useState(false)
  const [revokingReferralId, setRevokingReferralId] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [consultationId, setConsultationId] = useState('')
  const [referralResult, setReferralResult] = useState(null)
  const [consultationForm, setConsultationForm] = useState({ notes: '', assessment: '', treatmentPlan: '', priority: 'LOW', followUpDate: '', ashaVisitId: '' })
  const [prescriptionForm, setPrescriptionForm] = useState({ items: [blankMedicine()], notes: '' })
  const [referralForm, setReferralForm] = useState({
    reason: '',
    priority: 'HIGH',
    destination: { facilityName: '', address: '' },
  })

  const refresh = useCallback(async (initial = false) => {
    if (initial) setLoading(true)
    else setRefreshing(true)
    setError('')
    try {
      setCaseData(await getDoctorCase(patientId))
    } catch (requestError) {
      const status = requestError.response?.status
      setError(status === 401 ? 'Your session expired. Sign in again to continue.'
        : status === 403 ? 'A doctor account is required to access this case.'
          : requestError.response?.data?.message || 'Patient case could not be loaded.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [patientId])

  useEffect(() => {
    const timer = setTimeout(() => { void refresh(true) }, 0)
    return () => clearTimeout(timer)
  }, [refresh])

  const assignedToMe = Boolean(caseData?.patient.assignedDoctor?.isCurrentUser)
  const consultations = caseData?.consultations ?? []
  const selectedConsultationId = consultationId || consultations[0]?._id || ''

  function updatePrescriptionItem(index, field, value) {
    setPrescriptionForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item),
    }))
  }

  async function handleTakeCase() {
    setTaking(true)
    setError('')
    setSuccess('')
    try {
      const result = await takeDoctorCase(patientId)
      await refresh()
      setSuccess(result.alreadyAssigned ? 'This case is already assigned to you.' : 'Case assigned to you.')
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'This case could not be assigned. Refresh and try again.')
      if (requestError.response?.status === 409) await refresh()
    } finally {
      setTaking(false)
    }
  }

  async function handleConsultation(event) {
    event.preventDefault()
    setSavingConsultation(true)
    setError('')
    setSuccess('')
    try {
      const consultation = await createConsultation(patientId, {
        ...consultationForm,
        followUpDate: consultationForm.followUpDate || null,
        ashaVisitId: consultationForm.ashaVisitId || null,
      })
      setConsultationId(consultation._id)
      setConsultationForm({ notes: '', assessment: '', treatmentPlan: '', priority: 'LOW', followUpDate: '', ashaVisitId: '' })
      setSuccess('Consultation saved.')
      await refresh()
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Consultation could not be saved.')
    } finally {
      setSavingConsultation(false)
    }
  }

  async function handlePrescription(event) {
    event.preventDefault()
    setSavingPrescription(true)
    setError('')
    setSuccess('')
    try {
      await createPrescription(patientId, {
        consultationId: selectedConsultationId,
        notes: prescriptionForm.notes,
        items: prescriptionForm.items,
      })
      setPrescriptionForm({ items: [blankMedicine()], notes: '' })
      setSuccess('Prescription saved to the doctor record.')
      await refresh()
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Prescription could not be saved.')
    } finally {
      setSavingPrescription(false)
    }
  }

  async function handleReferral(event) {
    event.preventDefault()
    setSavingReferral(true)
    setError('')
    setSuccess('')
    setReferralResult(null)
    try {
      const result = await createReferral(patientId, { consultationId: selectedConsultationId, ...referralForm })
      setReferralResult(result)
      setReferralForm({ reason: '', priority: 'HIGH', destination: { facilityName: '', address: '' } })
      setSuccess('Secure referral created. The ASHA worker has been notified and can open its QR from their dashboard.')
      await refresh()
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Referral could not be created.')
    } finally {
      setSavingReferral(false)
    }
  }

  async function handleRevokeReferral(referralId) {
    setRevokingReferralId(referralId)
    setError('')
    setSuccess('')
    try {
      await revokeReferral(patientId, referralId)
      setSuccess('Referral revoked. Its QR token can no longer be used.')
      await refresh()
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Referral could not be revoked.')
    } finally {
      setRevokingReferralId('')
    }
  }

  if (loading) return <main className="content-width doctor-case-page"><p className="patient-state" role="status">Loading patient case…</p></main>
  if (!caseData) return <main className="content-width doctor-case-page"><Link className="back-link" to="/doctor">← Back to cases</Link><p className="auth-error" role="alert">{error || 'Patient case not found.'}</p></main>

  const { patient } = caseData
  return (
    <main className="content-width doctor-case-page">
      <Link className="back-link" to="/doctor">← Back to case queue</Link>
      <header className="doctor-patient-header">
        <div>
          <p className="eyebrow"><span className="eyebrow-dot" /> Patient case</p>
          <h1>{patient.fullName}</h1>
          <p>{patient.ageYears === null ? 'Age not recorded' : `${patient.ageYears} years`} · {patient.gender.toLowerCase()} · Registered {displayDate(patient.createdAt)}</p>
          <p>{patient.phone || 'Phone not recorded'}{patient.address?.village ? ` · ${patient.address.village}` : ''}{patient.address?.district ? `, ${patient.address.district}` : ''}</p>
        </div>
        <div className="doctor-assignment-action">
          {assignedToMe ? <span className="doctor-assigned-label">Assigned to you · {displayDate(patient.assignedAt)}</span> : patient.assignedDoctor ? <span className="doctor-assigned-label">Taken by {patient.assignedDoctor.name || 'another doctor'}</span> : <button className="doctor-take-case" type="button" onClick={handleTakeCase} disabled={taking}>{taking ? 'Taking case…' : 'Take Case'}</button>}
          <button className="doctor-refresh-button" type="button" onClick={() => void refresh()} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh'}</button>
        </div>
      </header>
      <p className="doctor-case-open-note">Opening a patient case does not assign it. Use <strong>Take Case</strong> to claim an unassigned case before documenting clinical actions.</p>
      {error && <p className="auth-error" role="alert">{error}</p>}
      {success && <p className="success-message" role="status">{success}</p>}

      <section className="doctor-patient-snapshot" aria-label="Current medical information">
        <div><h2>Medical history</h2>{displayList(caseData.medicalHistory)}</div>
        <div><h2>Allergies</h2>{displayList(caseData.allergies)}</div>
        <div><h2>Current medicines</h2>{displayList(caseData.currentMedicines)}</div>
      </section>

      <section className="doctor-case-section">
        <div className="doctor-section-heading"><div><p className="eyebrow"><span className="eyebrow-dot" /> Field records</p><h2>ASHA visits</h2></div><span>{caseData.visits.length} visits</span></div>
        {caseData.visits.length ? <div className="doctor-visit-list">{caseData.visits.map((visit) => <VisitPanel key={visit._id} visit={visit} />)}</div> : <div className="doctor-empty-panel"><h3>No ASHA visits yet</h3><p>Patient information will appear here after the first field visit synchronizes.</p></div>}
      </section>

      <section className="doctor-case-section doctor-timeline-section">
        <div className="doctor-section-heading"><div><p className="eyebrow"><span className="eyebrow-dot" /> Patient history</p><h2>Timeline</h2></div></div>
        {caseData.timeline.length ? <ol className="doctor-timeline">{caseData.timeline.map((event) => <li key={`${event.type}-${event.id}`}>
          <span className={`timeline-dot timeline-${event.type.toLowerCase()}`} aria-hidden="true" />
          <div><div className="timeline-heading"><strong>{event.title}</strong><time>{displayDate(event.date)}</time></div><p>{event.summary || 'Record saved'}</p>{event.type === 'REFERRAL' && <small>Referral status: {event.status}</small>}{event.type === 'FOLLOW_UP_SCHEDULED' && <small>Follow-up status: {event.status}</small>}</div>
        </li>)}</ol> : <div className="doctor-empty-panel"><p>No timeline events have been recorded yet.</p></div>}
      </section>

      <section className="doctor-case-section">
        <div className="doctor-section-heading"><div><p className="eyebrow"><span className="eyebrow-dot" /> Clinical notes</p><h2>Consultations</h2></div><span>{consultations.length} records</span></div>
        {consultations.map((consultation) => <article className="doctor-consultation-card" key={consultation._id}>
          <div className="timeline-heading"><strong>{consultation.priority} priority</strong><time>{displayDate(consultation.createdAt)}</time></div>
          <p><strong>Clinical notes</strong><br />{consultation.notes}</p>
          {consultation.assessment && <p><strong>Assessment</strong><br />{consultation.assessment}</p>}
          {consultation.treatmentPlan && <p><strong>Treatment plan</strong><br />{consultation.treatmentPlan}</p>}
          {consultation.followUpDate && <p><strong>Follow-up</strong> · {displayDate(consultation.followUpDate)} · {consultation.followUpStatus || 'PENDING'}</p>}
        </article>)}
        {assignedToMe ? <form className="doctor-action-form" onSubmit={handleConsultation}>
          <h3>Add consultation</h3>
          <label>Clinical notes <textarea required maxLength="10000" rows="3" value={consultationForm.notes} onChange={(event) => setConsultationForm((current) => ({ ...current, notes: event.target.value }))} /></label>
          <label>Assessment <textarea maxLength="5000" rows="3" value={consultationForm.assessment} onChange={(event) => setConsultationForm((current) => ({ ...current, assessment: event.target.value }))} /></label>
          <label>Treatment plan <textarea maxLength="5000" rows="3" value={consultationForm.treatmentPlan} onChange={(event) => setConsultationForm((current) => ({ ...current, treatmentPlan: event.target.value }))} /></label>
          <div className="doctor-form-grid">
            <label>Priority <select value={consultationForm.priority} onChange={(event) => setConsultationForm((current) => ({ ...current, priority: event.target.value }))}><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select></label>
            <label>Follow-up date <input type="date" value={consultationForm.followUpDate} onChange={(event) => setConsultationForm((current) => ({ ...current, followUpDate: event.target.value }))} /></label>
            <label>Related ASHA visit <select value={consultationForm.ashaVisitId} onChange={(event) => setConsultationForm((current) => ({ ...current, ashaVisitId: event.target.value }))}><option value="">No linked visit</option>{caseData.visits.map((visit) => <option key={visit._id} value={visit._id}>{displayDate(visit.visitDate)} · {visit.symptoms?.chiefComplaint}</option>)}</select></label>
          </div>
          <button className="doctor-primary-button" type="submit" disabled={savingConsultation}>{savingConsultation ? 'Saving…' : 'Save consultation'}</button>
        </form> : <p className="doctor-locked-note">Take this case before adding a consultation.</p>}
      </section>

      <section className="doctor-clinical-actions">
        <div className="doctor-case-section">
          <div className="doctor-section-heading"><div><p className="eyebrow"><span className="eyebrow-dot" /> Doctor record</p><h2>Prescriptions</h2></div></div>
          {caseData.prescriptions.map((prescription) => <article className="doctor-consultation-card" key={prescription._id}>
            <div className="timeline-heading"><strong>Prescription</strong><time>{displayDate(prescription.createdAt)}</time></div>
            <ul>{prescription.items.map((item, index) => <li key={`${item.medicine}-${index}`}>{item.medicine} · {item.dosage} · {item.frequency}{item.duration ? ` · ${item.duration}` : ''}{item.instructions ? ` · ${item.instructions}` : ''}</li>)}</ul>
            {prescription.notes && <p>{prescription.notes}</p>}
          </article>)}
          {assignedToMe && consultations.length > 0 ? <form className="doctor-action-form" onSubmit={handlePrescription}>
            <h3>Add prescription</h3>
            <label>Consultation <select required value={selectedConsultationId} onChange={(event) => setConsultationId(event.target.value)}>{consultations.map((item) => <option key={item._id} value={item._id}>{displayDate(item.createdAt)} · {item.priority}</option>)}</select></label>
            {prescriptionForm.items.map((item, index) => <fieldset className="vitals-fieldset" key={`medicine-${index}`}>
              <legend>Medicine {index + 1}</legend>
              <label>Medicine <input required maxLength="200" value={item.medicine} onChange={(event) => updatePrescriptionItem(index, 'medicine', event.target.value)} /></label>
              <div className="doctor-form-grid">
                <label>Dosage <input required maxLength="120" value={item.dosage} onChange={(event) => updatePrescriptionItem(index, 'dosage', event.target.value)} /></label>
                <label>Frequency <input required maxLength="120" value={item.frequency} onChange={(event) => updatePrescriptionItem(index, 'frequency', event.target.value)} /></label>
                <label>Duration <input maxLength="120" value={item.duration} onChange={(event) => updatePrescriptionItem(index, 'duration', event.target.value)} /></label>
              </div>
              <label>Instructions <textarea maxLength="500" rows="2" value={item.instructions} onChange={(event) => updatePrescriptionItem(index, 'instructions', event.target.value)} /></label>
              {prescriptionForm.items.length > 1 && <button className="doctor-clear-filters" type="button" onClick={() => setPrescriptionForm((current) => ({ ...current, items: current.items.filter((_medicine, itemIndex) => itemIndex !== index) }))}>Remove medicine</button>}
            </fieldset>)}
            <button className="doctor-clear-filters" type="button" disabled={prescriptionForm.items.length >= 20} onClick={() => setPrescriptionForm((current) => ({ ...current, items: [...current.items, blankMedicine()] }))}>Add another medicine</button>
            <label>Prescription notes <textarea maxLength="2000" rows="2" value={prescriptionForm.notes} onChange={(event) => setPrescriptionForm((current) => ({ ...current, notes: event.target.value }))} /></label>
            <button className="doctor-primary-button" type="submit" disabled={savingPrescription}>{savingPrescription ? 'Saving…' : 'Save prescription'}</button>
          </form> : <p className="doctor-locked-note">{assignedToMe ? 'Save a consultation before adding a prescription.' : 'Take this case before adding a prescription.'}</p>}
        </div>

        <div className="doctor-case-section">
          <div className="doctor-section-heading"><div><p className="eyebrow"><span className="eyebrow-dot" /> Care coordination</p><h2>Referrals</h2></div></div>
          {caseData.referrals.map((referral) => <article className="doctor-consultation-card" key={referral._id}>
            <div className="timeline-heading"><strong>{referral.status} · {referral.priority}</strong><time>{displayDate(referral.createdAt)}</time></div>
            <p>{referral.reason}</p>
            {referral.destination?.facilityName && <p><strong>Destination:</strong> {referral.destination.facilityName}{referral.destination.address ? ` · ${referral.destination.address}` : ''}</p>}
            <small>Expires {displayDate(referral.expiresAt)}</small>
            {referral.status === 'ACTIVE' && <button className="doctor-clear-filters" type="button" disabled={revokingReferralId === referral._id} onClick={() => void handleRevokeReferral(referral._id)}>{revokingReferralId === referral._id ? 'Revoking…' : 'Revoke referral'}</button>}
          </article>)}
          {assignedToMe && consultations.length > 0 ? <form className="doctor-action-form" onSubmit={handleReferral}>
            <h3>Refer patient</h3>
            <label>Consultation <select required value={selectedConsultationId} onChange={(event) => setConsultationId(event.target.value)}>{consultations.map((item) => <option key={item._id} value={item._id}>{displayDate(item.createdAt)} · {item.priority}</option>)}</select></label>
            <label>Referral reason <textarea required maxLength="2000" rows="3" value={referralForm.reason} onChange={(event) => setReferralForm((current) => ({ ...current, reason: event.target.value }))} /></label>
            <div className="doctor-form-grid">
              <label>Priority <select value={referralForm.priority} onChange={(event) => setReferralForm((current) => ({ ...current, priority: event.target.value }))}><option value="HIGH">HIGH</option><option value="CRITICAL">CRITICAL</option></select></label>
              <label>Destination facility <input maxLength="160" value={referralForm.destination.facilityName} onChange={(event) => setReferralForm((current) => ({ ...current, destination: { ...current.destination, facilityName: event.target.value } }))} /></label>
              <label>Destination address <input maxLength="300" value={referralForm.destination.address} onChange={(event) => setReferralForm((current) => ({ ...current, destination: { ...current.destination, address: event.target.value } }))} /></label>
            </div>
            <button className="doctor-primary-button" type="submit" disabled={savingReferral}>{savingReferral ? 'Creating…' : 'Create secure referral'}</button>
          </form> : <p className="doctor-locked-note">{assignedToMe ? 'Save a consultation before creating a referral.' : 'Take this case before creating a referral.'}</p>}
          {referralResult && <div className="doctor-referral-token" role="status"><strong>Referral Generated · {referralResult.referral.priority}</strong><span>ASHA worker was notified. Expires {displayDate(referralResult.referral.expiresAt)}. QR access is available only through the authorized ASHA dashboard.</span></div>}
        </div>
      </section>
      <p className="doctor-ai-disclaimer">Clinical decisions, treatment plans, prescriptions, and referrals are entered by the doctor. AI assessment is preliminary decision support only.</p>
    </main>
  )
}

export default DoctorCasePage
