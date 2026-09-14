"use client";

// Left nav, collapsible to icon-only -- docs/frontend.md §3.0. Exactly 8 pages, grouped.
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";
import { useUiStore } from "@/store/uiStore";
import {
  IconAdmin,
  IconAlert,
  IconAnalytics,
  IconCamera,
  IconDashboard,
  IconInvestigation,
  IconSystem,
  IconWatchlist,
} from "../shared/icons";

interface NavItem {
  href: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const GROUPS: NavGroup[] = [
  {
    label: "Monitor",
    items: [
      { href: "/", label: "Dashboard", Icon: IconDashboard },
      { href: "/cameras", label: "Live Cameras", Icon: IconCamera },
      { href: "/alerts", label: "Alerts", Icon: IconAlert },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { href: "/watchlists", label: "Watchlists", Icon: IconWatchlist },
      { href: "/investigations", label: "Investigations", Icon: IconInvestigation },
      { href: "/analytics", label: "Analytics & Reports", Icon: IconAnalytics },
    ],
  },
  {
    label: "Platform",
    items: [
      { href: "/system", label: "System & Network", Icon: IconSystem },
      { href: "/admin", label: "Administration", Icon: IconAdmin },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);

  return (
    <nav
      aria-label="Primary"
      style={{
        width: collapsed ? "var(--nav-width-collapsed)" : "var(--nav-width-expanded)",
        flexShrink: 0,
        background: "var(--bg-header)",
        borderRight: "1px solid var(--border)",
        padding: "12px 8px",
        transition: "width 150ms ease",
        overflowY: "auto",
      }}
    >
      {GROUPS.map((group) => (
        <div key={group.label} style={{ marginBottom: 16 }}>
          {!collapsed && (
            <div
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                color: "var(--text-secondary)",
                padding: "4px 8px",
              }}
            >
              {group.label}
            </div>
          )}
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {group.items.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    title={collapsed ? item.label : undefined}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 8px",
                      borderRadius: "var(--radius-button)",
                      color: active ? "#fff" : "var(--text-primary)",
                      background: active ? "var(--primary)" : "transparent",
                      textDecoration: "none",
                      fontSize: "var(--text-body)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                    }}
                  >
                    <item.Icon width={18} height={18} />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
