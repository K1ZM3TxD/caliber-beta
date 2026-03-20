import React from "react";

interface CaliberHeaderProps {
  className?: string;
  typedText?: string;
  showCursor?: boolean;
  compact?: boolean;
  noGradient?: boolean;
}

export default function CaliberHeader({ className = "", typedText, showCursor }: CaliberHeaderProps) {
  const display = typedText !== undefined ? typedText : "Caliber";
  return (
    <div className={`flex flex-col items-center text-center pt-4 ${className}`}>
      <span
        className="font-semibold tracking-[0.18em] sm:tracking-[0.22em] uppercase cb-wordmark-glow relative inline-block text-[1.6rem] sm:text-[2.15rem]"
        style={{
          color: "rgba(161,161,170,0.75)",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        {display}
        {showCursor && (
          <span
            className="cb-blink-cursor absolute"
            style={{
              color: "#22c55e",
              left: "100%",
              marginLeft: "0.05em",
              top: 0,
            }}
          >
            _
          </span>
        )}
      </span>
    </div>
  );
}
