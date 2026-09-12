// Coherent placeholder for pages not yet built out -- keeps every route on-brand and
// navigable (7 C's: Complete/Coherent, docs/frontend.md §2) rather than blank or broken
// while docs/prd.md §13.1's baseline features land page by page.
import { Card } from "./Card";

interface PagePlaceholderProps {
  title: string;
  purpose: string;
  comingUp: string[];
}

export function PagePlaceholder({ title, purpose, comingUp }: PagePlaceholderProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: "var(--text-title)", fontWeight: 700 }}>{title}</h1>
        <p style={{ color: "var(--text-secondary)", marginTop: 4, maxWidth: 720 }}>{purpose}</p>
      </div>

      <Card title="Coming up on this page" elevated style={{ maxWidth: 720 }}>
        <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 8 }}>
          {comingUp.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p style={{ marginTop: 16, fontSize: "var(--text-caption)", color: "var(--text-secondary)" }}>
          Full spec: <code className="mono">docs/frontend.md</code>. Tracked in{" "}
          <code className="mono">docs/prd.md</code> §13.1.
        </p>
      </Card>
    </div>
  );
}
