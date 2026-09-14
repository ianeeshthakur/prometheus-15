"use client";

// Live Cameras (`/cameras`) -- docs/frontend.md §3.2.
import { useMemo, useState } from "react";
import { useCameraStore } from "@/store/cameraStore";
import { CameraFilters, type CameraFilterState } from "@/components/cameras/CameraFilters";
import { CameraCard } from "@/components/cameras/CameraCard";

const DEFAULT_FILTERS: CameraFilterState = {
  district: "ALL",
  status: "ALL",
  protocol: "ALL",
  capability: "ALL",
};

export default function CamerasPage() {
  const cameras = useCameraStore((s) => s.cameras);
  const [filters, setFilters] = useState<CameraFilterState>(DEFAULT_FILTERS);
  const [density, setDensity] = useState<2 | 3 | 4>(3);

  const filtered = useMemo(
    () =>
      cameras.filter((c) => {
        if (filters.district !== "ALL" && c.district !== filters.district) return false;
        if (filters.status !== "ALL" && c.status !== filters.status) return false;
        if (filters.protocol !== "ALL" && c.protocol !== filters.protocol) return false;
        if (filters.capability !== "ALL" && !c.aiCapabilities.includes(filters.capability)) return false;
        return true;
      }),
    [cameras, filters]
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: "var(--text-title)", fontWeight: 700 }}>Live Cameras</h1>
        <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>
          Watch feeds and review what the AI pipeline is currently detecting.
        </p>
      </div>

      <CameraFilters
        cameras={cameras}
        filters={filters}
        onChange={setFilters}
        density={density}
        onDensityChange={setDensity}
      />

      {filtered.length === 0 ? (
        <div style={{ color: "var(--text-secondary)", textAlign: "center", padding: "48px 0" }}>
          No cameras match the current filters.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${density}, minmax(0, 1fr))`,
            gap: 16,
          }}
        >
          {filtered.map((cam) => (
            <CameraCard key={cam.camera_uid} camera={cam} />
          ))}
        </div>
      )}
    </div>
  );
}
