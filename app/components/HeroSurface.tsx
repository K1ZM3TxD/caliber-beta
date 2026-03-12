"use client";

import React from "react";

const VARIANTS = {
  soft: "radial-gradient(ellipse 60% 45% at 50% 52%, rgba(26,26,26,0.55) 0%, rgba(20,20,20,0.35) 35%, rgba(12,12,12,0.18) 55%, rgba(5,5,5,0) 75%)",
  elevated: "radial-gradient(ellipse 60% 45% at 50% 52%, rgba(26,26,26,0.65) 0%, rgba(20,20,20,0.45) 35%, rgba(12,12,12,0.25) 55%, rgba(5,5,5,0) 75%)",
} as const;

interface HeroSurfaceProps {
  variant?: keyof typeof VARIANTS;
  children: React.ReactNode;
}

export default function HeroSurface({
  variant = "soft",
  children,
}: HeroSurfaceProps) {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none -z-10"
        style={{
          background: VARIANTS[variant],
          /* Bleed the surface plane beyond the content box */
          inset: "-25vh -30vw",
        }}
      />
      {children}
    </div>
  );
}
