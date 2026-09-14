import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import DataTable from '../components/DataTable';
import { getCCTVRegistryStats } from '../api/mockData';
import api from '../api/client';
import { useLanguage } from '../i18n/LanguageContext';
import './CameraRegistry.css';

// docs/backend.md's real CameraCreate schema (server/schemas/camera.py) -- only these
// map to a field the backend actually stores. The original mock form also collected
// `type`/`resolution`/`power_source`/`warranty_status`, none of which the backend has
// a column for; keeping them in the "add camera" form would silently discard them on
// submit while the success toast implied everything was saved. Dropped rather than
// kept as decoration.
const PROTOCOL_TYPES = ['RTSP', 'HLS', 'ONVIF', 'VENDOR_SDK'];
const CAMERA_STATUSES = ['ACTIVE', 'INACTIVE', 'DEGRADED', 'OFFLINE'];
const AI_PROFILES = ['TRAFFIC', 'SECURITY', 'RTO'];
// prd.md §0.1's actual named departments, not the mock's invented "Municipal
// Corporation/Transport/Education" list.
const DEPARTMENTS = ['Police', 'Health', 'GSRTC', 'Panchayat', 'Municipal', 'Food & Civil Supplies', 'RTO'];
const DISTRICTS = ['Ahmedabad', 'Surat', 'Vadodara', 'Gandhinagar', 'Rajkot', 'Bhavnagar', 'Jamnagar', 'Kutch'];

const emptyNewCameraForm = {
  camera_uid: '',
  name: '',
  department: 'Police',
  district: 'Ahmedabad',
  location: '',
  vms_vendor: '',
  protocol_type: 'RTSP',
  status: 'ACTIVE',
  ai_enabled: true,
  ai_profile: 'TRAFFIC',
  latitude: '',
  longitude: '',
  rtsp_url: '',
};

function CameraRegistry() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [activeTab, setActiveTab] = useState('Details');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [newCameraForm, setNewCameraForm] = useState(emptyNewCameraForm);

  // Model 1's mandatory "gap-analysis report" (prd.md §0.1) -- real
  // GET /api/cameras/gap-analysis, previously wired on the client (api.getGapAnalysis())
  // but never surfaced on any page.
  const [gaps, setGaps] = useState([]);
  const [gapsLoading, setGapsLoading] = useState(true);
  const [expectedMinimum, setExpectedMinimum] = useState(3);

  const loadCameras = () => {
    setLoading(true);
    api
      .getCameras()
      .then((data) => setCameras(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  };

  const loadGaps = (minimum) => {
    setGapsLoading(true);
    api
      .getGapAnalysis(minimum)
      .then((data) => setGaps(Array.isArray(data.gaps) ? data.gaps : []))
      .finally(() => setGapsLoading(false));
  };

  useEffect(() => {
    loadCameras();
    loadGaps(expectedMinimum);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, 3000);
  };

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedCamera(null);
        setIsAddModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Compute live registry stats
  const stats = useMemo(() => {
    return getCCTVRegistryStats(cameras);
  }, [cameras]);

  // Handle "View Live" click
  const handleViewLive = (camera) => {
    const camId = camera?.camera_uid || camera?.id;
    // Route to Model 2 (Unified Live Viewing)
    navigate(`/model-2?camera=${camId}`);
  };

  // Handle Add Camera Submit -- real POST /api/cameras/ (server/routers/cameras.py),
  // not a local-only array push. camera_uid is auto-generated only as a convenience
  // when left blank; the backend rejects a duplicate either way (409), which
  // handleAddCameraSubmit surfaces as a real form error, not a silent no-op.
  const handleAddCameraSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!newCameraForm.name || !newCameraForm.location || !newCameraForm.vms_vendor) {
      setFormError('Please fill in name, location, and hardware vendor.');
      return;
    }

    const generatedUid =
      newCameraForm.camera_uid ||
      `CAM-${newCameraForm.district.substring(0, 3).toUpperCase()}-${String(cameras.length + 1).padStart(3, '0')}`;

    const payload = {
      camera_uid: generatedUid,
      name: newCameraForm.name,
      department: newCameraForm.department,
      district: newCameraForm.district,
      location: newCameraForm.location,
      vms_vendor: newCameraForm.vms_vendor,
      protocol_type: newCameraForm.protocol_type,
      status: newCameraForm.status,
      ai_enabled: newCameraForm.ai_enabled,
      ai_profile: newCameraForm.ai_profile,
      latitude: newCameraForm.latitude === '' ? null : parseFloat(newCameraForm.latitude),
      longitude: newCameraForm.longitude === '' ? null : parseFloat(newCameraForm.longitude),
      rtsp_url: newCameraForm.rtsp_url || null,
    };

    setSubmitting(true);
    try {
      await api.createCamera(payload);
      setIsAddModalOpen(false);
      showToast(`Registered ${generatedUid} successfully.`);
      setNewCameraForm(emptyNewCameraForm);
      loadCameras();
      loadGaps(expectedMinimum);
    } catch (err) {
      setFormError(err.message || 'Failed to register camera.');
    } finally {
      setSubmitting(false);
    }
  };

  // DataTable Column Definitions
  const columns = useMemo(
    () => [
      {
        key: 'camera_uid',
        label: 'Camera ID',
        sortable: true,
        width: '140px',
        render: (val) => <span className="cam-id-cell">{val}</span>,
      },
      {
        key: 'location',
        label: 'Location',
        sortable: true,
        render: (val, row) => (
          <div className="cam-location-cell">
            <span className="cam-location-name">{row.name || val}</span>
            <span className="cam-location-sub">
              {row.location} · {row.district}
            </span>
          </div>
        ),
      },
      {
        key: 'department',
        label: 'Department',
        sortable: true,
        width: '170px',
        render: (val) => (
          <span className="cam-dept-badge" data-dept={val}>
            {val}
          </span>
        ),
      },
      {
        key: 'protocol_type',
        label: 'Protocol',
        sortable: true,
        width: '120px',
        render: (val) => <span className="cam-type-cell">{val || '—'}</span>,
      },
      {
        key: 'status',
        label: 'Status',
        sortable: true,
        width: '130px',
        render: (val) => <StatusBadge status={val} size="sm" />,
      },
      {
        key: 'onboarding_source',
        label: 'Onboarded via',
        sortable: true,
        width: '130px',
        render: (val) => <span className="cam-date-cell">{val || 'MANUAL'}</span>,
      },
      {
        key: 'created_at',
        label: 'Registered',
        sortable: true,
        width: '130px',
        render: (val) => <span className="cam-date-cell">{val ? new Date(val).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</span>,
      },
      {
        key: 'actions',
        label: 'Action',
        align: 'right',
        width: '100px',
        render: (_, row) => (
          <button
            type="button"
            className="action-view-btn"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedCamera(row);
              setActiveTab('Details');
            }}
            title={`View full details for ${row.camera_uid}`}
            aria-label="View Details"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span>View</span>
          </button>
        ),
      },
    ],
    []
  );

  // DataTable Filters configuration -- values now match the real backend's fields
  // (server/schemas/camera.py) instead of the mock's invented department/type
  // vocabulary, which real camera rows would never match against.
  const filters = useMemo(
    () => [
      {
        key: 'department',
        label: 'Department',
        placeholder: 'All Departments',
        options: [{ value: 'ALL', label: 'All Departments' }, ...DEPARTMENTS.map((d) => ({ value: d, label: d }))],
      },
      {
        key: 'district',
        label: 'District',
        placeholder: 'All Districts',
        options: [{ value: 'ALL', label: 'All Districts' }, ...DISTRICTS.map((d) => ({ value: d, label: d }))],
      },
      {
        key: 'protocol_type',
        label: 'Protocol',
        placeholder: 'All Protocols',
        options: [{ value: 'ALL', label: 'All Protocols' }, ...PROTOCOL_TYPES.map((p) => ({ value: p, label: p }))],
      },
      {
        key: 'status',
        label: 'Status',
        placeholder: 'All Statuses',
        options: [{ value: 'ALL', label: 'All Statuses' }, ...CAMERA_STATUSES.map((s) => ({ value: s, label: s }))],
      },
    ],
    []
  );

  return (
    <div className="camera-registry-page">
      {/* 1. Page Header */}
      <div className="registry-header">
        <div className="registry-header-left">
          <div className="registry-title-row">
            <h1 className="registry-title">{t('registry_title')}</h1>
            <span className="registry-pipeline-badge">
              Pipeline 1 · Registry & GIS Foundation
            </span>
          </div>
          <p className="registry-subtitle">
            {t('registry_subtitle')}
          </p>
        </div>

        <div className="registry-header-right">
          <button
            type="button"
            className="btn-primary-add"
            onClick={() => setIsAddModalOpen(true)}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>{t('registry_add_camera')}</span>
          </button>
        </div>
      </div>

      {/* 2. Row of 5 StatCards */}
      <div className="registry-stats-grid">
        <StatCard
          label="Total Cameras"
          value={stats.totalCameras}
          statusAccent="blue"
          subtext="Statewide physical inventory"
          icon={
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 7l-7 5 7 5V7z" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          }
        />

        <StatCard
          label="Departments"
          value={stats.totalDepartments}
          statusAccent="blue"
          subtext="Police, Health, GSRTC, Panchayat, Municipal, RTO..."
          icon={
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
              <line x1="9" y1="22" x2="9" y2="22.01" />
              <line x1="15" y1="22" x2="15" y2="22.01" />
              <line x1="9" y1="6" x2="9" y2="6.01" />
              <line x1="15" y1="6" x2="15" y2="6.01" />
              <line x1="9" y1="10" x2="9" y2="10.01" />
              <line x1="15" y1="10" x2="15" y2="10.01" />
              <line x1="9" y1="14" x2="9" y2="14.01" />
              <line x1="15" y1="14" x2="15" y2="14.01" />
              <line x1="9" y1="18" x2="9" y2="18.01" />
              <line x1="15" y1="18" x2="15" y2="18.01" />
            </svg>
          }
        />

        <StatCard
          label="Locations"
          value={stats.totalLocations}
          statusAccent="amber"
          subtext="Covering 8 major Gujarat districts"
          icon={
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          }
        />

        <StatCard
          label="Operational"
          value={stats.operationalPct}
          suffix="%"
          statusAccent="green"
          isPositive={true}
          subtext={`${stats.operationalCount} nodes online & streaming`}
          icon={
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          }
        />

        <StatCard
          label="Offline"
          value={stats.offlinePct}
          suffix="%"
          statusAccent="red"
          isPositive={false}
          subtext={`${stats.offlineCount} nodes offline`}
          icon={
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
          }
        />
      </div>

      {/* 3. DataTable of CCTV Assets */}
      <DataTable
        title="Asset Inventory"
        subtitle={loading ? 'Loading registry…' : `Showing ${cameras.length} registered camera nodes`}
        columns={columns}
        rows={cameras}
        rowKey="camera_uid"
        searchable={true}
        searchPlaceholder="Search by ID, location, department, or protocol..."
        filters={filters}
        pagination={true}
        pageSize={10}
        pageSizeOptions={[5, 10, 25, 50]}
        emptyMessage={loading ? 'Loading registry…' : 'No cameras registered yet.'}
        onRowClick={(row) => {
          setSelectedCamera(row);
          setActiveTab('Details');
        }}
      />

      {/* 3.5 Coverage gap-analysis -- Model 1's mandatory "gap-analysis report"
          (prd.md §0.1), real GET /api/cameras/gap-analysis, previously wired on the
          client but never surfaced on any page. */}
      <div className="gap-analysis-panel">
        <div className="gap-analysis-header">
          <div>
            <h2 className="gap-analysis-title">Coverage Gap Analysis</h2>
            <p className="gap-analysis-subtitle">
              District &times; department combinations below the expected minimum camera count.
            </p>
          </div>
          <label className="gap-analysis-threshold">
            <span>Expected minimum per district/dept</span>
            <input
              type="number"
              min="1"
              value={expectedMinimum}
              onChange={(e) => {
                const val = Math.max(1, Number(e.target.value) || 1);
                setExpectedMinimum(val);
                loadGaps(val);
              }}
            />
          </label>
        </div>

        {gapsLoading ? (
          <p className="gap-analysis-empty">Loading gap analysis…</p>
        ) : gaps.length === 0 ? (
          <p className="gap-analysis-empty">
            No shortfalls — every district/department combination with at least one camera meets the
            expected minimum of {expectedMinimum}.
          </p>
        ) : (
          <table className="gap-analysis-table">
            <thead>
              <tr>
                <th>District</th>
                <th>Department</th>
                <th>Current</th>
                <th>Expected Min</th>
                <th>Shortfall</th>
              </tr>
            </thead>
            <tbody>
              {gaps.map((g) => (
                <tr key={`${g.district}-${g.department}`}>
                  <td>{g.district}</td>
                  <td>{g.department}</td>
                  <td>{g.camera_count}</td>
                  <td>{g.expected_minimum}</td>
                  <td className="gap-shortfall-cell">{g.shortfall}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 4. Detail Panel / Modal */}
      {selectedCamera && (
        <div
          className="modal-backdrop"
          onClick={() => setSelectedCamera(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="modal-container"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="modal-header">
              <div className="modal-header-info">
                <div className="modal-title-row">
                  <h2 className="modal-title">{selectedCamera.name}</h2>
                  <span className="cam-id-cell">{selectedCamera.camera_uid}</span>
                  <StatusBadge status={selectedCamera.status} size="sm" />
                </div>
                <p className="modal-subtitle">
                  {selectedCamera.location} · {selectedCamera.district}, Gujarat
                </p>
              </div>

              <div className="modal-header-actions">
                <button
                  type="button"
                  className="btn-view-live"
                  onClick={() => handleViewLive(selectedCamera)}
                  title="Link to Live Cameras page for this stream"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  <span>View Live</span>
                </button>

                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => setSelectedCamera(null)}
                  title="Close (Esc)"
                  aria-label="Close modal"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Tabs Navigation */}
            <div className="modal-tabs-nav">
              {['Details', 'Location', 'Maintenance', 'History'].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`modal-tab-btn ${activeTab === tab ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Modal Body Content */}
            <div className="modal-body">
              {/* Tab 1: Details -- only fields the real backend actually stores
                  (server/schemas/camera.py). No fabricated hardware/warranty specs. */}
              {activeTab === 'Details' && (
                <div className="detail-meta-grid">
                  <div className="detail-meta-item">
                    <span className="detail-meta-label">Department</span>
                    <span className="detail-meta-value">{selectedCamera.department}</span>
                  </div>
                  <div className="detail-meta-item">
                    <span className="detail-meta-label">Hardware Vendor</span>
                    <span className="detail-meta-value">{selectedCamera.vms_vendor}</span>
                  </div>
                  <div className="detail-meta-item">
                    <span className="detail-meta-label">Protocol</span>
                    <span className="detail-meta-value">{selectedCamera.protocol_type}</span>
                  </div>
                  <div className="detail-meta-item">
                    <span className="detail-meta-label">AI Enabled</span>
                    <span className="detail-meta-value">{selectedCamera.ai_enabled ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="detail-meta-item">
                    <span className="detail-meta-label">AI Profile</span>
                    <span className="detail-meta-value">{selectedCamera.ai_profile || 'TRAFFIC'}</span>
                  </div>
                  <div className="detail-meta-item">
                    <span className="detail-meta-label">Onboarding Source</span>
                    <span className="detail-meta-value">{selectedCamera.onboarding_source || 'MANUAL'}</span>
                  </div>
                  <div className="detail-meta-item">
                    <span className="detail-meta-label">Registered</span>
                    <span className="detail-meta-value">
                      {selectedCamera.created_at ? new Date(selectedCamera.created_at).toLocaleString('en-GB') : '—'}
                    </span>
                  </div>
                  <div className="detail-meta-item">
                    <span className="detail-meta-label">Last Updated</span>
                    <span className="detail-meta-value">
                      {selectedCamera.updated_at ? new Date(selectedCamera.updated_at).toLocaleString('en-GB') : '—'}
                    </span>
                  </div>
                </div>
              )}

              {/* Tab 2: Location */}
              {activeTab === 'Location' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div className="detail-meta-grid">
                    <div className="detail-meta-item">
                      <span className="detail-meta-label">District</span>
                      <span className="detail-meta-value">{selectedCamera.district}, Gujarat</span>
                    </div>
                    <div className="detail-meta-item">
                      <span className="detail-meta-label">Specific Landmark</span>
                      <span className="detail-meta-value">{selectedCamera.location}</span>
                    </div>
                    <div className="detail-meta-item">
                      <span className="detail-meta-label">Latitude</span>
                      <span className="detail-meta-value">{selectedCamera.latitude?.toFixed(6)}° N</span>
                    </div>
                    <div className="detail-meta-item">
                      <span className="detail-meta-label">Longitude</span>
                      <span className="detail-meta-value">{selectedCamera.longitude?.toFixed(6)}° E</span>
                    </div>
                  </div>

                  <div className="location-gis-card">
                    <div className="location-gis-header">
                      <span className="gis-header-title">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                          <line x1="8" y1="2" x2="8" y2="18" />
                          <line x1="16" y1="6" x2="16" y2="22" />
                        </svg>
                        GIS Telemetry & Geolocation
                      </span>
                      <span className="gis-coords-badge">
                        {selectedCamera.latitude?.toFixed(4)}, {selectedCamera.longitude?.toFixed(4)}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#475569' }}>
                      GPS coordinates as registered in the camera record. No fixed installation/mounting
                      metadata (pole height, azimuth) is tracked by the backend.
                    </p>
                  </div>
                </div>
              )}

              {/* Tab 3: Maintenance -- the backend does not track uptime history, service
                  records, or firmware yet (docs/backend.md's checklist has no such
                  endpoint). Real status only; everything else was fabricated before. */}
              {activeTab === 'Maintenance' && (
                <div className="detail-meta-grid">
                  <div className="detail-meta-item">
                    <span className="detail-meta-label">Operational Status</span>
                    <div style={{ marginTop: 4 }}>
                      <StatusBadge status={selectedCamera.status} size="sm" />
                    </div>
                  </div>
                  <div className="detail-meta-item" style={{ gridColumn: '1 / -1' }}>
                    <span className="detail-meta-label">Maintenance tracking</span>
                    <span className="detail-meta-value" style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                      Not yet tracked by the backend -- uptime history, service records, and firmware
                      versioning aren't part of the camera registry API yet.
                    </span>
                  </div>
                </div>
              )}

              {/* Tab 4: History -- same reasoning as Maintenance above: no per-camera
                  audit trail endpoint exists yet, so there's nothing real to show. */}
              {activeTab === 'History' && (
                <div className="history-timeline">
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>
                    No activity history is tracked for individual cameras yet. The platform's audit log
                    (Administration, once built) records who registered/edited a camera, but doesn't yet
                    surface a per-camera timeline here.
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setSelectedCamera(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn-primary-add"
                style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                onClick={() => handleViewLive(selectedCamera)}
              >
                View Live Stream →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Add New Camera Asset Modal */}
      {isAddModalOpen && (
        <div
          className="modal-backdrop"
          onClick={() => setIsAddModalOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="modal-container"
            style={{ maxWidth: '640px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-header-info">
                <h2 className="modal-title">Register New CCTV Asset</h2>
                <p className="modal-subtitle">
                  Enroll an active surveillance feed into Gujarat Police GIS Foundation
                </p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsAddModalOpen(false)}
                aria-label="Close modal"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleAddCameraSubmit}>
              <div className="modal-body" style={{ maxHeight: 'calc(85vh - 150px)' }}>
                <div className="add-cam-form">
                  <div className="form-group full-width">
                    <label className="form-label">Camera Asset Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Vastrapur Lake Public Promenade North"
                      value={newCameraForm.name}
                      onChange={(e) =>
                        setNewCameraForm({ ...newCameraForm, name: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Camera UID</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Auto-generated if left blank"
                      value={newCameraForm.camera_uid}
                      onChange={(e) => setNewCameraForm({ ...newCameraForm, camera_uid: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Department *</label>
                    <select
                      className="form-select"
                      value={newCameraForm.department}
                      onChange={(e) => setNewCameraForm({ ...newCameraForm, department: e.target.value })}
                    >
                      {DEPARTMENTS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">District *</label>
                    <select
                      className="form-select"
                      value={newCameraForm.district}
                      onChange={(e) => setNewCameraForm({ ...newCameraForm, district: e.target.value })}
                    >
                      {DISTRICTS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group full-width">
                    <label className="form-label">Specific Location / Landmark *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Near Amphitheater Gate 3, Vastrapur"
                      value={newCameraForm.location}
                      onChange={(e) => setNewCameraForm({ ...newCameraForm, location: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Hardware Vendor *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Axis Communications"
                      value={newCameraForm.vms_vendor}
                      onChange={(e) => setNewCameraForm({ ...newCameraForm, vms_vendor: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Protocol *</label>
                    <select
                      className="form-select"
                      value={newCameraForm.protocol_type}
                      onChange={(e) => setNewCameraForm({ ...newCameraForm, protocol_type: e.target.value })}
                    >
                      {PROTOCOL_TYPES.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Status *</label>
                    <select
                      className="form-select"
                      value={newCameraForm.status}
                      onChange={(e) => setNewCameraForm({ ...newCameraForm, status: e.target.value })}
                    >
                      {CAMERA_STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">AI Profile</label>
                    <select
                      className="form-select"
                      value={newCameraForm.ai_profile}
                      onChange={(e) => setNewCameraForm({ ...newCameraForm, ai_profile: e.target.value })}
                    >
                      {AI_PROFILES.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      id="ai-enabled-checkbox"
                      checked={newCameraForm.ai_enabled}
                      onChange={(e) => setNewCameraForm({ ...newCameraForm, ai_enabled: e.target.checked })}
                    />
                    <label className="form-label" htmlFor="ai-enabled-checkbox" style={{ margin: 0 }}>AI analytics enabled</label>
                  </div>

                  <div className="form-group">
                    <label className="form-label">GPS Latitude</label>
                    <input
                      type="number"
                      step="0.0001"
                      className="form-input"
                      value={newCameraForm.latitude}
                      onChange={(e) => setNewCameraForm({ ...newCameraForm, latitude: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">GPS Longitude</label>
                    <input
                      type="number"
                      step="0.0001"
                      className="form-input"
                      value={newCameraForm.longitude}
                      onChange={(e) => setNewCameraForm({ ...newCameraForm, longitude: e.target.value })}
                    />
                  </div>

                  <div className="form-group full-width">
                    <label className="form-label">RTSP URL (optional)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="rtsp://user:pass@host:port/stream/id -- required to start a live feed"
                      value={newCameraForm.rtsp_url}
                      onChange={(e) => setNewCameraForm({ ...newCameraForm, rtsp_url: e.target.value })}
                    />
                  </div>
                </div>
                {formError && <p style={{ color: '#c62828', fontSize: '0.8rem', margin: '10px 24px 0' }}>{formError}</p>}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary-add" disabled={submitting}>
                  {submitting ? 'Registering…' : 'Register Asset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Notification Toast */}
      {toastMessage && (
        <div className="registry-toast">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

export default CameraRegistry;
