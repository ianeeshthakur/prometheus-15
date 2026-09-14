"use client";

// Route-level error boundary. Courteous per docs/frontend.md §2's 7 C's: say what
// happened and what to do next, don't just show a stack trace.
import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div style={{ maxWidth: 480, margin: "48px auto", textAlign: "center" }}>
      <h1 style={{ fontSize: "var(--text-title)", fontWeight: 700 }}>Something went wrong loading this page</h1>
      <p style={{ color: "var(--text-secondary)", marginTop: 8 }}>
        The page failed to render. This has been logged. You can try again, or head back to the Dashboard.
      </p>
      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16 }}>
        <button type="button" className="btn-primary" onClick={reset}>
          Try again
        </button>
        <a className="btn-secondary" href="/" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
          Back to Dashboard
        </a>
      </div>
    </div>
  );
}
