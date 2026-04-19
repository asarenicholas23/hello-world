import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Spinner from './Spinner'

export default function ProtectedRoute({ children }) {
  const { user, staff, loading, staffError, logout } = useAuth()

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6' }}>
        <Spinner size={40} />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (staffError) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6', padding: 24 }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: '40px 36px', maxWidth: 420, width: '100%', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,.1)' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Access Denied</h2>
          <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 24 }}>{staffError}</p>
          <button className="btn btn--primary" onClick={logout}>Sign Out</button>
        </div>
      </div>
    )
  }

  if (!staff) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6' }}>
        <Spinner size={40} />
      </div>
    )
  }

  return children
}
