import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, LayersControl, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DEPARTMENT_COLORS, STATUS_COLORS, DISTRICT_CENTERS } from '../data/cameras';
import api from '../api/client';
import './CameraMap.css';

// Rewired 2026-09-14 (docs/frontend.md §5.1) to real api.getCameras() data instead of
// data/cameras.js's hardcoded CAMERAS array -- this used to show a fixed "48 Nodes
// Online / 77.1% Coverage" regardless of what was actually registered, visibly
// contradicting the real "0 cameras" shown right next to it on Dashboard.jsx once
// that page was fixed. DISTRICT_CENTERS/DEPARTMENT_COLORS/STATUS_COLORS are kept from
// data/cameras.js -- those are real geographic/color reference constants, not
// fabricated camera records.
//
// Real cameras don't carry `zone`/`resolution`/`fps` (no such columns on the backend,
// server/schemas/camera.py) or an "alert" status (real CameraStatus is
// ACTIVE/INACTIVE/DEGRADED/OFFLINE) -- the per-camera drawer below was rewritten to
// show only real fields, and the fabricated "LIVE FEED" video HUD with a fake AI
// bounding box + fake license plate ("VEHICLE [GJ-05-AB-7104] 98%") was replaced with
// an honest placeholder, matching LiveCameras.jsx's established pattern. The
// "Copy RTSP" button was removed entirely: `rtsp_url` is never exposed to the
// frontend on purpose (security -- CameraResponse omits it, core/security.py), so
// there was never a real URL to copy, only a fabricated one
// ("rtsp://stream.gvista.gujarat.gov.in:554/..." -- that host doesn't exist).

/** Real CameraStatus values (server/schemas/camera.py) don't include "alert" -- maps
 * DEGRADED to the same visual treatment the old fake "alert" status used (amber/red
 * pulse), since both mean "needs attention", while keeping ACTIVE/OFFLINE distinct.
 * INACTIVE (an intentionally disabled camera, not a fault) renders like OFFLINE. */
function mapRealStatus(status) {
  const s = (status || 'ACTIVE').toUpperCase();
  if (s === 'DEGRADED') return 'alert';
  if (s === 'OFFLINE' || s === 'INACTIVE') return 'offline';
  return 'active';
}

/** Adapts a real api.getCameras() row into the shape this component's markup already
 * expects (id/lat/lng/status), so the marker/popup/drawer JSX below didn't need a
 * field-by-field rewrite -- while `realStatus` keeps the actual backend value
 * (ACTIVE/DEGRADED/OFFLINE/INACTIVE) for honest display text, separate from the
 * lowercase `status` used only for CSS/icon matching. */
function normalizeCamera(apiCam) {
  return {
    id: apiCam.camera_uid,
    name: apiCam.name,
    lat: apiCam.latitude,
    lng: apiCam.longitude,
    status: mapRealStatus(apiCam.status),
    realStatus: apiCam.status,
    department: apiCam.department,
    district: apiCam.district,
    protocolType: apiCam.protocol_type,
    aiProfile: apiCam.ai_profile,
    aiEnabled: apiCam.ai_enabled,
    onboardingSource: apiCam.onboarding_source,
  };
}

// Fix Leaflet default icon path issues in bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Cache for Leaflet divIcons to prevent constant DOM recreation on re-renders
const iconCache = new Map();

function getCameraIcon(camera) {
  const statusKey = (camera.status || 'active').toLowerCase();
  const cacheKey = `${camera.id}-${camera.department}-${statusKey}`;
  if (iconCache.has(cacheKey)) {
    return iconCache.get(cacheKey);
  }

  const deptColor = DEPARTMENT_COLORS[camera.department] || '#0284c7';
  const isAlert = statusKey === 'alert';
  const isOffline = statusKey === 'offline';

  const html = `
    <div class="camera-marker-pin ${isAlert ? 'marker-alert' : ''} ${isOffline ? 'marker-offline' : ''}" style="--marker-color: ${deptColor}">
      <div class="marker-bubble">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M23 7l-7 5 7 5V7z" />
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
        </svg>
      </div>
      <div class="marker-stem"></div>
      ${isAlert ? '<div class="marker-alert-pulse"></div>' : ''}
      ${isOffline ? '<div class="marker-offline-pulse"></div>' : ''}
    </div>
  `;

  const icon = L.divIcon({
    className: 'custom-leaflet-marker',
    html,
    iconSize: [30, 36],
    iconAnchor: [15, 36],
    popupAnchor: [0, -36],
  });

  iconCache.set(cacheKey, icon);
  return icon;
}

// Procedural Web Audio API sound effects for Expand and Collapse
function playExpandSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(680, ctx.currentTime + 0.22);

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) {
    // AudioContext blocked or not supported
  }
}

function playCollapseSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(580, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(280, ctx.currentTime + 0.22);

    gain.gain.setValueAtTime(0.07, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) {
    // AudioContext blocked or not supported
  }
}

// district is a required field on every real camera (CameraCreate, server/schemas/
// camera.py) -- no inference needed, unlike the old mock data's ID-prefix guessing.
function getCameraDistrict(cam) {
  return cam.district || 'Unknown';
}

// Helper component to listen to clicks on the map background
function MapClickHandler({ isFullscreen, isDrawerOpen, onExpand }) {
  useMapEvents({
    click: () => {
      // Only auto-expand if neither fullscreen nor drawer is currently open
      if (!isFullscreen && !isDrawerOpen && onExpand) {
        onExpand();
      }
    },
  });
  return null;
}

// Helper component to trigger map.invalidateSize() when fullscreen changes
function MapResizeHandler({ isFullscreen }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 420);
    return () => clearTimeout(timer);
  }, [isFullscreen, map]);
  return null;
}

// Helper component to fly to new district center or camera focus coordinates
function MapViewController({ center, zoom, flyTarget }) {
  const map = useMap();
  const initialMount = useRef(true);

  // Smooth fly animation on district selection changes
  useEffect(() => {
    if (initialMount.current) {
      initialMount.current = false;
      return;
    }
    if (center && map) {
      try {
        map.flyTo(center, zoom, {
          duration: 1.15,
          easeLinearity: 0.25,
        });
      } catch {
        map.setView(center, zoom);
      }
    }
  }, [center, zoom, map]);

  // High-zoom pin-point fly when a camera is targeted for inspection
  useEffect(() => {
    if (flyTarget && map) {
      try {
        map.flyTo([flyTarget.lat, flyTarget.lng], 16, {
          duration: 1.25,
          easeLinearity: 0.2,
        });
      } catch {
        map.setView([flyTarget.lat, flyTarget.lng], 16);
      }
    }
  }, [flyTarget, map]);

  return null;
}

const CameraMap = React.memo(function CameraMap() {
  const [cameras, setCameras] = useState([]);
  const [camerasLoading, setCamerasLoading] = useState(true);
  const [selectedDistrict, setSelectedDistrict] = useState('All');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [cameraFlyTarget, setCameraFlyTarget] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [checkingHealth, setCheckingHealth] = useState(false);

  useEffect(() => {
    api
      .getCameras()
      .then((data) => {
        const rows = Array.isArray(data) ? data : [];
        setCameras(rows.filter((c) => c.latitude != null && c.longitude != null).map(normalizeCamera));
      })
      .finally(() => setCamerasLoading(false));
  }, []);

  const handleExpand = useCallback(() => {
    if (!isFullscreen) {
      setIsFullscreen(true);
      playExpandSound();
    }
  }, [isFullscreen]);

  const handleCollapse = useCallback(() => {
    if (isFullscreen) {
      setIsFullscreen(false);
      playCollapseSound();
    }
  }, [isFullscreen]);

  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 2800);
  }, []);

  // Keyboard navigation: Escape closes drawer or exits fullscreen
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isDrawerOpen) {
          setIsDrawerOpen(false);
        } else if (isFullscreen) {
          handleCollapse();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawerOpen, isFullscreen, handleCollapse]);

  // Sibling cameras in current district for switcher
  const districtCameras = useMemo(() => {
    if (selectedDistrict === 'All') return cameras;
    return cameras.filter((cam) => {
      const dist = getCameraDistrict(cam);
      return dist.toLowerCase() === selectedDistrict.toLowerCase();
    });
  }, [cameras, selectedDistrict]);

  // Filtered cameras by both district and department
  const filteredCameras = useMemo(() => {
    return districtCameras.filter((cam) => {
      const matchDept = selectedDept === 'ALL' || cam.department === selectedDept;
      return matchDept;
    });
  }, [districtCameras, selectedDept]);

  // Available unique departments across the real, registered fleet.
  const availableDepartments = useMemo(() => {
    const depts = new Set();
    cameras.forEach((c) => {
      if (c.department) depts.add(c.department);
    });
    return Array.from(depts);
  }, [cameras]);

  // Automatically keep selectedCamera valid
  useEffect(() => {
    if (!selectedCamera && filteredCameras.length > 0) {
      setSelectedCamera(filteredCameras[0]);
    }
  }, [selectedCamera, filteredCameras]);

  const activeCount = filteredCameras.filter((c) => c.status === 'active').length;
  const alertCount = filteredCameras.filter((c) => c.status === 'alert').length;
  const offlineCount = filteredCameras.filter((c) => c.status === 'offline').length;
  const coveragePct = filteredCameras.length > 0
    ? ((activeCount / filteredCameras.length) * 100).toFixed(1)
    : '0.0';

  const activeDistrictInfo = DISTRICT_CENTERS[selectedDistrict] || DISTRICT_CENTERS.All;

  return (
    <div className={`camera-map-card ${isFullscreen ? 'is-fullscreen' : ''}`}>
      {/* Scoped styles for Camera Detail Drawer & Micro-UI enhancements */}
      <style>{`
        /* Camera Detail Drawer */
        .cam-detail-drawer {
          position: absolute;
          top: 0;
          right: 0;
          bottom: 0;
          width: 420px;
          max-width: 95vw;
          background-color: var(--bg-primary, #ffffff);
          border-left: 1px solid var(--border-color, #e2e8f0);
          box-shadow: -8px 0 30px rgba(0, 0, 0, 0.16);
          z-index: 1000;
          display: flex;
          flex-direction: column;
          transform: translateX(100%);
          transition: transform 0.32s cubic-bezier(0.16, 1, 0.3, 1);
          pointer-events: none;
          overflow: hidden;
        }

        .cam-detail-drawer.is-open {
          transform: translateX(0);
          pointer-events: auto;
        }

        .cam-drawer-header {
          padding: 14px 18px;
          border-bottom: 1px solid var(--border-color, #e2e8f0);
          background-color: var(--bg-secondary, #f8fafc);
          display: flex;
          flex-direction: column;
          gap: 8px;
          position: relative;
        }

        .cam-drawer-top-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .cam-drawer-category {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.68rem;
          font-weight: 700;
          color: var(--accent, #0284c7);
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .cam-drawer-close-btn {
          background: transparent;
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 6px;
          color: var(--text-secondary, #64748b);
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
        }

        .cam-drawer-close-btn:hover {
          background-color: #fee2e2;
          color: #dc2626;
          border-color: #fca5a5;
        }

        .cam-drawer-title-box {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .cam-drawer-title {
          font-size: 1.05rem;
          font-weight: 700;
          color: var(--text-primary, #0f172a);
          margin: 0;
          line-height: 1.3;
        }

        .cam-drawer-meta-badges {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
          margin-top: 4px;
        }

        .cam-badge-id {
          font-size: 0.72rem;
          font-weight: 700;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          background-color: var(--bg-primary, #ffffff);
          border: 1px solid var(--border-color, #e2e8f0);
          padding: 2px 7px;
          border-radius: 4px;
          color: var(--text-secondary, #475569);
        }

        .cam-badge-status {
          font-size: 0.68rem;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 12px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .cam-badge-status.active {
          background-color: rgba(22, 163, 74, 0.12);
          color: #16a34a;
        }

        .cam-badge-status.alert {
          background-color: rgba(220, 38, 38, 0.12);
          color: #dc2626;
        }

        .cam-badge-status.offline {
          background-color: rgba(148, 163, 184, 0.16);
          color: #64748b;
        }

        .cam-badge-dept {
          font-size: 0.68rem;
          font-weight: 700;
          color: #ffffff;
          padding: 2px 8px;
          border-radius: 4px;
        }

        /* Drawer Body Scroll Area */
        .cam-drawer-body {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        /* Video Player Simulation */
        .cam-video-viewport {
          position: relative;
          aspect-ratio: 16 / 9;
          background-color: #090d16;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.8), 0 4px 12px rgba(0, 0, 0, 0.15);
          border: 1px solid #1e293b;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 10px;
        }

        .cam-video-viewport-empty {
          align-items: center;
          justify-content: center;
          gap: 6px;
          text-align: center;
        }

        .cam-video-empty-label {
          color: #94a3b8;
          font-size: 0.8rem;
          font-weight: 600;
          z-index: 1;
        }

        .cam-video-empty-sub {
          color: #64748b;
          font-size: 0.68rem;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          z-index: 1;
        }

        .cam-video-grid-pattern {
          position: absolute;
          inset: 0;
          background-image: linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
          background-size: 20px 20px;
          pointer-events: none;
        }

        .cam-video-reticle {
          position: absolute;
          inset: 12px;
          border: 1px dashed rgba(2, 132, 199, 0.25);
          pointer-events: none;
        }

        .cam-video-reticle::before,
        .cam-video-reticle::after {
          content: '';
          position: absolute;
          width: 10px;
          height: 10px;
          border-color: #38bdf8;
          pointer-events: none;
        }
        .cam-video-reticle::before {
          top: -1px;
          left: -1px;
          border-top: 2px solid;
          border-left: 2px solid;
        }
        .cam-video-reticle::after {
          bottom: -1px;
          right: -1px;
          border-bottom: 2px solid;
          border-right: 2px solid;
        }

        /* Simulated AI Bounding Box */
        .cam-ai-bbox {
          position: absolute;
          top: 24%;
          left: 30%;
          width: 40%;
          height: 48%;
          border: 1.5px solid #0284c7;
          background: rgba(2, 132, 199, 0.06);
          pointer-events: none;
          border-radius: 2px;
        }

        .cam-ai-bbox.alert-bbox {
          border-color: #ef4444;
          background: rgba(239, 68, 68, 0.08);
        }

        .cam-ai-bbox-tag {
          position: absolute;
          top: -18px;
          left: -1px;
          background-color: #0284c7;
          color: #ffffff;
          font-size: 0.62rem;
          font-weight: 700;
          padding: 1px 5px;
          border-radius: 2px;
          letter-spacing: 0.03em;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }

        .cam-ai-bbox.alert-bbox .cam-ai-bbox-tag {
          background-color: #ef4444;
        }

        .cam-video-top-hud {
          display: flex;
          align-items: center;
          justify-content: space-between;
          z-index: 2;
          font-size: 0.68rem;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }

        .cam-live-indicator {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: rgba(0, 0, 0, 0.55);
          padding: 2px 7px;
          border-radius: 4px;
          color: #ffffff;
          font-weight: 700;
        }

        .cam-rec-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background-color: #ef4444;
          animation: pulseRed 1.2s infinite;
        }

        @keyframes pulseRed {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(0.85); }
          100% { opacity: 1; transform: scale(1); }
        }

        .cam-res-tag {
          background: rgba(0, 0, 0, 0.55);
          color: #38bdf8;
          padding: 2px 7px;
          border-radius: 4px;
          font-weight: 700;
        }

        .cam-video-bottom-hud {
          display: flex;
          align-items: center;
          justify-content: space-between;
          z-index: 2;
          font-size: 0.64rem;
          color: #94a3b8;
          background: rgba(0, 0, 0, 0.65);
          backdrop-filter: blur(4px);
          padding: 3px 8px;
          border-radius: 4px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }

        /* Video Controls Toolbar */
        .cam-video-controls {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .cam-tool-btn {
          flex: 1;
          background-color: var(--bg-secondary, #f8fafc);
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 6px;
          padding: 6px 10px;
          font-size: 0.74rem;
          font-weight: 600;
          color: var(--text-primary, #0f172a);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .cam-tool-btn:hover {
          background-color: var(--accent, #0284c7);
          color: #ffffff;
          border-color: var(--accent, #0284c7);
        }

        .cam-tool-btn.primary {
          background-color: var(--accent, #0284c7);
          color: #ffffff;
          border-color: var(--accent, #0284c7);
        }

        .cam-tool-btn.primary:hover {
          opacity: 0.9;
        }

        /* Telemetry Grid */
        .cam-telemetry-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .cam-section-title {
          font-size: 0.76rem;
          font-weight: 700;
          color: var(--text-secondary, #64748b);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin: 0;
        }

        .cam-telemetry-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .cam-telemetry-tile {
          background-color: var(--bg-secondary, #f8fafc);
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 6px;
          padding: 8px 10px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .cam-tile-label {
          font-size: 0.68rem;
          color: var(--text-secondary, #64748b);
          text-transform: uppercase;
          letter-spacing: 0.03em;
          font-weight: 600;
        }

        .cam-tile-value {
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--text-primary, #0f172a);
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }

        /* Incident / Status Alert Banner */
        .cam-status-banner {
          border-radius: 8px;
          padding: 10px 14px;
          font-size: 0.78rem;
          display: flex;
          flex-direction: column;
          gap: 3px;
          border: 1px solid;
        }

        .cam-status-banner.alert {
          background-color: rgba(220, 38, 38, 0.08);
          border-color: rgba(220, 38, 38, 0.25);
          color: #991b1b;
        }

        .cam-status-banner.active {
          background-color: rgba(22, 163, 74, 0.08);
          border-color: rgba(22, 163, 74, 0.25);
          color: #166534;
        }

        .cam-status-banner.offline {
          background-color: rgba(148, 163, 184, 0.12);
          border-color: rgba(148, 163, 184, 0.3);
          color: #475569;
        }

        .cam-banner-heading {
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        /* Sibling Node Selector */
        .cam-sibling-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
          border-top: 1px solid var(--border-color, #e2e8f0);
          padding-top: 14px;
        }

        .cam-sibling-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
          max-height: 180px;
          overflow-y: auto;
          padding-right: 4px;
        }

        .cam-sibling-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 10px;
          background-color: var(--bg-secondary, #f8fafc);
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
          font-size: 0.76rem;
          text-align: left;
        }

        .cam-sibling-card:hover {
          background-color: var(--bg-primary, #ffffff);
          border-color: var(--accent, #0284c7);
        }

        .cam-sibling-card.active {
          border-color: var(--accent, #0284c7);
          background-color: rgba(2, 132, 199, 0.06);
        }

        .cam-sibling-info {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .cam-sibling-id {
          font-weight: 700;
          color: var(--text-primary, #0f172a);
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }

        .cam-sibling-name {
          color: var(--text-secondary, #64748b);
          font-size: 0.7rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 240px;
        }

        /* Mini Toast inside Drawer */
        .cam-drawer-toast {
          position: absolute;
          bottom: 16px;
          left: 16px;
          right: 16px;
          background-color: #0f172a;
          color: #f8fafc;
          padding: 8px 14px;
          border-radius: 6px;
          font-size: 0.76rem;
          font-weight: 600;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
          display: flex;
          align-items: center;
          justify-content: space-between;
          animation: toastFadeIn 0.25s ease-out;
          z-index: 1010;
        }

        @keyframes toastFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Map Header with Filters, District Selector & Actions */}
      <div className="camera-map-header">
        <div className="map-header-left">
          <div className="map-title-row">
            <h2 className="map-card-title">Surveillance GIS Matrix</h2>
            <span className="statewide-pill">STATEWIDE GUJARAT</span>
            {isFullscreen && (
              <span className="fullscreen-active-badge">FULLSCREEN COMMAND MODE</span>
            )}
          </div>
          <p className="map-card-subtitle">
            {camerasLoading
              ? 'Loading registry…'
              : selectedDistrict === 'All'
              ? `Gujarat Statewide Multi-District GIS Grid · ${cameras.length} Registered Node${cameras.length === 1 ? '' : 's'}`
              : `${activeDistrictInfo.name} Command & Telemetry Grid · ${districtCameras.length} Node${districtCameras.length === 1 ? '' : 's'}`}
          </p>
        </div>

        <div className="map-header-center">
          {/* District Selector Chips */}
          <div className="district-filter-row">
            <span className="filter-label">District:</span>
            {Object.keys(DISTRICT_CENTERS).map((dist) => {
              const isActive = selectedDistrict === dist;
              return (
                <button
                  key={dist}
                  type="button"
                  className={`filter-chip district-chip ${isActive ? 'active' : ''}`}
                  onClick={() => setSelectedDistrict(dist)}
                >
                  {dist === 'All' ? 'All Gujarat' : dist}
                </button>
              );
            })}
          </div>

          {/* Department Filter Chips */}
          <div className="map-header-filters">
            <span className="filter-label">Dept:</span>
            <button
              type="button"
              className={`filter-chip ${selectedDept === 'ALL' ? 'active' : ''}`}
              onClick={() => setSelectedDept('ALL')}
            >
              All ({districtCameras.length})
            </button>
            {availableDepartments.map((dept) => {
              const count = districtCameras.filter((c) => c.department === dept).length;
              if (count === 0 && selectedDistrict !== 'All') return null;
              return (
                <button
                  key={dept}
                  type="button"
                  className={`filter-chip ${selectedDept === dept ? 'active' : ''}`}
                  onClick={() => setSelectedDept(dept)}
                >
                  {dept} {count > 0 ? `(${count})` : ''}
                </button>
              );
            })}
          </div>
        </div>

        <div className="map-header-actions">
          {/* Toggle Camera Detail Drawer Button */}
          <button
            type="button"
            className={`map-expand-btn ${isDrawerOpen ? 'active-fullscreen' : ''}`}
            onClick={() => {
              if (!isDrawerOpen && !selectedCamera && filteredCameras.length > 0) {
                setSelectedCamera(filteredCameras[0]);
              }
              setIsDrawerOpen(!isDrawerOpen);
            }}
            title={isDrawerOpen ? 'Close Telemetry Drawer' : 'Open Camera Telemetry Drawer'}
            aria-label="Toggle Camera Drawer"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <span>{isDrawerOpen ? 'Close Drawer' : 'Camera Feed Drawer'}</span>
          </button>

          {/* Fullscreen Expand / Close Button */}
          <button
            type="button"
            className={`map-expand-btn ${isFullscreen ? 'active-fullscreen' : ''}`}
            onClick={isFullscreen ? handleCollapse : handleExpand}
            title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Expand Map Fullscreen'}
            aria-label={isFullscreen ? 'Exit Fullscreen' : 'Expand Map Fullscreen'}
          >
            {isFullscreen ? (
              <>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                <span>Close (Esc)</span>
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 3 21 3 21 9" />
                  <polyline points="9 21 3 21 3 15" />
                  <line x1="21" y1="3" x2="14" y2="10" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
                <span>Expand</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Interactive Leaflet Map Container Wrapper */}
      <div className={`leaflet-map-wrapper ${!isFullscreen ? 'clickable-canvas' : ''}`}>
        {/* Laser scanline beam sweeping down once on load */}
        <div className="map-scan-beam" />

        {/* Floating Stats Mini-Overlay on Top-Left */}
        <div className="map-floating-stats-overlay">
          <div className="floating-overlay-header">
            <span className="floating-overlay-title">Coverage Telemetry</span>
            <span className="floating-overlay-live">
              <span className="floating-overlay-pulse" />
              ONLINE
            </span>
          </div>
          <div className="floating-stat-row">
            <span className="floating-stat-label">Jurisdiction</span>
            <span className="floating-stat-value" style={{ fontSize: '0.74rem' }}>
              {selectedDistrict === 'All' ? `Statewide (${Object.keys(DISTRICT_CENTERS).length - 1} Districts)` : selectedDistrict}
            </span>
          </div>
          <div className="floating-stat-row">
            <span className="floating-stat-label">Active</span>
            <span className="floating-stat-value">{activeCount} / {filteredCameras.length}</span>
          </div>
          <div className="floating-stat-row">
            <span className="floating-stat-label">Coverage</span>
            <span className="floating-stat-value">{coveragePct}%</span>
          </div>
          {/* No real per-stream latency metric exists on the backend -- the old "18 ms"
              here was a fixed, fabricated number regardless of what was actually
              registered. Removed rather than kept as decoration. */}
          {!isFullscreen && (
            <div className="floating-expand-hint">
              <span>Click map to expand</span>
            </div>
          )}
        </div>

        {/* Interactive Leaflet Map */}
        <MapContainer
          center={activeDistrictInfo.center}
          zoom={activeDistrictInfo.zoom}
          scrollWheelZoom={true}
          className="leaflet-map-container"
        >
          {/* Handle background map click to expand */}
          <MapClickHandler
            isFullscreen={isFullscreen}
            isDrawerOpen={isDrawerOpen}
            onExpand={handleExpand}
          />

          {/* Invalidate size on fullscreen resize */}
          <MapResizeHandler isFullscreen={isFullscreen} />

          {/* Smooth Dynamic Flight to District or Focused Camera */}
          <MapViewController
            center={activeDistrictInfo.center}
            zoom={activeDistrictInfo.zoom}
            flyTarget={cameraFlyTarget}
          />

          {/* Layer Control: Streets, CartoDB, and Satellite */}
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="Streets (Clean)">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                maxZoom={19}
              />
            </LayersControl.BaseLayer>

            <LayersControl.BaseLayer name="Carto Light">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                maxZoom={19}
              />
            </LayersControl.BaseLayer>

            <LayersControl.BaseLayer name="Light Gray (Esri)">
              <TileLayer
                attribution="Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
                maxZoom={16}
              />
            </LayersControl.BaseLayer>

            <LayersControl.BaseLayer name="Satellite">
              <TileLayer
                attribution="Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                maxZoom={19}
              />
            </LayersControl.BaseLayer>
          </LayersControl>

          {/* Render Filtered Camera Markers with Cached Icons */}
          {filteredCameras.map((cam) => (
            <Marker
              key={cam.id}
              position={[cam.lat, cam.lng]}
              icon={getCameraIcon(cam)}
              eventHandlers={{
                click: () => {
                  setSelectedCamera(cam);
                },
              }}
            >
              <Popup>
                <div className="camera-popup-card">
                  <div className="popup-top-row">
                    <span className="popup-cam-id">{cam.id}</span>
                    <span className={`popup-status-pill ${cam.status}`}>
                      {cam.realStatus}
                    </span>
                  </div>

                  <h3 className="popup-cam-name">{cam.name}</h3>

                  <div className="popup-details-grid">
                    <div className="popup-detail-item">
                      <span className="popup-detail-label">District</span>
                      <span className="popup-detail-val">{getCameraDistrict(cam)}</span>
                    </div>
                    <div className="popup-detail-item">
                      <span className="popup-detail-label">Department</span>
                      <span
                        className="popup-dept-badge"
                        style={{ backgroundColor: DEPARTMENT_COLORS[cam.department] || '#0284c7' }}
                      >
                        {cam.department}
                      </span>
                    </div>
                    <div className="popup-detail-item">
                      <span className="popup-detail-label">Protocol</span>
                      <span className="popup-detail-val">{cam.protocolType}</span>
                    </div>
                    <div className="popup-detail-item">
                      <span className="popup-detail-label">AI Profile</span>
                      <span className="popup-detail-val">{cam.aiEnabled ? cam.aiProfile : 'AI disabled'}</span>
                    </div>
                    <div className="popup-detail-item">
                      <span className="popup-detail-label">Onboarded via</span>
                      <span className="popup-detail-val">{cam.onboardingSource}</span>
                    </div>
                    <div className="popup-detail-item">
                      <span className="popup-detail-label">Coordinates</span>
                      <span className="popup-detail-val">
                        {cam.lat.toFixed(4)}, {cam.lng.toFixed(4)}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="popup-action-btn"
                    onClick={() => {
                      setSelectedCamera(cam);
                      setIsDrawerOpen(true);
                    }}
                  >
                    Inspect in Detail Drawer →
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Camera Detail Drawer Overlay */}
        <aside
          className={`cam-detail-drawer ${isDrawerOpen ? 'is-open' : ''}`}
          aria-label="Camera Detail Drawer"
        >
          {selectedCamera && (
            <>
              {/* Drawer Top Header */}
              <div className="cam-drawer-header">
                <div className="cam-drawer-top-bar">
                  <span className="cam-drawer-category">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    Pipeline 1 · Registry & Telemetry
                  </span>
                  <button
                    type="button"
                    className="cam-drawer-close-btn"
                    onClick={() => setIsDrawerOpen(false)}
                    title="Close Drawer (Esc)"
                    aria-label="Close Drawer"
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>

                <div className="cam-drawer-title-box">
                  <h3 className="cam-drawer-title">{selectedCamera.name}</h3>
                  <div className="cam-drawer-meta-badges">
                    <span className="cam-badge-id">{selectedCamera.id}</span>
                    <span className={`cam-badge-status ${selectedCamera.status}`}>
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          backgroundColor: STATUS_COLORS[selectedCamera.status] || '#16a34a',
                          display: 'inline-block',
                        }}
                      />
                      {selectedCamera.realStatus}
                    </span>
                    <span
                      className="cam-badge-dept"
                      style={{ backgroundColor: DEPARTMENT_COLORS[selectedCamera.department] || '#0284c7' }}
                    >
                      {selectedCamera.department}
                    </span>
                  </div>
                </div>
              </div>

              {/* Drawer Content Body */}
              <div className="cam-drawer-body">
                {/* No fake video: there's no reachable real ingest host to play from
                    in this environment (backend.md §12.7.1), and there is no real
                    per-frame AI detection feed exposed to the client to overlay
                    (server/routers/ai.py is per-frame analyze-frame only, not a
                    live list). This used to show a fabricated license-plate
                    detection ("VEHICLE [GJ-05-AB-7104] 98%") and a ticking fake
                    "LIVE FEED" timestamp regardless of whether anything was actually
                    streaming -- removed rather than kept as decoration, matching
                    LiveCameras.jsx's honest placeholder. */}
                <div className="cam-video-viewport cam-video-viewport-empty">
                  <div className="cam-video-grid-pattern" />
                  <span className="cam-video-empty-label">No live playback in this environment</span>
                  <span className="cam-video-empty-sub">{selectedCamera.protocolType} · {selectedCamera.id}</span>
                </div>

                {/* Video Quick Controls */}
                <div className="cam-video-controls">
                  <button
                    type="button"
                    className="cam-tool-btn primary"
                    onClick={() => {
                      setCameraFlyTarget({
                        lat: selectedCamera.lat,
                        lng: selectedCamera.lng,
                        id: selectedCamera.id,
                        ts: Date.now(),
                      });
                      showToast(`Focused map on ${selectedCamera.id}`);
                    }}
                    title="Center and zoom on this camera coordinates"
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="22" y1="12" x2="18" y2="12" />
                      <line x1="6" y1="12" x2="2" y2="12" />
                      <line x1="12" y1="6" x2="12" y2="2" />
                      <line x1="12" y1="22" x2="12" y2="18" />
                    </svg>
                    Center Map
                  </button>

                  {/* Real adapter-health check, not a fake "Copy RTSP" (there's no
                      real URL to copy -- rtsp_url is never exposed to the frontend,
                      core/security.py) or fake "Snapshot" (no capture endpoint
                      exists). Calls the real GET
                      /api/cameras/{uid}/adapter/health, which genuinely attempts a
                      live connection -- honest about failing when there's nothing
                      real to connect to, not a canned success message. */}
                  <button
                    type="button"
                    className="cam-tool-btn"
                    disabled={checkingHealth}
                    onClick={async () => {
                      setCheckingHealth(true);
                      try {
                        const health = await api.getAdapterHealth(selectedCamera.id);
                        showToast(`${selectedCamera.id}: ${health.status} (${health.dimensions})`);
                      } catch (err) {
                        showToast(`${selectedCamera.id}: health check failed -- ${err.message}`);
                      } finally {
                        setCheckingHealth(false);
                      }
                    }}
                    title="Attempt a real adapter connection and report its health"
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                    </svg>
                    {checkingHealth ? 'Checking…' : 'Check Adapter Health'}
                  </button>
                </div>

                {/* Status Diagnostic Banner */}
                <div className={`cam-status-banner ${selectedCamera.status}`}>
                  <div className="cam-banner-heading">
                    {selectedCamera.status === 'alert' && (
                      <>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <span>Active Alert Triggered</span>
                      </>
                    )}
                    {selectedCamera.status === 'active' && (
                      <>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                          <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                        <span>Telemetry Nominal</span>
                      </>
                    )}
                    {selectedCamera.status === 'offline' && (
                      <>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                        </svg>
                        <span>Signal Offline</span>
                      </>
                    )}
                  </div>
                  <div>
                    {selectedCamera.status === 'alert'
                      ? 'Adapter reports DEGRADED health -- a real connection or read issue, not necessarily an AI detection. Check Adapter Health above for the live status.'
                      : selectedCamera.status === 'offline'
                      ? `Registry status is ${selectedCamera.realStatus}. Run a real adapter health check above to confirm current connectivity.`
                      : `Registry status is ${selectedCamera.realStatus}.`}
                  </div>
                </div>

                {/* Technical Specifications Grid -- only real fields
                    (server/schemas/camera.py). The old "Stream Resolution"/"Frame
                    Rate"/"Protocol Ingest: RTSP/WHEP (P2)"/"AI Pipeline: Active
                    (YOLOv11)" tiles were fabricated: the backend doesn't track
                    resolution/FPS at all, and claims a specific "YOLOv11" model when
                    the real AI engine reports itself as "simulated"
                    (GET /api/health/). */}
                <div className="cam-telemetry-section">
                  <h4 className="cam-section-title">Registry Telemetry</h4>
                  <div className="cam-telemetry-grid">
                    <div className="cam-telemetry-tile">
                      <span className="cam-tile-label">District</span>
                      <span className="cam-tile-value">{getCameraDistrict(selectedCamera)}</span>
                    </div>
                    <div className="cam-telemetry-tile">
                      <span className="cam-tile-label">Department</span>
                      <span className="cam-tile-value">{selectedCamera.department}</span>
                    </div>
                    <div className="cam-telemetry-tile">
                      <span className="cam-tile-label">GPS Latitude</span>
                      <span className="cam-tile-value">{selectedCamera.lat.toFixed(5)}&deg; N</span>
                    </div>
                    <div className="cam-telemetry-tile">
                      <span className="cam-tile-label">GPS Longitude</span>
                      <span className="cam-tile-value">{selectedCamera.lng.toFixed(5)}&deg; E</span>
                    </div>
                    <div className="cam-telemetry-tile">
                      <span className="cam-tile-label">Protocol</span>
                      <span className="cam-tile-value">{selectedCamera.protocolType}</span>
                    </div>
                    <div className="cam-telemetry-tile">
                      <span className="cam-tile-label">AI Analytics</span>
                      <span className="cam-tile-value" style={{ color: selectedCamera.aiEnabled ? '#16a34a' : undefined }}>
                        {selectedCamera.aiEnabled ? `Enabled (${selectedCamera.aiProfile})` : 'Disabled'}
                      </span>
                    </div>
                    <div className="cam-telemetry-tile">
                      <span className="cam-tile-label">Onboarded via</span>
                      <span className="cam-tile-value">{selectedCamera.onboardingSource}</span>
                    </div>
                    <div className="cam-telemetry-tile">
                      <span className="cam-tile-label">Status</span>
                      <span className="cam-tile-value">{selectedCamera.realStatus}</span>
                    </div>
                  </div>
                </div>

                {/* Sibling Cameras in District */}
                <div className="cam-sibling-section">
                  <h4 className="cam-section-title">
                    Nodes in {selectedDistrict === 'All' ? 'Gujarat' : selectedDistrict} ({districtCameras.length})
                  </h4>
                  <div className="cam-sibling-list">
                    {districtCameras.map((cam) => {
                      const isCurrent = cam.id === selectedCamera.id;
                      return (
                        <button
                          key={cam.id}
                          type="button"
                          className={`cam-sibling-card ${isCurrent ? 'active' : ''}`}
                          onClick={() => {
                            setSelectedCamera(cam);
                            setCameraFlyTarget({
                              lat: cam.lat,
                              lng: cam.lng,
                              id: cam.id,
                              ts: Date.now(),
                            });
                          }}
                        >
                          <div className="cam-sibling-info">
                            <span className="cam-sibling-id">{cam.id}</span>
                            <span className="cam-sibling-name">{cam.name}</span>
                          </div>
                          <span className={`popup-status-pill ${cam.status}`}>
                            {cam.realStatus}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Temporary Toast Notification */}
              {toastMessage && (
                <div className="cam-drawer-toast">
                  <span>{toastMessage}</span>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              )}
            </>
          )}
        </aside>
      </div>

      {/* Footer Status Legend */}
      <div className="camera-map-footer">
        <div className="map-status-legend">
          <div className="status-legend-item">
            <span className="status-legend-dot" style={{ backgroundColor: STATUS_COLORS.active }} />
            <span>Active Feeds ({activeCount})</span>
          </div>
          <div className="status-legend-item">
            <span className="status-legend-dot" style={{ backgroundColor: STATUS_COLORS.alert }} />
            <span>Incident Alert ({alertCount})</span>
          </div>
          <div className="status-legend-item">
            <span className="status-legend-dot" style={{ backgroundColor: STATUS_COLORS.offline }} />
            <span>Offline ({offlineCount})</span>
          </div>
        </div>

        <span>
          Jurisdiction: {activeDistrictInfo.name} ({filteredCameras.length} Visible Nodes)
        </span>
      </div>
    </div>
  );
});

export default CameraMap;
