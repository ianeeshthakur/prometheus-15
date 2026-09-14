// Alert queue client state. DEMO mode seeds from lib/mock-data; LIVE mode will
// subscribe to the alert stream (lib/api/sse.ts) once the alert engine is real.
import { create } from "zustand";
import type { Alert, AlertStatus } from "@/lib/types";
import { MOCK_ALERTS } from "@/lib/mock-data";

interface AlertState {
  alerts: Alert[];
  setStatus: (id: string, status: AlertStatus) => void;
}

export const useAlertStore = create<AlertState>((set) => ({
  alerts: MOCK_ALERTS,
  setStatus: (id, status) =>
    set((s) => ({
      alerts: s.alerts.map((a) => (a.id === id ? { ...a, status } : a)),
    })),
}));
