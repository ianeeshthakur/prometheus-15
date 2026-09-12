// Filter bar + grid-density toggle -- docs/frontend.md §3.2.
import type { AiCapability, Camera, CameraStatus, Protocol } from "@/lib/types";

export interface CameraFilterState {
  district: string;
  status: CameraStatus | "ALL";
  protocol: Protocol | "ALL";
  capability: AiCapability | "ALL";
}

const STATUSES: CameraStatus[] = ["ONLINE", "DEGRADED", "OFFLINE"];
const PROTOCOLS: Protocol[] = ["RTSP", "HLS", "ONVIF", "VENDOR"];
const CAPABILITIES: AiCapability[] = ["ANPR", "PERSON", "ANOMALY"];

const selectStyle: React.CSSProperties = {
  padding: "6px 8px",
  borderRadius: "var(--radius-button)",
  border: "1px solid var(--border)",
  background: "var(--bg-primary)",
  color: "var(--text-primary)",
  fontSize: "var(--text-body)",
};

interface Props {
  cameras: Camera[];
  filters: CameraFilterState;
  onChange: (filters: CameraFilterState) => void;
  density: 2 | 3 | 4;
  onDensityChange: (density: 2 | 3 | 4) => void;
}

export function CameraFilters({ cameras, filters, onChange, density, onDensityChange }: Props) {
  const districts = Array.from(new Set(cameras.map((c) => c.district))).sort();

  function update<K extends keyof CameraFilterState>(key: K, value: CameraFilterState[K]) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 10,
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <label>
          <span className="sr-only" style={{ position: "absolute", left: -9999 }}>
            District
          </span>
          <select style={selectStyle} value={filters.district} onChange={(e) => update("district", e.target.value)}>
            <option value="ALL">All districts</option>
            {districts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>

        <select
          style={selectStyle}
          value={filters.status}
          onChange={(e) => update("status", e.target.value as CameraFilterState["status"])}
          aria-label="Status"
        >
          <option value="ALL">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </option>
          ))}
        </select>

        <select
          style={selectStyle}
          value={filters.protocol}
          onChange={(e) => update("protocol", e.target.value as CameraFilterState["protocol"])}
          aria-label="Protocol"
        >
          <option value="ALL">All protocols</option>
          {PROTOCOLS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <select
          style={selectStyle}
          value={filters.capability}
          onChange={(e) => update("capability", e.target.value as CameraFilterState["capability"])}
          aria-label="AI capability"
        >
          <option value="ALL">All AI capabilities</option>
          {CAPABILITIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div role="group" aria-label="Grid density" style={{ display: "flex", gap: 4 }}>
        {[2, 3, 4].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onDensityChange(n as 2 | 3 | 4)}
            aria-pressed={density === n}
            className={density === n ? "btn-primary" : "btn-secondary"}
            style={{ padding: "6px 10px" }}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
