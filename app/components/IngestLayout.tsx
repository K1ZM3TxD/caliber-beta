"use client";

import React from "react";

interface IngestLayoutProps {
  children: React.ReactNode;
  /** Extra top padding for result/post-calibration screens */
  extendedTop?: boolean;
  /** Override max-width (default 760px) */
  maxWidth?: string;
}

/**
 * Shared layout wrapper for all ingest/calibration screens.
 * Provides the cinematic banded lighting system:
 *   - Dark top band (~14vh, darker than base)
 *   - Ambient green glow centered behind the interaction surface
 *   - Content container with wordmark-locked top spacing (~20vh)
 */
export default function IngestLayout({
  children,
  extendedTop = false,
  maxWidth = "760px",
}: IngestLayoutProps) {
  return (
    <div
      className="fixed inset-0"
      style={{ backgroundColor: "#050505" }}
    >
      {/* Layer 1 — Dark top band: visibly darker than base, no glow */}
      <div
        className="absolute inset-x-0 top-0 pointer-events-none"
        style={{
          height: "18vh",
          background: "linear-gradient(to bottom, #000000 0%, #010101 40%, #030303 75%, #050505 100%)",
          zIndex: 1,
        }}
      />
      {/* Layer 2 — Ambient glow: subtle atmospheric green, felt not seen */}
      <div
        className="absolute inset-x-0 pointer-events-none"
        style={{
          top: "16vh",
          height: "50vh",
          background:
            "radial-gradient(ellipse 70% 40% at 50% 40%, rgba(74,222,128,0.07) 0%, rgba(74,222,128,0.02) 55%, transparent 100%)",
          zIndex: 0,
        }}
      />
      {/* Layer 2b — Wordmark halo: tight radial glow centered on wordmark position */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: "19vh",
          left: "50%",
          transform: "translateX(-50%)",
          width: "280px",
          height: "80px",
          background:
            "radial-gradient(ellipse 100% 100% at 50% 50%, rgba(74,222,128,0.06) 0%, transparent 70%)",
          zIndex: 0,
        }}
      />
      {/* Layer 3 — Bottom fade: return to black */}
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none"
        style={{
          height: "38vh",
          background: "linear-gradient(to bottom, transparent 0%, #050505 100%)",
          zIndex: 1,
        }}
      />
      {/* Scrollable content layer */}
      <div className="relative z-10 h-full overflow-y-auto flex justify-center">
        <div
          className={`w-full px-6 pb-16 ${extendedTop ? "pt-[32vh]" : "pt-[22vh]"}`}
          style={{ maxWidth }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
