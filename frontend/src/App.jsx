import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import AppLayout      from './components/layout/AppLayout'
import ToastContainer from './components/ui/Toast'
import LoginPage      from './pages/LoginPage'
import DashboardPage  from './pages/DashboardPage'
import DevicesPage    from './pages/DevicesPage'
import DeviceDetailPage from './pages/DeviceDetailPage'
import TopologyPage   from './pages/TopologyPage'

/**
 * ProtectedRoute — redirects unauthenticated users to /login.
 */
function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

function AppRoutes() {
  const { isAuthenticated } = useAuth()

  return (
    <Routes>
      {/* Public */}
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />}
      />

      {/* Protected — wrapped in AppLayout */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="devices"   element={<DevicesPage />}   />
        <Route path="devices/:id" element={<DeviceDetailPage />} />
        <Route path="topology"  element={<TopologyPage />}  />
      </Route>

      {/* 404 fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        {/* Global toast notifications — always mounted */}
        <ToastContainer />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
