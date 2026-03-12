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
      {/* Atmospheric green wash — soft diffuse radial behind content zone */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 120% 70% at 50% 45%, rgba(74,222,128,0.07) 0%, rgba(74,222,128,0.02) 50%, transparent 80%)",
        }}
      />
      {/* Top darkening — gentle vignette */}
      <div
        className="absolute inset-x-0 top-0 pointer-events-none"
        style={{
          height: "30vh",
          background: "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 60%, transparent 100%)",
        }}
      />
      {/* Framing line — thin architectural rule above wordmark */}
      <div
        className="absolute inset-x-0 pointer-events-none"
        style={{
          top: "calc(22vh - 0.5rem)",
          height: "1px",
          background: "linear-gradient(to right, rgba(74,222,128,0.10) 0%, rgba(74,222,128,0.20) 35%, rgba(74,222,128,0.22) 50%, rgba(74,222,128,0.20) 65%, rgba(74,222,128,0.10) 100%)",
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
