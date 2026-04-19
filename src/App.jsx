import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { SyncProvider } from './context/SyncContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Home from './pages/Home'
import ComingSoon from './pages/ComingSoon'
import Facilities from './pages/Facilities'
import FacilityDetail from './pages/FacilityDetail'
import FacilityForm from './pages/FacilityForm'
import PermitForm from './pages/PermitForm'
import FinanceForm from './pages/FinanceForm'
import ScreeningForm from './pages/ScreeningForm'
import SiteVerificationForm from './pages/SiteVerificationForm'
import MonitoringForm from './pages/MonitoringForm'
import EnforcementForm from './pages/EnforcementForm'
import CrossRecordsPage from './pages/CrossRecordsPage'
import ImportPage from './pages/ImportPage'

export default function App() {
  return (
    <AuthProvider>
      <SyncProvider>
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

              {/* Facilities */}
              <Route path="facilities" element={<Facilities />} />
              <Route path="facilities/new" element={<FacilityForm />} />
              <Route path="facilities/:fileNumber" element={<FacilityDetail />} />
              <Route path="facilities/:fileNumber/edit" element={<FacilityForm />} />

              {/* Permits */}
              <Route path="facilities/:fileNumber/permits/new" element={<PermitForm />} />
              <Route path="facilities/:fileNumber/permits/:recordId/edit" element={<PermitForm />} />

              {/* Finance */}
              <Route path="facilities/:fileNumber/finance/new" element={<FinanceForm />} />
              <Route path="facilities/:fileNumber/finance/:recordId/edit" element={<FinanceForm />} />

              {/* Screenings */}
              <Route path="facilities/:fileNumber/screenings/new" element={<ScreeningForm />} />
              <Route path="facilities/:fileNumber/screenings/:recordId/edit" element={<ScreeningForm />} />

              {/* Site Verifications */}
              <Route path="facilities/:fileNumber/site-verifications/new" element={<SiteVerificationForm />} />
              <Route path="facilities/:fileNumber/site-verifications/:recordId/edit" element={<SiteVerificationForm />} />

              {/* Monitoring */}
              <Route path="facilities/:fileNumber/monitoring/new" element={<MonitoringForm />} />
              <Route path="facilities/:fileNumber/monitoring/:recordId/edit" element={<MonitoringForm />} />

              {/* Enforcement */}
              <Route path="facilities/:fileNumber/enforcement/new" element={<EnforcementForm />} />
              <Route path="facilities/:fileNumber/enforcement/:recordId/edit" element={<EnforcementForm />} />

              {/* Staff (placeholder) */}
              <Route path="staff" element={<ComingSoon />} />

              {/* Admin utilities */}
              <Route path="import" element={<ImportPage />} />

              {/* Cross-facility module views */}
              <Route path=":module" element={<CrossRecordsPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </SyncProvider>
    </AuthProvider>
  )
}
