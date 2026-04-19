import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Construction } from 'lucide-react'

const PHASE_MAP = {
  '/facilities': { label: 'Facilities', phase: 'Phase 2' },
  '/staff':      { label: 'Staff Management', phase: 'Phase 2' },
  '/permits':    { label: 'Permits', phase: 'Phase 5' },
  '/finance':    { label: 'Finance', phase: 'Phase 5' },
  '/screening':  { label: 'Screening', phase: 'Phase 5' },
  '/monitoring': { label: 'Monitoring', phase: 'Phase 5' },
  '/enforcement':{ label: 'Enforcement', phase: 'Phase 5' },
}

export default function ComingSoon() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const info = PHASE_MAP[pathname] ?? { label: pathname.replace('/', ''), phase: 'a future phase' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 360, gap: 16, textAlign: 'center' }}>
      <div style={{ width: 64, height: 64, borderRadius: 16, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Construction size={32} color="#9ca3af" />
      </div>
      <div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 6 }}>
          {info.label}
        </div>
        <div style={{ fontSize: 14, color: '#6b7280', maxWidth: 320 }}>
          This module is coming in <strong>{info.phase}</strong>. Check back after the next build.
        </div>
      </div>
      <button className="btn btn--ghost btn--sm" onClick={() => navigate('/')}>
        <ArrowLeft size={14} />
        Back to Dashboard
      </button>
    </div>
  )
}
