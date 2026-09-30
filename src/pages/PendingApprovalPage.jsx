import { Link } from 'react-router-dom'

function PendingApprovalPage() {
  return (
    <main className="content-width auth-page">
      <section className="auth-panel pending-panel" aria-labelledby="pending-title">
        <span className="pending-mark" aria-hidden="true">...</span>
        <p className="eyebrow"><span className="eyebrow-dot" /> Registration status</p>
        <h1 id="pending-title">Awaiting approval</h1>
        <p className="auth-intro">Your registration is pending administrator review. Protected FieldSync areas remain unavailable until your account is approved.</p>
        <Link className="auth-submit auth-link-button" to="/login">Return to sign in</Link>
      </section>
    </main>
  )
}

export default PendingApprovalPage
