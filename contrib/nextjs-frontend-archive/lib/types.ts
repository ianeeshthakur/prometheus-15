// Shared types. Field names match docs/backend.md §4 (registry) and docs/ai_pipelines.md §3 (detections).

export type CameraStatus = "ONLINE" | "DEGRADED" | "OFFLINE";
export type Protocol = "RTSP" | "HLS" | "ONVIF" | "VENDOR";
export type Department =
  | "POLICE"
  | "HEALTH"
  | "GSRTC"
  | "PANCHAYAT"
  | "MUNICIPAL"
  | "RTO"
  | "FOOD_CIVIL_SUPPLIES";
export type AiCapability = "ANPR" | "PERSON" | "ANOMALY";
export type OnboardingSource = "MANUAL" | "BULK_IMPORT" | "API";

export interface Camera {
  camera_uid: string;
  name: string;
  district: string;
  department: Department;
  protocol: Protocol;
  vendor: string;
  status: CameraStatus;
  lat: number;
  lng: number;
  aiCapabilities: AiCapability[];
  onboardingSource: OnboardingSource;
  lastHeartbeat: string; // ISO timestamp
  fps: number;
  restartCount: number;
}

export type AlertSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
export type AlertStatus = "NEW" | "ACKNOWLEDGED" | "ESCALATED" | "RESOLVED";
export type AlertType = "ANPR_MATCH" | "WATCHLIST_MATCH" | "ANOMALY" | "PERSON_MATCH";

export interface Alert {
  id: string;
  severity: AlertSeverity;
  type: AlertType;
  description: string;
  entity: string;
  cameraUid: string;
  cameraName: string;
  district: string;
  status: AlertStatus;
  timestamp: string; // ISO timestamp
  confidence: number; // 0-1
}

export interface DistrictSummary {
  district: string;
  camerasOnline: number;
  camerasTotal: number;
  activeAlerts: number;
  lastIncident: string | null; // ISO timestamp
}

export interface GapAnalysisRow {
  district: string;
  department: Department;
  cameraCount: number;
  expectedMinimum: number;
  shortfall: number;
}

export type DetectionType = "VEHICLE" | "PERSON" | "PLATE" | "ANOMALY";

export interface CameraEvent {
  id: string;
  cameraUid: string;
  type: DetectionType;
  label: string;
  confidence: number;
  timestamp: string; // ISO timestamp
}

export interface DashboardMetrics {
  camerasOnline: number;
  camerasTotal: number;
  activeAlertsBySeverity: Record<AlertSeverity, number>;
  aiEventsLastHour: number;
  openInvestigations: number;
}
