import { useParams, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import StatusBadge from "../components/StatusBadge";
import { ArrowLeft, Building2, BookOpen, Calendar, DollarSign } from "lucide-react";

export default function ViolationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { violations, firms, updateViolationStatus } = useApp();

  const violation = violations.find((v) => v.id === id);
  if (!violation) return <div className="page"><p>Violation not found.</p></div>;

  const firm = firms.find((f) => f.id === violation.firmId);

  return (
    <div className="page">
      <button className="btn btn--ghost btn--back" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> Back
      </button>

      <div className="detail-header">
        <div>
          <h1 className="page-title">Violation {violation.id}</h1>
          <p className="text-muted">{violation.category}</p>
          <div className="detail-badges">
            <StatusBadge status={violation.severity} />
            <StatusBadge status={violation.status} />
          </div>
        </div>
        <div className="fine-box">
          <span className="fine-box__label">Fine Issued</span>
          <span className="fine-box__amount">KES {violation.fine.toLocaleString()}</span>
        </div>
      </div>

      <div className="detail-grid">
        <div className="card">
          <h3 className="card-title">Details</h3>
          <div className="info-list">
            <div className="info-item"><Building2 size={15} />
              <button className="link-btn" onClick={() => navigate(`/firms/${firm?.id}`)}>{firm?.name}</button>
            </div>
            <div className="info-item"><BookOpen size={15} /><span>{violation.regulation}</span></div>
            <div className="info-item"><Calendar size={15} /><span>Issued: {violation.issuedDate}</span></div>
            <div className="info-item"><Calendar size={15} /><span>Deadline: {violation.deadline}</span></div>
            <div className="info-item"><DollarSign size={15} /><span>Fine: KES {violation.fine.toLocaleString()}</span></div>
          </div>
        </div>
        <div className="card">
          <h3 className="card-title">Description</h3>
          <p className="findings-text">{violation.description}</p>
        </div>
      </div>

      {/* Status update */}
      {violation.status !== "resolved" && (
        <div className="card">
          <h3 className="card-title">Update Status</h3>
          <div className="action-buttons">
            <button
              className="btn btn--yellow"
              onClick={() => updateViolationStatus(id, "pending")}
              disabled={violation.status === "pending"}
            >
              Mark Pending
            </button>
            <button
              className="btn btn--primary"
              onClick={() => updateViolationStatus(id, "resolved")}
            >
              Mark Resolved
            </button>
          </div>
        </div>
      )}
      {violation.status === "resolved" && (
        <div className="card card--success">
          <p>This violation has been resolved.</p>
        </div>
      )}
    </div>
  );
}
