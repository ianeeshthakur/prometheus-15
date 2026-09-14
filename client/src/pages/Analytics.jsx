import React, { useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import { useLanguage } from '../i18n/LanguageContext';
import './Analytics.css';

// docs/prd.md §0.1's submission deliverable: "a report showing detected
// vehicles/number plates with timestamps" must be a real product export, not a
// hand-assembled slide. The CSV export below is exactly that report, built from
// real api.getAlerts() data (entity, camera, district, severity, confidence,
// timestamp) -- not mock rows. No charting library is installed in client/ yet
// (package.json has only leaflet/react-leaflet), so the breakdowns below are plain
// bar-style divs sized by real counts rather than pulling in a new dependency for
// this pass -- still real data, just a simpler visual than a full charting lib.

function csvEscape(value) {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function downloadCsv(rows, filename) {
  const header = ['alert_uid', 'entity', 'type', 'severity', 'camera_uid', 'camera_name', 'district', 'confidence', 'status', 'created_at'];
  const lines = [header.join(',')];
  rows.forEach((r) => {
    lines.push(header.map((h) => csvEscape(r[h])).join(','));
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function BreakdownBar({ label, count, max, color }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="breakdown-row">
      <span className="breakdown-label">{label}</span>
      <div className="breakdown-track">
        <div className="breakdown-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="breakdown-count">{count}</span>
    </div>
  );
}

function Analytics() {
  const { t } = useLanguage();
  const [alerts, setAlerts] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getAlerts(), api.getCameras(), api.getWatchlistEntries()])
      .then(([a, c, w]) => {
        setAlerts(Array.isArray(a) ? a : []);
        setCameras(Array.isArray(c) ? c : []);
        setWatchlist(Array.isArray(w) ? w : []);
      })
      .finally(() => setLoading(false));
  }, []);

  const bySeverity = useMemo(() => {
    const counts = {};
    alerts.forEach((a) => { counts[a.severity] = (counts[a.severity] || 0) + 1; });
    return counts;
  }, [alerts]);

  const byType = useMemo(() => {
    const counts = {};
    alerts.forEach((a) => { counts[a.type] = (counts[a.type] || 0) + 1; });
    return counts;
  }, [alerts]);

  const byDistrict = useMemo(() => {
    const counts = {};
    alerts.forEach((a) => { counts[a.district] = (counts[a.district] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [alerts]);

  const severityColors = { CRITICAL: '#c62828', HIGH: '#d97706', MEDIUM: '#2781aa', LOW: '#718399', INFO: '#94a3b8' };
  const maxSeverity = Math.max(1, ...Object.values(bySeverity));
  const maxType = Math.max(1, ...Object.values(byType));
  const maxDistrict = Math.max(1, ...byDistrict.map(([, c]) => c));

  const watchlistMatches = watchlist.reduce((sum, w) => sum + (w.match_count || 0), 0);

  return (
    <div className="analytics-page">
      <header className="analytics-header">
        <div>
          <span className="section-eyebrow">INTELLIGENCE / ANALYTICS & REPORTS</span>
          <h1>{t('analytics_title')}</h1>
          <p>{loading ? 'Loading…' : `${alerts.length} alerts across ${cameras.length} registered cameras`}</p>
        </div>
        <button
          type="button"
          className="analytics-export-btn"
          disabled={alerts.length === 0}
          onClick={() => downloadCsv(alerts, `gvista-detections-${new Date().toISOString().slice(0, 10)}.csv`)}
        >
          ⬇ Export detections CSV
        </button>
      </header>

      <div className="analytics-stats-row">
        <div className="analytics-stat-card"><span>{alerts.length}</span><small>Total alerts</small></div>
        <div className="analytics-stat-card"><span>{cameras.length}</span><small>Registered cameras</small></div>
        <div className="analytics-stat-card"><span>{watchlist.length}</span><small>Watchlist entries</small></div>
        <div className="analytics-stat-card"><span>{watchlistMatches}</span><small>Watchlist matches recorded</small></div>
      </div>

      <div className="analytics-grid">
        <section className="analytics-panel">
          <h2>By severity</h2>
          {Object.entries(bySeverity).length === 0 && <p className="analytics-empty">No alerts yet.</p>}
          {Object.entries(bySeverity).map(([sev, count]) => (
            <BreakdownBar key={sev} label={sev} count={count} max={maxSeverity} color={severityColors[sev] || '#718399'} />
          ))}
        </section>

        <section className="analytics-panel">
          <h2>By detection type</h2>
          {Object.entries(byType).length === 0 && <p className="analytics-empty">No alerts yet.</p>}
          {Object.entries(byType).map(([type, count]) => (
            <BreakdownBar key={type} label={type.replace(/_/g, ' ')} count={count} max={maxType} color="#6366f1" />
          ))}
        </section>

        <section className="analytics-panel">
          <h2>By district</h2>
          {byDistrict.length === 0 && <p className="analytics-empty">No alerts yet.</p>}
          {byDistrict.map(([district, count]) => (
            <BreakdownBar key={district} label={district} count={count} max={maxDistrict} color="#0d9488" />
          ))}
        </section>
      </div>

      <section className="analytics-table-section">
        <h2>Detections with timestamps</h2>
        <div className="analytics-table-wrap">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>Entity</th><th>Type</th><th>Severity</th><th>Camera</th><th>District</th><th>Confidence</th><th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {alerts.length === 0 && (
                <tr><td colSpan={7} className="analytics-empty">No detections recorded yet.</td></tr>
              )}
              {alerts.slice(0, 100).map((a) => (
                <tr key={a.alert_uid}>
                  <td className="mono">{a.entity}</td>
                  <td>{a.type.replace(/_/g, ' ')}</td>
                  <td>{a.severity}</td>
                  <td>{a.camera_name || a.camera_uid}</td>
                  <td>{a.district}</td>
                  <td>{(a.confidence * 100).toFixed(1)}%</td>
                  <td className="mono">{new Date(a.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default Analytics;
