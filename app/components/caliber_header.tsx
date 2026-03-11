import React from "react";

interface CaliberHeaderProps {
  className?: string;
  compact?: boolean;
  noGradient?: boolean;
}

/**
 * Zone 1 — Brand Field.
 * Default: 20vh tall for immersive pages (e.g. TITLES results).
 * Compact: shorter fixed height for simple entry pages (upload, prompts) where
 * the brand mark should sit closer to the content below.
 */
export default function CaliberHeader({ className = "", compact = false, noGradient = false }: CaliberHeaderProps) {
  return (
    <div
      className={`relative w-full flex flex-col items-center justify-center text-center ${className}`}
      style={{
        height: compact ? "auto" : "20vh",
        minHeight: compact ? undefined : 140,
        paddingTop: compact ? "clamp(3.5rem, 10vh, 6rem)" : undefined,
        paddingBottom: compact ? "1.5rem" : undefined,
        background: noGradient
          ? "none"
          : "radial-gradient(ellipse 120% 70% at 50% 50%, rgba(34,197,94,0.18) 0%, rgba(34,197,94,0.09) 35%, rgba(34,197,94,0.03) 60%, transparent 80%)",
      }}
    >
      <span
        className="font-medium tracking-[0.25em] uppercase"
        style={{
          fontSize: "2.2rem",
          color: "rgba(161,161,170,0.7)",
          textShadow: "0 0 60px rgba(74,222,128,0.08)",
        }}
      >
        Caliber
      </span>
    </div>
  );
}
