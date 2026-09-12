// Adapter health: protocol, last heartbeat, FPS, restart count -- docs/frontend.md §3.2.
import type { Camera } from "@/lib/types";

function relativeTime(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

export function StreamHealthBadge({ camera, compact = false }: { camera: Camera; compact?: boolean }) {
  const items = [
    { label: "Protocol", value: camera.protocol },
    { label: "Last heartbeat", value: relativeTime(camera.lastHeartbeat) },
    { label: "FPS", value: String(camera.fps) },
    { label: "Restarts", value: String(camera.restartCount) },
  ];

  return (
    <dl
      className="mono"
      style={{
        display: "grid",
        gridTemplateColumns: compact ? "repeat(4, auto)" : "repeat(auto-fit, minmax(110px, 1fr))",
        gap: compact ? 12 : 12,
        fontSize: "var(--text-caption)",
        margin: 0,
      }}
    >
      {items.map((item) => (
        <div key={item.label}>
          <dt style={{ color: "var(--text-secondary)", fontFamily: "var(--font-ui)" }}>{item.label}</dt>
          <dd style={{ margin: 0, fontWeight: 600 }}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
