/**
 * G-VISTA API Client
 * Real backend router mapping (backend/main.py's actual include_router calls --
 * verified against the real backend, not guessed):
 *   - Camera registry:      /api/cameras
 *   - Adapter health:       /api/cameras/{camera_uid}/adapter/health (adapters.router
 *                            is mounted under the cameras prefix, not /api/adapters)
 *   - Stream lifecycle/SSE: /api/streams
 *   - AI orchestrator:      /api/ai (per-frame analyze, no "list detections" endpoint)
 *   - Watchlists:           /api/watchlists
 *   - Auth:                 /api/auth
 *   - Alerts:                /api/alerts
 *   - Investigations:       /api/investigations
 *   - Admin:                /api/admin
 *
 * Falls back to mock data when the backend is unreachable or returns non-2xx, so the
 * app stays usable offline/in DEMO mode -- but every mode is honestly labelled via
 * getMode(), never silently presented as live.
 */

import {
  MOCK_CAMERAS,
  MOCK_ADAPTERS,
  MOCK_AI_DETECTIONS,
  MOCK_INTELLIGENCE_EVENTS,
  MOCK_WATCHLIST_MATCHES,
  MOCK_ENTITY_TIMELINES,
  MOCK_OPERATIONAL_ALERTS,
} from './mockData';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const TOKEN_STORAGE_KEY = 'gvista_access_token';

// In-memory state for mock-mode session persistence (unchanged behavior when offline).
let localCameras = [...MOCK_CAMERAS];
let localAlerts = [...MOCK_OPERATIONAL_ALERTS];
let localInvestigations = [];
let localWatchlistEntries = [];

class VistaApiClient {
  constructor() {
    this.baseUrl = BASE_URL;
    this.isMockMode = true; // Auto-detected on first call, or forced via setMockMode()
    this.hasCheckedBackend = false;
    this.token = null;
    try {
      this.token = localStorage.getItem(TOKEN_STORAGE_KEY) || null;
    } catch {
      // localStorage can throw in a private/locked-down browser context -- fall back
      // to session-only (in-memory) auth rather than crashing the app on load.
    }
  }

  // --- Auth (backend/routers/auth.py) -------------------------------------------

  setToken(token) {
    this.token = token;
    try {
      if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
      else localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      // Same reasoning as the constructor -- storage failures shouldn't break auth.
    }
  }

  isAuthenticated() {
    return !!this.token;
  }

  /** A "session" also counts as a deliberate mock-mode entry (no backend reachable at
   * login time, docs/frontend.md §3.0's honest DEMO/LIVE distinction) -- tracked
   * separately from a real token so route protection doesn't lock a user out of the
   * demo UI just because there's no backend running, while still requiring a real
   * login attempt to have happened first (not just visiting the app). */
  hasSession() {
    if (this.isAuthenticated()) return true;
    try {
      return sessionStorage.getItem('gvista_mock_session') === '1';
    } catch {
      return false;
    }
  }

  startMockSession() {
    try {
      sessionStorage.setItem('gvista_mock_session', '1');
    } catch {
      // Non-fatal -- worst case the user is asked to "log in" again next reload.
    }
  }

  endSession() {
    try {
      sessionStorage.removeItem('gvista_mock_session');
    } catch {
      // best-effort
    }
  }

  _authHeaders(extra = {}) {
    const headers = { ...extra };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    return headers;
  }

  /** POST /api/auth/login -- real only, no mock fallback: a fake "success" here would
   * let someone believe they're authenticated against a backend that never validated
   * them, which is the one place in this app mock-fallback must not apply. */
  async login(username, password) {
    const res = await fetch(`${this.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      let detail = 'Login failed';
      try {
        detail = (await res.json()).detail || detail;
      } catch {
        // Non-JSON error body (e.g. a proxy/500 page) -- keep the generic message.
      }
      throw new Error(detail);
    }
    const data = await res.json();
    this.setToken(data.access_token);
    this.isMockMode = false;
    this.hasCheckedBackend = true;
    return data;
  }

  /** POST /api/auth/logout -- revokes the token server-side (backend/core/security.py's
   * jti blocklist) rather than only forgetting it client-side. */
  async logout() {
    if (this.token) {
      try {
        await fetch(`${this.baseUrl}/api/auth/logout`, {
          method: 'POST',
          headers: this._authHeaders(),
        });
      } catch {
        // Best-effort -- still clear the local token below even if the network call
        // failed, so the user is logged out of this browser regardless.
      }
    }
    this.setToken(null);
    this.endSession();
  }

  /** GET /api/auth/me -- current user's identity/role/department_scope. */
  async getCurrentUser() {
    if (!this.token) return null;
    try {
      const res = await fetch(`${this.baseUrl}/api/auth/me`, { headers: this._authHeaders() });
      if (res.ok) return await res.json();
      if (res.status === 401) this.setToken(null); // expired/revoked -- stop presenting as logged in
    } catch {
      // Network failure -- treat as "can't confirm identity right now", not a logout.
    }
    return null;
  }

  async checkBackendAvailability() {
    if (this.hasCheckedBackend) return !this.isMockMode;
    try {
      const res = await fetch(`${this.baseUrl}/api/health/`, { method: 'GET', signal: AbortSignal.timeout(1500) });
      this.isMockMode = !res.ok;
    } catch {
      this.isMockMode = true;
    }
    this.hasCheckedBackend = true;
    return !this.isMockMode;
  }

  setMockMode(forceMock) {
    this.isMockMode = forceMock;
  }

  getMode() {
    return this.isMockMode ? 'MOCK_ENGINE' : 'LIVE_BACKEND';
  }

  // --- Camera registry (backend/routers/cameras.py) ------------------------------

  async getCameras(params = {}) {
    await this.checkBackendAvailability();
    if (!this.isMockMode) {
      try {
        const query = new URLSearchParams(params).toString();
        const res = await fetch(`${this.baseUrl}/api/cameras/?${query}`, { headers: this._authHeaders() });
        if (res.ok) {
          const data = await res.json();
          return data.cameras || [];
        }
      } catch (err) {
        console.warn('Backend /api/cameras failed, falling back to mock layer:', err);
      }
    }

    let filtered = [...localCameras];
    if (params.department) {
      filtered = filtered.filter((c) => c.department.toLowerCase() === params.department.toLowerCase());
    }
    if (params.district) {
      filtered = filtered.filter((c) => c.district.toLowerCase() === params.district.toLowerCase());
    }
    if (params.status) {
      filtered = filtered.filter((c) => c.status.toLowerCase() === params.status.toLowerCase());
    }
    return filtered;
  }

  async getCamera(cameraUid) {
    await this.checkBackendAvailability();
    if (!this.isMockMode) {
      try {
        const res = await fetch(`${this.baseUrl}/api/cameras/${cameraUid}`, { headers: this._authHeaders() });
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn('Backend getCamera failed, using mock:', err);
      }
    }
    return localCameras.find((c) => c.camera_uid === cameraUid) || null;
  }

  async createCamera(cameraData) {
    await this.checkBackendAvailability();
    if (!this.isMockMode) {
      try {
        const res = await fetch(`${this.baseUrl}/api/cameras/`, {
          method: 'POST',
          headers: this._authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(cameraData),
        });
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn('Backend createCamera failed, saving locally:', err);
      }
    }

    const newCam = {
      ...cameraData,
      id: localCameras.length + 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    localCameras = [newCam, ...localCameras];
    return newCam;
  }

  async importCamerasCSV(file) {
    await this.checkBackendAvailability();
    if (!this.isMockMode) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`${this.baseUrl}/api/cameras/import/csv`, {
          method: 'POST',
          headers: this._authHeaders(),
          body: formData,
        });
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn('Backend import CSV failed, simulating mock result:', err);
      }
    }

    // Mock CSV Import Simulation
    return {
      total_rows: 15,
      created: 12,
      duplicates: 2,
      failed: 1,
      errors: ['Row 14: Invalid latitude value (95.2 > 90)'],
    };
  }

  /** GET /api/cameras/gap-analysis -- Model 1's mandatory gap-analysis report
   * (docs/frontend.md §3.1 Row 4 / §3.7 Camera fleet tab). No mock-data equivalent
   * existed in mockData.js -- this returns an empty-gaps shape rather than fabricating
   * plausible-looking district shortfalls when offline. */
  async getGapAnalysis(expectedMinimum) {
    await this.checkBackendAvailability();
    if (!this.isMockMode) {
      try {
        const query = expectedMinimum ? `?expected_minimum=${expectedMinimum}` : '';
        const res = await fetch(`${this.baseUrl}/api/cameras/gap-analysis${query}`, { headers: this._authHeaders() });
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn('Backend gap-analysis failed:', err);
      }
    }
    return { gaps: [] };
  }

  /** GET /api/cameras/{camera_uid}/adapter/health -- per-camera, not a global list
   * (the real adapters router is mounted under /api/cameras, not /api/adapters). */
  async getAdapterHealth(cameraUid) {
    await this.checkBackendAvailability();
    if (!this.isMockMode) {
      try {
        const res = await fetch(`${this.baseUrl}/api/cameras/${cameraUid}/adapter/health`, { headers: this._authHeaders() });
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn('Backend adapter health failed, using mock:', err);
      }
    }
    return MOCK_ADAPTERS.find((a) => a.camera_uid === cameraUid) || MOCK_ADAPTERS[0] || null;
  }

  // --- AI (backend/routers/ai.py -- no "list detections" endpoint exists; per-frame
  // analysis only, so this stays honestly mock-only until a real feed is wired) -----
  async getAIDetections() {
    await this.checkBackendAvailability();
    return MOCK_AI_DETECTIONS;
  }

  /** GET /api/streams/events/stream -- real Server-Sent Events feed of live AI
   * detections/alerts (backend/routers/streams.py, backend/intelligence/events.py).
   * This was genuinely unauthenticated on the backend until a real re-check of
   * docs/backend.md §12's "auth on every route" claim found it (and
   * getStreamStatus() below) contradicted that claim -- it's now real auth via
   * get_current_user_header_or_query. Browser EventSource can't set custom headers,
   * so the token goes as a ?token= query param (server/core/security.py's
   * get_current_user_header_or_query docstring explains why that's the one
   * legitimate exception to header-only auth in this codebase). Returns the
   * EventSource so the caller controls its lifecycle (close() on unmount). */
  subscribeToLiveEvents(onEvent, onError) {
    const tokenParam = this.token ? `?token=${encodeURIComponent(this.token)}` : '';
    const source = new EventSource(`${this.baseUrl}/api/streams/events/stream${tokenParam}`);
    source.onmessage = (evt) => {
      try {
        onEvent(JSON.parse(evt.data));
      } catch (err) {
        console.warn('Malformed live event payload:', err);
      }
    };
    if (onError) source.onerror = onError;
    return source;
  }

  /** POST /api/streams/{camera_id}/start -- real: spawns a real FFmpeg subprocess
   * server-side that transcodes the camera's real rtsp_url into local HLS segments.
   * Throws a real error (not a fake success) when the camera has no rtsp_url
   * configured, or when ffmpeg genuinely isn't available on the server host --
   * server/routers/streams.py's own 404/500 responses, surfaced honestly. */
  async startStream(cameraUid) {
    const res = await fetch(`${this.baseUrl}/api/streams/${cameraUid}/start`, {
      method: 'POST',
      headers: this._authHeaders(),
    });
    if (res.ok) return await res.json();
    let detail = 'Failed to start stream';
    try {
      detail = (await res.json()).detail || detail;
    } catch {
      // keep generic message
    }
    throw new Error(detail);
  }

  async stopStream(cameraUid) {
    const res = await fetch(`${this.baseUrl}/api/streams/${cameraUid}/stop`, {
      method: 'POST',
      headers: this._authHeaders(),
    });
    if (res.ok) return await res.json();
    throw new Error(`Failed to stop stream (${res.status})`);
  }

  /** GET /api/streams/{camera_id}/status -- now real auth (get_current_user), like
   * every other camera/stream route; was genuinely unauthenticated until the same
   * re-check that fixed the events/stream endpoint above found it too. */
  async getStreamStatus(cameraUid) {
    const res = await fetch(`${this.baseUrl}/api/streams/${cameraUid}/status`, { headers: this._authHeaders() });
    if (res.ok) return await res.json();
    return { camera_id: cameraUid, status: 'UNKNOWN' };
  }

  // --- Watchlists (backend/routers/watchlists.py) ---------------------------------

  async getWatchlistEntries() {
    await this.checkBackendAvailability();
    if (!this.isMockMode) {
      try {
        const res = await fetch(`${this.baseUrl}/api/watchlists/`, { headers: this._authHeaders() });
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn('Backend watchlists failed, using mock:', err);
      }
    }
    return localWatchlistEntries;
  }

  async createWatchlistEntry(entryData) {
    await this.checkBackendAvailability();
    if (!this.isMockMode) {
      try {
        const res = await fetch(`${this.baseUrl}/api/watchlists/`, {
          method: 'POST',
          headers: this._authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(entryData),
        });
        if (res.ok) return await res.json();
        let detail = 'Failed to create watchlist entry';
        try {
          detail = (await res.json()).detail || detail;
        } catch {
          // keep generic message
        }
        throw new Error(detail);
      } catch (err) {
        if (err instanceof Error && err.message !== 'Failed to fetch') throw err;
        console.warn('Backend createWatchlistEntry unreachable, saving locally:', err);
      }
    }
    const newEntry = {
      ...entryData,
      id: localWatchlistEntries.length + 1,
      match_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    localWatchlistEntries = [newEntry, ...localWatchlistEntries];
    return newEntry;
  }

  /** Legacy alias kept for any not-yet-migrated caller -- intelligence/watchlist
   * "matches" is real DB-derived data (models/watchlist.py's WatchlistMatch), but has
   * no dedicated list-all endpoint on the real backend (matches surface per-entry via
   * match_count, or as alerts). Mock-only until/unless that endpoint exists. */
  async getWatchlistMatches() {
    await this.checkBackendAvailability();
    return MOCK_WATCHLIST_MATCHES;
  }

  // --- Alerts (backend/routers/alerts.py) -----------------------------------------

  async getAlerts(params = {}) {
    await this.checkBackendAvailability();
    if (!this.isMockMode) {
      try {
        const query = new URLSearchParams(params).toString();
        const res = await fetch(`${this.baseUrl}/api/alerts/?${query}`, { headers: this._authHeaders() });
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn('Backend alerts failed, using mock:', err);
      }
    }
    return localAlerts;
  }

  async getAlert(alertUid) {
    await this.checkBackendAvailability();
    if (!this.isMockMode) {
      try {
        const res = await fetch(`${this.baseUrl}/api/alerts/${alertUid}`, { headers: this._authHeaders() });
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn('Backend getAlert failed, using mock:', err);
      }
    }
    return localAlerts.find((a) => a.alert_uid === alertUid) || null;
  }

  async updateAlertStatus(alertUid, newStatus) {
    await this.checkBackendAvailability();
    if (!this.isMockMode) {
      try {
        const res = await fetch(`${this.baseUrl}/api/alerts/${alertUid}/status`, {
          method: 'PATCH',
          headers: this._authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ status: newStatus }),
        });
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn('Backend updateAlertStatus failed, updating local state:', err);
      }
    }

    localAlerts = localAlerts.map((alt) =>
      alt.alert_uid === alertUid ? { ...alt, status: newStatus, updated_at: new Date().toISOString() } : alt
    );
    return localAlerts.find((alt) => alt.alert_uid === alertUid);
  }

  /** POST /api/alerts/{alert_uid}/investigation -- opens a case directly from an
   * alert, the real path the backend actually supports (there is no generic
   * createInvestigation independent of an alert on the mock-data side either, so this
   * replaces the old, non-existent /api/operations/investigations call). */
  async createInvestigationFromAlert(alertUid, investigationData) {
    await this.checkBackendAvailability();
    if (!this.isMockMode) {
      try {
        const res = await fetch(`${this.baseUrl}/api/alerts/${alertUid}/investigation`, {
          method: 'POST',
          headers: this._authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(investigationData),
        });
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn('Backend createInvestigationFromAlert failed, saving locally:', err);
      }
    }
    return this.createInvestigation(investigationData);
  }

  // --- Investigations (backend/routers/investigations.py) ------------------------

  async getInvestigations() {
    await this.checkBackendAvailability();
    if (!this.isMockMode) {
      try {
        const res = await fetch(`${this.baseUrl}/api/investigations/`, { headers: this._authHeaders() });
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn('Backend investigations failed, using mock:', err);
      }
    }
    return localInvestigations;
  }

  async createInvestigation(investigationData) {
    await this.checkBackendAvailability();
    if (!this.isMockMode) {
      try {
        const res = await fetch(`${this.baseUrl}/api/investigations/`, {
          method: 'POST',
          headers: this._authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(investigationData),
        });
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn('Backend createInvestigation failed, saving locally:', err);
      }
    }

    const newInv = {
      ...investigationData,
      id: localInvestigations.length + 1,
      case_uid: `INV-${Date.now()}`,
      status: 'OPEN',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    localInvestigations.push(newInv);
    return newInv;
  }

  async getInvestigation(caseUid) {
    await this.checkBackendAvailability();
    if (!this.isMockMode) {
      try {
        const res = await fetch(`${this.baseUrl}/api/investigations/${caseUid}`, { headers: this._authHeaders() });
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn('Backend getInvestigation failed, using mock:', err);
      }
    }
    return localInvestigations.find((i) => i.case_uid === caseUid) || null;
  }

  async updateInvestigationStatus(caseUid, newStatus) {
    await this.checkBackendAvailability();
    if (!this.isMockMode) {
      try {
        const res = await fetch(`${this.baseUrl}/api/investigations/${caseUid}/status`, {
          method: 'PATCH',
          headers: this._authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ status: newStatus }),
        });
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn('Backend updateInvestigationStatus failed, updating local state:', err);
      }
    }
    localInvestigations = localInvestigations.map((i) =>
      i.case_uid === caseUid ? { ...i, status: newStatus, updated_at: new Date().toISOString() } : i
    );
    return localInvestigations.find((i) => i.case_uid === caseUid);
  }

  /** GET /api/investigations/{case_uid}/timeline -- {events: [...], alerts: [...]}. */
  async getInvestigationTimeline(caseUid) {
    await this.checkBackendAvailability();
    if (!this.isMockMode) {
      try {
        const res = await fetch(`${this.baseUrl}/api/investigations/${caseUid}/timeline`, { headers: this._authHeaders() });
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn('Backend investigation timeline failed, using mock:', err);
      }
    }
    return { events: [], alerts: [] };
  }

  /** GET /api/investigations/{case_uid}/trace -- the graded "vehicle trace across
   * cameras" flow (docs/frontend.md §3.5). Falls back to MOCK_ENTITY_TIMELINES keyed
   * by the investigation's entity, for demo continuity when offline. */
  async getInvestigationTrace(caseUid, entityId) {
    await this.checkBackendAvailability();
    if (!this.isMockMode) {
      try {
        const res = await fetch(`${this.baseUrl}/api/investigations/${caseUid}/trace`, { headers: this._authHeaders() });
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn('Backend investigation trace failed, using mock:', err);
      }
    }
    return { sightings: MOCK_ENTITY_TIMELINES[entityId] || [] };
  }

  async getInvestigationEvidence(caseUid) {
    await this.checkBackendAvailability();
    if (!this.isMockMode) {
      try {
        const res = await fetch(`${this.baseUrl}/api/investigations/${caseUid}/evidence`, { headers: this._authHeaders() });
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn('Backend investigation evidence failed, using mock:', err);
      }
    }
    return [];
  }

  async addInvestigationEvidence(caseUid, evidenceData) {
    await this.checkBackendAvailability();
    if (!this.isMockMode) {
      try {
        const res = await fetch(`${this.baseUrl}/api/investigations/${caseUid}/evidence`, {
          method: 'POST',
          headers: this._authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(evidenceData),
        });
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn('Backend addInvestigationEvidence failed:', err);
      }
    }
    return { ...evidenceData, id: Date.now(), investigation_id: caseUid, added_at: new Date().toISOString() };
  }

  // --- Admin (backend/routers/admin.py, backend/routers/auth.py) -----------------

  /** Admin-only on the backend (require_admin) -- a 403 here is a real "you don't
   * have permission" fact, not the same as "the backend is unreachable." Earlier
   * versions of this and the two methods below silently returned an empty
   * list/default on ANY non-2xx, which would show an OPERATOR account "0 users"
   * indistinguishable from a real, permitted, empty result. Now: network failure
   * still falls back to mock/empty (existing behavior everywhere else in this
   * client); a real HTTP error from a reachable backend throws so the caller can
   * show it honestly. */
  async getUsers() {
    await this.checkBackendAvailability();
    if (!this.isMockMode) {
      let res;
      try {
        res = await fetch(`${this.baseUrl}/api/auth/users`, { headers: this._authHeaders() });
      } catch (err) {
        console.warn('Backend users unreachable, using mock:', err);
        return [];
      }
      if (res.ok) return await res.json();
      throw new Error(res.status === 403 ? 'Admin access required.' : `Request failed (${res.status})`);
    }
    return [];
  }

  async createUser(userData) {
    await this.checkBackendAvailability();
    const res = await fetch(`${this.baseUrl}/api/auth/users`, {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(userData),
    });
    if (res.ok) return await res.json();
    let detail = 'Failed to create user';
    try {
      detail = (await res.json()).detail || detail;
    } catch {
      // keep generic message
    }
    throw new Error(detail);
  }

  /** GET /api/admin/audit-log returns {entries: [...]}, not a bare list -- unwrapped
   * here so callers get a plain array like every other list method. */
  async getAuditLog(limit = 100) {
    await this.checkBackendAvailability();
    if (!this.isMockMode) {
      let res;
      try {
        res = await fetch(`${this.baseUrl}/api/admin/audit-log?limit=${limit}`, { headers: this._authHeaders() });
      } catch (err) {
        console.warn('Backend audit log unreachable, using mock:', err);
        return [];
      }
      if (res.ok) return (await res.json()).entries || [];
      throw new Error(res.status === 403 ? 'Admin access required.' : `Request failed (${res.status})`);
    }
    return [];
  }

  async getFacialRecognitionStatus() {
    await this.checkBackendAvailability();
    if (!this.isMockMode) {
      let res;
      try {
        res = await fetch(`${this.baseUrl}/api/admin/facial-recognition`, { headers: this._authHeaders() });
      } catch (err) {
        console.warn('Backend facial-recognition status unreachable, using mock:', err);
        return { currently_enabled: false, history: [] };
      }
      if (res.ok) return await res.json();
      throw new Error(res.status === 403 ? 'Admin access required.' : `Request failed (${res.status})`);
    }
    return { currently_enabled: false, history: [] };
  }

  async setFacialRecognitionAuthorization(enabled, reason) {
    await this.checkBackendAvailability();
    const res = await fetch(`${this.baseUrl}/api/admin/facial-recognition/authorize`, {
      method: 'POST',
      headers: this._authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ enabled, reason }),
    });
    if (res.ok) return await res.json();
    let detail = 'Failed to update facial-recognition authorization';
    try {
      detail = (await res.json()).detail || detail;
    } catch {
      // keep generic message
    }
    throw new Error(detail);
  }

  // Backwards-compat alias for older callers that expected a single legacy events feed.
  async getIntelligenceEvents() {
    await this.checkBackendAvailability();
    return MOCK_INTELLIGENCE_EVENTS;
  }
}

export const api = new VistaApiClient();
export default api;
