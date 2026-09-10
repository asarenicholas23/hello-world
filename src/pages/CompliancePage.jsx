import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getMonitoringComplianceRows } from '../firebase/dashboard'
import { facilityComplianceRows } from '../data/compliance'
import { hasFullDataAccess } from '../data/constants'
import { facilityPath } from '../utils/fileNumbers'
import ComplianceScorecard from '../components/ComplianceScorecard'
import Spinner from '../components/Spinner'

export default function CompliancePage() {
  const navigate = useNavigate()
  const { role, dataAccess } = useAuth()
  const canView = hasFullDataAccess(role, dataAccess) || role === 'it'

  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!canView) return
    getMonitoringComplianceRows()
      .then((monRows) => setRows(facilityComplianceRows(monRows)))
      .catch(() => setError('Failed to load compliance data.'))
  }, [canView])

  if (!canView) {
    return <div className="empty-state">Compliance analytics is available to I.T and data-access accounts.</div>
  }

  return (
    <div className="page">
      <button className="btn btn--ghost btn--sm btn--back" onClick={() => navigate('/')}>
        <ArrowLeft size={14} /> Dashboard
      </button>

      <div className="page-header" style={{ marginTop: 12 }}>
        <div className="page-title">Compliance Scorecard</div>
        <div className="page-subtitle">
          Each facility scored on its most recent monitoring visit. Filter by sector and district; open a row for the facility.
        </div>
      </div>

      {error && (
        <div className="login-error" style={{ margin: '12px 0' }}>
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {rows == null && !error ? (
        <Spinner size={40} />
      ) : (
        <ComplianceScorecard
          rows={rows ?? []}
          onOpenFacility={(fileNumber) => navigate(facilityPath(fileNumber), { state: { tab: 'monitoring' } })}
        />
      )}
    </div>
  )
}
