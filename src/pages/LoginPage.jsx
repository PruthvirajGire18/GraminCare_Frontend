import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { dashboardPathForRole } from '../utils/auth.js'

function LoginPage() {
  const { user, loading: sessionLoading, login } = useAuth()
  const navigate = useNavigate()
  const routeLocation = useLocation()
  const [form, setForm] = useState({ email: '', password: '' })
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
      const signedInUser = await login(form)
      const requestedPath = routeLocation.state?.from
      const destination = requestedPath?.pathname?.startsWith('/') && !requestedPath.pathname.startsWith('//')
        ? `${requestedPath.pathname}${requestedPath.search || ''}${requestedPath.hash || ''}`
        : dashboardPathForRole(signedInUser.role)
      navigate(destination, { replace: true })
    } catch (requestError) {
      const response = requestError.response?.data
      setError(response?.message || 'Unable to sign in. Check your connection and try again.')
      if (response?.code === 'ACCOUNT_PENDING') {
        navigate('/pending', { replace: true })
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="content-width auth-page">
      <section className="auth-panel" aria-labelledby="login-title">
        <p className="eyebrow"><span className="eyebrow-dot" /> FieldSync access</p>
        <h1 id="login-title">Welcome back</h1>
        <p className="auth-intro">Sign in with your approved care-team account.</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="login-email">Email address</label>
          <input id="login-email" type="email" autoComplete="username" required maxLength="254" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          <label htmlFor="login-password">Password</label>
          <input id="login-password" type="password" autoComplete="current-password" required maxLength="72" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" type="submit" disabled={submitting || sessionLoading}>{submitting ? 'Signing in...' : 'Sign in'}</button>
        </form>
        <p className="auth-switch">New to FieldSync? <Link to="/register">Request an account</Link></p>
      </section>
    </main>
  )
}

export default LoginPage
