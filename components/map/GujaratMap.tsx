"use client";

// Gujarat district map: camera markers, shape-coded by status (docs/frontend.md §1 --
// color reinforces but never carries meaning alone). Every map ships a "View as list"
// toggle producing an equivalent accessible table -- this is a hard requirement, not
// optional (docs/frontend.md §3.1), for screen-reader/keyboard users.
//
// The actual Leaflet map lives in LeafletMap.tsx and is loaded with ssr:false below --
// react-leaflet touches `window` at module-evaluation time, which crashes Next.js's
// server prerender if imported at the top level here, even inside "use client".
import { useState } from "react";
import dynamic from "next/dynamic";
import type { Camera } from "@/lib/types";
import { StatusDot } from "../shared/StatusDot";
import { IconList, IconMap } from "../shared/icons";

const LeafletMap = dynamic(() => import("./LeafletMap"), {
  ssr: false,
  loading: () => (
    <div
      aria-busy="true"
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-surface)",
        color: "var(--text-secondary)",
      }}
    >
      Loading map…
    </div>
  ),
});

export function GujaratMap({ cameras }: { cameras: Camera[] }) {
  const [view, setView] = useState<"map" | "list">("map");

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <button
          type="button"
          onClick={() => setView(view === "map" ? "list" : "map")}
          className="btn-secondary"
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          {view === "map" ? <IconList width={16} height={16} /> : <IconMap width={16} height={16} />}
          {view === "map" ? "View as list" : "View as map"}
        </button>
      </div>

      {view === "map" ? (
        <div
          style={{
            height: 420,
            borderRadius: "var(--radius-card)",
            overflow: "hidden",
            border: "1px solid var(--border)",
          }}
        >
          <LeafletMap cameras={cameras} />
        </div>
      ) : (
        <div
          style={{
            maxHeight: 420,
            overflowY: "auto",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-card)",
          }}
        >
          <table>
            <thead>
              <tr>
                <th>Camera</th>
                <th>District</th>
                <th>Department</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {cameras.map((cam) => (
                <tr key={cam.camera_uid}>
                  <td>
                    <span className="mono">{cam.camera_uid}</span>
                    <div style={{ color: "var(--text-secondary)", fontSize: "var(--text-caption)" }}>
                      {cam.name}
                    </div>
                  </td>
                  <td>{cam.district}</td>
                  <td>{cam.department.replace("_", " ")}</td>
                  <td>
                    <StatusDot status={cam.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
