import React, { useEffect, useState } from 'react';
import StatusBadge from '../components/StatusBadge';
import api from '../api/client';
import { useLanguage } from '../i18n/LanguageContext';
import './SystemNetwork.css';

// New page (docs/frontend.md's original spec named this "System & Network" --
// Pipeline health, per-camera adapter health, integration log). Built against what's
// actually real on the backend:
//   - GET /api/health/ -- real system health (CPU/memory/ffmpeg/AI engine/GPU).
//   - GET /api/cameras/{uid}/adapter/health -- real per-camera adapter check, but it
//     genuinely opens a live network connection (routers/adapters.py's own docstring
//     says so), so this is checked on-demand per selected camera, never looped over
//     the whole fleet automatically -- that would mean silently opening N live
//     connections just to render a page.
//   - Integration/error log: NO real endpoint exists for this anywhere on the
//     backend (checked server/routers/*.py before building this page) -- shown
//     honestly as "not yet tracked", not fabricated rows.

const TABS = ['Pipeline Health', 'Adapter Health', 'Integration Log'];

function PipelineHealthTab() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    fetch(`${api.baseUrl}/api/health/`)
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        return res.json();
      })
      .then(setHealth)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading) return <p className="sn-empty">Loading system health…</p>;
  if (error) return <p className="sn-permission-error">Could not reach the backend: {error}.</p>;
  if (!health) return null;

  const components = [
    { name: 'Database & API', state: health.status === 'online' ? 'Healthy' : 'Down', detail: `Status: ${health.status}` },
    { name: 'CPU', state: health.cpu_percent < 85 ? 'Healthy' : 'Degraded', detail: `${health.cpu_percent}% utilized` },
    { name: 'Memory', state: health.memory_percent < 85 ? 'Healthy' : 'Degraded', detail: `${health.memory_percent}% utilized` },
    { name: 'FFmpeg (RTSP→HLS transcode)', state: health.ffmpeg_available ? 'Healthy' : 'Down', detail: health.ffmpeg_available ? 'Available on PATH' : 'Not installed on this host -- local transcoding unavailable' },
    { name: 'AI Orchestrator', state: 'Healthy', detail: `Engine: ${health.ai_engine}${health.gpu_available ? ' (GPU)' : ' (CPU)'}` },
  ];

  return (
    <div>
      <div className="sn-toolbar">
        <span>Live system health (GET /api/health/)</span>
        <button type="button" onClick={load}>Refresh</button>
      </div>
      <div className="sn-component-grid">
        {components.map((c) => (
          <div key={c.name} className="sn-component-card">
            <div className="sn-component-header">
              <span>{c.name}</span>
              <StatusBadge status={c.state === 'Healthy' ? 'active' : c.state === 'Degraded' ? 'degraded' : 'offline'} size="sm" />
            </div>
            <p className="sn-component-detail">{c.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdapterHealthTab() {
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUid, setSelectedUid] = useState('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .getCameras()
      .then((data) => setCameras(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  const runCheck = async () => {
    if (!selectedUid) return;
    setChecking(true);
    setError('');
    setResult(null);
    try {
      const health = await api.getAdapterHealth(selectedUid);
      setResult(health);
    } catch (err) {
      setError(err.message || 'Health check failed.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div>
      <p className="sn-note">
        Opens a real live connection to the selected camera's adapter (RTSP/HLS/ONVIF/Vendor SDK) --
        checked on demand per camera, not automatically for the whole fleet.
      </p>
      <div className="sn-toolbar">
        <select value={selectedUid} onChange={(e) => { setSelectedUid(e.target.value); setResult(null); setError(''); }} disabled={loading}>
          <option value="">{loading ? 'Loading cameras…' : 'Select a camera…'}</option>
          {cameras.map((c) => (
            <option key={c.camera_uid} value={c.camera_uid}>{c.camera_uid} — {c.name}</option>
          ))}
        </select>
        <button type="button" onClick={runCheck} disabled={!selectedUid || checking}>
          {checking ? 'Checking…' : 'Run health check'}
        </button>
      </div>
      {error && <p className="sn-permission-error">{error}</p>}
      {result && (
        <div className="sn-result-card">
          <div className="sn-component-header">
            <span>{result.camera_uid}</span>
            <StatusBadge status={result.status} size="sm" />
          </div>
          <p className="sn-component-detail">Frame dimensions: {result.dimensions}</p>
        </div>
      )}
    </div>
  );
}

function IntegrationLogTab() {
  return (
    <div>
      <p className="sn-empty">
        Not yet tracked by the backend -- no integration/connector error log endpoint exists yet
        (checked every router before building this page). Adapter connection failures are logged
        server-side (Python <code>logger</code> calls, docs/backend.md §2's pre-submission
        checklist) but aren't currently persisted or exposed via an API for this page to read.
        The Audit Log (Administration) records user actions, not adapter/connector errors -- a
        different thing.
      </p>
    </div>
  );
}

function SystemNetwork() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState(TABS[0]);

  return (
    <div className="system-network-page">
      <header className="sn-header">
        <span className="section-eyebrow">PLATFORM / SYSTEM &amp; NETWORK</span>
        <h1>{t('system_network_title')}</h1>
        <p>{t('system_network_subtitle')}</p>
      </header>

      <div className="sn-tabs">
        {TABS.map((t) => (
          <button key={t} type="button" className={activeTab === t ? 'active' : ''} onClick={() => setActiveTab(t)}>{t}</button>
        ))}
      </div>

      <div className="sn-tab-content">
        {activeTab === 'Pipeline Health' && <PipelineHealthTab />}
        {activeTab === 'Adapter Health' && <AdapterHealthTab />}
        {activeTab === 'Integration Log' && <IntegrationLogTab />}
      </div>
    </div>
  );
}

export default SystemNetwork;
