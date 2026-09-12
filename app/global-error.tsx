"use client";

// App-wide error boundary (catches errors layout.tsx itself can't). Must render its own
// <html>/<body> since it replaces the root layout when triggered.
import "./globals.css";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <div style={{ maxWidth: 480, margin: "80px auto", textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>G-VISTA failed to load</h1>
          <p style={{ color: "#5B6472", marginTop: 8 }}>
            A critical error occurred. This has been logged. Please try again.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{ marginTop: 16, background: "#1B3A6B", color: "#fff", border: "none", borderRadius: 6, padding: "8px 16px" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
