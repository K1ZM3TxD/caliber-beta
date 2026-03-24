import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Link from "next/link";

export default async function HomePage() {
  const session = await auth();
  if (session?.user) {
    redirect("/pipeline");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "0 16px",
        position: "relative",
      }}
    >
      {/* Ambient green glow */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background:
            "radial-gradient(ellipse 70% 50% at 50% 40%, rgba(74,222,128,0.07) 0%, rgba(74,222,128,0.03) 50%, transparent 80%)",
          zIndex: 0,
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 560, width: "100%" }}>
        {/* Brand */}
        <h1
          style={{
            fontSize: "clamp(2rem, 6vw, 2.75rem)",
            fontWeight: 700,
            letterSpacing: "0.16em",
            color: "#F2F2F2",
            margin: 0,
          }}
        >
          Caliber
        </h1>

        {/* Tagline */}
        <p
          className="cb-headline"
          style={{ marginTop: "1.25rem" }}
        >
          Career Decision Engine
        </p>

        {/* Value prop */}
        <p
          style={{
            marginTop: "1.25rem",
            fontSize: "0.925rem",
            color: "rgba(207,207,207,0.55)",
            lineHeight: 1.75,
            maxWidth: 420,
            margin: "1.25rem auto 0",
          }}
        >
          Calibrate your profile once. Then paste any job description to see
          exactly how well it fits your background — before you apply.
        </p>

        {/* CTAs */}
        <div
          style={{
            marginTop: "2.5rem",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1rem",
          }}
        >
          <Link
            href="/calibration"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "13px 32px",
              borderRadius: "8px",
              fontSize: "15px",
              fontWeight: 600,
              backgroundColor: "rgba(74,222,128,0.10)",
              color: "#4ADE80",
              border: "1px solid rgba(74,222,128,0.55)",
              textDecoration: "none",
              letterSpacing: "0.02em",
            }}
          >
            Get Started
          </Link>
          <Link
            href="/signin"
            style={{
              fontSize: "0.8rem",
              color: "rgba(207,207,207,0.38)",
              textDecoration: "none",
              borderBottom: "1px solid rgba(207,207,207,0.16)",
              paddingBottom: "1px",
            }}
          >
            Already have an account? Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
