import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { useReminder } from './hooks/useReminder'
import SignUpPage from './pages/SignUpPage'
import SignInPage from './pages/SignInPage'
import HabitsPage from './pages/HabitsPage'
import GroupsPage from './pages/GroupsPage'
import GroupDetailPage from './pages/GroupDetailPage'
import StatsPage from './pages/StatsPage'
import ProfilePage from './pages/ProfilePage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import OfflineBanner from './components/OfflineBanner'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, recovering } = useAuth()
  if (loading) return null
  if (recovering) return <Navigate to="/restablecer" replace />
  if (!session) return <Navigate to="/signin" replace />
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return null
  if (session) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export default function App() {
  useReminder()
  return (
    <>
      <OfflineBanner />
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/signup" element={<PublicRoute><SignUpPage /></PublicRoute>} />
        <Route path="/signin" element={<PublicRoute><SignInPage /></PublicRoute>} />
        <Route path="/recuperar" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
        <Route path="/restablecer" element={<ResetPasswordPage />} />
        <Route path="/dashboard" element={<ProtectedRoute><HabitsPage /></ProtectedRoute>} />
        <Route path="/grupos" element={<ProtectedRoute><GroupsPage /></ProtectedRoute>} />
        <Route path="/grupos/:id" element={<ProtectedRoute><GroupDetailPage /></ProtectedRoute>} />
        <Route path="/estadisticas" element={<ProtectedRoute><StatsPage /></ProtectedRoute>} />
        <Route path="/perfil" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  )
}
