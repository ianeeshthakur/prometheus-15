// DEMO-mode data only -- never used when NEXT_PUBLIC_APP_MODE=LIVE (see lib/mode.ts).
// Fixed, hand-authored (not Math.random at module scope) so server/client render identically.
// Districts/departments reflect the real hackathon scope (docs/prd.md §0.1): 26 departments,
// cameras spread ~1,000km across the state, Valsad/Dahod/Somnath/Jamnagar/Dwarka cited as examples.

import type {
  Alert,
  Camera,
  CameraEvent,
  DashboardMetrics,
  DetectionType,
  DistrictSummary,
  GapAnalysisRow,
} from "./types";

interface DistrictSeed {
  district: string;
  lat: number;
  lng: number;
}

const DISTRICTS: DistrictSeed[] = [
  { district: "Ahmedabad", lat: 23.0225, lng: 72.5714 },
  { district: "Surat", lat: 21.1702, lng: 72.8311 },
  { district: "Vadodara", lat: 22.3072, lng: 73.1812 },
  { district: "Rajkot", lat: 22.3039, lng: 70.8022 },
  { district: "Bhavnagar", lat: 21.7645, lng: 72.1519 },
  { district: "Jamnagar", lat: 22.4707, lng: 70.0577 },
  { district: "Junagadh", lat: 21.5222, lng: 70.4579 },
  { district: "Gir Somnath", lat: 20.9089, lng: 70.3676 },
  { district: "Devbhoomi Dwarka", lat: 22.2394, lng: 68.9678 },
  { district: "Dahod", lat: 22.8333, lng: 74.2667 },
  { district: "Valsad", lat: 20.5992, lng: 72.9342 },
  { district: "Gandhinagar", lat: 23.2156, lng: 72.6369 },
];

const DEPARTMENTS_BY_DISTRICT: Camera["department"][] = [
  "POLICE",
  "HEALTH",
  "GSRTC",
  "PANCHAYAT",
  "MUNICIPAL",
  "RTO",
  "FOOD_CIVIL_SUPPLIES",
];

const VENDORS = ["Hikvision", "CP Plus", "Bosch", "Dahua", "Axis"];

function jitter(base: number, seedIdx: number, spread: number): number {
  // Deterministic pseudo-offset so markers don't all stack on one point per district.
  const pseudo = Math.sin(seedIdx * 12.9898) * 43758.5453;
  const frac = pseudo - Math.floor(pseudo);
  return base + (frac - 0.5) * spread;
}

function buildCameras(): Camera[] {
  const cameras: Camera[] = [];
  let idx = 0;
  for (const d of DISTRICTS) {
    for (let i = 0; i < 2; i++) {
      const dept = DEPARTMENTS_BY_DISTRICT[idx % DEPARTMENTS_BY_DISTRICT.length];
      const protocol: Camera["protocol"] =
        idx % 4 === 0 ? "ONVIF" : idx % 4 === 1 ? "VENDOR" : idx % 4 === 2 ? "HLS" : "RTSP";
      const status: Camera["status"] =
        idx % 11 === 0 ? "OFFLINE" : idx % 7 === 0 ? "DEGRADED" : "ONLINE";
      const caps: Camera["aiCapabilities"][number][] = [];
      if (idx % 2 === 0) caps.push("ANPR");
      if (idx % 3 === 0) caps.push("PERSON");
      if (idx % 5 === 0) caps.push("ANOMALY");
      if (caps.length === 0) caps.push("PERSON");

      cameras.push({
        camera_uid: `GJ-${d.district.slice(0, 3).toUpperCase()}-${String(idx + 1).padStart(3, "0")}`,
        name: `${d.district} ${dept.replace("_", " ")} Cam ${i + 1}`,
        district: d.district,
        department: dept,
        protocol,
        vendor: VENDORS[idx % VENDORS.length],
        status,
        lat: jitter(d.lat, idx, 0.08),
        lng: jitter(d.lng, idx + 1, 0.08),
        aiCapabilities: caps,
        onboardingSource: idx % 3 === 0 ? "API" : idx % 3 === 1 ? "BULK_IMPORT" : "MANUAL",
        lastHeartbeat: new Date(Date.now() - (idx % 6) * 60_000).toISOString(),
        fps: status === "OFFLINE" ? 0 : status === "DEGRADED" ? 8 : 25,
        restartCount: status === "DEGRADED" ? 3 : status === "OFFLINE" ? 7 : 0,
      });
      idx++;
    }
  }
  return cameras;
}

export const MOCK_CAMERAS: Camera[] = buildCameras();

const ALERT_SEEDS: Array<
  Pick<Alert, "severity" | "type" | "description" | "entity" | "confidence"> & {
    cameraIdx: number;
    minutesAgo: number;
    status: Alert["status"];
  }
> = [
  {
    severity: "CRITICAL",
    type: "WATCHLIST_MATCH",
    description: "Vehicle matched against stolen-vehicle watchlist entry",
    entity: "GJ-01-AB-4521",
    confidence: 0.94,
    cameraIdx: 2,
    minutesAgo: 4,
    status: "NEW",
  },
  {
    severity: "HIGH",
    type: "ANPR_MATCH",
    description: "Plate read matched a flagged vehicle from an open investigation",
    entity: "GJ-05-CD-1187",
    confidence: 0.88,
    cameraIdx: 7,
    minutesAgo: 12,
    status: "NEW",
  },
  {
    severity: "HIGH",
    type: "PERSON_MATCH",
    description: "Person detection matched a wanted-persons watchlist entry",
    entity: "WL-PER-0042",
    confidence: 0.81,
    cameraIdx: 11,
    minutesAgo: 21,
    status: "ACKNOWLEDGED",
  },
  {
    severity: "MEDIUM",
    type: "ANOMALY",
    description: "Loitering detected outside operating hours",
    entity: "Zone A perimeter",
    confidence: 0.72,
    cameraIdx: 5,
    minutesAgo: 33,
    status: "NEW",
  },
  {
    severity: "MEDIUM",
    type: "ANOMALY",
    description: "Crowd density above configured threshold",
    entity: "Main gate",
    confidence: 0.69,
    cameraIdx: 14,
    minutesAgo: 47,
    status: "ACKNOWLEDGED",
  },
  {
    severity: "LOW",
    type: "ANPR_MATCH",
    description: "Plate read logged, no watchlist match",
    entity: "GJ-11-EF-9034",
    confidence: 0.91,
    cameraIdx: 3,
    minutesAgo: 58,
    status: "RESOLVED",
  },
  {
    severity: "CRITICAL",
    type: "ANOMALY",
    description: "Wrong-way vehicle movement on divided carriageway",
    entity: "NH-48 stretch",
    confidence: 0.9,
    cameraIdx: 9,
    minutesAgo: 3,
    status: "NEW",
  },
  {
    severity: "INFO",
    type: "ANPR_MATCH",
    description: "Routine plate log, informational only",
    entity: "GJ-06-GH-2210",
    confidence: 0.95,
    cameraIdx: 16,
    minutesAgo: 70,
    status: "RESOLVED",
  },
  {
    severity: "HIGH",
    type: "WATCHLIST_MATCH",
    description: "Vehicle matched against custom district watchlist",
    entity: "GJ-27-IJ-5566",
    confidence: 0.85,
    cameraIdx: 18,
    minutesAgo: 15,
    status: "ESCALATED",
  },
  {
    severity: "MEDIUM",
    type: "PERSON_MATCH",
    description: "Repeat visitor flagged in a sensitive-zone camera",
    entity: "WL-PER-0117",
    confidence: 0.66,
    cameraIdx: 20,
    minutesAgo: 25,
    status: "NEW",
  },
];

export const MOCK_ALERTS: Alert[] = ALERT_SEEDS.map((seed, i) => {
  const cam = MOCK_CAMERAS[seed.cameraIdx % MOCK_CAMERAS.length];
  return {
    id: `ALT-${String(i + 1).padStart(4, "0")}`,
    severity: seed.severity,
    type: seed.type,
    description: seed.description,
    entity: seed.entity,
    cameraUid: cam.camera_uid,
    cameraName: cam.name,
    district: cam.district,
    status: seed.status,
    timestamp: new Date(Date.now() - seed.minutesAgo * 60_000).toISOString(),
    confidence: seed.confidence,
  };
});

const VEHICLE_LABELS = ["Sedan", "Two-wheeler", "SUV", "Commercial truck"];
const ANOMALY_LABELS = [
  "Loitering detected outside operating hours",
  "Wrong-way vehicle movement",
  "Crowd density above configured threshold",
  "Unattended object flagged",
];
// Plate reads honor the OCR contract in docs/ai_pipelines.md §2: never hallucinate a
// plate below confidence threshold -- some reads come back UNREADABLE instead of a guess.
const PLATE_READS = ["GJ-01-AB-4521", "GJ-05-CD-1187", "GJ-11-EF-9034", "UNREADABLE"];

function buildCameraEvents(): CameraEvent[] {
  const events: CameraEvent[] = [];
  let seq = 0;
  for (const cam of MOCK_CAMERAS) {
    if (cam.status === "OFFLINE") continue; // not streaming -- no detections to show
    const count = cam.status === "DEGRADED" ? 2 : 4;
    for (let i = 0; i < count; i++) {
      seq++;
      const cycle: DetectionType[] = cam.aiCapabilities.includes("ANPR")
        ? ["VEHICLE", "PLATE", "PERSON", "ANOMALY"]
        : cam.aiCapabilities.includes("ANOMALY")
          ? ["ANOMALY", "PERSON", "VEHICLE", "PLATE"]
          : ["PERSON", "VEHICLE", "PLATE", "ANOMALY"];
      const type = cycle[i % cycle.length];
      const label =
        type === "VEHICLE"
          ? `Vehicle detected (${VEHICLE_LABELS[seq % VEHICLE_LABELS.length]})`
          : type === "PERSON"
            ? "Person detected"
            : type === "PLATE"
              ? PLATE_READS[seq % PLATE_READS.length] === "UNREADABLE"
                ? "Plate read: UNREADABLE (below confidence threshold)"
                : `Plate read: ${PLATE_READS[seq % PLATE_READS.length]}`
              : ANOMALY_LABELS[seq % ANOMALY_LABELS.length];
      events.push({
        id: `EVT-${String(seq).padStart(5, "0")}`,
        cameraUid: cam.camera_uid,
        type,
        label,
        confidence: 0.6 + ((seq * 7) % 35) / 100,
        timestamp: new Date(Date.now() - (seq % 180) * 60_000).toISOString(),
      });
    }
  }
  return events;
}

export const MOCK_CAMERA_EVENTS: CameraEvent[] = buildCameraEvents();

export function getCameraEvents(cameraUid: string): CameraEvent[] {
  return MOCK_CAMERA_EVENTS.filter((e) => e.cameraUid === cameraUid).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export function getDistrictSummaries(): DistrictSummary[] {
  return DISTRICTS.map(({ district }) => {
    const cams = MOCK_CAMERAS.filter((c) => c.district === district);
    const online = cams.filter((c) => c.status === "ONLINE").length;
    const districtAlerts = MOCK_ALERTS.filter(
      (a) => a.district === district && a.status !== "RESOLVED"
    );
    const lastIncident = MOCK_ALERTS.filter((a) => a.district === district).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )[0];
    return {
      district,
      camerasOnline: online,
      camerasTotal: cams.length,
      activeAlerts: districtAlerts.length,
      lastIncident: lastIncident ? lastIncident.timestamp : null,
    };
  });
}

const EXPECTED_MINIMUM_PER_DEPARTMENT = 3;

export function getGapAnalysis(): GapAnalysisRow[] {
  const rows: GapAnalysisRow[] = [];
  for (const { district } of DISTRICTS) {
    for (const dept of DEPARTMENTS_BY_DISTRICT) {
      const count = MOCK_CAMERAS.filter(
        (c) => c.district === district && c.department === dept
      ).length;
      const shortfall = EXPECTED_MINIMUM_PER_DEPARTMENT - count;
      if (shortfall > 0) {
        rows.push({
          district,
          department: dept,
          cameraCount: count,
          expectedMinimum: EXPECTED_MINIMUM_PER_DEPARTMENT,
          shortfall,
        });
      }
    }
  }
  return rows.sort((a, b) => b.shortfall - a.shortfall);
}

export function getDashboardMetrics(): DashboardMetrics {
  const camerasOnline = MOCK_CAMERAS.filter((c) => c.status === "ONLINE").length;
  const activeAlerts = MOCK_ALERTS.filter((a) => a.status !== "RESOLVED");
  const bySeverity: DashboardMetrics["activeAlertsBySeverity"] = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    INFO: 0,
  };
  for (const a of activeAlerts) bySeverity[a.severity]++;

  const oneHourAgo = Date.now() - 60 * 60_000;
  const aiEventsLastHour = MOCK_ALERTS.filter(
    (a) => new Date(a.timestamp).getTime() >= oneHourAgo
  ).length;

  return {
    camerasOnline,
    camerasTotal: MOCK_CAMERAS.length,
    activeAlertsBySeverity: bySeverity,
    aiEventsLastHour,
    openInvestigations: 6,
  };
}
