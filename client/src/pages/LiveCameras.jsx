import React, { useEffect, useMemo, useState } from 'react';
import Hls from 'hls.js';
import StatusBadge from '../components/StatusBadge';
import HlsPlayer from '../components/HlsPlayer';
import api from '../api/client';
import { useLanguage } from '../i18n/LanguageContext';
import './LiveCameras.css';

// docs/frontend.md §5 flags this as the highest-priority stub to build after
// CameraRegistry/Dashboard/Investigation. Real camera list (api.getCameras()) and a
// real live AI-event feed (api.subscribeToLiveEvents(), the same SSE stream
// Dashboard.jsx's "Live AI Events" counter uses).
//
// Real HLS playback (2026-09-14): "Start Stream" calls the real
// POST /api/streams/{camera_id}/start, which spawns a real FFmpeg subprocess
// server-side transcoding the camera's real rtsp_url. This genuinely works given a
// camera with a configured rtsp_url and a server host with ffmpeg installed. Neither
// is guaranteed here: there's no reachable real ingest host from this environment
// (backend.md §12.7.1), and this sandbox's own server doesn't have ffmpeg on PATH
// (GET /api/health/'s ffmpeg_available flag) -- so a real, honest error is exactly
// what should happen when either is missing, not a fabricated "connected" state.

function CameraCard({ cam }) {
  const [streamState, setStreamState] = useState('idle'); // idle | starting | playing | error
  const [streamError, setStreamError] = useState('');
  const [hlsUrl, setHlsUrl] = useState('');

  const handleStart = async () => {
    setStreamState('starting');
    setStreamError('');
    try {
      const result = await api.startStream(cam.camera_uid);
      setHlsUrl(`${api.baseUrl}${result.hls_url}`);
      setStreamState('playing');
    } catch (err) {
      setStreamError(err.message);
      setStreamState('error');
    }
  };

  const handleStop = async () => {
    try {
      await api.stopStream(cam.camera_uid);
    } catch {
      // best-effort -- still reset the local UI state below
    }
    setStreamState('idle');
    setHlsUrl('');
  };

  return (
    <div className="live-camera-card">
      {streamState === 'playing' && hlsUrl ? (
        <HlsPlayer
          src={hlsUrl}
          onError={(msg) => {
            setStreamError(msg);
            setStreamState('error');
            // Real client-side error report (docs/backend.md §2's structured
            // error-reporting checklist item) -- best-effort, never blocks the UI
            // on its own failure.
            api.reportClientError({
              cameraUid: cam.camera_uid,
              clientName: 'browser-hls.js',
              clientVersion: Hls.version,
              errorType: 'PLAYBACK_ERROR',
              errorMessage: msg,
            }).catch(() => {});
          }}
        />
      ) : (
        <div className="live-camera-thumb">
          {streamState === 'starting' && <span>Starting stream…</span>}
          {streamState === 'error' && <span className="live-camera-thumb-error">Stream failed: {streamError}</span>}
          {streamState === 'idle' && <span>No live playback started</span>}
        </div>
      )}
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
        <div className="live-camera-actions">
          {streamState === 'playing' ? (
            <button type="button" onClick={handleStop} className="live-camera-btn stop">Stop</button>
          ) : (
            <button type="button" onClick={handleStart} disabled={streamState === 'starting'} className="live-camera-btn">
              {streamState === 'starting' ? 'Starting…' : streamState === 'error' ? 'Retry' : 'Start Stream'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function LiveCameras() {
  const { t } = useLanguage();
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
          <span className="section-eyebrow">CAMERA INTELLIGENCE / PIPELINE 2</span>
          <h1>{t('live_cameras_title')}</h1>
          <p>
            {loading ? 'Loading registry…' : `${filtered.length} of ${cameras.length} registered cameras`}
            {' '}· Protocol adapter boundary — live acquisition via real HLS/RTSP if backend &amp; FFmpeg configured.
          </p>
        </div>
      </header>

      <div className="live-cameras-layout">
        <div className="live-cameras-main">
          <div className="live-cameras-filters">
            <select aria-label="Filter by district" value={districtFilter} onChange={(e) => setDistrictFilter(e.target.value)}>
              <option value="ALL">All Districts</option>
              {districts.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <select aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="ALL">All Statuses</option>
              {['ACTIVE', 'INACTIVE', 'DEGRADED', 'OFFLINE'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select aria-label="Filter by protocol" value={protocolFilter} onChange={(e) => setProtocolFilter(e.target.value)}>
              <option value="ALL">All Protocols</option>
              {protocols.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div className="live-cameras-grid">
            {!loading && filtered.length === 0 && <p className="live-cameras-empty">No cameras match this filter.</p>}
            {filtered.map((cam) => <CameraCard key={cam.camera_uid} cam={cam} />)}
          </div>
        </div>

        <aside className="live-events-panel" aria-label="Live AI event feed">
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
