import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export default function AdminPage() {
  return (
    <PagePlaceholder
      title="Administration"
      purpose="Admin-only configuration and oversight — merges access control, audit, camera onboarding, and AI/dataset management."
      comingUp={[
        "Users & roles — RBAC table (name, role, district scope, last login)",
        "Audit log — append-only, filterable, who/what/when",
        "Camera onboarding — manual, bulk CSV/JSON, and /api/ingest catalogue-driven registration",
        "AI & datasets — active profile per camera, model version, and a visible DPDP-aware privacy toggle",
      ]}
    />
  );
}
