import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export default function SystemPage() {
  return (
    <PagePlaceholder
      title="System & Network"
      purpose="Is the platform working? Merges camera network and system health for the admin persona — and hosts the mandatory Model 1 registry (docs/prd.md §0.1)."
      comingUp={[
        "Camera fleet — the Model 1 registry: department/protocol/district filters, role-based search",
        "Gap-analysis report — full coverage table/heatmap by district × department",
        "Pipeline health — Video Ingestion / AI Orchestrator / Alert Engine / Database status cards",
        "Integration log — recent connector errors, newest first",
      ]}
    />
  );
}
