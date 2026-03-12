"use client";

import React from "react";

/**
 * Shared surface primitive for hero-level depth separation.
 * Renders a full-viewport-width panel behind hero content.
 *
 * Variants:
 *  - soft:     subtle surface (#181818, 10% edge)
 *  - elevated: stronger surface (#222222, 25% edge)
 */

const VARIANTS = {
  soft: {
    surface: "#181818",
    borderColor: "rgba(255,255,255,0.10)",
  },
  elevated: {
    surface: "#222222",
    borderColor: "rgba(255,255,255,0.25)",
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
    <div
      className="relative py-12"
      style={{
        /* Full viewport width panel, regardless of parent max-width */
        width: "100vw",
        marginLeft: "calc(50% - 50vw)",
        background: v.surface,
        borderTop: `1px solid ${v.borderColor}`,
        borderBottom: `1px solid ${v.borderColor}`,
        boxShadow: "0 0 80px 20px rgba(0,0,0,0.7)",
      }}
    >
      {/* Center content back to parent alignment */}
      <div className="flex justify-center px-6">
        <div className="w-full" style={{ maxWidth: "720px" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
