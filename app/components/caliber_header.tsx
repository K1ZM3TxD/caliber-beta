import React from "react";

interface CaliberHeaderProps {
  className?: string;
  typedText?: string;
}

export default function CaliberHeader({ className = "", typedText }: CaliberHeaderProps) {
  const display = typedText !== undefined ? typedText : "Caliber";
  return (
    <div className={`flex flex-col items-center text-center pt-4 ${className}`}>
      <span
        className="font-semibold tracking-[0.22em] uppercase"
        style={{
          fontSize: "2.15rem",
          color: "rgba(161,161,170,0.75)",
          textShadow: "0 0 40px rgba(74,222,128,0.09), 0 0 80px rgba(74,222,128,0.04)",
          minWidth: "14ch",
          display: "inline-block",
        }}
      >
        {display}
      </span>
    </div>
  );
}
