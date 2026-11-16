import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { AuthProvider } from './context/AuthContext'
import { SyncProvider } from './context/SyncContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Home from './pages/Home'
import StaffPage from './pages/StaffPage'
import StaffForm from './pages/StaffForm'
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
import FieldReportsPage from './pages/FieldReportsPage'
import FieldReportForm from './pages/FieldReportForm'
import PermitAnalyticsPage from './pages/PermitAnalyticsPage'
import VisitReportsPage from './pages/VisitReportsPage'
import AnalyticsDashboardPage from './pages/AnalyticsDashboardPage'
import CompliancePage from './pages/CompliancePage'
import MyAssignmentsPage from './pages/MyAssignmentsPage'
import AllAssignmentsPage from './pages/AllAssignmentsPage'
import TaskFillPage from './pages/TaskFillPage'
import TaskReviewPage from './pages/TaskReviewPage'
import MyProfilePage from './pages/MyProfilePage'
import MyAttendancePage from './pages/MyAttendancePage'
import AttendancePage from './pages/AttendancePage'
import ComplaintsPage from './pages/ComplaintsPage'
import ComplaintForm from './pages/ComplaintForm'
import EnvironmentalEducationPage from './pages/EnvironmentalEducationPage'
import EnvEducationForm from './pages/EnvEducationForm'
import SmsPage from './pages/SmsPage'
import EmailPage from './pages/EmailPage'
import ChatPage from './pages/ChatPage'
import FeeCalculatorPage from './pages/FeeCalculatorPage'

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
              <Route path="analytics" element={<AnalyticsDashboardPage />} />
              <Route path="compliance" element={<CompliancePage />} />

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

              {/* Staff */}
              <Route path="staff" element={<StaffPage />} />
              <Route path="staff/new" element={<StaffForm />} />
              <Route path="staff/:uid/edit" element={<StaffForm />} />

              {/* Admin utilities — bulk import is desktop-only, not in the mobile app */}
              <Route path="import" element={Capacitor.isNativePlatform() ? <Navigate to="/" replace /> : <ImportPage />} />

              {/* Field Reports */}
              <Route path="field-reports" element={<FieldReportsPage />} />
              <Route path="field-reports/new" element={<FieldReportForm />} />
              <Route path="field-reports/:id/edit" element={<FieldReportForm />} />

              {/* Fee Calculator (Act 1080) — static route, so it wins over :module */}
              <Route path="fee-calculator" element={<FeeCalculatorPage />} />

              {/* Top-level module overviews */}
              <Route path=":module" element={<CrossRecordsPage />} />

              {/* Permit Analytics */}
              <Route path="permit-analytics" element={<PermitAnalyticsPage />} />

              {/* Visit Reports */}
              <Route path="visit-reports" element={<VisitReportsPage />} />

              {/* Assignments */}
              <Route path="my-assignments" element={<MyAssignmentsPage />} />
              <Route path="all-assignments" element={<AllAssignmentsPage />} />
              <Route path="tasks/:taskId/fill" element={<TaskFillPage />} />
              <Route path="tasks/:taskId/review" element={<TaskReviewPage />} />

              {/* Profile */}
              <Route path="profile" element={<MyProfilePage />} />

              {/* Attendance */}
              <Route path="my-attendance" element={<MyAttendancePage />} />
              <Route path="attendance" element={<AttendancePage />} />

              {/* Complaints */}
              <Route path="complaints" element={<ComplaintsPage />} />
              <Route path="complaints/new" element={<ComplaintForm />} />
              <Route path="complaints/:id/edit" element={<ComplaintForm />} />

              {/* Environmental Education */}
              <Route path="env-education" element={<EnvironmentalEducationPage />} />
              <Route path="env-education/new" element={<EnvEducationForm />} />
              <Route path="env-education/:id/edit" element={<EnvEducationForm />} />

              {/* SMS */}
              <Route path="sms" element={<SmsPage />} />
              <Route path="email" element={<EmailPage />} />

              {/* Chat */}
              <Route path="chat" element={<ChatPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </SyncProvider>
    </AuthProvider>
  )
}
