import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { dashboardPathForRole } from '../utils/auth.js'

function MainLayout() {
  const { user, loading, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    try {
      await logout()
    } finally {
      navigate('/', { replace: true })
    }
  }

  return (
    <div className="page-shell">
      <header className="site-header">
        <Link className="brand" to="/" aria-label="FieldSync home">
          <span className="brand-mark" aria-hidden="true">FS</span>
          <span>FieldSync</span>
        </Link>
        <span className="header-note">Offline-first rural telemedicine</span>
        <nav className="header-actions" aria-label="Account navigation">
          {!loading && user ? (
            <>
              <Link className="header-dashboard" to={dashboardPathForRole(user.role)}>{user.role.replace('_', ' ')}</Link>
              <button className="header-logout" type="button" onClick={handleLogout}>Sign out</button>
            </>
          ) : !loading && (
            <>
              <Link className="header-login" to="/login">Sign in</Link>
              <Link className="header-register" to="/register">Request access</Link>
            </>
          )}
        </nav>
      </header>
      <Outlet />
      <footer className="site-footer">
        <span>FieldSync project foundation</span>
        <span>Care teams, connected with care</span>
      </footer>
    </div>
  )
}

export default MainLayout
