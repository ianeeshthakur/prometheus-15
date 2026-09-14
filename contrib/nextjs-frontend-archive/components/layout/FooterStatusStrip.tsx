// Persistent, thin, bottom of viewport -- docs/frontend.md §3.0. Must always show DEMO/LIVE
// so nobody mistakes simulated data for real (docs/prd.md §0.1 -- graded, not cosmetic).
import { getAppMode } from "@/lib/mode";
import { StatusDot } from "../shared/StatusDot";

// No backend is wired up yet (docs/backend.md is still pre-implementation) -- say so
// honestly rather than claiming "Live" for a connection that doesn't exist.
const BACKEND_CONNECTED = false;

export function FooterStatusStrip() {
  const mode = getAppMode();

  return (
    <footer
      style={{
        height: "var(--footer-height)",
        background: "var(--bg-header)",
        borderTop: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        fontSize: "var(--text-caption)",
        color: "var(--text-secondary)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <StatusDot status={BACKEND_CONNECTED ? "ONLINE" : "OFFLINE"} />
        <span>Backend: {BACKEND_CONNECTED ? "Live" : "Not connected (showing demo data)"}</span>
        <span>Last sync: n/a</span>
      </div>
      <span
        className="mono"
        style={{
          fontWeight: 700,
          padding: "1px 8px",
          borderRadius: "var(--radius-badge)",
          border: `1px solid ${mode === "DEMO" ? "var(--status-warning)" : "var(--status-online)"}`,
          color: mode === "DEMO" ? "var(--status-warning)" : "var(--status-online)",
        }}
      >
        {mode} MODE
      </span>
    </footer>
  );
}
