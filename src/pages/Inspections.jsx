import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import StatusBadge from "../components/StatusBadge";
import { Search, Plus } from "lucide-react";

export default function Inspections() {
  const { inspections, firms } = useApp();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const getFirmName = (id) => firms.find((f) => f.id === id)?.name ?? id;

  const filtered = inspections.filter((ins) => {
    const name = getFirmName(ins.firmId).toLowerCase();
    const matchSearch = name.includes(search.toLowerCase()) || ins.type.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || ins.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const sorted = [...filtered].sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Inspections</h1>
          <p className="page-subtitle">{inspections.length} total inspections</p>
        </div>
        <button className="btn btn--primary" onClick={() => navigate("/inspections/new")}>
          <Plus size={16} /> New Inspection
        </button>
      </div>

      <div className="filter-bar">
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search by firm or type…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="select">
          <option value="all">All Statuses</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="enforcement">Enforcement</option>
        </select>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Firm</th>
                <th>Date</th>
                <th>Type</th>
                <th>Score</th>
                <th>Violations</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((ins) => (
                <tr
                  key={ins.id}
                  onClick={() => navigate(`/inspections/${ins.id}`)}
                  className="table-row--clickable"
                >
                  <td className="text-mono">{ins.id}</td>
                  <td>{getFirmName(ins.firmId)}</td>
                  <td>{ins.date}</td>
                  <td>{ins.type}</td>
                  <td>
                    <span
                      className="score-pill"
                      style={{
                        background: ins.score >= 75 ? "#dcfce7" : ins.score >= 50 ? "#fef9c3" : "#fee2e2",
                        color: ins.score >= 75 ? "#16a34a" : ins.score >= 50 ? "#a16207" : "#dc2626",
                      }}
                    >
                      {ins.score}
                    </span>
                  </td>
                  <td>{ins.violations.length > 0 ? <span className="badge badge--red">{ins.violations.length}</span> : "—"}</td>
                  <td><StatusBadge status={ins.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
