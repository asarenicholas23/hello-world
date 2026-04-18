import { useApp } from "../context/AppContext";
import { firms as allFirms, officers } from "../data/mockData";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

export default function Reports() {
  const { firms, inspections, violations } = useApp();

  const totalFines = violations.reduce((s, v) => s + v.fine, 0);
  const resolvedViolations = violations.filter((v) => v.status === "resolved").length;
  const overdueViolations = violations.filter((v) => v.status === "overdue").length;
  const avgScore = Math.round(firms.reduce((s, f) => s + f.complianceScore, 0) / firms.length);

  // Scores per firm
  const firmScores = firms.map((f) => ({ name: f.name.split(" ").slice(0, 2).join(" "), score: f.complianceScore }));

  // Inspections per officer
  const officerInspections = officers.map((o) => ({
    name: o.name.split(" ")[0],
    count: inspections.filter((i) => i.officer === o.id).length,
  }));

  // Fines per firm
  const firmFines = firms
    .map((f) => ({
      name: f.name.split(" ").slice(0, 2).join(" "),
      fine: violations.filter((v) => v.firmId === f.id).reduce((s, v) => s + v.fine, 0),
    }))
    .filter((f) => f.fine > 0);

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Compliance Reports</h1>
        <p className="page-subtitle">Summary for April 2026</p>
      </div>

      {/* Summary KPIs */}
      <div className="kpi-grid">
        <div className="kpi-card kpi-card--blue">
          <div className="kpi-body">
            <span className="kpi-value">{avgScore}</span>
            <span className="kpi-label">Avg Compliance Score</span>
          </div>
        </div>
        <div className="kpi-card kpi-card--green">
          <div className="kpi-body">
            <span className="kpi-value">{inspections.length}</span>
            <span className="kpi-label">Total Inspections</span>
          </div>
        </div>
        <div className="kpi-card kpi-card--red">
          <div className="kpi-body">
            <span className="kpi-value">{overdueViolations}</span>
            <span className="kpi-label">Overdue Violations</span>
          </div>
        </div>
        <div className="kpi-card kpi-card--orange">
          <div className="kpi-body">
            <span className="kpi-value">KES {(totalFines / 1000000).toFixed(1)}M</span>
            <span className="kpi-label">Total Fines Issued</span>
          </div>
        </div>
      </div>

      <div className="charts-grid">
        {/* Firm compliance scores */}
        <div className="chart-card">
          <h3 className="chart-title">Firm Compliance Scores</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={firmScores} layout="vertical" barSize={14}>
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [`${v}/100`, "Score"]} />
              <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                {firmScores.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.score >= 75 ? "#22c55e" : entry.score >= 50 ? "#f59e0b" : "#ef4444"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Inspections per officer */}
        <div className="chart-card">
          <h3 className="chart-title">Inspections per Officer</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={officerInspections} barSize={28}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" name="Inspections" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Fines by firm */}
      <div className="chart-card">
        <h3 className="chart-title">Fines Issued by Firm (KES)</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={firmFines} barSize={32}>
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v) => [`KES ${v.toLocaleString()}`, "Fine"]} />
            <Bar dataKey="fine" name="Fine" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Firms table */}
      <div className="card">
        <h3 className="card-title" style={{ marginBottom: "1rem" }}>Firm Compliance Summary</h3>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Firm</th>
                <th>Industry</th>
                <th>Score</th>
                <th>Status</th>
                <th>Violations</th>
                <th>Total Fines (KES)</th>
                <th>Last Inspected</th>
              </tr>
            </thead>
            <tbody>
              {firms.map((f) => {
                const fv = violations.filter((v) => v.firmId === f.id);
                const fine = fv.reduce((s, v) => s + v.fine, 0);
                return (
                  <tr key={f.id}>
                    <td>{f.name}</td>
                    <td>{f.industry}</td>
                    <td>
                      <span className="score-pill" style={{ background: f.complianceScore >= 75 ? "#dcfce7" : f.complianceScore >= 50 ? "#fef9c3" : "#fee2e2", color: f.complianceScore >= 75 ? "#16a34a" : f.complianceScore >= 50 ? "#a16207" : "#dc2626" }}>
                        {f.complianceScore}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${f.status === "compliant" ? "badge--green" : f.status === "at-risk" ? "badge--yellow" : "badge--red"}`}>
                        {f.status}
                      </span>
                    </td>
                    <td>{fv.length}</td>
                    <td>{fine > 0 ? fine.toLocaleString() : "—"}</td>
                    <td>{f.lastInspected}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
