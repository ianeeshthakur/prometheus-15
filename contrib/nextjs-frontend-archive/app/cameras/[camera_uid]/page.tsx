// Camera detail (`/cameras/[camera_uid]`) -- docs/frontend.md §3.2. Its own page state
// (not a stacked modal) so the URL stays shareable.
import Link from "next/link";
import { notFound } from "next/navigation";
import { MOCK_CAMERAS, getCameraEvents } from "@/lib/mock-data";
import { Card } from "@/components/shared/Card";
import { StatusDot } from "@/components/shared/StatusDot";
import { LiveCameraPlayer } from "@/components/cameras/LiveCameraPlayer";
import { StreamHealthBadge } from "@/components/cameras/StreamHealthBadge";
import { EventCard } from "@/components/cameras/EventCard";

export default async function CameraDetailPage({
  params,
}: {
  params: Promise<{ camera_uid: string }>;
}) {
  const { camera_uid } = await params;
  const camera = MOCK_CAMERAS.find((c) => c.camera_uid === camera_uid);
  if (!camera) notFound();

  const events = getCameraEvents(camera.camera_uid);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <Link href="/cameras" style={{ fontSize: "var(--text-caption)" }}>
          ← Back to Live Cameras
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4, flexWrap: "wrap" }}>
          <h1 className="mono" style={{ fontSize: "var(--text-title)", fontWeight: 700 }}>
            {camera.camera_uid}
          </h1>
          <StatusDot status={camera.status} />
        </div>
        <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>
          {camera.name} — {camera.district} · {camera.department.replace("_", " ")}
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 7fr) minmax(280px, 3fr)",
          gap: 20,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card title="Live feed" elevated>
            <LiveCameraPlayer camera={camera} latestEvents={events} />
          </Card>
          <Card title="Adapter health" elevated>
            <StreamHealthBadge camera={camera} />
          </Card>
        </div>

        <Card title="Live event log" elevated>
          {events.length === 0 ? (
            <div style={{ color: "var(--text-secondary)" }}>No detections logged for this camera.</div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {events.map((ev) => (
                <EventCard key={ev.id} event={ev} />
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
