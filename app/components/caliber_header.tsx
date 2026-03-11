import React from "react";

interface CaliberHeaderProps {
  className?: string;
}

export default function CaliberHeader({ className = "" }: CaliberHeaderProps) {
  return (
    <div className={`flex flex-col items-center text-center ${className}`}>
      <span
        className="font-medium tracking-[0.25em] uppercase"
        style={{
          fontSize: "2.2rem",
          color: "rgba(161,161,170,0.7)",
          textShadow: "0 0 60px rgba(74,222,128,0.06)",
        }}
      >
        Caliber
      </span>
    </div>
  );
}
