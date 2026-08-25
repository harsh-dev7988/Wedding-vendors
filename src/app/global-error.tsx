"use client";

/**
 * Replaces the root layout when it is the layout itself that throws, so this
 * file must render its own <html> and <body>.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en-IN">
      <body
        style={{
          alignItems: "center",
          background: "#fffdf9",
          color: "#241803",
          display: "flex",
          fontFamily: "system-ui, sans-serif",
          justifyContent: "center",
          margin: 0,
          minHeight: "100vh",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "32rem" }}>
          <h1 style={{ fontSize: "2rem", margin: 0 }}>
            The application failed to start.
          </h1>
          <p style={{ color: "#756542", lineHeight: 1.7, marginTop: "1rem" }}>
            This is a fault on our side. Nothing you submitted was lost.
          </p>
          <button
            onClick={reset}
            style={{
              background: "#241803",
              border: 0,
              borderRadius: "999px",
              color: "#fff",
              cursor: "pointer",
              fontSize: "0.95rem",
              fontWeight: 700,
              marginTop: "1.75rem",
              minHeight: "3rem",
              padding: "0 1.75rem",
            }}
            type="button"
          >
            Try again
          </button>
          {error.digest && (
            <p
              style={{
                color: "#756542",
                fontSize: "0.75rem",
                marginTop: "1.5rem",
              }}
            >
              Reference: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
