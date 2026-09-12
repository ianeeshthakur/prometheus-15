// Camera detail player -- docs/frontend.md §3.2. Targets WHEP first, HLS fallback, once a
// real backend exists (docs/backend.md §2). In DEMO mode there is no real stream to play,
// so this says so honestly instead of faking video -- the same mode-honesty rule that
// governs the footer status strip (docs/prd.md §0.1).
import type { Camera, CameraEvent } from "@/lib/types";
import { IconAlert, IconNoSignal, IconPlate, IconUser, IconVehicle } from "../shared/icons";
import type { ComponentType, SVGProps } from "react";

const OVERLAY_ICON: Record<CameraEvent["type"], ComponentType<SVGProps<SVGSVGElement>>> = {
  VEHICLE: IconVehicle,
  PERSON: IconUser,
  PLATE: IconPlate,
  ANOMALY: IconAlert,
};

// Fixed, illustrative positions -- there is no real video frame to derive real
// bounding boxes from in DEMO mode, so these are clearly labeled as illustrative.
const OVERLAY_SLOTS = [
  { top: "45%", left: "18%" },
  { top: "62%", left: "62%" },
  { top: "78%", left: "30%" },
];

function relativeTime(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

export function LiveCameraPlayer({ camera, latestEvents }: { camera: Camera; latestEvents: CameraEvent[] }) {
  if (camera.status === "OFFLINE") {
    return (
      <div style={frame}>
        <IconNoSignal width={36} height={36} style={{ color: "var(--text-secondary)" }} />
        <div style={{ fontWeight: 700, marginTop: 8 }}>No Signal</div>
        <div style={{ color: "var(--text-secondary)", fontSize: "var(--text-caption)" }}>
          Last heartbeat: {relativeTime(camera.lastHeartbeat)} ({new Date(camera.lastHeartbeat).toLocaleString()})
        </div>
      </div>
    );
  }

  const overlays = latestEvents.slice(0, OVERLAY_SLOTS.length);

  return (
    <div style={{ ...frame, alignItems: "stretch", justifyContent: "flex-start" }}>
      <div style={{ position: "relative", flex: 1, background: "var(--bg-header)" }}>
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            padding: "16px 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            color: "var(--text-secondary)",
            textAlign: "center",
          }}
        >
          <span style={{ fontWeight: 600 }}>Live preview not available in DEMO mode</span>
          <span style={{ fontSize: "var(--text-caption)" }}>
            WHEP stream will render here once the real ingest API is wired up (docs/backend.md §2)
          </span>
        </div>

        {overlays.map((ev, i) => {
          const Icon = OVERLAY_ICON[ev.type];
          const pos = OVERLAY_SLOTS[i];
          return (
            <div
              key={ev.id}
              title="Illustrative detection overlay -- no real video frame in DEMO mode"
              style={{
                position: "absolute",
                top: pos.top,
                left: pos.left,
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "2px 6px",
                borderRadius: 4,
                border: "1.5px dashed var(--primary)",
                background: "color-mix(in srgb, var(--primary) 10%, transparent)",
                color: "var(--primary)",
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              <Icon width={12} height={12} />
              {ev.type}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const frame = {
  minHeight: 320,
  borderRadius: "var(--radius-card)",
  border: "1px solid var(--border)",
  background: "var(--bg-surface)",
  display: "flex",
  flexDirection: "column" as const,
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center" as const,
  overflow: "hidden",
};
