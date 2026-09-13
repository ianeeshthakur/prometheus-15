import React from 'react';
import './TelemetryTicker.css';

const TICKER_ITEMS = [
  { id: 1, type: 'FEED', text: 'Ahmedabad Metro: 28 of 36 optical nodes active and synced', tag: '30 FPS' },
  { id: 2, type: 'ALERT', text: 'Lal Darwaja (CAM-AHM-02): Crowd density tracking active — Normal flow', tag: 'Police' },
  { id: 3, type: 'AI', text: 'Optical Anomaly Detection: 0 critical hazards in Sector 1 (Sabarmati)', tag: 'Verified' },
  { id: 4, type: 'TRAFFIC', text: 'ISCON Crossroad Flyover: Stream latency stabilized at 14ms', tag: 'Optimal' },
  { id: 5, type: 'HEALTH', text: 'Civil Hospital Emergency Transit: Corridor clear and monitored', tag: 'Active' },
  { id: 6, type: 'SYNC', text: 'VMS Telemetry heartbeat received across all 6 civic agencies', tag: '99.94% SLA' },
  { id: 7, type: 'MUNICIPAL', text: 'Kankaria Lakefront perimeter perimeter gate 1 sensors nominal', tag: 'Online' },
];

function TelemetryTicker() {
  return (
    <div className="telemetry-ticker-wrapper">
      <div className="ticker-badge">
        <span className="ticker-pulse-dot" />
        <span className="ticker-badge-text">LIVE TELEMETRY</span>
      </div>

      <div className="ticker-viewport">
        <div className="ticker-track">
          {/* Duplicate list to enable continuous seamless looping */}
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, idx) => (
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
