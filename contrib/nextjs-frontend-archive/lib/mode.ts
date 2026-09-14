// DEMO vs LIVE mode + backend URL resolution. See docs/frontend.md §3.0 -- the footer
// status strip must always show this so nobody mistakes simulated data for real.

export type AppMode = "DEMO" | "LIVE";

export function getAppMode(): AppMode {
  const raw = process.env.NEXT_PUBLIC_APP_MODE;
  return raw === "LIVE" ? "LIVE" : "DEMO";
}

export function getBackendUrl(): string {
  return process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";
}

export function isDemoMode(): boolean {
  return getAppMode() === "DEMO";
}
