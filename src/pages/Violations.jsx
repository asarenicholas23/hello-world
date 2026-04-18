import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import StatusBadge from "../components/StatusBadge";
import { Search } from "lucide-react";

export default function Violations() {
  const { violations, firms } = useApp();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const getFirmName = (id) => firms.find((f) => f.id === id)?.name ?? id;

  const filtered = violations.filter((v) => {
    const name = getFirmName(v.firmId).toLowerCase();
    const matchSearch = name.includes(search.toLowerCase()) || v.category.toLowerCase().includes(search.toLowerCase());
    const matchSev = filterSeverity === "all" || v.severity === filterSeverity;
    const matchStat = filterStatus === "all" || v.status === filterStatus;
    return matchSearch && matchSev && matchStat;
  });

  const totalFines = filtered.reduce((sum, v) => sum + v.fine, 0);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Violations</h1>
          <p className="page-subtitle">{violations.length} total · KES {totalFines.toLocaleString()} in fines</p>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search firm or category…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
        </div>
        <select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)} className="select">
          <option value="all">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="select">
          <option value="all">All Statuses</option>
          <option value="overdue">Overdue</option>
          <option value="pending">Pending</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Firm</th>
                <th>Category</th>
                <th>Regulation</th>
                <th>Severity</th>
                <th>Deadline</th>
                <th>Fine (KES)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => (
                <tr
                  key={v.id}
                  onClick={() => navigate(`/violations/${v.id}`)}
                  className="table-row--clickable"
                >
                  <td className="text-mono">{v.id}</td>
                  <td className="td--truncate">{getFirmName(v.firmId)}</td>
                  <td>{v.category}</td>
                  <td className="td--small text-muted">{v.regulation.split("–")[0].trim()}</td>
                  <td><StatusBadge status={v.severity} /></td>
                  <td className={v.status === "overdue" ? "text-danger" : ""}>{v.deadline}</td>
                  <td>{v.fine.toLocaleString()}</td>
                  <td><StatusBadge status={v.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
