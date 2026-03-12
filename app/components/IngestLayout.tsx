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
      {/* Dark top band — structural, darker than base surface */}
      <div
        className="absolute inset-x-0 top-0 pointer-events-none"
        style={{
          height: "14vh",
          background: "linear-gradient(to bottom, #010101 0%, #030303 60%, #050505 100%)",
          zIndex: 0,
        }}
      />
      {/* Ambient glow — begins below the dark band, centered behind interaction surface */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 40% at 50% 52%, rgba(74,222,128,0.07) 0%, transparent 100%)",
          zIndex: 0,
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
