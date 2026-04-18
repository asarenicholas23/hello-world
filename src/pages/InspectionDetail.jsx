import { useParams, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import StatusBadge from "../components/StatusBadge";
import { officers } from "../data/mockData";
import { ArrowLeft, Building2, User, Calendar, ClipboardList } from "lucide-react";

export default function InspectionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { inspections, firms, violations } = useApp();

  const ins = inspections.find((i) => i.id === id);
  if (!ins) return <div className="page"><p>Inspection not found.</p></div>;

  const firm = firms.find((f) => f.id === ins.firmId);
  const officer = officers.find((o) => o.id === ins.officer);
  const insViolations = violations.filter((v) => ins.violations.includes(v.id));

  const scoreColor = ins.score >= 75 ? "#16a34a" : ins.score >= 50 ? "#a16207" : "#dc2626";
  const scoreBg = ins.score >= 75 ? "#dcfce7" : ins.score >= 50 ? "#fef9c3" : "#fee2e2";

  return (
    <div className="page">
      <button className="btn btn--ghost btn--back" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> Back
      </button>

      <div className="detail-header">
        <div>
          <h1 className="page-title">Inspection {ins.id}</h1>
          <div className="detail-badges">
            <StatusBadge status={ins.status} />
            <span className="badge badge--gray">{ins.type}</span>
          </div>
        </div>
        <div
          className="score-large"
          style={{ background: scoreBg, color: scoreColor }}
        >
          <span className="score-large__value">{ins.score}</span>
          <span className="score-large__label">/ 100</span>
        </div>
      </div>

      <div className="detail-grid">
        <div className="card">
          <h3 className="card-title">Inspection Info</h3>
          <div className="info-list">
            <div className="info-item"><Building2 size={15} />
              <button className="link-btn" onClick={() => navigate(`/firms/${firm?.id}`)}>{firm?.name}</button>
            </div>
            <div className="info-item"><Calendar size={15} /><span>{ins.date}</span></div>
            <div className="info-item"><User size={15} /><span>{officer?.name ?? ins.officer} ({officer?.badge})</span></div>
            <div className="info-item"><ClipboardList size={15} /><span>{ins.type} inspection</span></div>
          </div>
        </div>
        <div className="card">
          <h3 className="card-title">Field Findings</h3>
          <p className="findings-text">{ins.findings}</p>
        </div>
      </div>

      {insViolations.length > 0 && (
        <div className="card">
          <h3 className="card-title">Violations Raised</h3>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr><th>ID</th><th>Category</th><th>Severity</th><th>Fine (KES)</th><th>Status</th></tr>
              </thead>
              <tbody>
                {insViolations.map((v) => (
                  <tr key={v.id} onClick={() => navigate(`/violations/${v.id}`)} className="table-row--clickable">
                    <td className="text-mono">{v.id}</td>
                    <td>{v.category}</td>
                    <td><StatusBadge status={v.severity} /></td>
                    <td>{v.fine.toLocaleString()}</td>
                    <td><StatusBadge status={v.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
