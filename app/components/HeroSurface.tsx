"use client";

import React from "react";

/**
 * Shared surface primitive for hero-level depth separation.
 * Creates a full-width lifted dark plane behind hero content.
 *
 * Variants:
 *  - soft:     subtle surface separation (landing)
 *  - elevated: stronger foreground plane (results, ingest states)
 */

const VARIANTS = {
  soft: {
    surface: "#111111",
    edge: "rgba(255,255,255,0.07)",
    shadow: "0 0 40px 10px rgba(0,0,0,0.5)",
    topFade: "linear-gradient(to bottom, rgba(5,5,5,1) 0%, rgba(5,5,5,0) 100%)",
    bottomFade: "linear-gradient(to top, rgba(5,5,5,1) 0%, rgba(5,5,5,0) 100%)",
    fadeH: "3.5vh",
  },
  elevated: {
    surface: "#141414",
    edge: "rgba(255,255,255,0.10)",
    shadow: "0 0 60px 14px rgba(0,0,0,0.6)",
    topFade: "linear-gradient(to bottom, rgba(5,5,5,1) 0%, rgba(5,5,5,0) 100%)",
    bottomFade: "linear-gradient(to top, rgba(5,5,5,1) 0%, rgba(5,5,5,0) 100%)",
    fadeH: "3vh",
  },
} as const;

interface HeroSurfaceProps {
  variant?: keyof typeof VARIANTS;
  children: React.ReactNode;
}

export default function HeroSurface({
  variant = "soft",
  children,
}: HeroSurfaceProps) {
  const v = VARIANTS[variant];
  return (
    <div className="relative w-full">
      {/* Surface plane — full-width foreground panel */}
      <div
        aria-hidden
        className="absolute pointer-events-none -z-10"
        style={{
          left: "50%",
          transform: "translateX(-50%)",
          width: "100vw",
          top: "-4vh",
          bottom: "-4vh",
          background: v.surface,
          boxShadow: v.shadow,
        }}
      >
        {/* Top boundary fade — short, sharp transition from page base */}
        <div
          className="absolute inset-x-0 top-0"
          style={{ height: v.fadeH, background: v.topFade }}
        />
        {/* Bottom boundary fade */}
        <div
          className="absolute inset-x-0 bottom-0"
          style={{ height: v.fadeH, background: v.bottomFade }}
        />
        {/* Top edge line */}
        <div
          className="absolute inset-x-0"
          style={{
            top: v.fadeH,
            height: "1px",
            background: v.edge,
          }}
        />
        {/* Bottom edge line */}
        <div
          className="absolute inset-x-0"
          style={{
            bottom: v.fadeH,
            height: "1px",
            background: v.edge,
          }}
        />
      </div>
      {children}
    </div>
  );
}
