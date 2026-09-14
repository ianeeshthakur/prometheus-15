import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import CameraMap from '../components/CameraMap';
import TelemetryTicker from '../components/TelemetryTicker';
import { DEPARTMENT_COLORS } from '../data/cameras';
import './Dashboard.css';

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
        <span className={`trend-badge ${isPositive ? 'positive' : 'negative'}`}>
          <span className="trend-arrow">{isPositive ? '↑' : '↓'}</span>
          {trendText}
        </span>
      </div>

      <Sparkline data={sparkData} strokeColor={accentColor} id={id} />

      <div className="sparkline-footer">
        <span>7-day activity</span>
        <span>Current period</span>
      </div>
    </div>
  );
}

// ============================================================================
// Department Activity Donut Widget with Synchronous Radar Sweep
// ============================================================================

const departmentData = [
  { name: 'Police / Security', pct: 28, count: 516, color: DEPARTMENT_COLORS.Police },
  { name: 'Municipal Affairs', pct: 24, count: 442, color: DEPARTMENT_COLORS.Municipal },
  { name: 'Food Safety', pct: 18, count: 331, color: DEPARTMENT_COLORS.Food },
  { name: 'Traffic Control', pct: 16, count: 294, color: DEPARTMENT_COLORS.Traffic },
  { name: 'Sanitation', pct: 8, count: 147, color: DEPARTMENT_COLORS.Sanitation },
  { name: 'Health Services', pct: 6, count: 110, color: DEPARTMENT_COLORS.Health },
];

const DepartmentDonut = React.memo(function DepartmentDonut() {
  const radius = 70;
  const circumference = 2 * Math.PI * radius; // ~439.82

  const [animationComplete, setAnimationComplete] = useState(false);
  const [hoveredDept, setHoveredDept] = useState(null);

  // Step D concludes at ~2.9s (1.4s start + 1.5s spin duration)
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimationComplete(true);
    }, 2900);
    return () => clearTimeout(timer);
  }, []);

  // Center count-up triggers after radar spin settles
  const totalCount = useCountUp(animationComplete ? 1840 : 0, 900);

  let accumulatedPct = 0;

  const currentHovered = hoveredDept
    ? departmentData.find((d) => d.name === hoveredDept)
    : null;

  return (
    <div className="widget-card">
      <div className="widget-header">
        <div className="widget-title-group">
          <h2 className="widget-title">Department Activity</h2>
          <p className="widget-subtitle">Multi-agency incident distribution</p>
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

function CommandPriorityStrip() {
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <section className="command-priority-strip" aria-label="Command priority summary">
      <div className="priority-alert-block">
        <span className="priority-alert-icon">!</span>
        <div>
          <span className="priority-kicker">Priority response</span>
          <strong>GJ05X7821 · Vehicle match detected</strong>
          <small>Surat Ring Road · 98.7% AI confidence · 2 min ago</small>
        </div>
      </div>
      <div className="priority-metric"><span>Nearest patrol</span><strong>PSI Rakesh Solanki</strong><small><i /> 4 min ETA · PAT-SRT-0042</small></div>
      <div className="priority-metric"><span>Response state</span><strong className={acknowledged ? 'state-acknowledged' : 'state-pending'}>{acknowledged ? 'Acknowledged' : 'Needs review'}</strong><small>Officer confirmation required</small></div>
      <div className="priority-actions"><button type="button" className={`priority-acknowledge ${acknowledged ? 'done' : ''}`} onClick={() => setAcknowledged((value) => !value)}>{acknowledged ? '✓ Acknowledged' : 'Acknowledge'}</button><Link to="/investigation" className="priority-open">Open incident <span>→</span></Link></div>
    </section>
  );
}

// ============================================================================
// Main Dashboard Component
// ============================================================================

function Dashboard() {
  const clock = useLiveClock();

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
            <h1 className="hero-title">Command Overview</h1>
            <span className="hero-badge">Enterprise VMS</span>
          </div>
          <p className="hero-desc">
            Unified telemetry stream, live GIS surveillance coverage, and real-time AI incident detection across Ahmedabad.
          </p>
        </div>

        <div className="hero-right">
          <div className="live-clock-card">
            <div className="live-status-indicator">
              <span className="pulse-dot" />
              <span>System Live</span>
            </div>
            <div className="live-time">{formattedTime}</div>
            <div className="live-date">{formattedDate}</div>
          </div>
        </div>
      </section>

      {/* 3. Ambient Live Telemetry Ticker Strip */}
      <TelemetryTicker />

      {/* 3.5 Operator-first triage before aggregate metrics */}
      <CommandPriorityStrip />

      {/* 4. Map-first operational view */}
      <section className="widgets-row dashboard-map-first">
        <CameraMap />
        <DepartmentDonut />
      </section>

      {/* 5. Aggregate metrics after the operational map */}
      <section className="stats-grid">
        <StatCard
          cardIndex={0}
          id="cams"
          label="Active Camera Feeds"
          targetValue={1428}
          trendText="+12% this week"
          isPositive={true}
          accentColor="#0284c7"
          sparkData={[1280, 1310, 1340, 1375, 1395, 1412, 1428]}
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
          label="AI Detections Today"
          targetValue={8742}
          trendText="+18% this week"
          isPositive={true}
          accentColor="#6366f1"
          sparkData={[6900, 7250, 7600, 7920, 8200, 8510, 8742]}
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
          targetValue={27}
          trendText="-8% response"
          isPositive={true}
          accentColor="#d97706"
          sparkData={[42, 38, 35, 33, 30, 29, 27]}
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
          label="Stream SLA Stability"
          targetValue={99.94}
          isDecimal={true}
          suffix="%"
          trendText="+0.05% uptime"
          isPositive={true}
          accentColor="#0d9488"
          sparkData={[99.85, 99.87, 99.90, 99.91, 99.92, 99.93, 99.94]}
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
