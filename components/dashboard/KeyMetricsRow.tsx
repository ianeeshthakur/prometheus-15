// Row 1: four concrete metric cards -- docs/frontend.md §3.1.
import Link from "next/link";
import type { DashboardMetrics } from "@/lib/types";
import { Card } from "../shared/Card";

interface MetricCardDef {
  label: string;
  value: string;
  href: string;
  trend?: string;
}

export function KeyMetricsRow({ metrics }: { metrics: DashboardMetrics }) {
  const activeAlerts =
    metrics.activeAlertsBySeverity.CRITICAL +
    metrics.activeAlertsBySeverity.HIGH +
    metrics.activeAlertsBySeverity.MEDIUM +
    metrics.activeAlertsBySeverity.LOW +
    metrics.activeAlertsBySeverity.INFO;

  const cards: MetricCardDef[] = [
    {
      label: "Cameras Online / Total",
      value: `${metrics.camerasOnline} / ${metrics.camerasTotal}`,
      href: "/cameras",
    },
    {
      label: "Active Alerts",
      value: String(activeAlerts),
      href: "/alerts",
      trend: `${metrics.activeAlertsBySeverity.CRITICAL} critical`,
    },
    {
      label: "AI Events (last hour)",
      value: String(metrics.aiEventsLastHour),
      href: "/analytics",
    },
    {
      label: "Open Investigations",
      value: String(metrics.openInvestigations),
      href: "/investigations",
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: 16,
      }}
    >
      {cards.map((c) => (
        <Card key={c.label} elevated>
          <Link href={c.href} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
            <div style={{ fontSize: "var(--text-caption)", color: "var(--text-secondary)" }}>{c.label}</div>
            <div className="mono" style={{ fontSize: "var(--text-metric)", fontWeight: 700, margin: "4px 0" }}>
              {c.value}
            </div>
            {c.trend && (
              <div style={{ fontSize: "var(--text-caption)", color: "var(--status-critical)" }}>{c.trend}</div>
            )}
          </Link>
        </Card>
      ))}
    </div>
  );
}
