import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { ArrowLeft, Save } from "lucide-react";

const CHECKLIST = [
  { key: "eia", label: "Valid EIA/EA Certificate on file" },
  { key: "wastewater", label: "Wastewater treatment system operational" },
  { key: "airEmissions", label: "Air emissions within permitted limits" },
  { key: "wasteDisposal", label: "Solid & hazardous waste properly disposed" },
  { key: "chemStorage", label: "Chemical storage labelled and segregated" },
  { key: "staffTraining", label: "Environmental staff training records current" },
  { key: "monitoring", label: "Self-monitoring reports submitted on time" },
  { key: "emergencyPlan", label: "Emergency spill/response plan in place" },
  { key: "noiseLevels", label: "Noise levels within zoning limits" },
  { key: "recordKeeping", label: "Environmental records complete and accessible" },
];

export default function NewInspection() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { firms, addInspection } = useApp();

  const preselectedFirm = params.get("firmId") ?? "";

  const [form, setForm] = useState({
    firmId: preselectedFirm,
    date: new Date().toISOString().split("T")[0],
    type: "Routine",
    officer: "OFF001",
    findings: "",
    checklist: Object.fromEntries(CHECKLIST.map((c) => [c.key, false])),
  });

  const [errors, setErrors] = useState({});

  function handleCheck(key) {
    setForm((f) => ({ ...f, checklist: { ...f.checklist, [key]: !f.checklist[key] } }));
  }

  const score = Math.round(
    (Object.values(form.checklist).filter(Boolean).length / CHECKLIST.length) * 100
  );

  function validate() {
    const e = {};
    if (!form.firmId) e.firmId = "Please select a firm.";
    if (!form.findings.trim()) e.findings = "Findings are required.";
    return e;
  }

  function handleSubmit(e) {
    e.preventDefault();
    const e2 = validate();
    if (Object.keys(e2).length) { setErrors(e2); return; }

    const status = score < 50 ? "enforcement" : score < 75 ? "open" : "closed";
    addInspection({ ...form, score, violations: [], status });
    navigate("/inspections");
  }

  const scoreColor = score >= 75 ? "#16a34a" : score >= 50 ? "#a16207" : "#dc2626";

  return (
    <div className="page">
      <button className="btn btn--ghost btn--back" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> Back
      </button>

      <div className="page-header">
        <h1 className="page-title">New Inspection</h1>
      </div>

      <form onSubmit={handleSubmit} className="form-card">
        {/* Basic Info */}
        <div className="form-section">
          <h3 className="form-section-title">Inspection Details</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Firm *</label>
              <select
                value={form.firmId}
                onChange={(e) => setForm((f) => ({ ...f, firmId: e.target.value }))}
                className={`select ${errors.firmId ? "input--error" : ""}`}
              >
                <option value="">— Select a firm —</option>
                {firms.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              {errors.firmId && <span className="error-msg">{errors.firmId}</span>}
            </div>
            <div className="form-group">
              <label>Date *</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="input"
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Inspection Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                className="select"
              >
                <option>Routine</option>
                <option>Follow-up</option>
                <option>Complaint-Driven</option>
                <option>Special</option>
              </select>
            </div>
            <div className="form-group">
              <label>Officer</label>
              <select
                value={form.officer}
                onChange={(e) => setForm((f) => ({ ...f, officer: e.target.value }))}
                className="select"
              >
                <option value="OFF001">Amina Odhiambo</option>
                <option value="OFF002">Brian Mutua</option>
                <option value="OFF003">Catherine Njeri</option>
              </select>
            </div>
          </div>
        </div>

        {/* Compliance Checklist */}
        <div className="form-section">
          <div className="checklist-header">
            <h3 className="form-section-title">Compliance Checklist</h3>
            <div className="score-live" style={{ color: scoreColor }}>
              Score: <strong>{score}/100</strong>
            </div>
          </div>
          <div className="checklist">
            {CHECKLIST.map(({ key, label }) => (
              <label key={key} className="checklist-item">
                <input
                  type="checkbox"
                  checked={form.checklist[key]}
                  onChange={() => handleCheck(key)}
                  className="checklist-checkbox"
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Findings */}
        <div className="form-section">
          <h3 className="form-section-title">Field Findings & Observations</h3>
          <div className="form-group">
            <label>Findings *</label>
            <textarea
              rows={5}
              value={form.findings}
              onChange={(e) => setForm((f) => ({ ...f, findings: e.target.value }))}
              placeholder="Describe observations, measurements, and evidence found during inspection…"
              className={`textarea ${errors.findings ? "input--error" : ""}`}
            />
            {errors.findings && <span className="error-msg">{errors.findings}</span>}
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn--ghost" onClick={() => navigate(-1)}>Cancel</button>
          <button type="submit" className="btn btn--primary">
            <Save size={16} /> Save Inspection
          </button>
        </div>
      </form>
    </div>
  );
}
