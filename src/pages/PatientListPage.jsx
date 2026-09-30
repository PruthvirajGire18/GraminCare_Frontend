import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getPatients } from '../services/asha.service.js'

function PatientListPage() {
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    getPatients({ q: query })
      .then((result) => { if (active) setPatients(result.patients) })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Patients could not be loaded.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [query])

  function submitSearch(event) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setQuery(search.trim())
  }

  return (
    <main className="content-width asha-dashboard patient-list-page">
      <div className="asha-page-heading">
        <div>
          <p className="eyebrow"><span className="eyebrow-dot" /> Patient records</p>
          <h1>My patients</h1>
        </div>
        <Link className="asha-primary-action" to="/asha/patients/new">Register patient <span aria-hidden="true">+</span></Link>
      </div>
      <form className="patient-search" onSubmit={submitSearch} role="search">
        <label htmlFor="patient-search">Search by name or phone</label>
        <div>
          <input id="patient-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search patients" maxLength="80" />
          <button type="submit" disabled={loading}>Search</button>
        </div>
      </form>
      {error && <p className="auth-error" role="alert">{error}</p>}
      {loading ? <p className="patient-state" role="status">Loading patients...</p> : patients.length ? (
        <div className="patient-list">
          {patients.map((patient) => (
            <Link className="patient-row" to={`/asha/patients/${patient._id}`} key={patient._id}>
              <span className="patient-avatar" aria-hidden="true">{patient.fullName.slice(0, 1).toUpperCase()}</span>
              <span className="patient-main"><strong>{patient.fullName}</strong><span>{patient.gender.replace('_', ' ')}{patient.address?.village ? ` · ${patient.address.village}` : ''}</span></span>
              <span className="patient-phone">{patient.phone || 'No phone recorded'}</span>
              <span className="patient-arrow" aria-hidden="true">&#8594;</span>
            </Link>
          ))}
        </div>
      ) : (
        <section className="asha-empty-state patient-empty">
          <span className="empty-index">NO MATCHING RECORDS</span>
          <h2>{query ? 'No patients found' : 'Your patient list is empty'}</h2>
          <p>{query ? 'Try another name or phone number.' : 'Registered patients will appear here.'}</p>
          {!query && <Link to="/asha/patients/new">Register a patient</Link>}
        </section>
      )}
    </main>
  )
}

export default PatientListPage
