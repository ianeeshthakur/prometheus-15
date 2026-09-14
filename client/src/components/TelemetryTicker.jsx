import React, { useMemo } from 'react';
import './TelemetryTicker.css';

/** Derives real ticker items from actual camera/alert data (props from Dashboard.jsx)
 * instead of 7 hardcoded strings that claimed to be "LIVE TELEMETRY" but never
 * changed regardless of real system state -- exactly the kind of fabricated-looking-
 * real data this project's own conventions (docs/backend.md, docs/frontend.md)
 * exist to avoid. Falls back to an honest single "no signals yet" item when there's
 * nothing real to report, rather than making something up to fill the ticker. */
function buildTickerItems(cameras, alerts, backendMode) {
  const items = [];

  if (backendMode !== 'LIVE_BACKEND') {
    items.push({ id: 'mode', type: 'MODE', text: 'Running in demo mode -- no live backend connected', tag: 'DEMO' });
  }

  const onlineCount = cameras.filter((c) => c.status === 'ACTIVE').length;
  if (cameras.length > 0) {
    items.push({
      id: 'registry',
      type: 'FEED',
      text: `Camera registry: ${onlineCount} of ${cameras.length} nodes active`,
      tag: `${cameras.length ? Math.round((onlineCount / cameras.length) * 100) : 0}%`,
    });
  }

  const districts = [...new Set(cameras.map((c) => c.district).filter(Boolean))];
  if (districts.length > 0) {
    items.push({ id: 'coverage', type: 'MUNICIPAL', text: `Registered coverage across ${districts.length} district${districts.length === 1 ? '' : 's'}`, tag: 'Registry' });
  }

  const unresolved = alerts.filter((a) => a.status !== 'RESOLVED');
  if (unresolved.length > 0) {
    unresolved.slice(0, 5).forEach((a) => {
      items.push({
        id: `alert-${a.alert_uid || a.id}`,
        type: 'ALERT',
        text: `${a.camera_name || a.camera_uid || 'Unknown camera'}: ${(a.type || 'ALERT').replace(/_/g, ' ')} -- ${a.entity || ''}`,
        tag: a.severity,
      });
    });
  } else {
    items.push({ id: 'no-alerts', type: 'AI', text: 'No active alerts -- alert engine idle', tag: 'Nominal' });
  }

  if (items.length === 0) {
    items.push({ id: 'empty', type: 'SYNC', text: 'No telemetry to report yet', tag: '—' });
  }

  return items;
}

function TelemetryTicker({ cameras = [], alerts = [], backendMode = 'MOCK_ENGINE' }) {
  const items = useMemo(() => buildTickerItems(cameras, alerts, backendMode), [cameras, alerts, backendMode]);

  return (
    <div className="telemetry-ticker-wrapper">
      <div className="ticker-badge">
        <span className="ticker-pulse-dot" />
        <span className="ticker-badge-text">{backendMode === 'LIVE_BACKEND' ? 'LIVE TELEMETRY' : 'DEMO TELEMETRY'}</span>
      </div>

      <div className="ticker-viewport">
        <div className="ticker-track">
          {/* Duplicate list to enable continuous seamless looping */}
          {[...items, ...items].map((item, idx) => (
            <div key={`${item.id}-${idx}`} className="ticker-item">
              <span className="ticker-bullet">●</span>
              <span className="ticker-text">{item.text}</span>
              <span className="ticker-tag">{item.tag}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default TelemetryTicker;
