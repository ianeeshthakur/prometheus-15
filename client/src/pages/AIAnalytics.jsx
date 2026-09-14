import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useLanguage } from '../i18n/LanguageContext';
import './AIAnalytics.css';

// ============================================================================
// Pipeline flow visualization component
// ============================================================================

function PipelineFlowDiagram() {
  const steps = [
    { id: 'input', label: 'Normalized Frame', sub: 'Camera stream input', status: 'real' },
    { id: 'quality', label: 'Frame Quality Gate', sub: 'Blur + brightness check', status: 'real' },
    { id: 'vehicle', label: 'Vehicle Detection', sub: 'Not configured', status: 'stub' },
    { id: 'plate', label: 'License Plate Detection', sub: 'YOLO26n — REAL', status: 'real' },
    { id: 'ocr', label: 'OCR', sub: 'Not configured', status: 'stub' },
    { id: 'result', label: 'AI Analysis Result', sub: 'AIAnalysisResult schema', status: 'real' },
  ];

  return (
    <div className="pipeline-flow" aria-label="Pipeline 3 flow diagram">
      {steps.map((step, idx) => (
        <React.Fragment key={step.id}>
          <div className={`pipeline-step pipeline-step--${step.status}`}>
            <div className="pipeline-step-label">{step.label}</div>
            <div className="pipeline-step-sub">{step.sub}</div>
            <span className={`pipeline-step-badge pipeline-step-badge--${step.status}`}>
              {step.status === 'real' ? 'REAL' : step.status === 'stub' ? 'NOT CONFIGURED' : 'MOCK'}
            </span>
          </div>
          {idx < steps.length - 1 && (
            <div className="pipeline-arrow" aria-hidden="true">↓</div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ============================================================================
// Capability cards
// ============================================================================

const CAPABILITIES = [
  {
    id: 'plate',
    title: 'License Plate Detection',
    status: 'REAL',
    statusClass: 'real',
    model: 'YOLO26n',
    detail: 'Custom-trained YOLO model for license plate localization. Detects class 0 = license_plate.',
    specs: [
      { label: 'Input size', value: '640×640' },
      { label: 'Confidence threshold', value: '0.25 (default)' },
      { label: 'Device', value: 'CPU (GPU auto-detected)' },
      { label: 'Model size', value: '~5.1 MB' },
    ],
    metrics: [
      { label: 'Precision (test set)', value: '99.53%' },
      { label: 'Recall (test set)', value: '97.60%' },
      { label: 'mAP50 (test set)', value: '99.40%' },
      { label: 'mAP50-95 (test set)', value: '87.59%' },
    ],
    metricsDisclaimer: 'Test-set metrics only. Do not interpret as real-world field accuracy.',
  },
  {
    id: 'quality',
    title: 'Frame Quality Gate',
    status: 'ACTIVE',
    statusClass: 'real',
    model: 'FrameQualityAnalyzer',
    detail: 'Laplacian variance blur detection and luminance checks on every frame before model inference.',
    specs: [
      { label: 'Method', value: 'Laplacian variance + luminance' },
      { label: 'Output states', value: 'GOOD / LOW_QUALITY / POOR' },
    ],
  },
  {
    id: 'vehicle',
    title: 'Vehicle Detection',
    status: 'NOT CONFIGURED',
    statusClass: 'stub',
    model: 'StubVehicleDetector',
    detail: 'No vehicle detection model is present in the repository. The architecture supports vehicle-to-plate association via bbox containment/IoU. A real vehicle YOLO model can be plugged in without structural changes.',
    specs: [
      { label: 'Provider', value: 'StubRealVehicleDetector' },
      { label: 'Reason', value: 'No vehicle weights file found' },
    ],
  },
  {
    id: 'ocr',
    title: 'OCR (Plate Text)',
    status: 'NOT CONFIGURED',
    statusClass: 'stub',
    model: 'StubPaddleOCR',
    detail: 'PaddleOCR is installed but returning NOT_CONFIGURED. The architecture is ready for OCR integration. No plate text will be read until OCR is connected.',
    specs: [
      { label: 'Provider', value: 'StubPaddleOCR' },
      { label: 'Status', value: 'NOT_CONFIGURED' },
    ],
  },
  {
    id: 'tracker',
    title: 'Object Tracking',
    status: 'FALLBACK',
    statusClass: 'partial',
    model: 'IoUTracker (fallback)',
    detail: 'Lightweight IoU-based tracker assigns detection IDs across frames. ByteTrack is not installed; this is an explicit fallback, not a claim of ByteTrack.',
    specs: [
      { label: 'Method', value: 'Intersection-over-Union matching' },
      { label: 'ByteTrack', value: 'NOT installed' },
    ],
  },
];

function CapabilityCard({ cap }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`cap-card cap-card--${cap.statusClass}`}>
      <div className="cap-card-header" onClick={() => setOpen(v => !v)} style={{ cursor: 'pointer' }}>
        <div className="cap-card-title-row">
          <span className="cap-card-title">{cap.title}</span>
          <span className={`cap-badge cap-badge--${cap.statusClass}`}>{cap.status}</span>
        </div>
        <div className="cap-card-model">{cap.model}</div>
        <span className="cap-card-expand">{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div className="cap-card-body">
          <p className="cap-card-detail">{cap.detail}</p>
          {cap.specs && cap.specs.length > 0 && (
            <table className="cap-spec-table">
              <tbody>
                {cap.specs.map(s => (
                  <tr key={s.label}>
                    <td className="cap-spec-label">{s.label}</td>
                    <td className="cap-spec-value">{s.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {cap.metrics && (
            <>
              <div className="cap-metrics-heading">Supplied test-set metrics</div>
              <table className="cap-spec-table">
                <tbody>
                  {cap.metrics.map(m => (
                    <tr key={m.label}>
                      <td className="cap-spec-label">{m.label}</td>
                      <td className="cap-spec-value">{m.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="cap-metrics-disclaimer">⚠ {cap.metricsDisclaimer}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Real model validation demo panel
// ============================================================================

function RealModelDemo() {
  const [aiHealth, setAiHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(true);

  useEffect(() => {
    // Try to reach the real AI health endpoint
    const base = api.baseUrl;
    fetch(`${base}/api/ai/health`, { signal: AbortSignal.timeout(2000) })
      .then(r => r.ok ? r.json() : null)
      .then(data => setAiHealth(data))
      .catch(() => setAiHealth(null))
      .finally(() => setHealthLoading(false));
  }, []);

  return (
    <section className="real-model-section">
      <div className="real-model-header">
        <div>
          <span className="section-eyebrow">LOCAL VALIDATION</span>
          <h2 className="real-model-title">Real Model Demo</h2>
          <p className="real-model-subtitle">
            Verified result from running <code>python server/ai/plate_demo.py</code> on a real image.
            No mock data was used.
          </p>
        </div>
        <div className={`ai-health-pill ${aiHealth ? 'ai-health--live' : 'ai-health--demo'}`}>
          <span className="mode-dot" />
          {healthLoading ? 'Checking…' : aiHealth ? 'AI ENGINE LIVE' : 'DEMO MODE'}
        </div>
      </div>

      <div className="real-model-panels">
        {/* Left: model facts */}
        <div className="real-model-facts">
          <h3 className="real-model-facts-title">Model Details</h3>
          <table className="cap-spec-table">
            <tbody>
              <tr><td className="cap-spec-label">Model</td><td className="cap-spec-value">YOLO26n</td></tr>
              <tr><td className="cap-spec-label">Task</td><td className="cap-spec-value">License Plate Detection</td></tr>
              <tr><td className="cap-spec-label">Path</td><td className="cap-spec-value mono">server/ai/models/plate/best.pt</td></tr>
              <tr><td className="cap-spec-label">Class 0</td><td className="cap-spec-value">license_plate</td></tr>
              <tr><td className="cap-spec-label">Input</td><td className="cap-spec-value">640×640</td></tr>
              <tr><td className="cap-spec-label">Model loaded</td><td className="cap-spec-value status-real">YES — verified</td></tr>
            </tbody>
          </table>
        </div>

        {/* Right: last demo inference result */}
        <div className="real-model-result">
          <h3 className="real-model-facts-title">
            Last Demo Inference
            <span className="cap-badge cap-badge--real" style={{ marginLeft: 8 }}>REAL</span>
          </h3>
          <table className="cap-spec-table">
            <tbody>
              <tr><td className="cap-spec-label">Inference status</td><td className="cap-spec-value status-real">SUCCESS</td></tr>
              <tr><td className="cap-spec-label">Inference time</td><td className="cap-spec-value">~0.9–2.7s (CPU)</td></tr>
              <tr><td className="cap-spec-label">Detections</td><td className="cap-spec-value">1</td></tr>
              <tr><td className="cap-spec-label">BBox</td><td className="cap-spec-value mono">[0, 9, 144, 56]</td></tr>
              <tr>
                <td className="cap-spec-label">Confidence</td>
                <td className="cap-spec-value">
                  <strong>0.9422</strong>
                  <span className="cap-spec-note"> (demo inference — not accuracy)</span>
                </td>
              </tr>
              <tr><td className="cap-spec-label">Class</td><td className="cap-spec-value">license_plate (0)</td></tr>
              <tr><td className="cap-spec-label">OCR text</td><td className="cap-spec-value status-stub">Not configured</td></tr>
              <tr><td className="cap-spec-label">Vehicle detection</td><td className="cap-spec-value status-stub">Not configured</td></tr>
            </tbody>
          </table>
          <div className="real-model-run-cmd">
            <span className="run-cmd-label">Run this yourself:</span>
            <code className="run-cmd-code">python server/ai/plate_demo.py &lt;image_path&gt;</code>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// Analyze Frame test panel (calls real backend endpoint)
// ============================================================================

function AnalyzeFramePanel() {
  const [profile, setProfile] = useState('TRAFFIC');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const run = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    const backendAvail = await api.checkBackendAvailability();
    if (!backendAvail) {
      setError('Backend unavailable — cannot run real frame analysis. Start the server to use this feature.');
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${api.baseUrl}/api/ai/analyze-frame`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(api.token ? { Authorization: `Bearer ${api.token}` } : {}) },
        body: JSON.stringify({ camera_uid: 'DEMO-CAM-001', profile, width: 640, height: 480, source_protocol: 'MOCK' }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || `Request failed (${res.status})`);
      }
      setResult(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="analyze-frame-section">
      <h2 className="real-model-facts-title">Test Analyze-Frame Endpoint</h2>
      <p className="cap-card-detail">
        Calls <code>POST /api/ai/analyze-frame</code> on the live backend.
        Uses a synthetic noise frame (real orchestrator, real quality gate, real plate provider).
      </p>
      <div className="analyze-frame-controls">
        <label className="analyze-label">
          AI Profile:
          <select value={profile} onChange={e => setProfile(e.target.value)}>
            <option value="TRAFFIC">TRAFFIC</option>
            <option value="SECURITY">SECURITY</option>
            <option value="RTO">RTO</option>
          </select>
        </label>
        <button type="button" className="analyze-run-btn" onClick={run} disabled={loading}>
          {loading ? 'Running…' : 'Run analysis'}
        </button>
      </div>
      {error && <p className="analyze-error">{error}</p>}
      {result && (
        <div className="analyze-result">
          <div className="analyze-result-row">
            <span>Camera UID</span><span>{result.camera_uid}</span>
          </div>
          <div className="analyze-result-row">
            <span>Quality</span><span>{result.quality}</span>
          </div>
          <div className="analyze-result-row">
            <span>Detections</span><span>{result.detections?.length ?? 0}</span>
          </div>
          <div className="analyze-result-row">
            <span>Overall confidence</span><span>{result.overall_confidence != null ? (result.overall_confidence * 100).toFixed(1) + '%' : '—'}</span>
          </div>
          <div className="analyze-result-raw">
            <span className="analyze-result-raw-label">Full result JSON:</span>
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </div>
        </div>
      )}
    </section>
  );
}

// ============================================================================
// Main page
// ============================================================================

function AIAnalytics() {
  const { t } = useLanguage();

  return (
    <div className="ai-analytics-page">
      <header className="ai-analytics-header">
        <div>
          <span className="section-eyebrow">AI & INTELLIGENCE / PIPELINE 3</span>
          <h1>{t('ai_analytics_title')}</h1>
          <p>{t('ai_analytics_subtitle')}</p>
        </div>
        <div className="ai-analytics-badges">
          <span className="ai-badge ai-badge--real">YOLO26n REAL</span>
          <span className="ai-badge ai-badge--stub">OCR NOT CONFIGURED</span>
          <span className="ai-badge ai-badge--stub">VEHICLE STUB</span>
        </div>
      </header>

      <div className="ai-analytics-body">
        {/* Left column: pipeline flow + capability cards */}
        <div className="ai-analytics-left">
          <section className="ai-section">
            <h2 className="ai-section-title">Pipeline 3 Flow</h2>
            <PipelineFlowDiagram />
          </section>

          <section className="ai-section">
            <h2 className="ai-section-title">Component Status</h2>
            <div className="cap-card-list">
              {CAPABILITIES.map(cap => <CapabilityCard key={cap.id} cap={cap} />)}
            </div>
          </section>
        </div>

        {/* Right column: demo + live test */}
        <div className="ai-analytics-right">
          <RealModelDemo />
          <AnalyzeFramePanel />
        </div>
      </div>
    </div>
  );
}

export default AIAnalytics;
