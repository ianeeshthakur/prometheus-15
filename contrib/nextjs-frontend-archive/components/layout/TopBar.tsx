"use client";

// Header, below the accessibility bar -- docs/frontend.md §3.0.
import { useUiStore } from "@/store/uiStore";
import { IconBell, IconMenu, IconMoon, IconSearch, IconSun, IconUser } from "../shared/icons";
import { useAlertStore } from "@/store/alertStore";

export function TopBar() {
  const { toggleSidebar, colorScheme, toggleColorScheme } = useUiStore();
  const unread = useAlertStore((s) => s.alerts.filter((a) => a.status === "NEW").length);

  return (
    <header
      style={{
        height: "var(--header-height)",
        background: "var(--bg-header)",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        gap: 16,
      }}
    >
      <button
        type="button"
        onClick={toggleSidebar}
        aria-label="Toggle navigation"
        style={{ background: "none", border: "none", color: "var(--text-primary)", padding: 4 }}
      >
        <IconMenu />
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <div
          aria-hidden="true"
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "var(--primary)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          GJ
        </div>
        <div style={{ lineHeight: 1.2, whiteSpace: "nowrap" }}>
          <div style={{ fontWeight: 700, fontSize: "var(--text-body)" }}>G-VISTA</div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Gujarat Police &amp; Allied Departments</div>
        </div>
      </div>

      <div style={{ flex: 1, maxWidth: 480, marginLeft: 16 }}>
        <label style={{ position: "relative", display: "block" }}>
          <span style={{ position: "absolute", left: -9999 }}>Search cameras, plates, case IDs, watchlist entries</span>
          <IconSearch
            width={16}
            height={16}
            style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" }}
          />
          <input
            type="text"
            role="searchbox"
            placeholder="Search cameras, plates, case IDs, watchlist entries..."
            style={{
              width: "100%",
              padding: "8px 10px 8px 32px",
              borderRadius: "var(--radius-button)",
              border: "1px solid var(--border)",
              background: "var(--bg-primary)",
              color: "var(--text-primary)",
              fontSize: "var(--text-body)",
            }}
          />
        </label>
      </div>

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
        <button
          type="button"
          aria-label={`Notifications, ${unread} unread`}
          style={{ position: "relative", background: "none", border: "none", color: "var(--text-primary)", padding: 4 }}
        >
          <IconBell />
          {unread > 0 && (
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                top: -2,
                right: -2,
                background: "var(--status-critical)",
                color: "#fff",
                fontSize: 10,
                fontWeight: 700,
                borderRadius: 999,
                minWidth: 15,
                height: 15,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 3px",
              }}
            >
              {unread}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={toggleColorScheme}
          aria-label={colorScheme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          style={{ background: "none", border: "none", color: "var(--text-primary)", padding: 4 }}
        >
          {colorScheme === "light" ? <IconMoon /> : <IconSun />}
        </button>

        <button
          type="button"
          aria-label="User profile menu"
          style={{ background: "none", border: "none", color: "var(--text-primary)", padding: 4 }}
        >
          <IconUser />
        </button>
      </div>
    </header>
  );
}
