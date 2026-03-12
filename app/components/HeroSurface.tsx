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
    bg: "#0b0b0b",
    edgeOpacity: 0.06,
    topFade: "linear-gradient(to bottom, transparent 0%, #0b0b0b 100%)",
    bottomFade: "linear-gradient(to top, transparent 0%, #0b0b0b 100%)",
  },
  elevated: {
    bg: "#0e0e0e",
    edgeOpacity: 0.08,
    topFade: "linear-gradient(to bottom, transparent 0%, #0e0e0e 100%)",
    bottomFade: "linear-gradient(to top, transparent 0%, #0e0e0e 100%)",
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
      {/* Surface plane — full-width lifted dark band */}
      <div
        aria-hidden
        className="absolute pointer-events-none -z-10"
        style={{
          /* Stretch full viewport width, bleed vertically past content */
          left: "-50vw",
          right: "-50vw",
          top: "-6vh",
          bottom: "-6vh",
          marginLeft: "calc(50% - 0px)",
          marginRight: "calc(50% - 0px)",
          width: "100vw",
          background: v.bg,
        }}
      >
        {/* Top fade edge */}
        <div
          className="absolute inset-x-0 top-0"
          style={{ height: "6vh", background: v.topFade }}
        />
        {/* Bottom fade edge */}
        <div
          className="absolute inset-x-0 bottom-0"
          style={{ height: "6vh", background: v.bottomFade }}
        />
        {/* Top edge line — subtle architectural separation */}
        <div
          className="absolute inset-x-0 top-0"
          style={{
            height: "1px",
            background: `rgba(255,255,255,${v.edgeOpacity})`,
          }}
        />
        {/* Bottom edge line */}
        <div
          className="absolute inset-x-0 bottom-0"
          style={{
            height: "1px",
            background: `rgba(255,255,255,${v.edgeOpacity})`,
          }}
        />
      </div>
      {children}
    </div>
  );
}
