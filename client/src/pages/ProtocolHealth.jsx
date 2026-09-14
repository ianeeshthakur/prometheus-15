import React, { useEffect, useState } from 'react';
import StatusBadge from '../components/StatusBadge';
import api from '../api/client';
import { useLanguage } from '../i18n/LanguageContext';
import './ProtocolHealth.css';

// ============================================================================
// Protocol Health — Pipeline 2
// Uses same real API as SystemNetwork's AdapterHealth tab:
//   GET /api/cameras/{uid}/adapter/health
// ============================================================================

const PROTOCOL_TYPES = ['RTSP', 'HLS', 'ONVIF', 'VENDOR_SDK', 'MOCK'];

const PROTOCOL_DESCRIPTIONS = {
  RTSP: 'Real-Time Streaming Protocol — direct camera stream via FFmpeg transcode',
  HLS: 'HTTP Live Streaming — segment-based playback via browser-compatible HLS',
  ONVIF: 'ONVIF Profile S/T — IP camera discovery and control standard',
  VENDOR_SDK: 'Proprietary vendor SDK integration',
  MOCK: 'Mock adapter — demo data, no real camera connection',
};

function ProtocolSummaryCards({ cameras }) {
  const byProtocol = {};
  PROTOCOL_TYPES.forEach(p => { byProtocol[p] = 0; });
  cameras.forEach(c => {
    const p = c.protocol_type || 'MOCK';
    byProtocol[p] = (byProtocol[p] || 0) + 1;
  });

  return (
    <div className="protocol-summary-row">
      {PROTOCOL_TYPES.map(p => (
        <div key={p} className="protocol-summary-card">
          <span className="protocol-summary-name">{p}</span>
          <span className="protocol-summary-count">{byProtocol[p] || 0}</span>
          <span className="protocol-summary-desc">{PROTOCOL_DESCRIPTIONS[p]}</span>
        </div>
      ))}
    </div>
  );
}

function AdapterHealthRow({ cam }) {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const check = async () => {
    setChecking(true);
    setError('');
    setResult(null);
    try {
      const h = await api.getAdapterHealth(cam.camera_uid);
      setResult(h);
    } catch (err) {
      setError(err.message || 'Check failed');
    } finally {
      setChecking(false);
    }
  };

  return (
    <tr>
      <td className="proto-td mono">{cam.camera_uid}</td>
      <td className="proto-td">{cam.name}</td>
      <td className="proto-td"><span className="proto-badge">{cam.protocol_type || 'MOCK'}</span></td>
      <td className="proto-td">{cam.vms_vendor || '—'}</td>
      <td className="proto-td">
        {result ? (
          <StatusBadge status={result.status || 'unknown'} size="sm" />
        ) : (
          <span className="proto-not-checked">—</span>
        )}
      </td>
      <td className="proto-td">{result?.dimensions || '—'}</td>
      <td className="proto-td">{cam.ai_enabled ? <span className="proto-ai-on">AI</span> : <span className="proto-ai-off">—</span>}</td>
      <td className="proto-td">
        <button
          type="button"
          className="proto-check-btn"
          onClick={check}
          disabled={checking}
        >
          {checking ? 'Checking…' : result ? 'Re-check' : error ? 'Retry' : 'Check'}
        </button>
        {error && <span className="proto-check-error">{error}</span>}
      </td>
    </tr>
  );
}

function ProtocolHealth() {
  const { t } = useLanguage();
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [protocolFilter, setProtocolFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.getCameras()
      .then(data => setCameras(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = cameras.filter(c => {
    const matchProto = protocolFilter === 'ALL' || c.protocol_type === protocolFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || c.camera_uid.toLowerCase().includes(q) ||
      (c.name || '').toLowerCase().includes(q) ||
      (c.location || '').toLowerCase().includes(q);
    return matchProto && matchSearch;
  });

  return (
    <div className="protocol-health-page">
      <header className="protocol-health-header">
        <div>
          <span className="section-eyebrow">CAMERA INTELLIGENCE / PIPELINE 2</span>
          <h1>{t('protocol_health_title')}</h1>
          <p>{t('protocol_health_subtitle')}</p>
        </div>
        <div className="proto-note">
          <span>⚠</span>
          <span>
            Adapter health checks open a live connection to the camera.
            Check on-demand per camera — not auto-looped over the fleet.
          </span>
        </div>
      </header>

      <div className="protocol-health-body">
        <ProtocolSummaryCards cameras={cameras} />

        <div className="proto-table-controls">
          <input
            type="search"
            className="proto-search"
            placeholder="Search camera UID, name, location…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            className="proto-filter"
            value={protocolFilter}
            onChange={e => setProtocolFilter(e.target.value)}
          >
            <option value="ALL">All Protocols</option>
            {PROTOCOL_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <span className="proto-count">
            {loading ? 'Loading…' : `${filtered.length} of ${cameras.length} cameras`}
          </span>
        </div>

        <div className="proto-table-wrap">
          <table className="proto-table">
            <thead>
              <tr>
                <th>Camera UID</th>
                <th>Name</th>
                <th>Protocol</th>
                <th>Vendor</th>
                <th>Connection State</th>
                <th>Resolution</th>
                <th>AI</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={8} className="proto-empty">No cameras match the current filter.</td></tr>
              )}
              {filtered.map(cam => (
                <AdapterHealthRow key={cam.camera_uid} cam={cam} />
              ))}
            </tbody>
          </table>
        </div>

        <div className="proto-disclaimer">
          <p>
            <strong>Live acquisition note:</strong> RTSP and ONVIF streams require a camera
            with a configured RTSP URL and a server host with FFmpeg available (
            <code>GET /api/health/</code> → <code>ffmpeg_available</code>).
            HLS segments are served via the stream lifecycle endpoints (
            <code>POST /api/streams/{'{camera_id}'}/start</code>).
            ONVIF/VENDOR_SDK live acquisition is not configured in this environment.
          </p>
          <p>
            Private RTSP credentials are never exposed in the UI, API responses, browser logs,
            or localStorage.
          </p>
        </div>
      </div>
    </div>
  );
}

export default ProtocolHealth;
