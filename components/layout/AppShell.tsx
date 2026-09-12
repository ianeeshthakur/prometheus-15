"use client";

// Composes the shared shell present on all 8 pages -- docs/frontend.md §3.0.
import { useEffect } from "react";
import type { ReactNode } from "react";
import { useUiStore } from "@/store/uiStore";
import { AccessibilityBar } from "./AccessibilityBar";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { FooterStatusStrip } from "./FooterStatusStrip";

export function AppShell({ children }: { children: ReactNode }) {
  const { fontStep, highContrast, colorScheme } = useUiStore();

  useEffect(() => {
    document.body.dataset.fontStep = String(fontStep);
  }, [fontStep]);

  useEffect(() => {
    if (highContrast) {
      document.documentElement.dataset.contrast = "high";
    } else {
      delete document.documentElement.dataset.contrast;
    }
  }, [highContrast]);

  useEffect(() => {
    document.documentElement.dataset.theme = colorScheme;
  }, [colorScheme]);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <AccessibilityBar />
      <TopBar />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <Sidebar />
        <main id="main-content" style={{ flex: 1, minWidth: 0, padding: 24, background: "var(--bg-primary)" }}>
          {children}
        </main>
      </div>
      <FooterStatusStrip />
    </div>
  );
}
