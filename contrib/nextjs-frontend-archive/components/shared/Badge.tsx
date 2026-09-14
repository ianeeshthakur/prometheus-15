// Icon + label + tint background, never a color-only fill. Spec: docs/frontend.md §1.
import type { ReactNode } from "react";

export type Tone = "critical" | "warning" | "online" | "info" | "neutral";

const TONE_VARS: Record<Tone, string> = {
  critical: "var(--status-critical)",
  warning: "var(--status-warning)",
  online: "var(--status-online)",
  info: "var(--status-info)",
  neutral: "var(--text-secondary)",
};

interface BadgeProps {
  tone: Tone;
  icon: ReactNode;
  children: ReactNode;
  pulse?: boolean; // reserved for CRITICAL severity only -- docs/frontend.md §3.3
}

export function Badge({ tone, icon, children, pulse = false }: BadgeProps) {
  const color = TONE_VARS[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "2px 8px",
        borderRadius: "var(--radius-badge)",
        border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        color,
        fontSize: "var(--text-caption)",
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
      className={pulse ? "badge-pulse" : undefined}
    >
      <span aria-hidden="true" style={{ display: "inline-flex", lineHeight: 0 }}>
        {icon}
      </span>
      {children}
    </span>
  );
}
