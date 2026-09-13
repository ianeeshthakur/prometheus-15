import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import './Topbar.css';

function Topbar() {
  const [backendMode, setBackendMode] = useState('Checking...');
  const [unreadAlerts, setUnreadAlerts] = useState(3);

  useEffect(() => {
    api.checkBackendAvailability().then((isLive) => {
      setBackendMode(isLive ? 'LIVE BACKEND' : 'MOCK ENGINE');
    });
  }, []);

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="topbar-brand">
          <div className="topbar-logo-icon">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
          </div>
          <div>
            <div className="topbar-brand-title-row">
              <span className="brand-name">G-VISTA</span>
              <span className="state-tag">GUJARAT POLICE & COMMAND</span>
            </div>
            <span className="topbar-sub">Statewide Video Intelligence & Investigation Platform</span>
          </div>
        </div>
      </div>

      <div className="topbar-center">
        <div className="pipeline-indicator-group" title="All 5 Backend Video Intelligence Pipelines Running">
          <span className="pulse-beacon" />
          <span className="pipeline-label">PIPELINES 1–5 ACTIVE</span>
          <span className="pipeline-chips">
            <span className="p-chip" title="Pipeline 1: Camera Registry & GIS">P1</span>
            <span className="p-chip" title="Pipeline 2: Protocol Normalization">P2</span>
            <span className="p-chip" title="Pipeline 3: AI Video Analytics">P3</span>
            <span className="p-chip" title="Pipeline 4: Intelligence & Correlation">P4</span>
            <span className="p-chip" title="Pipeline 5: Operations & Investigation">P5</span>
          </span>
        </div>

        <div className={`engine-mode-pill ${backendMode === 'LIVE BACKEND' ? 'live' : 'mock'}`}>
          <span className="mode-dot" />
          <span>{backendMode}</span>
        </div>
      </div>

      <div className="topbar-right">
        {/* Quick Link to Investigation */}
        <Link to="/investigation" className="topbar-alert-link" title="Open Active Triage Alerts">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {unreadAlerts > 0 && <span className="alert-count-bubble">{unreadAlerts}</span>}
        </Link>

        {/* User / Officer Profile Badge */}
        <div className="officer-badge">
          <div className="officer-avatar">RS</div>
          <div className="officer-info">
            <span className="officer-name">PSI Rakesh Solanki</span>
            <span className="officer-unit">Gandhinagar Command · SRT-0042</span>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Topbar;
