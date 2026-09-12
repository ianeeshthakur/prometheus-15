import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export default function AnalyticsPage() {
  return (
    <PagePlaceholder
      title="Analytics & Reports"
      purpose="District-command-level reporting for the ACP/DSP persona — a weekly/monthly cadence, not real-time triage."
      comingUp={[
        "Date-range selector + charts: event volume, detections by category, district comparison, watchlist-match trend",
        "Every chart paired with an accessible data table",
        "Export (CSV/PDF) for offline reporting",
        "Automated report generation for the hackathon's graded live-feed demo (detected vehicles/plates with timestamps)",
      ]}
    />
  );
}
