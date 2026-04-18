import { useApp } from "../context/AppContext";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from "recharts";
import { complianceTrend, violationsByCategory, officers } from "../data/mockData";
import StatusBadge from "../components/StatusBadge";
import { Building2, ClipboardCheck, AlertTriangle, TrendingDown } from "lucide-react";

const PIE_COLORS = ["#3b82f6", "#ef4444", "#f59e0b", "#22c55e", "#8b5cf6"];

export default function Dashboard() {
  const { firms, inspections, violations } = useApp();
  const navigate = useNavigate();

  const compliantCount = firms.filter((f) => f.status === "compliant").length;
  const atRiskCount = firms.filter((f) => f.status === "at-risk").length;
  const nonCompliantCount = firms.filter((f) => f.status === "non-compliant").length;
  const overdueViolations = violations.filter((v) => v.status === "overdue").length;
  const openInspections = inspections.filter((i) => i.status === "open" || i.status === "enforcement").length;

  const recentInspections = [...inspections]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  const getOfficerName = (id) => officers.find((o) => o.id === id)?.name ?? id;
  const getFirmName = (id) => firms.find((f) => f.id === id)?.name ?? id;

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Environmental Compliance Overview — April 2026</p>
      </div>

      {/* KPI cards */}
      <div className="kpi-grid">
        <div className="kpi-card kpi-card--green" onClick={() => navigate("/firms")}>
          <div className="kpi-icon"><Building2 size={20} /></div>
          <div className="kpi-body">
            <span className="kpi-value">{compliantCount}</span>
            <span className="kpi-label">Compliant Firms</span>
          </div>
        </div>
        <div className="kpi-card kpi-card--yellow" onClick={() => navigate("/firms")}>
          <div className="kpi-icon"><TrendingDown size={20} /></div>
          <div className="kpi-body">
            <span className="kpi-value">{atRiskCount}</span>
            <span className="kpi-label">At-Risk Firms</span>
          </div>
        </div>
        <div className="kpi-card kpi-card--red" onClick={() => navigate("/firms")}>
          <div className="kpi-icon"><AlertTriangle size={20} /></div>
          <div className="kpi-body">
            <span className="kpi-value">{nonCompliantCount}</span>
            <span className="kpi-label">Non-Compliant</span>
          </div>
        </div>
        <div className="kpi-card kpi-card--blue" onClick={() => navigate("/inspections")}>
          <div className="kpi-icon"><ClipboardCheck size={20} /></div>
          <div className="kpi-body">
            <span className="kpi-value">{openInspections}</span>
            <span className="kpi-label">Open Inspections</span>
          </div>
        </div>
        <div className="kpi-card kpi-card--orange" onClick={() => navigate("/violations")}>
          <div className="kpi-icon"><AlertTriangle size={20} /></div>
          <div className="kpi-body">
            <span className="kpi-value">{overdueViolations}</span>
            <span className="kpi-label">Overdue Violations</span>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="charts-grid">
        <div className="chart-card">
          <h3 className="chart-title">Compliance Trend (6 Months)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={complianceTrend} barSize={10}>
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="compliant" name="Compliant" fill="#22c55e" radius={[4,4,0,0]} />
              <Bar dataKey="atRisk" name="At Risk" fill="#f59e0b" radius={[4,4,0,0]} />
              <Bar dataKey="nonCompliant" name="Non-Compliant" fill="#ef4444" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3 className="chart-title">Violations by Category</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={violationsByCategory}
                dataKey="count"
                nameKey="category"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ category, percent }) =>
                  `${category.split(" ")[0]} ${(percent * 100).toFixed(0)}%`
                }
                labelLine={false}
              >
                {violationsByCategory.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Inspections */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Recent Inspections</h3>
          <button className="btn btn--ghost" onClick={() => navigate("/inspections")}>View All</button>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Firm</th>
                <th>Date</th>
                <th>Type</th>
                <th>Officer</th>
                <th>Score</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentInspections.map((ins) => (
                <tr key={ins.id} onClick={() => navigate(`/inspections/${ins.id}`)} className="table-row--clickable">
                  <td className="text-mono">{ins.id}</td>
                  <td>{getFirmName(ins.firmId)}</td>
                  <td>{ins.date}</td>
                  <td>{ins.type}</td>
                  <td>{getOfficerName(ins.officer)}</td>
                  <td>
                    <span
                      className="score-pill"
                      style={{
                        background:
                          ins.score >= 75 ? "#dcfce7" : ins.score >= 50 ? "#fef9c3" : "#fee2e2",
                        color:
                          ins.score >= 75 ? "#16a34a" : ins.score >= 50 ? "#a16207" : "#dc2626",
                      }}
                    >
                      {ins.score}
                    </span>
                  </td>
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
