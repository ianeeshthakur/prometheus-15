import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../api/client';
import './Investigation.css';

// This page used to render 4 hardcoded incidents with a fabricated "nearest patrol
// officer" (name, badge ID, ETA), a fake predicted-next-location AI forecast, and a
// route drawn from invented lat/lng points -- none of it backed by anything the real
// backend tracks. docs/prd.md's graded live technical test is exactly this page's
// search -> alert -> investigation -> map-trace flow, so it has to run on real data:
// GET /api/alerts, POST /api/alerts/{uid}/investigation, and
// GET /api/investigations/{case_uid}/trace (server/intelligence/entity_graph.py's
// real cross-camera correlation). The officer-dispatch fantasy is dropped entirely
// (nothing backs it); the "AI forecast" playback slider is repurposed into stepping
// through the REAL chronological sightings the trace endpoint returns -- a real
// feature, not a fabricated one, using the same interaction pattern.

const sightingIcon = L.divIcon({
  className: 'investigation-vehicle-marker',
  html: '<span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 16l1.4-5h11.2l1.4 5"/><path d="M4 16h16v4H4z"/><path d="M7 11l1.4-3h7.2l1.4 3"/><circle cx="7" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/></svg></span>',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

const GUJARAT_CENTER = [22.2587, 71.1924];

function speakWithNaturalVoice(text, language) {
  if (!('speechSynthesis' in window) || !text) return;

  const languageCode = language === 'Gujarati' ? 'gu-IN' : language === 'Hindi' ? 'hi-IN' : 'en-IN';
  const voices = window.speechSynthesis.getVoices();
  const languagePrefix = languageCode.slice(0, 2).toLowerCase();
  const matchingVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith(languagePrefix));
  const preferredVoice = matchingVoices.find((voice) => /google|microsoft|samantha|alex|veena|rishi|lekha|natural|neural/i.test(voice.name))
    || matchingVoices.find((voice) => voice.lang.toLowerCase() === languageCode.toLowerCase())
    || matchingVoices[0];

  window.speechSynthesis.cancel();
  const voice = new SpeechSynthesisUtterance(text);
  voice.lang = languageCode;
  voice.rate = language === 'English' ? 0.92 : 0.82;
  voice.pitch = 1;
  voice.volume = 0.92;
  if (preferredVoice) voice.voice = preferredVoice;
  window.speechSynthesis.speak(voice);
}

/** Builds the spoken briefing from real alert/sighting fields -- no scripted fake
 * officer names or ETAs. */
function buildBriefing(alert, sightingCount, language) {
  if (!alert) return '';
  const entity = alert.entity;
  const camera = alert.camera_name || alert.camera_uid;
  if (language === 'Gujarati') {
    return `${entity} માટે ${alert.severity} ચેતવણી ${camera} પર ${alert.district} માં મળી. ${sightingCount} કેમેરા પર જોવા મળ્યું.`;
  }
  if (language === 'Hindi') {
    return `${entity} के लिए ${alert.severity} अलर्ट ${camera} पर ${alert.district} में मिला। ${sightingCount} कैमरों पर देखा गया।`;
  }
  return `${alert.severity} alert for ${entity}, detected at ${camera} in ${alert.district}. Correlated across ${sightingCount} camera${sightingCount === 1 ? '' : 's'}.`;
}

function RouteMapView({ sightings, playbackStep }) {
  const mapRef = useRef(null);
  const validSightings = sightings.filter((s) => typeof s.latitude === 'number' && typeof s.longitude === 'number');

  if (validSightings.length === 0) {
    return (
      <div className="route-map-empty">
        <p>
          {sightings.length === 0
            ? 'No cross-camera sightings correlated for this entity yet.'
            : 'Sightings exist but have no camera GPS coordinates to plot.'}
        </p>
      </div>
    );
  }

  const center = validSightings[Math.min(playbackStep, validSightings.length - 1)];
  const visible = validSightings.slice(0, playbackStep + 1);
  const positions = visible.map((s) => [s.latitude, s.longitude]);

  useEffect(() => {
    mapRef.current?.flyTo([center.latitude, center.longitude], 12, { duration: 0.8 });
  }, [playbackStep]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <MapContainer ref={mapRef} className="investigation-leaflet-map" center={[center.latitude, center.longitude]} zoom={11} scrollWheelZoom={false} zoomControl={true}>
      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {positions.length > 1 && <Polyline positions={positions} pathOptions={{ color: '#2781aa', weight: 4, opacity: 0.85 }} />}
      {visible.map((s, idx) => (
        <Marker key={`${s.camera_uid}-${idx}`} position={[s.latitude, s.longitude]} icon={sightingIcon}>
          <Tooltip permanent={idx === visible.length - 1} direction="top" offset={[0, -14]}>
            {s.camera_name} · {new Date(s.timestamp).toLocaleTimeString()}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}

function Investigation() {
  const [alerts, setAlerts] = useState([]);
  const [investigations, setInvestigations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUid, setSelectedUid] = useState(null);
  const [language, setLanguage] = useState('English');
  const [severityFilter, setSeverityFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [trace, setTrace] = useState(null);
  const [traceLoading, setTraceLoading] = useState(false);
  const [playbackStep, setPlaybackStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [openingCase, setOpeningCase] = useState(false);
  const [actionError, setActionError] = useState('');

  const loadAll = () => {
    setLoading(true);
    Promise.all([api.getAlerts(), api.getInvestigations()])
      .then(([alertData, invData]) => {
        setAlerts(Array.isArray(alertData) ? alertData : []);
        setInvestigations(Array.isArray(invData) ? invData : []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAll();
  }, []);

  const selectedAlert = alerts.find((a) => a.alert_uid === selectedUid) || null;
  const linkedInvestigation = selectedAlert?.investigation_id
    ? investigations.find((i) => i.id === selectedAlert.investigation_id)
    : null;

  // Load the real map trace whenever the selected alert's linked investigation changes.
  useEffect(() => {
    setPlaybackStep(0);
    setIsPlaying(false);
    if (!linkedInvestigation) {
      setTrace(null);
      return;
    }
    setTraceLoading(true);
    api
      .getInvestigationTrace(linkedInvestigation.case_uid, linkedInvestigation.entity)
      .then((data) => setTrace(data))
      .finally(() => setTraceLoading(false));
  }, [linkedInvestigation?.case_uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const sightings = trace?.sightings || [];

  useEffect(() => {
    if (!isPlaying || sightings.length === 0) return undefined;
    const timer = window.setInterval(() => {
      setPlaybackStep((step) => (step >= sightings.length - 1 ? 0 : step + 1));
    }, 1400);
    return () => window.clearInterval(timer);
  }, [isPlaying, sightings.length]);

  const filteredAlerts = alerts.filter((a) => {
    const matchesSeverity = severityFilter === 'All' || a.severity === severityFilter;
    const query = search.toLowerCase();
    const haystack = `${a.entity} ${a.camera_name || ''} ${a.district} ${a.alert_uid}`.toLowerCase();
    return matchesSeverity && (!query || haystack.includes(query));
  });

  const handleAcknowledge = async () => {
    if (!selectedAlert) return;
    setActionError('');
    try {
      await api.updateAlertStatus(selectedAlert.alert_uid, 'ACKNOWLEDGED');
      loadAll();
    } catch (err) {
      setActionError(err.message || 'Failed to acknowledge alert.');
    }
  };

  const handleOpenInvestigation = async () => {
    if (!selectedAlert) return;
    setOpeningCase(true);
    setActionError('');
    try {
      await api.createInvestigationFromAlert(selectedAlert.alert_uid);
      loadAll();
    } catch (err) {
      setActionError(err.message || 'Failed to open investigation.');
    } finally {
      setOpeningCase(false);
    }
  };

  const speakBriefing = () => {
    speakWithNaturalVoice(buildBriefing(selectedAlert, sightings.length, language), language);
  };

  return (
    <div className="investigation-page">
      <header className="investigation-header">
        <div>
          <span className="section-eyebrow">GUJARAT COMMAND NETWORK / LIVE RESPONSE</span>
          <h1>Incidents & Alerts</h1>
          <p>Triage alerts, open investigations, and trace an entity across cameras.</p>
        </div>
        <div className="response-status"><span />{loading ? 'Loading…' : `${filteredAlerts.length} shown`}</div>
      </header>

      <section className="incident-layout">
        <div className="incident-main">
          <div className="incident-tabs">
            <strong>Alert triage</strong><span className="incident-count">{alerts.length} total</span>
            <div className="severity-filters">
              {['All', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'].map((item) => (
                <button key={item} type="button" className={severityFilter === item ? 'active' : ''} onClick={() => setSeverityFilter(item)}>
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="map-tools">
            <label className="alert-search">
              <span>⌕</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search plate, camera, district..." />
            </label>
          </div>

          <div className="incident-list">
            {filteredAlerts.length === 0 && !loading && (
              <p style={{ padding: '16px', color: '#8294a3', fontSize: '0.8rem' }}>No alerts match this filter.</p>
            )}
            {filteredAlerts.map((item) => (
              <button
                key={item.alert_uid}
                type="button"
                className={`incident-row ${selectedUid === item.alert_uid ? 'selected' : ''}`}
                onClick={() => setSelectedUid(item.alert_uid)}
              >
                <span className={`severity-dot ${item.severity.toLowerCase()}`} />
                <span className="incident-row-copy">
                  <strong>{item.entity}</strong>
                  <small>{item.type.replace(/_/g, ' ')} · {item.camera_name || item.camera_uid}</small>
                </span>
                <span className="incident-row-meta">
                  <strong>{item.severity}</strong>
                  <small>{item.status}</small>
                </span>
                <span className="row-arrow">→</span>
              </button>
            ))}
          </div>

          <div className="route-map" aria-label="Entity cross-camera map trace">
            <div className="map-region-label">MAP TRACE {linkedInvestigation ? `· ${linkedInvestigation.case_uid}` : ''}</div>
            {!selectedAlert && <div className="route-map-empty"><p>Select an alert to view its trace.</p></div>}
            {selectedAlert && !linkedInvestigation && (
              <div className="route-map-empty">
                <p>No investigation open for this entity yet. Open one to correlate its cross-camera trace.</p>
              </div>
            )}
            {selectedAlert && linkedInvestigation && traceLoading && <div className="route-map-empty"><p>Loading trace…</p></div>}
            {selectedAlert && linkedInvestigation && !traceLoading && <RouteMapView sightings={sightings} playbackStep={playbackStep} />}
            <div className="route-legend"><span><i className="legend-route" />Observed route</span></div>
          </div>
        </div>

        <aside className="incident-detail">
          {!selectedAlert && (
            <div>
              <h2>No alert selected</h2>
              <p className="detail-subtitle">Choose an alert from the list to see its detail and open an investigation.</p>
            </div>
          )}

          {selectedAlert && (
            <>
              <div className="detail-topline"><span className="critical-label">● {selectedAlert.severity}</span><span>{selectedAlert.alert_uid}</span></div>
              <h2>{selectedAlert.type.replace(/_/g, ' ')}</h2>
              <p className="detail-subtitle">{selectedAlert.description}</p>
              <div className="vehicle-identity">
                <div className="vehicle-icon car"><span>▰</span></div>
                <div><strong>{selectedAlert.entity}</strong><span>{selectedAlert.camera_name || selectedAlert.camera_uid} · {selectedAlert.district}</span></div>
                <b>{(selectedAlert.confidence * 100).toFixed(1)}%</b>
              </div>
              <dl className="detail-facts">
                <div><dt>Status</dt><dd>{selectedAlert.status}</dd></div>
                <div><dt>Created</dt><dd>{new Date(selectedAlert.created_at).toLocaleString()}</dd></div>
                <div><dt>Camera</dt><dd>{selectedAlert.camera_uid}</dd></div>
              </dl>

              {linkedInvestigation && sightings.length > 0 && (
                <div className="prediction-lens">
                  <div className="prediction-heading"><span><i />Trace playback</span><strong>{sightings.length} sightings</strong></div>
                  <p>Currently at: <b>{sightings[Math.min(playbackStep, sightings.length - 1)]?.camera_name}</b></p>
                  <label htmlFor="trace-progress"><span>Sighting</span><span>{playbackStep + 1} of {sightings.length}</span></label>
                  <input
                    id="trace-progress"
                    type="range"
                    min="0"
                    max={Math.max(sightings.length - 1, 0)}
                    value={playbackStep}
                    onChange={(event) => setPlaybackStep(Number(event.target.value))}
                  />
                  <button type="button" className={`playback-button ${isPlaying ? 'playing' : ''}`} onClick={() => setIsPlaying((p) => !p)}>
                    {isPlaying ? 'Pause playback' : 'Play trace playback'} <span>{isPlaying ? 'Ⅱ' : '▶'}</span>
                  </button>
                </div>
              )}

              <div className="briefing-language">
                <span>Briefing language</span>
                {['English', 'Hindi', 'Gujarati'].map((item) => (
                  <button key={item} type="button" className={language === item ? 'active' : ''} onClick={() => setLanguage(item)}>{item}</button>
                ))}
                <button type="button" onClick={speakBriefing} style={{ marginLeft: 'auto' }}>🔊 Speak</button>
              </div>

              <div className="dispatch-actions">
                {!linkedInvestigation ? (
                  <button type="button" className="assign-ticket" onClick={handleOpenInvestigation} disabled={openingCase}>
                    {openingCase ? 'Opening…' : 'Open investigation'}<span>→</span>
                  </button>
                ) : (
                  <button type="button" className="assign-ticket assigned" disabled>
                    ✓ Investigation open ({linkedInvestigation.status})
                  </button>
                )}
                <button
                  type="button"
                  className={`secondary-action ${selectedAlert.status === 'ACKNOWLEDGED' ? 'done' : ''}`}
                  onClick={handleAcknowledge}
                  disabled={selectedAlert.status !== 'NEW'}
                >
                  {selectedAlert.status === 'ACKNOWLEDGED' || selectedAlert.status === 'ESCALATED' || selectedAlert.status === 'RESOLVED'
                    ? `✓ ${selectedAlert.status}`
                    : 'Acknowledge alert'}
                </button>
              </div>
              {actionError && <p style={{ color: '#c62828', fontSize: '0.75rem', marginTop: 8 }}>{actionError}</p>}
              <p className="human-note">Officer confirmation is required before any field action.</p>
            </>
          )}
        </aside>
      </section>
    </div>
  );
}

export default Investigation;
