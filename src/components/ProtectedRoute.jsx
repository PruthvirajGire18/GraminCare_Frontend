import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { dashboardPathForRole } from '../utils/auth.js'

function ProtectedRoute({ allowedRoles, children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <main className="content-width auth-loading" role="status">Checking your session...</main>
  }
  if (!user) {
    return <Navigate to="/login" replace />
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={dashboardPathForRole(user.role)} replace />
  }
  if (user.status !== 'APPROVED') {
    return <Navigate to="/pending" replace />
  }

  return children
}

export default ProtectedRoute
