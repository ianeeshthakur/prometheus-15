import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export default async function InvestigationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <PagePlaceholder
      title={`Investigation ${id}`}
      purpose="Case header (title, status, priority, assigned officer, dates) with four tabs: Timeline, Evidence, Related entities, Map trace."
      comingUp={[
        "Timeline — chronological events, key events visually distinguished from routine sightings",
        "Evidence — snapshots, clips, plate reads, event-log excerpts with confidence values",
        "Related entities — plain-language relationships (\"seen with\", \"matched against\")",
        "Map trace — plotted route across cameras/time, with the accessible view-as-list fallback",
      ]}
    />
  );
}
