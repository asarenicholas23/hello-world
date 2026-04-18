import { useParams, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import StatusBadge from "../components/StatusBadge";
import ScoreGauge from "../components/ScoreGauge";
import { officers } from "../data/mockData";
import { ArrowLeft, MapPin, Phone, Mail, User, Calendar, Plus } from "lucide-react";

export default function FirmDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { firms, inspections, violations } = useApp();

  const firm = firms.find((f) => f.id === id);
  if (!firm) return <div className="page"><p>Firm not found.</p></div>;

  const firmInspections = inspections.filter((i) => i.firmId === id);
  const firmViolations = violations.filter((v) => v.firmId === id);
  const officer = officers.find((o) => o.id === firm.assignedOfficer);

  return (
    <div className="page">
      <button className="btn btn--ghost btn--back" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> Back
      </button>

      <div className="detail-header">
        <div className="detail-header__main">
          <h1 className="page-title">{firm.name}</h1>
          <p className="text-muted">{firm.registrationNumber} · {firm.industry}</p>
          <div className="detail-badges">
            <StatusBadge status={firm.status} />
          </div>
        </div>
        <ScoreGauge score={firm.complianceScore} />
      </div>

      {/* Info grid */}
      <div className="detail-grid">
        <div className="card">
          <h3 className="card-title">Firm Details</h3>
          <div className="info-list">
            <div className="info-item"><MapPin size={15} /><span>{firm.location}</span></div>
            <div className="info-item"><User size={15} /><span>{firm.contact}</span></div>
            <div className="info-item"><Phone size={15} /><span>{firm.phone}</span></div>
            <div className="info-item"><Mail size={15} /><span>{firm.email}</span></div>
          </div>
        </div>
        <div className="card">
          <h3 className="card-title">Inspection Schedule</h3>
          <div className="info-list">
            <div className="info-item"><Calendar size={15} /><span>Last inspected: {firm.lastInspected}</span></div>
            <div className="info-item"><Calendar size={15} /><span>Next due: {firm.nextInspection}</span></div>
            <div className="info-item"><User size={15} /><span>Officer: {officer?.name ?? firm.assignedOfficer}</span></div>
            <div className="info-item"><span className="info-badge">{officer?.badge}</span></div>
          </div>
        </div>
      </div>

      {/* Inspections */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Inspection History</h3>
          <button
            className="btn btn--primary btn--sm"
            onClick={() => navigate(`/inspections/new?firmId=${firm.id}`)}
          >
            <Plus size={14} /> New Inspection
          </button>
        </div>
        {firmInspections.length === 0 ? (
          <p className="empty-state">No inspections recorded.</p>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr><th>ID</th><th>Date</th><th>Type</th><th>Score</th><th>Status</th></tr>
              </thead>
              <tbody>
                {firmInspections.map((ins) => (
                  <tr key={ins.id} onClick={() => navigate(`/inspections/${ins.id}`)} className="table-row--clickable">
                    <td className="text-mono">{ins.id}</td>
                    <td>{ins.date}</td>
                    <td>{ins.type}</td>
                    <td>
                      <span className="score-pill" style={{ background: ins.score >= 75 ? "#dcfce7" : ins.score >= 50 ? "#fef9c3" : "#fee2e2", color: ins.score >= 75 ? "#16a34a" : ins.score >= 50 ? "#a16207" : "#dc2626" }}>
                        {ins.score}
                      </span>
                    </td>
                    <td><StatusBadge status={ins.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Violations */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Violations</h3>
        </div>
        {firmViolations.length === 0 ? (
          <p className="empty-state">No violations on record.</p>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr><th>ID</th><th>Category</th><th>Severity</th><th>Deadline</th><th>Fine (KES)</th><th>Status</th></tr>
              </thead>
              <tbody>
                {firmViolations.map((v) => (
                  <tr key={v.id} onClick={() => navigate(`/violations/${v.id}`)} className="table-row--clickable">
                    <td className="text-mono">{v.id}</td>
                    <td>{v.category}</td>
                    <td><StatusBadge status={v.severity} /></td>
                    <td>{v.deadline}</td>
                    <td>{v.fine.toLocaleString()}</td>
                    <td><StatusBadge status={v.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
