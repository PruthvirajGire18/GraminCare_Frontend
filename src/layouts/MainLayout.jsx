import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { useSyncStatus } from '../hooks/useSyncStatus.js'
import { dashboardPathForRole } from '../utils/auth.js'
import { useLanguage } from '../context/LanguageContext.jsx'

const WORKSPACE_LINKS = {
  ASHA_WORKER: [
    { to: '/asha', label: 'Overview', end: true },
    { to: '/asha/patients', label: 'Patients' },
    { to: '/asha/patients/new', label: 'Register patient', end: true },
    { to: '/asha/sync', label: 'Sync status', end: true },
  ],
  DOCTOR: [
    { to: '/doctor', label: 'Cases', end: true },
    { to: '/doctor/conflicts', label: 'Review conflicts', end: true },
  ],
  ADMIN: [
    { to: '/admin', label: 'Overview', end: true },
    { to: '/admin#admin-users-title', label: 'User management', anchor: true },
    { to: '/admin#admin-audit-title', label: 'Audit log', anchor: true },
    { to: '/admin/conflicts', label: 'Review conflicts', end: true },
  ],
}

function MainLayout() {
  const { user, loading, logout } = useAuth()
  const { isOnline, status, pendingCount, syncedCount, failedCount, conflictCount } = useSyncStatus()
  const { language, setLanguage, t } = useLanguage()
  const navigate = useNavigate()
  const workspaceLinks = user?.status === 'APPROVED' ? WORKSPACE_LINKS[user.role] || [] : []
  const networkState = !isOnline ? 'Offline' : status === 'SYNCING' ? 'Syncing' : 'Online'
  const networkLabel = t(networkState)
  const networkGlyph = !isOnline ? '🔴' : status === 'SYNCING' ? '🟠' : '🟢'

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
        <Link className="brand" to="/" aria-label={t('FieldSync home')}>
          <span className="brand-mark" aria-hidden="true">FS</span>
          <span>FieldSync</span>
        </Link>
        <span className="header-note">{t('Offline-first rural telemedicine')}</span>
        <nav className="header-actions" aria-label={t('Account navigation')}>
          <label className="language-picker">
            <span>{t('Language')}</span>
            <select aria-label={t('Choose language')} value={language} onChange={(event) => setLanguage(event.target.value)}>
              <option value="en">English</option>
              <option value="hi">हिन्दी</option>
              <option value="mr">मराठी</option>
            </select>
          </label>
          {!loading && user ? (
            <>
              <Link className="header-dashboard" to={dashboardPathForRole(user.role)}>{t(user.role === 'ASHA_WORKER' ? 'ASHA Worker' : user.role === 'DOCTOR' ? 'Doctor' : 'Admin')}</Link>
              <button className="header-logout" type="button" onClick={handleLogout}>{t('Sign out')}</button>
            </>
          ) : !loading && (
            <>
              <Link className="header-login" to="/login">{t('Sign in')}</Link>
              <Link className="header-register" to="/register">{t('Request access')}</Link>
            </>
          )}
        </nav>
      </header>
      {workspaceLinks.length > 0 && <div className="workspace-nav-shell">
        <nav className="workspace-nav" aria-label={t('Workspace navigation')}>
          {workspaceLinks.map((item) => item.anchor
            ? <Link className="workspace-nav-link" key={item.to} to={item.to}>{t(item.label)}</Link>
            : <NavLink className={({ isActive }) => `workspace-nav-link${isActive ? ' workspace-nav-link-active' : ''}`} end={item.end} key={item.to} to={item.to}>{t(item.label)}</NavLink>)}
        </nav>
      </div>}
      {user?.role === 'ASHA_WORKER' && (
        <section className="offline-sync-strip" aria-label={t('Network and synchronization status')}>
          <div className={`offline-sync-indicator offline-sync-${networkState.toLowerCase()}`} role="status">
            <span aria-hidden="true">{networkGlyph}</span>{networkLabel}
          </div>
          <div className="offline-sync-counts" aria-label={t('Synchronization queue totals')}>
            <span><strong>{t('Pending:')}</strong> {pendingCount}</span>
            <span><strong>{t('Synced:')}</strong> {syncedCount}</span>
            <span><strong>{t('Failed:')}</strong> {failedCount}</span>
            <span><strong>{t('Conflict:')}</strong> {conflictCount}</span>
          </div>
        </section>
      )}
      <Outlet />
      <footer className="site-footer">
        <span>{t('FieldSync project foundation')}</span>
        <span>{t('Care teams, connected with care')}</span>
      </footer>
    </div>
  )
}

export default MainLayout
