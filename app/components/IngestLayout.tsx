"use client";

import React from "react";

interface IngestLayoutProps {
  children: React.ReactNode;
  /** Override max-width (default 760px) */
  maxWidth?: string;
  /** Show the hero surface band behind the content zone */
  showHeroSurface?: boolean;
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
  maxWidth = "760px",
  showHeroSurface = false,
}: IngestLayoutProps) {
  return (
    <div
      className="fixed inset-0"
      style={{ backgroundColor: "#0a0a0a" }}
    >
      {/* Atmospheric green wash — soft diffuse radial behind content zone */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 120% 65% at 50% 55%, rgba(74,222,128,0.07) 0%, rgba(74,222,128,0.02) 50%, transparent 80%)",
        }}
      />
      {/* Hero atmosphere — green halo glow BEHIND the surface panel */}
      {showHeroSurface && (
        <div
          className="absolute inset-x-0 pointer-events-none"
          style={{
            top: "14vh",
            height: "75vh",
            background:
              "radial-gradient(ellipse 110% 65% at 50% 42%, rgba(74,222,128,0.14) 0%, rgba(74,222,128,0.06) 40%, rgba(74,222,128,0.015) 70%, transparent 100%)",
          }}
        />
      )}
      {/* Top darkening — extended vignette keeps top 10% calm and dark */}
      <div
        className="absolute inset-x-0 top-0 pointer-events-none"
        style={{
          height: "38vh",
          background: "linear-gradient(to bottom, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.35) 28%, rgba(0,0,0,0.12) 65%, transparent 100%)",
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
      {/* Hero surface — solid dark panel, top edge defined, bottom dissolves */}
      {showHeroSurface && (
        <div
          className="absolute inset-x-0 pointer-events-none"
          style={{
            top: "1vh",
            bottom: 0,
            background:
              "linear-gradient(to bottom, #0a0a0a 0%, #0a0a0a 35%, #080808 55%, rgba(6,6,6,0.6) 78%, rgba(5,5,5,0) 100%)",
            borderTop: "1px solid rgba(74,222,128,0.12)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
          }}
        />
      )}
      {/* Scrollable content layer */}
      <div className="relative z-10 h-full overflow-y-auto flex flex-col items-center justify-center">
        <div
          className="w-full px-6 py-12"
          style={{ maxWidth }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
