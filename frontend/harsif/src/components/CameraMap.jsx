import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, LayersControl, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CAMERAS, DEPARTMENT_COLORS, STATUS_COLORS } from '../data/cameras';
import './CameraMap.css';

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
  const cacheKey = `${camera.id}-${camera.department}-${camera.status}`;
  if (iconCache.has(cacheKey)) {
    return iconCache.get(cacheKey);
  }

  const deptColor = DEPARTMENT_COLORS[camera.department] || '#0284c7';
  const isAlert = camera.status === 'alert';
  const isOffline = camera.status === 'offline';

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
    // Ascending soft chime: 320Hz -> 680Hz
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
    // Descending soft chime: 580Hz -> 280Hz
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

// Helper component to listen to clicks on the map background
function MapClickHandler({ isFullscreen, onExpand }) {
  useMapEvents({
    click: () => {
      if (!isFullscreen) {
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

const CameraMap = React.memo(function CameraMap() {
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  // Pressing Escape exits fullscreen
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isFullscreen) {
        handleCollapse();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, handleCollapse]);

  const filteredCameras = useMemo(() => {
    return CAMERAS.filter((cam) => {
      const matchDept = selectedDept === 'ALL' || cam.department === selectedDept;
      return matchDept;
    });
  }, [selectedDept]);

  const activeCount = CAMERAS.filter((c) => c.status === 'active').length;
  const alertCount = CAMERAS.filter((c) => c.status === 'alert').length;
  const offlineCount = CAMERAS.filter((c) => c.status === 'offline').length;
  const coveragePct = ((activeCount / CAMERAS.length) * 100).toFixed(1);

  return (
    <div className={`camera-map-card ${isFullscreen ? 'is-fullscreen' : ''}`}>
      {/* Map Header with Filters & Expand/Close Button */}
      <div className="camera-map-header">
        <div className="map-header-left">
          <div className="map-title-row">
            <h2 className="map-card-title">Surveillance GIS Matrix</h2>
            {isFullscreen && (
              <span className="fullscreen-active-badge">FULLSCREEN COMMAND MODE</span>
            )}
          </div>
          <p className="map-card-subtitle">Ahmedabad Metropolitan Command & Telemetry Grid</p>
        </div>

        <div className="map-header-center">
          <div className="map-header-filters">
            <button
              type="button"
              className={`filter-chip ${selectedDept === 'ALL' ? 'active' : ''}`}
              onClick={() => setSelectedDept('ALL')}
            >
              All ({CAMERAS.length})
            </button>
            {['Police', 'Traffic', 'Municipal', 'Food', 'Sanitation', 'Health'].map((dept) => (
              <button
                key={dept}
                type="button"
                className={`filter-chip ${selectedDept === dept ? 'active' : ''}`}
                onClick={() => setSelectedDept(dept)}
              >
                {dept}
              </button>
            ))}
          </div>
        </div>

        <div className="map-header-actions">
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

      {/* Real Interactive Leaflet Map Container */}
      <div className={`leaflet-map-wrapper ${!isFullscreen ? 'clickable-canvas' : ''}`}>
        {/* Step C: Laser scanline beam sweeping down once on load */}
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
            <span className="floating-stat-label">Active Feeds</span>
            <span className="floating-stat-value">{activeCount} / {CAMERAS.length}</span>
          </div>
          <div className="floating-stat-row">
            <span className="floating-stat-label">Coverage</span>
            <span className="floating-stat-value">{coveragePct}%</span>
          </div>
          <div className="floating-stat-row">
            <span className="floating-stat-label">Stream Latency</span>
            <span className="floating-stat-value">18 ms</span>
          </div>
          {!isFullscreen && (
            <div className="floating-expand-hint">
              <span>Click map to expand</span>
            </div>
          )}
        </div>

        <MapContainer
          center={[23.0225, 72.5714]}
          zoom={12}
          scrollWheelZoom={true}
          className="leaflet-map-container"
        >
          {/* Handle background map click to expand */}
          <MapClickHandler isFullscreen={isFullscreen} onExpand={handleExpand} />

          {/* Invalidate size on fullscreen resize */}
          <MapResizeHandler isFullscreen={isFullscreen} />

          {/* Layer Control: OpenStreetMap (Clean No Watermark), CartoDB, and Satellite */}
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

          {/* Render All Camera Markers with Cached Icons */}
          {filteredCameras.map((cam) => (
            <Marker
              key={cam.id}
              position={[cam.lat, cam.lng]}
              icon={getCameraIcon(cam)}
            >
              <Popup>
                <div className="camera-popup-card">
                  <div className="popup-top-row">
                    <span className="popup-cam-id">{cam.id}</span>
                    <span className={`popup-status-pill ${cam.status}`}>
                      {cam.status}
                    </span>
                  </div>

                  <h3 className="popup-cam-name">{cam.name}</h3>

                  <div className="popup-details-grid">
                    <div className="popup-detail-item">
                      <span className="popup-detail-label">Department</span>
                      <span
                        className="popup-dept-badge"
                        style={{ backgroundColor: DEPARTMENT_COLORS[cam.department] }}
                      >
                        {cam.department}
                      </span>
                    </div>
                    <div className="popup-detail-item">
                      <span className="popup-detail-label">Zone</span>
                      <span className="popup-detail-val">{cam.zone}</span>
                    </div>
                    <div className="popup-detail-item">
                      <span className="popup-detail-label">Stream Res</span>
                      <span className="popup-detail-val">{cam.resolution}</span>
                    </div>
                    <div className="popup-detail-item">
                      <span className="popup-detail-label">FPS</span>
                      <span className="popup-detail-val">{cam.fps} fps</span>
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
                    onClick={() => alert(`Launching live stream feed for ${cam.id} (${cam.name})`)}
                  >
                    Open Live Feed
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
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

        <span>Center: Ahmedabad (23.0225° N, 72.5714° E)</span>
      </div>
    </div>
  );
});

export default CameraMap;
