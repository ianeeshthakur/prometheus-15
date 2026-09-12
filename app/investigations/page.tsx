import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export default function InvestigationsPage() {
  return (
    <PagePlaceholder
      title="Investigations"
      purpose="Case management and entity search in one place — investigating is searching. This page's search → timeline → map flow is the hackathon's graded live vehicle-tracking test (docs/prd.md §0.1)."
      comingUp={[
        "Entity-search box (plate / person description / case ID) that opens or starts a case",
        "Case table: ID, title, entity, status, priority, assigned officer, last updated",
        "Detail page (/investigations/[id]) with Timeline / Evidence / Related entities / Map trace tabs",
        "Map trace must work end-to-end against the real ingest API, not only mock data",
      ]}
    />
  );
}
