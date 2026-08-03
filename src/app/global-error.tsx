"use client";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ background: "#fafaf9", color: "#1c1917", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
          <div style={{ maxWidth: 420, textAlign: "center" }}>
            <p style={{ fontSize: 20, fontWeight: 700, color: "#1b4332", marginBottom: 8 }}>Something went wrong</p>
            <p style={{ fontSize: 14, color: "#78716c", lineHeight: 1.6, marginBottom: 16 }}>
              An unexpected error occurred. Please close the app completely and reopen it.
            </p>
            <button
              onClick={() => reset()}
              style={{
                background: "#1b4332", color: "#fff", border: "none", borderRadius: 12,
                padding: "12px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
