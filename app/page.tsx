import Link from "next/link"

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "white",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          borderRadius: 12,
          border: "1px solid #d0d0d0",
          background: "white",
          padding: 18,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
            Calibration
          </h1>
          <p style={{ margin: 0, fontSize: 14, opacity: 0.85 }}>
            Run the calibration flow (resume upload + prompts + job).
          </p>
        </div>

        <div style={{ display: "flex" }}>
          <Link
            href="/calibration"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #d0d0d0",
              background: "white",
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
              color: "black",
            }}
          >
            Go to /calibration
          </Link>
        </div>
      </div>
    </main>
  )
}