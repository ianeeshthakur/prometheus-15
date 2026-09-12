// Dashboard (`/`) -- docs/frontend.md §3.1. One-glance operational picture for a
// control-room operator starting their shift.
import { MOCK_CAMERAS, MOCK_ALERTS, getDashboardMetrics, getDistrictSummaries, getGapAnalysis } from "@/lib/mock-data";
import { Card } from "@/components/shared/Card";
import { KeyMetricsRow } from "@/components/dashboard/KeyMetricsRow";
import { AlertFeed } from "@/components/dashboard/AlertFeed";
import { DistrictHealthTable } from "@/components/dashboard/DistrictHealthTable";
import { GapAnalysisPanel } from "@/components/dashboard/GapAnalysisPanel";
import { GujaratMap } from "@/components/map/GujaratMap";

export default function DashboardPage() {
  const metrics = getDashboardMetrics();
  const districts = getDistrictSummaries();
  const gaps = getGapAnalysis();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: "var(--text-title)", fontWeight: 700 }}>Dashboard</h1>
        <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>
          Statewide operational picture across every onboarded department and district.
        </p>
      </div>

      <KeyMetricsRow metrics={metrics} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 7fr) minmax(280px, 3fr)",
          gap: 20,
        }}
      >
        <Card title="Camera network — Gujarat" elevated>
          <GujaratMap cameras={MOCK_CAMERAS} />
        </Card>
        <Card title="Live alerts" elevated>
          <AlertFeed alerts={MOCK_ALERTS} />
        </Card>
      </div>

      <Card title="District health summary" elevated>
        <DistrictHealthTable districts={districts} />
      </Card>

      <Card title="Coverage gap analysis" elevated>
        <GapAnalysisPanel rows={gaps} />
      </Card>
    </div>
  );
}
