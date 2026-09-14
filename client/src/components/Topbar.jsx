import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import './Topbar.css';

function Topbar() {
  const navigate = useNavigate();
  const [backendMode, setBackendMode] = useState('Checking...');
  const [unreadAlerts, setUnreadAlerts] = useState(3);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    api.checkBackendAvailability().then((isLive) => {
      setBackendMode(isLive ? 'LIVE BACKEND' : 'MOCK ENGINE');
      if (isLive) api.getCurrentUser().then(setCurrentUser);
    });
  }, []);

  const handleLogout = async () => {
    await api.logout();
    navigate('/login', { replace: true });
  };

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

        {/* User / Officer Profile Badge -- real identity when a real session exists
            (backend/routers/auth.py's /me), a generic DEMO placeholder otherwise --
            never a hardcoded fake name presented as if it were a real signed-in user. */}
        <div className="officer-badge">
          <div className="officer-avatar">
            {currentUser ? (currentUser.full_name || currentUser.username).slice(0, 2).toUpperCase() : 'DM'}
          </div>
          <div className="officer-info">
            <span className="officer-name">{currentUser ? (currentUser.full_name || currentUser.username) : 'Demo session'}</span>
            <span className="officer-unit">
              {currentUser ? `${currentUser.role}${currentUser.department_scope ? ' · ' + currentUser.department_scope : ''}` : 'No backend connected'}
            </span>
          </div>
          <button type="button" className="officer-logout" onClick={handleLogout} title="Log out">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}

export default Topbar;
