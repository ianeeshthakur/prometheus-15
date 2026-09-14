"use client";

// The actual Leaflet-dependent rendering, split out of GujaratMap.tsx so that file can
// stay free of a top-level `react-leaflet` import -- react-leaflet touches `window` at
// module-evaluation time, which crashes Next.js's server-side prerender even inside a
// "use client" component. GujaratMap.tsx loads this via next/dynamic(..., { ssr: false }).
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Camera } from "@/lib/types";
import { StatusDot } from "../shared/StatusDot";

const STATUS_COLOR: Record<Camera["status"], string> = {
  ONLINE: "var(--status-online)",
  DEGRADED: "var(--status-warning)",
  OFFLINE: "var(--status-info)",
};

const GUJARAT_CENTER: [number, number] = [22.2587, 71.1924];

export default function LeafletMap({ cameras }: { cameras: Camera[] }) {
  return (
    <MapContainer
      center={GUJARAT_CENTER}
      zoom={7}
      style={{ height: "100%", width: "100%" }}
      attributionControl={false}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
      />
      {cameras.map((cam) => (
        <CircleMarker
          key={cam.camera_uid}
          center={[cam.lat, cam.lng]}
          radius={7}
          pathOptions={{
            color: STATUS_COLOR[cam.status],
            fillColor: STATUS_COLOR[cam.status],
            fillOpacity: 0.85,
            weight: cam.status === "DEGRADED" ? 3 : 1,
          }}
        >
          <Popup>
            <div style={{ fontSize: 13 }}>
              <strong className="mono">{cam.camera_uid}</strong>
              <div>{cam.name}</div>
              <div>
                {cam.district} — {cam.department.replace("_", " ")}
              </div>
              <StatusDot status={cam.status} />
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
