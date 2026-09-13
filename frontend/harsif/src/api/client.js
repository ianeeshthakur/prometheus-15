/**
 * G-VISTA API Client
 * Clean interface to backend services with intelligent mock fallback.
 * Backend router mapping:
 *   - Pipeline 1: /api/cameras
 *   - Pipeline 2: /api/adapters, /api/streams
 *   - Pipeline 3: /api/ai
 *   - Pipeline 4: /api/intelligence
 *   - Pipeline 5: /api/operations
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

// In-memory state for mock mode session persistence
let localCameras = [...MOCK_CAMERAS];
let localAlerts = [...MOCK_OPERATIONAL_ALERTS];
let localInvestigations = [];

class VistaApiClient {
  constructor() {
    this.baseUrl = BASE_URL;
    this.isMockMode = true; // Auto-detected or forced
    this.hasCheckedBackend = false;
  }

  async checkBackendAvailability() {
    if (this.hasCheckedBackend) return !this.isMockMode;
    try {
      const res = await fetch(`${this.baseUrl}/api/health`, { method: 'GET', signal: AbortSignal.timeout(1500) });
      if (res.ok) {
        this.isMockMode = false;
      } else {
        this.isMockMode = true;
      }
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

  // --- Pipeline 1: Camera Registry ---
  async getCameras(params = {}) {
    await this.checkBackendAvailability();
    if (!this.isMockMode) {
      try {
        const query = new URLSearchParams(params).toString();
        const res = await fetch(`${this.baseUrl}/api/cameras/?${query}`);
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
        const res = await fetch(`${this.baseUrl}/api/cameras/${cameraUid}`);
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
          headers: { 'Content-Type': 'application/json' },
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

  // --- Pipeline 2: Protocol Normalization & Adapters ---
  async getAdapterHealth() {
    await this.checkBackendAvailability();
    if (!this.isMockMode) {
      try {
        const res = await fetch(`${this.baseUrl}/api/adapters/health`);
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn('Backend adapters health failed, using mock:', err);
      }
    }
    return MOCK_ADAPTERS;
  }

  // --- Pipeline 3: AI Video Analytics ---
  async getAIDetections() {
    await this.checkBackendAvailability();
    return MOCK_AI_DETECTIONS;
  }

  // --- Pipeline 4: Intelligence & Correlation ---
  async getIntelligenceEvents() {
    await this.checkBackendAvailability();
    if (!this.isMockMode) {
      try {
        const res = await fetch(`${this.baseUrl}/api/intelligence/events`);
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn('Backend intelligence events failed, using mock:', err);
      }
    }
    return MOCK_INTELLIGENCE_EVENTS;
  }

  async getWatchlistMatches() {
    await this.checkBackendAvailability();
    if (!this.isMockMode) {
      try {
        const res = await fetch(`${this.baseUrl}/api/intelligence/watchlist-matches`);
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn('Backend watchlist matches failed, using mock:', err);
      }
    }
    return MOCK_WATCHLIST_MATCHES;
  }

  async getEntityTimeline(entityId) {
    await this.checkBackendAvailability();
    if (!this.isMockMode) {
      try {
        const res = await fetch(`${this.baseUrl}/api/operations/entities/${entityId}/timeline`);
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn('Backend entity timeline failed, using mock:', err);
      }
    }
    return MOCK_ENTITY_TIMELINES[entityId] || [
      {
        observation_id: 'OBS-GEN-1',
        entity_id: entityId,
        camera_uid: 'CAM-AHM-001',
        camera_name: 'Sabarmati Promenade',
        district: 'Ahmedabad',
        timestamp: new Date().toISOString(),
        confidence: 0.92,
        activity: 'Correlated multi-camera transit',
      },
    ];
  }

  // --- Pipeline 5: Operations & Investigation ---
  async getOperationalAlerts() {
    await this.checkBackendAvailability();
    if (!this.isMockMode) {
      try {
        const res = await fetch(`${this.baseUrl}/api/operations/alerts`);
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn('Backend alerts failed, using mock:', err);
      }
    }
    return localAlerts;
  }

  async updateAlertStatus(alertId, newStatus, reason = '', actorId = 'OPR-GUJ-701') {
    await this.checkBackendAvailability();
    if (!this.isMockMode) {
      try {
        const res = await fetch(`${this.baseUrl}/api/operations/alerts/${alertId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus, actor_id: actorId, reason }),
        });
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn('Backend updateAlertStatus failed, updating local state:', err);
      }
    }

    localAlerts = localAlerts.map((alt) => {
      if (alt.alert_id === alertId) {
        return {
          ...alt,
          status: newStatus,
          last_actor: actorId,
          last_reason: reason,
          updated_at: new Date().toISOString(),
        };
      }
      return alt;
    });

    return localAlerts.find((alt) => alt.alert_id === alertId);
  }

  async createInvestigation(investigationData) {
    await this.checkBackendAvailability();
    if (!this.isMockMode) {
      try {
        const res = await fetch(`${this.baseUrl}/api/operations/investigations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
      investigation_id: `INV-${Date.now()}`,
      status: 'OPEN',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    localInvestigations.push(newInv);
    return newInv;
  }
}

export const api = new VistaApiClient();
export default api;
