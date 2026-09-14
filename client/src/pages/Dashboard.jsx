import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import CameraMap from '../components/CameraMap';
import TelemetryTicker from '../components/TelemetryTicker';
import { DEPARTMENT_COLORS } from '../data/cameras';
import api from '../api/client';
import { useLanguage } from '../i18n/LanguageContext';
import './Dashboard.css';

// docs/frontend.md flags CameraMap.jsx as a known remaining gap: it's a large
// (1300+ line), self-contained component reading its own hardcoded fake camera data
// (data/cameras.js), not wired to the API client. Fixing that is out of scope for
// this pass -- rewiring it safely needs its own dedicated pass, not a rushed change
// inside a Dashboard edit. Everything else on this page below (stat cards, the
// department donut, the priority strip, the ticker) is now real.

// ============================================================================
// Custom Hooks
// ============================================================================

/** Real-time live clock hook updating every second */
function useLiveClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return time;
}

/** Easing count-up animation hook for numbers */
function useCountUp(target, duration = 1000, isDecimal = false) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let startTimestamp = null;
    let animationFrameId;

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = ease * target;
      setValue(current);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      }
    };

    animationFrameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrameId);
  }, [target, duration]);

  if (isDecimal) {
    return value.toFixed(2);
  }
  return Math.round(value).toLocaleString();
}

/**
 * Step B: Digital Scramble Hook
 * Rapidly cycles through random digits for ~400ms after delay,
 * then locks onto the real value (like an odometer/slot-machine locking in).
 */
function useDigitalScramble(targetValue, delayMs = 300, scrambleDuration = 420, isDecimal = false) {
  const [displayValue, setDisplayValue] = useState(isDecimal ? '00.00' : '0000');

  useEffect(() => {
    let scrambleInterval = null;
    let finishTimeout = null;

    const getRandomDigits = () => {
      if (isDecimal) {
        const intPart = Math.floor(Math.random() * 90 + 10);
        const decPart = Math.floor(Math.random() * 90 + 10);
        return `${intPart}.${decPart}`;
      }
      const numDigits = String(Math.floor(targetValue)).length;
      let res = '';
      for (let i = 0; i < numDigits; i++) {
        res += Math.floor(Math.random() * 10);
      }
      return Number(res).toLocaleString();
    };

    const startTimer = setTimeout(() => {
      // Rapid digit scramble cycling every 32ms
      scrambleInterval = setInterval(() => {
        setDisplayValue(getRandomDigits());
      }, 32);

      // Lock in the authentic metric
      finishTimeout = setTimeout(() => {
        clearInterval(scrambleInterval);
        setDisplayValue(
          isDecimal
            ? Number(targetValue).toFixed(2)
            : Math.round(targetValue).toLocaleString()
        );
      }, scrambleDuration);
    }, delayMs);

    return () => {
      clearTimeout(startTimer);
      if (scrambleInterval) clearInterval(scrambleInterval);
      if (finishTimeout) clearTimeout(finishTimeout);
    };
  }, [targetValue, delayMs, scrambleDuration, isDecimal]);

  return displayValue;
}

// ============================================================================
// Pure SVG Sparkline Component
// ============================================================================

function Sparkline({ data, strokeColor, id }) {
  const width = 200;
  const height = 40;
  const padding = 4;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((val, idx) => {
    const x = padding + (idx / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((val - min) / range) * (height - padding * 2);
    return { x, y };
  });

  const pathD = points.reduce((acc, pt, idx) => {
    return `${acc} ${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${height} L ${points[0].x.toFixed(1)} ${height} Z`;
  const gradientId = `spark-grad-${id}`;

  return (
    <div className="sparkline-wrapper">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="sparkline-svg"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.28" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#${gradientId})`} />
        <path
          d={pathD}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r="3"
          fill={strokeColor}
        />
      </svg>
    </div>
  );
}

// ============================================================================
// Single Glassmorphism Stats Card with Digital Scramble
// ============================================================================

function StatCard({
  cardIndex,
  label,
  targetValue,
  isDecimal,
  suffix,
  trendText,
  isPositive,
  accentColor,
  sparkData,
  icon,
  id,
}) {
  const scrambleDelay = 300 + cardIndex * 120;
  const scrambledValue = useDigitalScramble(targetValue, scrambleDelay, 420, isDecimal);

  return (
    <div className="stats-card" style={{ '--card-idx': cardIndex }}>
      <div
        className="stats-card-accent-bar"
        style={{
          background: `linear-gradient(90deg, ${accentColor}, rgba(255, 255, 255, 0.2))`,
        }}
      />
      <div className="stats-card-header">
        <span className="stats-label">{label}</span>
        <div className="stats-icon-badge" style={{ color: accentColor }}>
          {icon}
        </div>
      </div>

      <div className="stats-value-row">
        <span className="stats-value">
          {scrambledValue}
          {suffix}
        </span>
        {trendText && (
          <span className={`trend-badge ${isPositive ? 'positive' : 'negative'}`}>
            <span className="trend-arrow">{isPositive ? '↑' : '↓'}</span>
            {trendText}
          </span>
        )}
      </div>

      {/* No real historical time-series endpoint exists yet (docs/frontend.md) --
          only render a trend line when real per-period data is actually supplied,
          rather than fabricating a plausible-looking 7-day curve from nothing. */}
      {sparkData && sparkData.length > 1 && (
        <>
          <Sparkline data={sparkData} strokeColor={accentColor} id={id} />
          <div className="sparkline-footer">
            <span>Recent activity</span>
            <span>Current period</span>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Department Activity Donut Widget with Synchronous Radar Sweep
// ============================================================================

const FALLBACK_DEPT_COLORS = ['#0284c7', '#6366f1', '#d97706', '#0d9488', '#dc2626', '#7c3aed', '#059669'];

/** Real department distribution derived from registered cameras (api.getCameras()) --
 * this used to be a fixed array of invented department names/counts/percentages that
 * never changed regardless of what was actually in the registry. */
function deriveDepartmentData(cameras) {
  const counts = {};
  cameras.forEach((c) => {
    const dept = c.department || 'Unknown';
    counts[dept] = (counts[dept] || 0) + 1;
  });
  const total = cameras.length || 1;
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count], idx) => ({
      name,
      count,
      pct: Math.round((count / total) * 1000) / 10,
      color: DEPARTMENT_COLORS[name] || FALLBACK_DEPT_COLORS[idx % FALLBACK_DEPT_COLORS.length],
    }));
}

const DepartmentDonut = React.memo(function DepartmentDonut({ cameras }) {
  const radius = 70;
  const circumference = 2 * Math.PI * radius; // ~439.82

  const [animationComplete, setAnimationComplete] = useState(false);
  const [hoveredDept, setHoveredDept] = useState(null);

  const departmentData = useMemo(() => deriveDepartmentData(cameras), [cameras]);

  // Step D concludes at ~2.9s (1.4s start + 1.5s spin duration)
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimationComplete(true);
    }, 2900);
    return () => clearTimeout(timer);
  }, []);

  // Center count-up now targets the real registered-camera count, not a fixed 1840.
  const totalCount = useCountUp(animationComplete ? cameras.length : 0, 900);

  let accumulatedPct = 0;

  const currentHovered = hoveredDept
    ? departmentData.find((d) => d.name === hoveredDept)
    : null;

  if (departmentData.length === 0) {
    return (
      <div className="widget-card">
        <div className="widget-header">
          <div className="widget-title-group">
            <h2 className="widget-title">Department Activity</h2>
            <p className="widget-subtitle">Camera distribution by owning department</p>
          </div>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No cameras registered yet.</p>
      </div>
    );
  }

  return (
    <div className="widget-card">
      <div className="widget-header">
        <div className="widget-title-group">
          <h2 className="widget-title">Department Activity</h2>
          <p className="widget-subtitle">Camera distribution by owning department</p>
        </div>
        <span className="widget-action-pill">Live Ratio</span>
      </div>

      <div className={`donut-widget-content ${animationComplete ? 'donut-settled' : ''}`}>
        <div className="donut-chart-container">
          <svg viewBox="0 0 200 200" className="donut-svg">
            <defs>
              <linearGradient id="donut-radar-grad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#0284c7" stopOpacity="0.32" />
                <stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Static background track */}
            <circle
              cx="100"
              cy="100"
              r={radius}
              fill="none"
              stroke="#f1f5f9"
              strokeWidth="24"
            />

            {/* Step D: Rotator group spinning with radar needle in sync */}
            <g
              className="donut-rotator-group"
              onAnimationEnd={() => setAnimationComplete(true)}
            >
              {/* Radar sweep beam needle & soft sector cone */}
              <polygon
                points="100,100 100,28 128,34"
                className="donut-radar-cone"
              />
              <line
                x1="100"
                y1="100"
                x2="100"
                y2="28"
                className="donut-radar-needle"
              />

              {departmentData.map((dept) => {
                const strokeLength = (dept.pct / 100) * circumference;
                const strokeGap = circumference - strokeLength;
                const strokeOffset = -((accumulatedPct / 100) * circumference);
                accumulatedPct += dept.pct;

                const isHovered = hoveredDept === dept.name;
                const isOtherHovered = hoveredDept && !isHovered;

                return (
                  <circle
                    key={dept.name}
                    cx="100"
                    cy="100"
                    r={radius}
                    className={`donut-segment ${isOtherHovered ? 'dimmed' : ''}`}
                    stroke={dept.color}
                    strokeDasharray={`${strokeLength} ${strokeGap}`}
                    style={{
                      '--target-offset': `${strokeOffset}`,
                    }}
                    onMouseEnter={() => {
                      if (animationComplete) setHoveredDept(dept.name);
                    }}
                    onMouseLeave={() => {
                      if (animationComplete) setHoveredDept(null);
                    }}
                  />
                );
              })}
            </g>
          </svg>

          {/* Center Readout: Counts up after radar settling, responds to hover */}
          <div className="donut-center-info">
            <span
              className="donut-center-total"
              style={{
                color: currentHovered ? currentHovered.color : 'var(--text-primary)',
              }}
            >
              {currentHovered ? currentHovered.count.toLocaleString() : totalCount}
            </span>
            <span className="donut-center-label">
              {currentHovered ? `${currentHovered.name} (${currentHovered.pct}%)` : 'Total Incidents'}
            </span>
          </div>
        </div>

        {/* Staggered Legend Reveal */}
        <div className="donut-legend-grid">
          {departmentData.map((dept, idx) => (
            <div
              key={dept.name}
              className="donut-legend-item"
              style={{
                '--item-delay': idx,
                backgroundColor: hoveredDept === dept.name ? 'var(--bg-secondary)' : undefined,
              }}
              onMouseEnter={() => {
                if (animationComplete) setHoveredDept(dept.name);
              }}
              onMouseLeave={() => {
                if (animationComplete) setHoveredDept(null);
              }}
            >
              <div className="donut-legend-left">
                <span
                  className="donut-color-dot"
                  style={{ backgroundColor: dept.color }}
                />
                <span>{dept.name}</span>
              </div>
              <span className="donut-legend-pct">{dept.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

// ============================================================================
// Command Center Priority Strip
// ============================================================================

/** The single highest-priority unresolved alert, real (api.getAlerts()) -- this used
 * to be a hardcoded "GJ05X7821" incident that showed regardless of actual alert
 * state, including with zero real alerts. */
function CommandPriorityStrip({ alerts, onAcknowledge }) {
  const severityRank = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };
  const topAlert = [...alerts]
    .filter((a) => a.status !== 'RESOLVED')
    .sort((a, b) => (severityRank[a.severity] ?? 9) - (severityRank[b.severity] ?? 9))[0];

  if (!topAlert) {
    return (
      <section className="command-priority-strip" aria-label="Command priority summary">
        <div className="priority-alert-block">
          <div>
            <span className="priority-kicker">Priority response</span>
            <strong>No active incidents</strong>
            <small>All alerts resolved or none raised yet</small>
          </div>
        </div>
      </section>
    );
  }

  const acknowledged = topAlert.status === 'ACKNOWLEDGED' || topAlert.status === 'ESCALATED';
  const minutesAgo = topAlert.created_at ? Math.max(0, Math.round((Date.now() - new Date(topAlert.created_at).getTime()) / 60000)) : null;

  return (
    <section className="command-priority-strip" aria-label="Command priority summary">
      <div className="priority-alert-block">
        <span className="priority-alert-icon">!</span>
        <div>
          <span className="priority-kicker">Priority response</span>
          <strong>{topAlert.entity} · {topAlert.type?.replace(/_/g, ' ')}</strong>
          <small>
            {topAlert.camera_name || topAlert.camera_uid} · {(topAlert.confidence * 100).toFixed(1)}% confidence
            {minutesAgo !== null ? ` · ${minutesAgo} min ago` : ''}
          </small>
        </div>
      </div>
      <div className="priority-metric"><span>Severity</span><strong>{topAlert.severity}</strong><small>{topAlert.district}</small></div>
      <div className="priority-metric"><span>Response state</span><strong className={acknowledged ? 'state-acknowledged' : 'state-pending'}>{acknowledged ? topAlert.status : 'Needs review'}</strong><small>Officer confirmation required</small></div>
      <div className="priority-actions">
        <button
          type="button"
          className={`priority-acknowledge ${acknowledged ? 'done' : ''}`}
          disabled={acknowledged}
          onClick={() => onAcknowledge(topAlert.alert_uid)}
        >
          {acknowledged ? '✓ Acknowledged' : 'Acknowledge'}
        </button>
        <Link to="/investigation" className="priority-open">Open incident <span>→</span></Link>
      </div>
    </section>
  );
}

// ============================================================================
// Main Dashboard Component
// ============================================================================

function Dashboard() {
  const { t } = useLanguage();
  const clock = useLiveClock();
  const [cameras, setCameras] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [liveEventCount, setLiveEventCount] = useState(0);
  const [backendMode, setBackendMode] = useState('MOCK_ENGINE');

  const loadAlerts = () => {
    api.getAlerts().then((data) => setAlerts(Array.isArray(data) ? data : []));
  };

  useEffect(() => {
    api.getCameras().then((data) => setCameras(Array.isArray(data) ? data : []));
    loadAlerts();
    api.checkBackendAvailability().then(() => setBackendMode(api.getMode()));

    // Real, live-updating count of AI events received this session -- there is no
    // "detections today" endpoint on the backend (server/routers/ai.py is per-frame
    // analyze-frame only), so this counts actual SSE messages since page load rather
    // than fabricating a daily total. Labeled accordingly below, not as "Today".
    const source = api.subscribeToLiveEvents(
      () => setLiveEventCount((n) => n + 1),
      () => source.close()
    );
    return () => source.close();
  }, []);

  const handleAcknowledge = async (alertUid) => {
    await api.updateAlertStatus(alertUid, 'ACKNOWLEDGED');
    loadAlerts();
  };

  const onlineCount = cameras.filter((c) => c.status === 'ACTIVE').length;
  const onlinePct = cameras.length > 0 ? ((onlineCount / cameras.length) * 100).toFixed(1) : '0.0';
  const activeIncidents = alerts.filter((a) => a.status !== 'RESOLVED').length;

  const formattedDate = clock.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const formattedTime = clock.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className="dashboard-container">
      {/* 1. Subtle Live Dot-Grid Background & Activation Light Sweep Beam */}
      <div className="dashboard-live-bg" aria-hidden="true" />
      <div className="page-activation-beam" aria-hidden="true" />

      {/* 2. Hero Strip with Live Updating Clock & System Live Beacon */}
      <section className="dashboard-hero">
        <div className="hero-left">
          <div className="hero-title-row">
            <h1 className="hero-title">{t('dashboard_title')}</h1>
            <span className="hero-badge">Enterprise VMS</span>
          </div>
          <p className="hero-desc">
            {t('dashboard_subtitle')}
          </p>
        </div>

        <div className="hero-right">
          <div className="live-clock-card">
            <div className="live-status-indicator">
              <span className="pulse-dot" />
              <span>{backendMode === 'LIVE_BACKEND' ? 'Live backend' : 'Demo mode'}</span>
            </div>
            <div className="live-time">{formattedTime}</div>
            <div className="live-date">{formattedDate}</div>
          </div>
        </div>
      </section>

      {/* 3. Ambient Live Telemetry Ticker Strip */}
      <TelemetryTicker cameras={cameras} alerts={alerts} backendMode={backendMode} />

      {/* 3.5 Operator-first triage before aggregate metrics */}
      <CommandPriorityStrip alerts={alerts} onAcknowledge={handleAcknowledge} />

      {/* 4. Map-first operational view */}
      <section className="widgets-row dashboard-map-first">
        <CameraMap />
        <DepartmentDonut cameras={cameras} />
      </section>

      {/* 5. Aggregate metrics after the operational map */}
      <section className="stats-grid">
        <StatCard
          cardIndex={0}
          id="cams"
          label="Active Camera Feeds"
          targetValue={onlineCount}
          trendText={cameras.length > 0 ? `of ${cameras.length} registered` : undefined}
          isPositive={true}
          accentColor="#0284c7"
          icon={
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 7l-7 5 7 5V7z" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          }
        />

        <StatCard
          cardIndex={1}
          id="detections"
          label="Live AI Events (this session)"
          targetValue={liveEventCount}
          isPositive={true}
          accentColor="#6366f1"
          icon={
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          }
        />

        <StatCard
          cardIndex={2}
          id="alerts"
          label="Active Incidents"
          targetValue={activeIncidents}
          isPositive={activeIncidents === 0}
          accentColor="#d97706"
          icon={
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          }
        />

        <StatCard
          cardIndex={3}
          id="uptime"
          label="Cameras Online"
          targetValue={Number(onlinePct)}
          isDecimal={true}
          suffix="%"
          isPositive={true}
          accentColor="#0d9488"
          icon={
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          }
        />
      </section>

    </div>
  );
}

export default Dashboard;
