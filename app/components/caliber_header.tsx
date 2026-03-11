import React from "react";

interface CaliberHeaderProps {
  className?: string;
}

/**
 * Zone 1 — Brand Field.
 * 20vh tall, CALIBER centered vertically, ambient gradient band visible behind.
 * The gradient is self-contained so every page using this component gets it.
 */
export default function CaliberHeader({ className = "" }: CaliberHeaderProps) {
  return (
    <div
      className={`relative w-full flex flex-col items-center justify-center text-center ${className}`}
      style={{
        height: "20vh",
        minHeight: 140,
        background:
          "radial-gradient(ellipse 120% 70% at 50% 50%, rgba(34,197,94,0.18) 0%, rgba(34,197,94,0.09) 35%, rgba(34,197,94,0.03) 60%, transparent 80%)",
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
