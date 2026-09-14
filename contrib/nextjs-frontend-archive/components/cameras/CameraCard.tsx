// Grid card: thumbnail placeholder, ID + location, status, AI-capability tags, Open action.
// docs/frontend.md §3.2.
import Link from "next/link";
import type { Camera } from "@/lib/types";
import { Card } from "../shared/Card";
import { StatusDot } from "../shared/StatusDot";
import { Badge } from "../shared/Badge";
import { IconAlert, IconCamera, IconNoSignal, IconUser, IconVehicle } from "../shared/icons";

const CAPABILITY_ICON = {
  ANPR: IconVehicle,
  PERSON: IconUser,
  ANOMALY: IconAlert,
};

export function CameraCard({ camera }: { camera: Camera }) {
  const offline = camera.status === "OFFLINE";

  return (
    <Card elevated style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          height: 120,
          background: "var(--bg-header)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-secondary)",
          gap: 4,
          borderBottom: "1px solid var(--border)",
        }}
      >
        {offline ? (
          <>
            <IconNoSignal width={24} height={24} />
            <span style={{ fontSize: "var(--text-caption)", fontWeight: 600 }}>No Signal</span>
          </>
        ) : (
          <>
            <IconCamera width={24} height={24} />
            <span style={{ fontSize: "var(--text-caption)" }}>Preview unavailable (DEMO mode)</span>
          </>
        )}
      </div>

      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
        <div>
          <div className="mono" style={{ fontWeight: 700, fontSize: "var(--text-body)" }}>
            {camera.camera_uid}
          </div>
          <div style={{ fontSize: "var(--text-caption)", color: "var(--text-secondary)" }}>
            {camera.name} — {camera.district}
          </div>
        </div>

        <StatusDot status={camera.status} />

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {camera.aiCapabilities.map((cap) => {
            const Icon = CAPABILITY_ICON[cap];
            return (
              <Badge key={cap} tone="info" icon={<Icon width={12} height={12} />}>
                {cap}
              </Badge>
            );
          })}
        </div>

        <div style={{ marginTop: "auto", paddingTop: 4 }}>
          <Link href={`/cameras/${camera.camera_uid}`} className="btn-secondary" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
            Open
          </Link>
        </div>
      </div>
    </Card>
  );
}
