import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import DataTable from '../components/DataTable';
import { MOCK_CAMERAS, getCCTVRegistryStats } from '../api/mockData';
import './CameraRegistry.css';

function CameraRegistry() {
  const navigate = useNavigate();
  const [cameras, setCameras] = useState(MOCK_CAMERAS);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [activeTab, setActiveTab] = useState('Details');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // New Camera Form State
  const [newCameraForm, setNewCameraForm] = useState({
    camera_uid: '',
    name: '',
    department: 'Police',
    district: 'Ahmedabad',
    location: '',
    type: 'PTZ Dome',
    resolution: '4K (3840x2160)',
    vms_vendor: 'Axis Communications',
    protocol_type: 'RTSP',
    power_source: 'PoE+ (IEEE 802.3at)',
    status: 'Online',
    latitude: 23.0225,
    longitude: 72.5714,
  });

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

  // Handle Add Camera Submit
  const handleAddCameraSubmit = (e) => {
    e.preventDefault();
    if (!newCameraForm.name || !newCameraForm.location) {
      alert('Please enter camera name and location.');
      return;
    }

    const generatedUid =
      newCameraForm.camera_uid ||
      `CAM-${newCameraForm.district.substring(0, 3).toUpperCase()}-${String(
        cameras.length + 1
      ).padStart(3, '0')}`;

    const newCam = {
      id: cameras.length + 1,
      camera_uid: generatedUid,
      name: newCameraForm.name,
      department: newCameraForm.department,
      district: newCameraForm.district,
      location: newCameraForm.location,
      type: newCameraForm.type,
      latitude: parseFloat(newCameraForm.latitude) || 23.0225,
      longitude: parseFloat(newCameraForm.longitude) || 72.5714,
      vms_vendor: newCameraForm.vms_vendor,
      protocol_type: newCameraForm.protocol_type,
      status: newCameraForm.status,
      installed_on: new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      power_source: newCameraForm.power_source,
      warranty_status: 'Active (3-Year AMC)',
      ai_enabled: true,
      fps: 30,
      resolution: newCameraForm.resolution,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      maintenance: {
        last_serviced: 'Today (Commissioned)',
        next_scheduled: 'In 3 Months',
        contractor: 'Gujarat State Telecom SPV',
        firmware: 'v4.14.0 (Factory Sealed)',
        uptime_pct: '100.0%',
      },
      history: [
        {
          date: new Date().toISOString().replace('T', ' ').substring(0, 16),
          event: 'Asset registered in Gujarat Central CCTV Inventory',
          author: 'Operator PSI',
        },
      ],
    };

    setCameras([newCam, ...cameras]);
    setIsAddModalOpen(false);
    showToast(`Registered ${generatedUid} successfully.`);
    // Reset form
    setNewCameraForm({
      camera_uid: '',
      name: '',
      department: 'Police',
      district: 'Ahmedabad',
      location: '',
      type: 'PTZ Dome',
      resolution: '4K (3840x2160)',
      vms_vendor: 'Axis Communications',
      protocol_type: 'RTSP',
      power_source: 'PoE+ (IEEE 802.3at)',
      status: 'Online',
      latitude: 23.0225,
      longitude: 72.5714,
    });
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
        key: 'type',
        label: 'Type',
        sortable: true,
        width: '140px',
        render: (val) => <span className="cam-type-cell">{val || 'PTZ Dome'}</span>,
      },
      {
        key: 'status',
        label: 'Status',
        sortable: true,
        width: '130px',
        render: (val) => <StatusBadge status={val} size="sm" />,
      },
      {
        key: 'installed_on',
        label: 'Installed On',
        sortable: true,
        width: '130px',
        render: (val) => <span className="cam-date-cell">{val || '12 Jan 2025'}</span>,
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

  // DataTable Filters configuration
  const filters = useMemo(
    () => [
      {
        key: 'department',
        label: 'Department',
        placeholder: 'All Departments',
        options: [
          { value: 'ALL', label: 'All Departments' },
          { value: 'Police', label: 'Police' },
          { value: 'Municipal Corporation', label: 'Municipal Corporation' },
          { value: 'Transport', label: 'Transport' },
          { value: 'Education', label: 'Education' },
          { value: 'Health', label: 'Health' },
        ],
      },
      {
        key: 'district',
        label: 'District',
        placeholder: 'All Districts',
        options: [
          { value: 'ALL', label: 'All Districts' },
          { value: 'Ahmedabad', label: 'Ahmedabad' },
          { value: 'Surat', label: 'Surat' },
          { value: 'Vadodara', label: 'Vadodara' },
          { value: 'Gandhinagar', label: 'Gandhinagar' },
          { value: 'Rajkot', label: 'Rajkot' },
          { value: 'Bhavnagar', label: 'Bhavnagar' },
          { value: 'Jamnagar', label: 'Jamnagar' },
          { value: 'Kutch', label: 'Kutch' },
        ],
      },
      {
        key: 'type',
        label: 'Type',
        placeholder: 'All Types',
        options: [
          { value: 'ALL', label: 'All Camera Types' },
          { value: 'PTZ Dome', label: 'PTZ Dome' },
          { value: 'Bullet Fixed', label: 'Bullet Fixed' },
          { value: 'ANPR High-Speed', label: 'ANPR High-Speed' },
          { value: 'Fisheye 360°', label: 'Fisheye 360°' },
          { value: 'Box Thermal', label: 'Box Thermal' },
        ],
      },
      {
        key: 'status',
        label: 'Status',
        placeholder: 'All Statuses',
        options: [
          { value: 'ALL', label: 'All Statuses' },
          { value: 'Online', label: 'Online' },
          { value: 'Active', label: 'Active' },
          { value: 'Maintenance', label: 'Maintenance' },
          { value: 'Degraded', label: 'Degraded' },
          { value: 'Offline', label: 'Offline' },
        ],
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
            <h1 className="registry-title">CCTV Registry</h1>
            <span className="registry-pipeline-badge">
              Pipeline 1 · Registry & GIS Foundation
            </span>
          </div>
          <p className="registry-subtitle">
            Centralised inventory of all CCTV assets across Gujarat public safety jurisdictions
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
            <span>Add New Camera</span>
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
          subtext="Police, Municipal, Transport, Edu, Health"
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
          trendText="+2.4% vs last month"
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
          trendText={`${stats.offlineCount} nodes under triage`}
          isPositive={false}
          subtext="Maintenance tickets active"
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
        subtitle={`Showing ${cameras.length} verified surveillance camera nodes`}
        columns={columns}
        rows={cameras}
        rowKey="camera_uid"
        searchable={true}
        searchPlaceholder="Search by ID, location, department, or camera type..."
        filters={filters}
        pagination={true}
        pageSize={10}
        pageSizeOptions={[5, 10, 25, 50]}
        onRowClick={(row) => {
          setSelectedCamera(row);
          setActiveTab('Details');
        }}
      />

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
              {/* Tab 1: Details */}
              {activeTab === 'Details' && (
                <div className="detail-meta-grid">
                  <div className="detail-meta-item">
                    <span className="detail-meta-label">Camera Type</span>
                    <span className="detail-meta-value">{selectedCamera.type || 'PTZ Dome 36x'}</span>
                  </div>
                  <div className="detail-meta-item">
                    <span className="detail-meta-label">Resolution & Framerate</span>
                    <span className="detail-meta-value">
                      {selectedCamera.resolution} @ {selectedCamera.fps || 30} FPS
                    </span>
                  </div>
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
                    <span className="detail-meta-value">
                      {selectedCamera.protocol_type} (Pipeline 2 Normalized)
                    </span>
                  </div>
                  <div className="detail-meta-item">
                    <span className="detail-meta-label">Power Source</span>
                    <span className="detail-meta-value">
                      {selectedCamera.power_source || 'PoE+ (IEEE 802.3at)'}
                    </span>
                  </div>
                  <div className="detail-meta-item">
                    <span className="detail-meta-label">Installation Date</span>
                    <span className="detail-meta-value">{selectedCamera.installed_on}</span>
                  </div>
                  <div className="detail-meta-item">
                    <span className="detail-meta-label">Warranty & AMC</span>
                    <span className="detail-meta-value">
                      {selectedCamera.warranty_status || 'Active (3-Year AMC)'}
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
                      Mounted on Heavy-Duty Galvanized Steel Pole (8.5m AGL). Azimuth coverage: 360° continuous rotation with 45° vertical tilt angle. Directly indexed into the Gujarat Police GIS Matrix.
                    </p>
                  </div>
                </div>
              )}

              {/* Tab 3: Maintenance */}
              {activeTab === 'Maintenance' && (
                <div className="detail-meta-grid">
                  <div className="detail-meta-item">
                    <span className="detail-meta-label">Operational Health</span>
                    <div style={{ marginTop: 4 }}>
                      <StatusBadge status={selectedCamera.status} size="sm" />
                    </div>
                  </div>
                  <div className="detail-meta-item">
                    <span className="detail-meta-label">90-Day Uptime</span>
                    <span className="detail-meta-value" style={{ color: '#16a34a' }}>
                      {selectedCamera.maintenance?.uptime_pct || '99.8%'}
                    </span>
                  </div>
                  <div className="detail-meta-item">
                    <span className="detail-meta-label">Last Serviced</span>
                    <span className="detail-meta-value">
                      {selectedCamera.maintenance?.last_serviced || '14 Aug 2026'}
                    </span>
                  </div>
                  <div className="detail-meta-item">
                    <span className="detail-meta-label">Next Scheduled Inspection</span>
                    <span className="detail-meta-value">
                      {selectedCamera.maintenance?.next_scheduled || '14 Nov 2026'}
                    </span>
                  </div>
                  <div className="detail-meta-item">
                    <span className="detail-meta-label">Authorized Contractor</span>
                    <span className="detail-meta-value">
                      {selectedCamera.maintenance?.contractor || 'Gujarat Infotech Ltd'}
                    </span>
                  </div>
                  <div className="detail-meta-item">
                    <span className="detail-meta-label">Installed Firmware</span>
                    <span className="detail-meta-value" style={{ fontFamily: 'monospace' }}>
                      {selectedCamera.maintenance?.firmware || 'v4.12.8-p3'}
                    </span>
                  </div>
                </div>
              )}

              {/* Tab 4: History */}
              {activeTab === 'History' && (
                <div className="history-timeline">
                  {(selectedCamera.history && selectedCamera.history.length > 0
                    ? selectedCamera.history
                    : [
                        {
                          date: '2026-09-12 14:32',
                          event: 'Protocol heartbeat and RTSP 200 OK verified',
                          author: 'Pipeline 2 Health Check',
                        },
                        {
                          date: '2026-08-14 11:15',
                          event: 'Quarterly field inspection and optical lens cleaning',
                          author: 'Field Technician #42',
                        },
                        {
                          date: '2025-01-12 10:00',
                          event: 'Initial commissioning and GIS geofence integration',
                          author: 'State Deployment Team',
                        },
                      ]
                  ).map((ev, idx) => (
                    <div key={idx} className="timeline-event-item">
                      <div className="timeline-event-dot" />
                      <div className="timeline-event-header">
                        <span className="timeline-event-date">{ev.date}</span>
                        <span className="timeline-event-author">{ev.author}</span>
                      </div>
                      <p className="timeline-event-title">{ev.event}</p>
                    </div>
                  ))}
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
                    <label className="form-label">Department *</label>
                    <select
                      className="form-select"
                      value={newCameraForm.department}
                      onChange={(e) =>
                        setNewCameraForm({ ...newCameraForm, department: e.target.value })
                      }
                    >
                      <option value="Police">Police</option>
                      <option value="Municipal Corporation">Municipal Corporation</option>
                      <option value="Transport">Transport</option>
                      <option value="Education">Education</option>
                      <option value="Health">Health</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">District *</label>
                    <select
                      className="form-select"
                      value={newCameraForm.district}
                      onChange={(e) =>
                        setNewCameraForm({ ...newCameraForm, district: e.target.value })
                      }
                    >
                      <option value="Ahmedabad">Ahmedabad</option>
                      <option value="Surat">Surat</option>
                      <option value="Vadodara">Vadodara</option>
                      <option value="Gandhinagar">Gandhinagar</option>
                      <option value="Rajkot">Rajkot</option>
                      <option value="Bhavnagar">Bhavnagar</option>
                      <option value="Jamnagar">Jamnagar</option>
                      <option value="Kutch">Kutch</option>
                    </select>
                  </div>

                  <div className="form-group full-width">
                    <label className="form-label">Specific Location / Landmark *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Near Amphitheater Gate 3, Vastrapur"
                      value={newCameraForm.location}
                      onChange={(e) =>
                        setNewCameraForm({ ...newCameraForm, location: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Camera Type</label>
                    <select
                      className="form-select"
                      value={newCameraForm.type}
                      onChange={(e) =>
                        setNewCameraForm({ ...newCameraForm, type: e.target.value })
                      }
                    >
                      <option value="PTZ Dome">PTZ Dome</option>
                      <option value="Bullet Fixed">Bullet Fixed</option>
                      <option value="ANPR High-Speed">ANPR High-Speed</option>
                      <option value="Fisheye 360°">Fisheye 360°</option>
                      <option value="Box Thermal">Box Thermal</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Stream Resolution</label>
                    <select
                      className="form-select"
                      value={newCameraForm.resolution}
                      onChange={(e) =>
                        setNewCameraForm({ ...newCameraForm, resolution: e.target.value })
                      }
                    >
                      <option value="4K (3840x2160)">4K Ultra HD (3840x2160)</option>
                      <option value="1080p (1920x1080)">1080p Full HD (1920x1080)</option>
                      <option value="720p (1280x720)">720p HD (1280x720)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Hardware Vendor</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Axis Communications"
                      value={newCameraForm.vms_vendor}
                      onChange={(e) =>
                        setNewCameraForm({ ...newCameraForm, vms_vendor: e.target.value })
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Protocol Ingest</label>
                    <select
                      className="form-select"
                      value={newCameraForm.protocol_type}
                      onChange={(e) =>
                        setNewCameraForm({ ...newCameraForm, protocol_type: e.target.value })
                      }
                    >
                      <option value="RTSP">RTSP (Real-Time Streaming Protocol)</option>
                      <option value="ONVIF">ONVIF Profile S/G</option>
                      <option value="HLS">HLS (HTTP Live Streaming)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">GPS Latitude</label>
                    <input
                      type="number"
                      step="0.0001"
                      className="form-input"
                      value={newCameraForm.latitude}
                      onChange={(e) =>
                        setNewCameraForm({ ...newCameraForm, latitude: e.target.value })
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">GPS Longitude</label>
                    <input
                      type="number"
                      step="0.0001"
                      className="form-input"
                      value={newCameraForm.longitude}
                      onChange={(e) =>
                        setNewCameraForm({ ...newCameraForm, longitude: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary-add">
                  Register Asset
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
