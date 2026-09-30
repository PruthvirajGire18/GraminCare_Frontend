import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthProvider.jsx'
import { useAuth } from './hooks/useAuth.js'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import MainLayout from './layouts/MainLayout.jsx'
import AdminDashboardPage from './pages/AdminDashboardPage.jsx'
import ASHADashboardPage from './pages/ASHADashboardPage.jsx'
import ConflictReviewPage from './pages/ConflictReviewPage.jsx'
import DoctorDashboardPage from './pages/DoctorDashboardPage.jsx'
import HomePage from './pages/HomePage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import PatientCreatePage from './pages/PatientCreatePage.jsx'
import PatientListPage from './pages/PatientListPage.jsx'
import PatientProfilePage from './pages/PatientProfilePage.jsx'
import PatientVisitCreatePage from './pages/PatientVisitCreatePage.jsx'
import PatientVisitEditPage from './pages/PatientVisitEditPage.jsx'
import PendingApprovalPage from './pages/PendingApprovalPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import ReferralVerifyPage from './pages/ReferralVerifyPage.jsx'
import SyncDebugPage from './pages/SyncDebugPage.jsx'
import { dashboardPathForRole } from './utils/auth.js'

const DoctorCasePage = lazy(() => import('./pages/DoctorCasePage.jsx'))

function DashboardRedirect() {
  const { user, loading } = useAuth()
  if (loading) return <main className="content-width auth-loading" role="status">Checking your session...</main>
  return <Navigate to={user ? dashboardPathForRole(user.role) : '/login'} replace />
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<MainLayout />}>
            <Route index element={<HomePage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
            <Route path="pending" element={<PendingApprovalPage />} />
            <Route path="dashboard" element={<DashboardRedirect />} />
            <Route path="referral/verify" element={<ReferralVerifyPage />} />
            <Route path="admin" element={<ProtectedRoute allowedRoles={['ADMIN']}><AdminDashboardPage /></ProtectedRoute>} />
            <Route path="admin/conflicts" element={<ProtectedRoute allowedRoles={['ADMIN']}><ConflictReviewPage /></ProtectedRoute>} />
            <Route path="asha" element={<ProtectedRoute allowedRoles={['ASHA_WORKER']}><ASHADashboardPage /></ProtectedRoute>} />
            <Route path="asha/sync" element={<ProtectedRoute allowedRoles={['ASHA_WORKER']}><SyncDebugPage /></ProtectedRoute>} />
            <Route path="asha/patients" element={<ProtectedRoute allowedRoles={['ASHA_WORKER']}><PatientListPage /></ProtectedRoute>} />
            <Route path="asha/patients/new" element={<ProtectedRoute allowedRoles={['ASHA_WORKER']}><PatientCreatePage /></ProtectedRoute>} />
            <Route path="asha/patients/:patientId" element={<ProtectedRoute allowedRoles={['ASHA_WORKER']}><PatientProfilePage /></ProtectedRoute>} />
            <Route path="asha/patients/:patientId/visits/new" element={<ProtectedRoute allowedRoles={['ASHA_WORKER']}><PatientVisitCreatePage /></ProtectedRoute>} />
            <Route path="asha/patients/:patientId/visits/:visitId/edit" element={<ProtectedRoute allowedRoles={['ASHA_WORKER']}><PatientVisitEditPage /></ProtectedRoute>} />
            <Route path="doctor" element={<ProtectedRoute allowedRoles={['DOCTOR']}><DoctorDashboardPage /></ProtectedRoute>} />
            <Route path="doctor/cases/:patientId" element={<ProtectedRoute allowedRoles={['DOCTOR']}><Suspense fallback={<main className="content-width doctor-case-page"><p className="patient-state" role="status">Loading patient case…</p></main>}><DoctorCasePage /></Suspense></ProtectedRoute>} />
            <Route path="doctor/conflicts" element={<ProtectedRoute allowedRoles={['DOCTOR']}><ConflictReviewPage /></ProtectedRoute>} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
