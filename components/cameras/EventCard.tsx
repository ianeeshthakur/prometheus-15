// One row in a camera's live event log -- docs/frontend.md §3.2.
import type { CameraEvent } from "@/lib/types";
import { IconAlert, IconPlate, IconUser, IconVehicle } from "../shared/icons";
import type { ComponentType, SVGProps } from "react";

const TYPE_ICON: Record<CameraEvent["type"], ComponentType<SVGProps<SVGSVGElement>>> = {
  VEHICLE: IconVehicle,
  PERSON: IconUser,
  PLATE: IconPlate,
  ANOMALY: IconAlert,
};

function relativeTime(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

export function EventCard({ event }: { event: CameraEvent }) {
  const Icon = TYPE_ICON[event.type];
  const unreadable = event.label.includes("UNREADABLE");

  return (
    <li
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "8px 0",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <Icon width={16} height={16} style={{ marginTop: 2, color: "var(--text-secondary)", flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className={unreadable ? undefined : "mono"} style={{ fontSize: "var(--text-body)" }}>
          {event.label}
        </div>
        <div style={{ fontSize: "var(--text-caption)", color: "var(--text-secondary)" }}>
          {Math.round(event.confidence * 100)}% confidence · {relativeTime(event.timestamp)}
        </div>
      </div>
    </li>
  );
}
