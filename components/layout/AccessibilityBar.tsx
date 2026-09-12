"use client";

// Topmost strip, above the header -- docs/frontend.md §3.0. Font-size stepper, language
// switch, high-contrast toggle, skip-to-content link. Mirrors the pattern the hackathon's
// own portal (sentinel.gujarat.gov.in) ships, so this is not a guess at government norms.
import type { CSSProperties } from "react";
import { useUiStore, type Language } from "@/store/uiStore";
import { IconContrast, IconGlobe } from "../shared/icons";

const LANGUAGES: { code: Language; label: string }[] = [
  { code: "EN", label: "English" },
  { code: "HI", label: "हिंदी" },
  { code: "GU", label: "ગુજરાતી" },
];

export function AccessibilityBar() {
  const { fontStep, increaseFontStep, decreaseFontStep, language, setLanguage, highContrast, toggleHighContrast } =
    useUiStore();

  return (
    <div
      style={{
        height: "var(--a11y-bar-height)",
        background: "var(--bg-header)",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        fontSize: "var(--text-caption)",
        color: "var(--text-secondary)",
        gap: 16,
      }}
    >
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div role="group" aria-label="Text size" style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span>Text size:</span>
          <button
            type="button"
            onClick={decreaseFontStep}
            aria-label="Decrease text size"
            style={ctrlBtn}
          >
            A−
          </button>
          <button type="button" aria-label="Default text size" style={{ ...ctrlBtn, fontWeight: fontStep === 1 ? 700 : 400 }} onClick={() => {}}>
            A
          </button>
          <button
            type="button"
            onClick={increaseFontStep}
            aria-label="Increase text size"
            style={ctrlBtn}
          >
            A+
          </button>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <IconGlobe width={14} height={14} />
          <span className="sr-only" style={{ position: "absolute", left: -9999 }}>
            Language
          </span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            style={{
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: 4,
              color: "var(--text-secondary)",
              fontSize: "var(--text-caption)",
              padding: "1px 4px",
            }}
            aria-label="Select language"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={toggleHighContrast}
          aria-pressed={highContrast}
          style={{ ...ctrlBtn, display: "flex", alignItems: "center", gap: 4 }}
        >
          <IconContrast width={14} height={14} />
          High contrast
        </button>
      </div>

      <span aria-live="polite">Screen-reader mode: standard</span>
    </div>
  );
}

const ctrlBtn: CSSProperties = {
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: 4,
  color: "var(--text-secondary)",
  fontSize: "var(--text-caption)",
  padding: "1px 6px",
};
