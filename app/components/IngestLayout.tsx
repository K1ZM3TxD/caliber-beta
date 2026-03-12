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
      {/* Layer 1 — Dark top band: darker than base, no glow */}
      <div
        className="absolute inset-x-0 top-0 pointer-events-none"
        style={{
          height: "18vh",
          background: "linear-gradient(to bottom, #010101 0%, #020202 50%, #050505 100%)",
          zIndex: 1,
        }}
      />
      {/* Layer 2 — Ambient glow band: horizontal green band behind interaction surface */}
      <div
        className="absolute inset-x-0 pointer-events-none"
        style={{
          top: "18vh",
          height: "55vh",
          background:
            "radial-gradient(ellipse 80% 55% at 50% 35%, rgba(74,222,128,0.10) 0%, rgba(74,222,128,0.04) 45%, transparent 100%)",
          zIndex: 0,
        }}
      />
      {/* Layer 3 — Bottom fade: return to black */}
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none"
        style={{
          height: "35vh",
          background: "linear-gradient(to bottom, transparent 0%, #050505 100%)",
          zIndex: 1,
        }}
      />
      {/* Scrollable content layer */}
      <div className="relative z-10 h-full overflow-y-auto flex justify-center">
        <div
          className={`w-full px-6 pb-16 ${extendedTop ? "pt-[30vh]" : "pt-[20vh]"}`}
          style={{ maxWidth }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
