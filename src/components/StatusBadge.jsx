export default function StatusBadge({ status }) {
  const map = {
    compliant: { label: "Compliant", cls: "badge badge--green" },
    "at-risk": { label: "At Risk", cls: "badge badge--yellow" },
    "non-compliant": { label: "Non-Compliant", cls: "badge badge--red" },
    open: { label: "Open", cls: "badge badge--blue" },
    closed: { label: "Closed", cls: "badge badge--green" },
    enforcement: { label: "Enforcement", cls: "badge badge--red" },
    pending: { label: "Pending", cls: "badge badge--yellow" },
    overdue: { label: "Overdue", cls: "badge badge--red" },
    resolved: { label: "Resolved", cls: "badge badge--green" },
    critical: { label: "Critical", cls: "badge badge--red" },
    high: { label: "High", cls: "badge badge--orange" },
    medium: { label: "Medium", cls: "badge badge--yellow" },
    low: { label: "Low", cls: "badge badge--blue" },
  };
  const { label, cls } = map[status] ?? { label: status, cls: "badge badge--gray" };
  return <span className={cls}>{label}</span>;
}
