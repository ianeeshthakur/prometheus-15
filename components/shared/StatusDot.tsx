// Status shown as [shape] + [label] -- shape differs per status, not just color,
// so colorblind users can distinguish states. Spec: docs/frontend.md §1.
import type { CameraStatus } from "@/lib/types";

const STATUS_META: Record<
  CameraStatus,
  { label: string; color: string; shape: "circle" | "triangle" | "slash" }
> = {
  ONLINE: { label: "Online", color: "var(--status-online)", shape: "circle" },
  DEGRADED: { label: "Degraded", color: "var(--status-warning)", shape: "triangle" },
  OFFLINE: { label: "Offline", color: "var(--status-info)", shape: "slash" },
};

function Shape({ shape, color }: { shape: "circle" | "triangle" | "slash"; color: string }) {
  if (shape === "circle") {
    return (
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
        <circle cx="5" cy="5" r="5" fill={color} />
      </svg>
    );
  }
  if (shape === "triangle") {
    return (
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
        <polygon points="5,0 10,10 0,10" fill={color} />
      </svg>
    );
  }
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <circle cx="5" cy="5" r="5" fill="none" stroke={color} strokeWidth="1.5" />
      <line x1="1" y1="9" x2="9" y2="1" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

export function StatusDot({ status }: { status: CameraStatus }) {
  const meta = STATUS_META[status];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "var(--text-caption)" }}>
      <Shape shape={meta.shape} color={meta.color} />
      <span style={{ color: "var(--text-primary)" }}>{meta.label}</span>
    </span>
  );
}
