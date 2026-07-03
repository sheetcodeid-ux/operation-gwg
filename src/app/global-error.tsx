"use client";

import { useEffect } from "react";

/**
 * Root error boundary. Replaces the whole document when an error escapes the
 * root layout, so it must render its own <html>/<body>. Kept dependency-free
 * (no shared components) because those may be what failed.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#0b0f19",
          color: "#e5e7eb",
          margin: 0,
          padding: "1rem",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 420 }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Terjadi kesalahan sistem</h1>
          <p style={{ marginTop: 8, fontSize: "0.875rem", color: "#9ca3af" }}>
            Aplikasi mengalami masalah tak terduga. Silakan muat ulang halaman.
          </p>
          {error.digest && (
            <p style={{ marginTop: 8, fontSize: "0.75rem", color: "#6b7280" }}>Ref: {error.digest}</p>
          )}
          <button
            onClick={reset}
            style={{
              marginTop: 20,
              height: 40,
              padding: "0 16px",
              borderRadius: 8,
              border: "none",
              background: "#6366f1",
              color: "white",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Coba lagi
          </button>
        </div>
      </body>
    </html>
  );
}
