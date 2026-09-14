import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export default function AlertsPage() {
  return (
    <PagePlaceholder
      title="Alerts"
      purpose="The triage queue — the single place every alert, regardless of type, is worked from."
      comingUp={[
        "Sortable table: Severity | Type | Entity | Camera / District | Time | Status | Actions",
        "Filter bar: severity, status, district, date range, alert type",
        "Side panel on row click: evidence, related events, Acknowledge / Escalate / Open Investigation",
        "Only CRITICAL severity pulses — every other severity stays static",
      ]}
    />
  );
}
