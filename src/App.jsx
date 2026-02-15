import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Landing from './pages/Landing'
import SignIn from './pages/SignIn'
import HunterSignIn from './pages/HunterSignIn'
import LandownerSignIn from './pages/LandownerSignIn'
import HunterDashboard from './pages/HunterDashboard'
import HunterBook from './pages/HunterBook'
import LandownerDashboard from './pages/LandownerDashboard'
import { useAuth } from './context/AuthContext'

function ProtectedRoute({ children, role }) {
  const { user, isLoading } = useAuth()
  const location = useLocation()
  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">Loading…</div>
  if (!user) return <Navigate to={`/signin?redirect=${encodeURIComponent(location.pathname)}`} replace />
  if (role && user.role !== role) return <Navigate to="/" replace />
  return children
}

function RedirectIfAuth({ children }) {
  const { user, isLoading } = useAuth()
  if (isLoading) return null
  if (user?.role === 'hunter') return <Navigate to="/hunter/dashboard" replace />
  if (user?.role === 'landowner') return <Navigate to="/landowner/dashboard" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/signin" element={<RedirectIfAuth><SignIn /></RedirectIfAuth>} />
      <Route path="/hunter/signin" element={<HunterSignIn />} />
      <Route path="/landowner/signin" element={<LandownerSignIn />} />
      <Route path="/hunter/dashboard" element={
        <ProtectedRoute role="hunter">
          <HunterDashboard />
        </ProtectedRoute>
      } />
      <Route path="/hunter/book/:propertyId" element={
        <ProtectedRoute role="hunter">
          <HunterBook />
        </ProtectedRoute>
      } />
      <Route path="/landowner/dashboard" element={
        <ProtectedRoute role="landowner">
          <LandownerDashboard />
        </ProtectedRoute>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
