import React, { useEffect, useState } from 'react';
import api from '../api/client';
import { useLanguage } from '../i18n/LanguageContext';
import './Footer.css';

// docs/frontend.md's original spec placed the DEMO/LIVE distinction in a footer
// status strip specifically; Topbar.jsx's engine-mode pill already covers the
// underlying honesty requirement (never let real vs. simulated data be ambiguous),
// but a literal footer was still a named, unmet item. Reuses the same real
// api.checkBackendAvailability()/getMode() Topbar.jsx already calls -- one shared
// source of truth, not a second independent check that could disagree with it.
function Footer() {
  const { t } = useLanguage();
  const [mode, setMode] = useState(null);

  useEffect(() => {
    api.checkBackendAvailability().then(() => setMode(api.getMode()));
  }, []);

  const isLive = mode === 'LIVE_BACKEND';

  return (
    <footer className="app-footer" role="contentinfo">
      <span className="app-footer-status">
        <span className={`app-footer-dot ${mode === null ? 'checking' : isLive ? 'live' : 'mock'}`} aria-hidden="true" />
        <span>
          {mode === null ? 'Checking backend…' : isLive ? t('footer_live') : t('footer_mock')}
        </span>
      </span>
      <span className="app-footer-meta">G-VISTA &middot; Gujarat Police CCTV Integration Hackathon 2026</span>
    </footer>
  );
}

export default Footer;
