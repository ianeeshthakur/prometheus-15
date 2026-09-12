// Camera registry client state. DEMO mode seeds from lib/mock-data; LIVE mode will
// populate this from GET /api/cameras (backend.md §6) once that endpoint is real.
import { create } from "zustand";
import type { Camera } from "@/lib/types";
import { MOCK_CAMERAS } from "@/lib/mock-data";

interface CameraState {
  cameras: Camera[];
  getByUid: (uid: string) => Camera | undefined;
}

export const useCameraStore = create<CameraState>((set, get) => ({
  cameras: MOCK_CAMERAS,
  getByUid: (uid) => get().cameras.find((c) => c.camera_uid === uid),
}));
