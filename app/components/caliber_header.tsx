import React from "react";

interface CaliberHeaderProps {
  className?: string;
}

export default function CaliberHeader({ className = "" }: CaliberHeaderProps) {
  return (
    <div className={`flex flex-col items-center text-center ${className}`}>
      {/* Faded horizontal line */}
      <div
        className="w-12 h-px mb-4"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(161,161,170,0.45), transparent)",
        }}
      />
      {/* Wordmark */}
      <span
        className="font-medium tracking-[0.22em] uppercase text-zinc-400"
        style={{
          fontSize: "1.3125rem",
          textShadow: "0 0 40px rgba(74,222,128,0.08)",
        }}
      >
        Caliber
      </span>
    </div>
  );
}
