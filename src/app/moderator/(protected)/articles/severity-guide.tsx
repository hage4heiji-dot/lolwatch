import { SEVERITY_LABELS, SEVERITY_ICONS, SEVERITY_DESCRIPTIONS, SEVERITY_ORDER } from "@/lib/articleSeverity";

export function SeverityGuide() {
  return (
    <ul
      className="muted"
      style={{ marginTop: "-0.5rem", marginBottom: "1rem", fontSize: "0.8rem", paddingLeft: "1.1rem" }}
    >
      {SEVERITY_ORDER.map((severity) => (
        <li key={severity} style={{ marginTop: "0.2rem" }}>
          {SEVERITY_ICONS[severity]} {SEVERITY_LABELS[severity]}: {SEVERITY_DESCRIPTIONS[severity]}
        </li>
      ))}
    </ul>
  );
}
