import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Home from './pages/Home'
import ComingSoon from './pages/ComingSoon'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Home />} />

            {/* Phase 2 */}
            <Route path="facilities" element={<ComingSoon />} />
            <Route path="staff" element={<ComingSoon />} />

            {/* Phase 5 */}
            <Route path="permits" element={<ComingSoon />} />
            <Route path="finance" element={<ComingSoon />} />
            <Route path="screening" element={<ComingSoon />} />
            <Route path="monitoring" element={<ComingSoon />} />
            <Route path="enforcement" element={<ComingSoon />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
