// Row 3: district health summary table, sortable columns -- docs/frontend.md §3.1.
"use client";

import { useMemo, useState } from "react";
import type { DistrictSummary } from "@/lib/types";

type SortKey = keyof DistrictSummary;

function formatLastIncident(iso: string | null): string {
  if (!iso) return "None recorded";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return mins < 60 ? `${mins}m ago` : `${Math.round(mins / 60)}h ago`;
}

export function DistrictHealthTable({ districts }: { districts: DistrictSummary[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("activeAlerts");
  const [asc, setAsc] = useState(false);

  const sorted = useMemo(() => {
    const copy = [...districts];
    copy.sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      if (av < bv) return asc ? -1 : 1;
      if (av > bv) return asc ? 1 : -1;
      return 0;
    });
    return copy;
  }, [districts, sortKey, asc]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setAsc(!asc);
    else {
      setSortKey(key);
      setAsc(true);
    }
  }

  const columns: { key: SortKey; label: string }[] = [
    { key: "district", label: "District" },
    { key: "camerasOnline", label: "Cameras Online" },
    { key: "camerasTotal", label: "Cameras Total" },
    { key: "activeAlerts", label: "Active Alerts" },
    { key: "lastIncident", label: "Last Incident" },
  ];

  return (
    <table>
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col.key}>
              <button
                type="button"
                onClick={() => toggleSort(col.key)}
                style={{
                  background: "none",
                  border: "none",
                  color: "inherit",
                  font: "inherit",
                  textTransform: "inherit",
                  letterSpacing: "inherit",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: 0,
                }}
              >
                {col.label}
                {sortKey === col.key && <span aria-hidden="true">{asc ? "▲" : "▼"}</span>}
              </button>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sorted.map((d) => (
          <tr key={d.district}>
            <td>{d.district}</td>
            <td className="mono">{d.camerasOnline}</td>
            <td className="mono">{d.camerasTotal}</td>
            <td className="mono">{d.activeAlerts}</td>
            <td>{formatLastIncident(d.lastIncident)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
