import { Link } from 'react-router-dom'

function RoleDashboardPage({ role }) {
  const roleTitles = {
    ASHA_WORKER: 'ASHA worker',
    DOCTOR: 'Doctor',
  }

  return (
    <main className="content-width dashboard-page">
      <p className="eyebrow"><span className="eyebrow-dot" /> {roleTitles[role]} workspace</p>
      <h1>Your workspace is ready.</h1>
      <p>This role-specific area is protected. Field workflows will be added in a later phase.</p>
      {role === 'DOCTOR' && <Link className="asha-secondary-action" to="/doctor/conflicts">Review clinical data conflicts</Link>}
    </main>
  )
}

export default RoleDashboardPage
