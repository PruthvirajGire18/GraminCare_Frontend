import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { dashboardPathForRole } from '../utils/auth.js'

function RegisterPage() {
  const { user, loading: sessionLoading, register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'ASHA_WORKER' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!sessionLoading && user) {
    return <Navigate to={dashboardPathForRole(user.role)} replace />
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await register(form)
      navigate('/pending', { replace: true, state: { email: form.email } })
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to submit registration. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="content-width auth-page">
      <section className="auth-panel" aria-labelledby="register-title">
        <p className="eyebrow"><span className="eyebrow-dot" /> Request access</p>
        <h1 id="register-title">Join the care team</h1>
        <p className="auth-intro">Registrations are reviewed by a FieldSync administrator before sign-in is enabled.</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="register-name">Full name</label>
          <input id="register-name" type="text" autoComplete="name" required minLength="2" maxLength="100" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <label htmlFor="register-email">Email address</label>
          <input id="register-email" type="email" autoComplete="email" required maxLength="254" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          <label htmlFor="register-role">Role</label>
          <select id="register-role" required value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
            <option value="ASHA_WORKER">ASHA worker</option>
            <option value="DOCTOR">Doctor</option>
          </select>
          <label htmlFor="register-password">Password <span className="field-hint">At least 10 characters</span></label>
          <input id="register-password" type="password" autoComplete="new-password" required minLength="10" maxLength="72" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" type="submit" disabled={submitting || sessionLoading}>{submitting ? 'Submitting...' : 'Request account'}</button>
        </form>
        <p className="auth-switch">Already approved? <Link to="/login">Sign in</Link></p>
      </section>
    </main>
  )
}

export default RegisterPage
