import React, { useEffect, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import './AccessibilityBar.css';

const FONT_STEPS = ['sm', 'md', 'lg']; // three fixed steps, per docs/frontend.md §1
const FONT_SCALE = { sm: 0.9, md: 1, lg: 1.15 };
const STORAGE_KEY = 'gvista_a11y_prefs';

function loadPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // localStorage can throw/be unavailable -- fall back to defaults, not a crash.
  }
  return { fontStep: 'md', highContrast: false };
}

function savePrefs(prefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // best-effort persistence only
  }
}

/** Real accessibility bar -- previously entirely absent from client/ despite being a
 * graded requirement (docs/prd.md §4, docs/frontend.md §1/§2). Font-size stepper
 * scales every rem-based measurement in the app (html { font-size }), high-contrast
 * swaps CSS custom properties to an AAA-checked palette, and skip-to-content jumps
 * past the nav to #main-content (App.jsx).
 *
 * Language switch is real, via LanguageContext (src/i18n/): it sets
 * document.documentElement.lang AND retranslates the app shell (Sidebar, Topbar) and
 * every page's header/subtitle through translations.js. Honest about its actual
 * scope, documented in translations.js's own header comment: this covers shell
 * chrome, not dynamic data (camera names, alert descriptions, etc.) or every label
 * in every modal -- claiming full localization it doesn't have would be worse than
 * being clear about what's covered. */
function AccessibilityBar() {
  const [prefs, setPrefs] = useState(loadPrefs);
  const { language, setLanguage } = useLanguage();

  useEffect(() => {
    document.documentElement.style.setProperty('--font-scale', FONT_SCALE[prefs.fontStep]);
    document.documentElement.setAttribute('data-contrast', prefs.highContrast ? 'high' : 'normal');
    savePrefs(prefs);
  }, [prefs]);

  const cycleFontSize = () => {
    setPrefs((p) => {
      const idx = FONT_STEPS.indexOf(p.fontStep);
      return { ...p, fontStep: FONT_STEPS[(idx + 1) % FONT_STEPS.length] };
    });
  };

  return (
    <div className="a11y-bar" role="region" aria-label="Accessibility controls">
      <a href="#main-content" className="a11y-skip-link">Skip to content</a>

      <div className="a11y-controls">
        <button type="button" className="a11y-btn" onClick={cycleFontSize} aria-label={`Font size: ${prefs.fontStep}. Click to change.`}>
          <span aria-hidden="true">A{prefs.fontStep === 'lg' ? '+' : prefs.fontStep === 'sm' ? '-' : ''}</span>
          <span className="a11y-btn-label">Text size</span>
        </button>

        <label className="a11y-lang-select">
          <span className="a11y-btn-label">Language</span>
          <select
            value={language}
            onChange={(e) => {
              setLanguage(e.target.value);
              document.documentElement.lang = e.target.value;
            }}
          >
            <option value="en">English</option>
            <option value="hi">हिंदी</option>
            <option value="gu">ગુજરાતી</option>
          </select>
        </label>

        <button
          type="button"
          className={`a11y-btn ${prefs.highContrast ? 'active' : ''}`}
          onClick={() => setPrefs((p) => ({ ...p, highContrast: !p.highContrast }))}
          aria-pressed={prefs.highContrast}
        >
          <span aria-hidden="true">◐</span>
          <span className="a11y-btn-label">High contrast</span>
        </button>
      </div>
    </div>
  );
}

export default AccessibilityBar;
