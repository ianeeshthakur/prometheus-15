import { PagePlaceholder } from "@/components/shared/PagePlaceholder";

export default function WatchlistsPage() {
  return (
    <PagePlaceholder
      title="Watchlists"
      purpose="Manage the lists the alert engine matches against."
      comingUp={[
        "Tabs: Stolen Vehicles / Wanted & Missing Persons / Custom",
        "Table: identifier, description, risk level, source, added-by, match count, active toggle",
        "Add entry form + bulk CSV import",
        "Match-count click jumps to filtered alert history for that entry",
      ]}
    />
  );
}
