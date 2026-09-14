// Row 2 right column: live alert feed, newest first, capped at 10 -- docs/frontend.md §3.1.
import Link from "next/link";
import type { Alert, AlertSeverity } from "@/lib/types";
import { Badge, type Tone } from "../shared/Badge";
import { IconAlert } from "../shared/icons";

const SEVERITY_TONE: Record<AlertSeverity, Tone> = {
  CRITICAL: "critical",
  HIGH: "warning",
  MEDIUM: "warning",
  LOW: "info",
  INFO: "neutral",
};

function relativeTime(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

export function AlertFeed({ alerts }: { alerts: Alert[] }) {
  const active = [...alerts]
    .filter((a) => a.status !== "RESOLVED")
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10);

  if (active.length === 0) {
    return (
      <div style={{ color: "var(--text-secondary)", textAlign: "center", padding: "32px 0" }}>
        No active alerts.
      </div>
    );
  }

  return (
    <div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {active.map((a) => (
          <li
            key={a.id}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              padding: "10px 0",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Badge tone={SEVERITY_TONE[a.severity]} icon={<IconAlert width={12} height={12} />} pulse={a.severity === "CRITICAL"}>
                {a.severity}
              </Badge>
              <span style={{ fontSize: "var(--text-caption)", color: "var(--text-secondary)" }}>
                {a.type.replace("_", " ")}
              </span>
            </div>
            <div style={{ fontSize: "var(--text-body)" }}>{a.description}</div>
            <div style={{ fontSize: "var(--text-caption)", color: "var(--text-secondary)", display: "flex", justifyContent: "space-between" }}>
              <span>
                {a.cameraName} · {a.district} · {relativeTime(a.timestamp)}
              </span>
              <Link href={`/alerts?id=${a.id}`}>View</Link>
            </div>
          </li>
        ))}
      </ul>
      <div style={{ textAlign: "right", marginTop: 8 }}>
        <Link href="/alerts">View all alerts →</Link>
      </div>
    </div>
  );
}
