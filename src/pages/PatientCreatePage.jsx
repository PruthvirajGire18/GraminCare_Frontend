import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createPatient } from '../services/asha.service.js'

const EMPTY_FORM = {
  fullName: '',
  dateOfBirth: '',
  gender: 'UNKNOWN',
  phone: '',
  village: '',
  district: '',
  state: '',
  details: '',
}

function PatientCreatePage() {
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function submitPatient(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const patient = await createPatient({
        fullName: form.fullName,
        dateOfBirth: form.dateOfBirth || null,
        gender: form.gender,
        phone: form.phone,
        address: { village: form.village, district: form.district, state: form.state, details: form.details },
      })
      navigate(`/asha/patients/${patient._id}`, {
        replace: true,
        state: { message: navigator.onLine ? 'Patient saved. Sync status will update shortly.' : 'Patient saved on this device; it will sync when online.' },
      })
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Patient could not be registered. Check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="content-width asha-dashboard patient-form-page">
      <Link className="back-link" to="/asha/patients">&#8592; Back to patients</Link>
      <section className="patient-form-panel">
        <p className="eyebrow"><span className="eyebrow-dot" /> New patient</p>
        <h1>Patient details</h1>
        <p className="form-intro">Demographic information is stored separately from visit records.</p>
        <form className="patient-form" onSubmit={submitPatient}>
          <label htmlFor="patient-name">Full name <span>Required</span></label>
          <input id="patient-name" autoComplete="name" required minLength="2" maxLength="120" value={form.fullName} onChange={(event) => setField('fullName', event.target.value)} />
          <div className="form-grid-two">
            <div><label htmlFor="patient-dob">Date of birth</label><input id="patient-dob" type="date" max={new Date().toISOString().slice(0, 10)} value={form.dateOfBirth} onChange={(event) => setField('dateOfBirth', event.target.value)} /></div>
            <div><label htmlFor="patient-gender">Gender <span>Required</span></label><select id="patient-gender" required value={form.gender} onChange={(event) => setField('gender', event.target.value)}><option value="UNKNOWN">Not specified</option><option value="FEMALE">Female</option><option value="MALE">Male</option><option value="OTHER">Other</option></select></div>
          </div>
          <label htmlFor="patient-phone">Phone number</label>
          <input id="patient-phone" type="tel" autoComplete="tel" maxLength="25" value={form.phone} onChange={(event) => setField('phone', event.target.value)} />
          <div className="form-grid-two">
            <div><label htmlFor="patient-village">Village</label><input id="patient-village" maxLength="120" value={form.village} onChange={(event) => setField('village', event.target.value)} /></div>
            <div><label htmlFor="patient-district">District</label><input id="patient-district" maxLength="120" value={form.district} onChange={(event) => setField('district', event.target.value)} /></div>
          </div>
          <div className="form-grid-two">
            <div><label htmlFor="patient-state">State</label><input id="patient-state" maxLength="120" value={form.state} onChange={(event) => setField('state', event.target.value)} /></div>
            <div><label htmlFor="patient-address">Address details</label><input id="patient-address" maxLength="300" value={form.details} onChange={(event) => setField('details', event.target.value)} /></div>
          </div>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" type="submit" disabled={submitting}>{submitting ? 'Saving patient...' : 'Save patient'}</button>
        </form>
      </section>
    </main>
  )
}

export default PatientCreatePage
