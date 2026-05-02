"use client";

// Last-resort error boundary. Catches errors thrown in the root layout itself
// (where `app/error.tsx` cannot reach because its parent is broken). Must
// render its own <html> and <body> tags since the root layout has failed.

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="id">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          textAlign: "center",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          background: "#09090b",
          color: "#fafafa",
        }}
      >
        <p style={{ fontSize: 12, opacity: 0.5, letterSpacing: "0.1em" }}>
          FATAL
        </p>
        <h1
          style={{
            marginTop: 8,
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: "-0.02em",
          }}
        >
          App gagal dimuat
        </h1>
        <p
          style={{
            marginTop: 12,
            maxWidth: 360,
            fontSize: 14,
            lineHeight: 1.6,
            opacity: 0.7,
          }}
        >
          Terjadi error tak terduga di lapisan paling dasar. Coba refresh
          halaman. Kalau masih, hapus cache browser kamu untuk dollarkilat.
        </p>
        {error.digest && (
          <p
            style={{
              marginTop: 12,
              fontFamily: "ui-monospace, monospace",
              fontSize: 10,
              opacity: 0.4,
            }}
          >
            ref: {error.digest}
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            // Try React reset first; if that won't work for fatal errors,
            // hard reload to nuke the SW state.
            try {
              reset();
            } catch {
              if (typeof window !== "undefined") window.location.reload();
            }
          }}
          style={{
            marginTop: 28,
            padding: "10px 18px",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 999,
            background: "#fafafa",
            color: "#09090b",
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Refresh halaman
        </button>
      </body>
    </html>
  );
}
