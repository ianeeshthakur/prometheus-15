import React, { useEffect, useMemo, useState } from 'react';
import StatusBadge from '../components/StatusBadge';
import api from '../api/client';
import './LiveCameras.css';

// docs/frontend.md §5 flags this as the highest-priority stub to build after
// CameraRegistry/Dashboard/Investigation. Real camera list (api.getCameras()) and a
// real live AI-event feed (api.subscribeToLiveEvents(), the same SSE stream
// Dashboard.jsx's "Live AI Events" counter uses). No fake video player: there is no
// reachable real ingest host to play from in this environment (docs/backend.md
// §12.7.1), so each card is honest about that instead of showing a placeholder that
// looks like it might be live.

function LiveCameras() {
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [districtFilter, setDistrictFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [protocolFilter, setProtocolFilter] = useState('ALL');
  const [events, setEvents] = useState([]);

  useEffect(() => {
    api
      .getCameras()
      .then((data) => setCameras(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));

    const source = api.subscribeToLiveEvents(
      (evt) => setEvents((prev) => [{ ...evt, _receivedAt: new Date().toISOString() }, ...prev].slice(0, 30)),
      () => source.close()
    );
    return () => source.close();
  }, []);

  const districts = useMemo(() => [...new Set(cameras.map((c) => c.district).filter(Boolean))].sort(), [cameras]);
  const protocols = useMemo(() => [...new Set(cameras.map((c) => c.protocol_type).filter(Boolean))].sort(), [cameras]);

  const filtered = cameras.filter((c) => {
    return (
      (districtFilter === 'ALL' || c.district === districtFilter) &&
      (statusFilter === 'ALL' || c.status === statusFilter) &&
      (protocolFilter === 'ALL' || c.protocol_type === protocolFilter)
    );
  });

  return (
    <div className="live-cameras-page">
      <header className="live-cameras-header">
        <div>
          <span className="section-eyebrow">MONITOR / LIVE CAMERAS</span>
          <h1>Live Cameras</h1>
          <p>{loading ? 'Loading registry…' : `${filtered.length} of ${cameras.length} registered cameras`}</p>
        </div>
      </header>

      <div className="live-cameras-layout">
        <div className="live-cameras-main">
          <div className="live-cameras-filters">
            <select value={districtFilter} onChange={(e) => setDistrictFilter(e.target.value)}>
              <option value="ALL">All Districts</option>
              {districts.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="ALL">All Statuses</option>
              {['ACTIVE', 'INACTIVE', 'DEGRADED', 'OFFLINE'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={protocolFilter} onChange={(e) => setProtocolFilter(e.target.value)}>
              <option value="ALL">All Protocols</option>
              {protocols.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div className="live-cameras-grid">
            {!loading && filtered.length === 0 && <p className="live-cameras-empty">No cameras match this filter.</p>}
            {filtered.map((cam) => (
              <div key={cam.camera_uid} className="live-camera-card">
                <div className="live-camera-thumb">
                  <span>No live playback in this environment</span>
                </div>
                <div className="live-camera-meta">
                  <div className="live-camera-title-row">
                    <span className="live-camera-id">{cam.camera_uid}</span>
                    <StatusBadge status={cam.status} size="sm" />
                  </div>
                  <span className="live-camera-name">{cam.name}</span>
                  <span className="live-camera-location">{cam.location} · {cam.district}</span>
                  <div className="live-camera-tags">
                    <span className="live-camera-tag">{cam.protocol_type}</span>
                    {cam.ai_enabled && <span className="live-camera-tag ai">{cam.ai_profile || 'AI'}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="live-events-panel">
          <div className="live-events-header">
            <h2>Live AI Event Feed</h2>
            <span className="live-events-count">{events.length}</span>
          </div>
          {events.length === 0 && <p className="live-cameras-empty">No live events received yet.</p>}
          <div className="live-events-list">
            {events.map((evt, idx) => (
              <div key={idx} className="live-event-row">
                <span className={`live-event-type ${evt.type || ''}`}>{evt.type || 'event'}</span>
                <span className="live-event-detail">
                  {evt.data?.camera_uid || evt.data?.camera_name || ''} {evt.data?.plate_number || evt.data?.entity || ''}
                </span>
                <span className="live-event-time">{new Date(evt._receivedAt).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default LiveCameras;
