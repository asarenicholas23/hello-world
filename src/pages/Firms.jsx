import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import StatusBadge from "../components/StatusBadge";
import ScoreGauge from "../components/ScoreGauge";
import { Search, SlidersHorizontal, MapPin, Phone } from "lucide-react";

export default function Firms() {
  const { firms } = useApp();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const filtered = firms.filter((f) => {
    const matchSearch =
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.location.toLowerCase().includes(search.toLowerCase()) ||
      f.industry.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || f.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Regulated Firms</h1>
        <p className="page-subtitle">{firms.length} firms under supervision</p>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search by name, location or industry…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="filter-group">
          <SlidersHorizontal size={16} />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="select"
          >
            <option value="all">All Statuses</option>
            <option value="compliant">Compliant</option>
            <option value="at-risk">At Risk</option>
            <option value="non-compliant">Non-Compliant</option>
          </select>
        </div>
      </div>

      {/* Firm cards */}
      <div className="firms-grid">
        {filtered.map((firm) => (
          <div
            key={firm.id}
            className="firm-card"
            onClick={() => navigate(`/firms/${firm.id}`)}
          >
            <div className="firm-card__header">
              <div className="firm-card__info">
                <h3 className="firm-card__name">{firm.name}</h3>
                <span className="firm-card__industry">{firm.industry}</span>
              </div>
              <ScoreGauge score={firm.complianceScore} />
            </div>
            <div className="firm-card__meta">
              <span><MapPin size={13} /> {firm.location}</span>
              <span><Phone size={13} /> {firm.phone}</span>
            </div>
            <div className="firm-card__footer">
              <StatusBadge status={firm.status} />
              <span className="firm-card__date">Last: {firm.lastInspected}</span>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="empty-state">No firms match your search.</p>
        )}
      </div>
    </div>
  );
}
