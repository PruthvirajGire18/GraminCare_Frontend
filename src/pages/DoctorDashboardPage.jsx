import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDoctorDashboard } from '../services/doctor.service.js'

const RISK_BADGES = {
  LOW: { icon: '🟢', label: 'LOW' },
  MEDIUM: { icon: '🟡', label: 'MEDIUM' },
  HIGH: { icon: '🟠', label: 'HIGH' },
  CRITICAL: { icon: '🔴', label: 'CRITICAL' },
}

const EMPTY_SUMMARY = {
  newCases: 0,
  unassignedCases: 0,
  myActiveCases: 0,
  highRiskCases: 0,
  criticalCases: 0,
  followUps: 0,
}

function formatDate(value) {
  if (!value) return 'Not recorded'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Not recorded' : date.toLocaleString()
}

function MetricCard({ label, value, active, onClick, className = '' }) {
  return <button className={`doctor-metric ${className} ${active ? 'doctor-metric-active' : ''}`} type="button" onClick={onClick} aria-pressed={active}>
    <span>{label}</span><strong>{value}</strong>
  </button>
}

function QueueCaseCard({ item }) {
  const { patient, latestVisit } = item
  const assessment = latestVisit?.aiAssessment
  const badge = assessment?.riskLevel ? RISK_BADGES[assessment.riskLevel] : null
  return (
    <article className={`doctor-queue-card ${assessment?.riskLevel ? `queue-${assessment.riskLevel.toLowerCase()}` : ''}`}>
      <div className="doctor-queue-topline">
        <div>
          <p className="doctor-case-date">{latestVisit ? `${latestVisit.visitType === 'FOLLOW_UP' ? 'Follow-up visit' : 'Field visit'} · ${formatDate(latestVisit.visitDate)}` : 'No visit submitted yet'}</p>
          <h2>{patient.fullName}</h2>
          <p className="doctor-patient-meta">{patient.ageYears === null ? 'Age not recorded' : `${patient.ageYears} years`} · {patient.gender.toLowerCase()}</p>
        </div>
        {badge ? <span className={`risk-badge risk-${assessment.riskLevel.toLowerCase()}`}><span aria-hidden="true">{badge.icon}</span> {badge.label}</span> : <span className="risk-badge risk-pending">Assessment pending</span>}
      </div>
      <div className="doctor-queue-description">
        <strong>{latestVisit?.symptoms?.chiefComplaint || 'Awaiting ASHA visit information'}</strong>
        <span>{patient.assignedDoctor ? `Assigned to ${patient.assignedDoctor.name || 'doctor'}` : 'Unassigned'}</span>
      </div>
      <div className="doctor-queue-meta">
        <span>{patient.caseStatus === 'ACTIVE' ? 'Active case' : 'New case'}</span>
        {item.followUpDue && <span className="follow-up-due">Follow-up due · {formatDate(item.followUpDate)}</span>}
        {assessment?.priority && <span>Priority: {assessment.priority}</span>}
      </div>
      <Link className="doctor-open-case" to={`/doctor/cases/${patient.id}`}>Open patient case <span aria-hidden="true">→</span></Link>
    </article>
  )
}

function DoctorDashboardPage() {
  const [summary, setSummary] = useState(EMPTY_SUMMARY)
  const [cases, setCases] = useState([])
  const [filters, setFilters] = useState({ q: '', riskLevel: '', assigned: '', followUpDue: false, caseStatus: '' })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [updatedAt, setUpdatedAt] = useState(null)

  const refresh = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true)
    setRefreshing(true)
    setError('')
    try {
      const result = await getDoctorDashboard()
      setSummary({ ...EMPTY_SUMMARY, ...result.summary })
      setCases(result.cases || [])
      setUpdatedAt(new Date())
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Doctor cases could not be loaded.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    const initialRequest = setTimeout(() => { void refresh(true) }, 0)
    const timer = setInterval(() => { void refresh() }, 30_000)
    return () => {
      clearTimeout(initialRequest)
      clearInterval(timer)
    }
  }, [refresh])

  const visibleCases = useMemo(() => cases.filter((item) => {
    const patient = item.patient
    const matchesName = !filters.q || `${patient.fullName} ${patient.phone || ''}`.toLowerCase().includes(filters.q.trim().toLowerCase())
    const matchesRisk = !filters.riskLevel || item.riskLevel === filters.riskLevel
    const matchesAssignment = filters.assigned === 'UNASSIGNED' ? !patient.assignedDoctor
      : filters.assigned === 'MINE' ? Boolean(patient.assignedDoctor?.isCurrentUser)
        : true
    const matchesFollowUp = !filters.followUpDue || item.followUpDue
    const matchesStatus = !filters.caseStatus || patient.caseStatus === filters.caseStatus
    return matchesName && matchesRisk && matchesAssignment && matchesFollowUp && matchesStatus
  }), [cases, filters])

  function selectPreset(preset) {
    const next = { q: '', riskLevel: '', assigned: '', followUpDue: false, caseStatus: '' }
    if (preset === 'newCases') next.caseStatus = 'NEW'
    if (preset === 'unassignedCases') next.assigned = 'UNASSIGNED'
    if (preset === 'myActiveCases') next.assigned = 'MINE'
    if (preset === 'highRiskCases') next.riskLevel = 'HIGH'
    if (preset === 'criticalCases') next.riskLevel = 'CRITICAL'
    if (preset === 'followUps') next.followUpDue = true
    setFilters(next)
  }

  return (
    <main className="content-width doctor-dashboard">
      <div className="asha-page-heading doctor-page-heading">
        <div>
          <p className="eyebrow"><span className="eyebrow-dot" /> Doctor workspace</p>
          <h1>Case management</h1>
          <p className="doctor-dashboard-intro">Review synchronized field cases, take ownership, and record clinical decisions.</p>
        </div>
        <button className="doctor-refresh-button" type="button" onClick={() => void refresh(true)} disabled={refreshing}>
          {refreshing ? 'Refreshing…' : 'Refresh cases'}
        </button>
      </div>

      <section className="doctor-metric-grid" aria-label="Case summary">
        <MetricCard label="New cases" value={summary.newCases} active={filters.caseStatus === 'NEW'} onClick={() => selectPreset('newCases')} />
        <MetricCard label="Unassigned cases" value={summary.unassignedCases} active={filters.assigned === 'UNASSIGNED'} onClick={() => selectPreset('unassignedCases')} />
        <MetricCard label="My active cases" value={summary.myActiveCases} active={filters.assigned === 'MINE'} onClick={() => selectPreset('myActiveCases')} />
        <MetricCard label="High risk" value={summary.highRiskCases} className="metric-high" active={filters.riskLevel === 'HIGH'} onClick={() => selectPreset('highRiskCases')} />
        <MetricCard label="Critical" value={summary.criticalCases} className="metric-critical" active={filters.riskLevel === 'CRITICAL'} onClick={() => selectPreset('criticalCases')} />
        <MetricCard label="Follow-ups" value={summary.followUps} active={filters.followUpDue} onClick={() => selectPreset('followUps')} />
      </section>

      <div className="doctor-dashboard-links">
        <Link className="asha-secondary-action" to="/doctor/conflicts">Review clinical data conflicts <span aria-hidden="true">→</span></Link>
        {updatedAt && <span>Updated {formatDate(updatedAt)}</span>}
      </div>
      <p className="doctor-dashboard-disclaimer">AI-assisted preliminary assessment. For prioritization only; the doctor remains responsible for the final clinical assessment.</p>

      {summary.notifications?.length > 0 && <section className="doctor-queue-section" aria-labelledby="doctor-notifications-heading">
        <div className="doctor-queue-title"><div><p className="eyebrow"><span className="eyebrow-dot" /> Care reminders</p><h2 id="doctor-notifications-heading">Follow-up notifications</h2></div><span>{summary.notifications.length} recent</span></div>
        <div className="doctor-queue-list">{summary.notifications.map((item) => <article className="doctor-consultation-card" key={item._id}>
          <div className="timeline-heading"><strong>{item.title}</strong><time>{formatDate(item.createdAt)}</time></div>
          <p>{item.message}</p>
          <Link className="doctor-open-case" to={`/doctor/cases/${item.patient}`}>Open patient case <span aria-hidden="true">→</span></Link>
        </article>)}</div>
      </section>}

      <section className="doctor-queue-section" aria-labelledby="doctor-queue-heading">
        <div className="doctor-queue-title"><div><p className="eyebrow"><span className="eyebrow-dot" /> Patient queue</p><h2 id="doctor-queue-heading">Cases for review</h2></div><span>{visibleCases.length} cases</span></div>
        <div className="doctor-filters">
          <label className="doctor-search"><span>Search patients</span><input value={filters.q} onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))} placeholder="Name or phone" /></label>
          <label><span>Risk level</span><select value={filters.riskLevel} onChange={(event) => setFilters((current) => ({ ...current, riskLevel: event.target.value }))}><option value="">All risk levels</option><option value="LOW">LOW</option><option value="MEDIUM">MEDIUM</option><option value="HIGH">HIGH</option><option value="CRITICAL">CRITICAL</option></select></label>
          <label><span>Assignment</span><select value={filters.assigned} onChange={(event) => setFilters((current) => ({ ...current, assigned: event.target.value }))}><option value="">All cases</option><option value="UNASSIGNED">Unassigned</option><option value="MINE">Assigned to me</option></select></label>
          <label><span>Follow-up</span><select value={filters.followUpDue ? 'DUE' : ''} onChange={(event) => setFilters((current) => ({ ...current, followUpDue: event.target.value === 'DUE' }))}><option value="">Any follow-up</option><option value="DUE">Follow-up due</option></select></label>
          {(filters.q || filters.riskLevel || filters.assigned || filters.followUpDue || filters.caseStatus) && <button className="doctor-clear-filters" type="button" onClick={() => setFilters({ q: '', riskLevel: '', assigned: '', followUpDue: false, caseStatus: '' })}>Clear filters</button>}
        </div>
        {error && <p className="auth-error" role="alert">{error}</p>}
        {loading ? <p className="patient-state" role="status">Loading patient cases…</p> : visibleCases.length ? (
          <div className="doctor-queue-list">{visibleCases.map((item) => <QueueCaseCard item={item} key={item.patient.id} />)}</div>
        ) : !error ? (
          <section className="asha-empty-state"><span className="empty-index">QUEUE CLEAR</span><h2>{cases.length ? 'No cases match these filters' : 'No synchronized cases yet'}</h2><p>{cases.length ? 'Change or clear the filters to see other cases.' : 'Patient cases will appear after an ASHA visit synchronizes.'}</p></section>
        ) : null}
      </section>
    </main>
  )
}

export default DoctorDashboardPage
