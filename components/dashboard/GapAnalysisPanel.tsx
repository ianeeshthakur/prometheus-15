// Row 4: coverage gap-analysis summary -- the graded Model 1 "gap-analysis report"
// requirement (docs/prd.md §0.1, docs/frontend.md §3.1). Detailed report lives on
// System & Network -> Camera fleet (docs/frontend.md §3.7); this is the ranked summary.
import Link from "next/link";
import type { GapAnalysisRow } from "@/lib/types";
import { Badge } from "../shared/Badge";
import { IconAlert } from "../shared/icons";

export function GapAnalysisPanel({ rows }: { rows: GapAnalysisRow[] }) {
  const top = rows.slice(0, 5);

  if (top.length === 0) {
    return (
      <div style={{ color: "var(--text-secondary)" }}>
        No coverage gaps below the configured threshold.
      </div>
    );
  }

  return (
    <div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
        {top.map((row) => (
          <li
            key={`${row.district}-${row.department}`}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 10px",
              background: "var(--bg-primary)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-button)",
            }}
          >
            <span>
              <strong>{row.district}</strong> — {row.department.replace("_", " ")}
              <span style={{ color: "var(--text-secondary)" }}>
                {" "}
                ({row.cameraCount} of {row.expectedMinimum} expected)
              </span>
            </span>
            <Badge tone="warning" icon={<IconAlert width={12} height={12} />}>
              Shortfall {row.shortfall}
            </Badge>
          </li>
        ))}
      </ul>
      <div style={{ textAlign: "right", marginTop: 8 }}>
        <Link href="/system">View full gap-analysis report →</Link>
      </div>
    </div>
  );
}
