// Flat surface card -- no glow, no glassmorphism blur (docs/frontend.md §1 "do not" list).
// Replaces the old GlassPanel.tsx name, a leftover from the rejected dark/cyberpunk direction.
import type { CSSProperties, ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  title?: ReactNode;
  action?: ReactNode;
  elevated?: boolean;
  style?: CSSProperties;
}

export function Card({ children, title, action, elevated = false, style }: CardProps) {
  return (
    <section
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-card)",
        boxShadow: elevated ? "var(--shadow-card)" : "none",
        padding: 16,
        ...style,
      }}
    >
      {(title || action) && (
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          {title && (
            <h2 style={{ fontSize: "var(--text-section)", fontWeight: 600 }}>{title}</h2>
          )}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
