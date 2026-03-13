"use client";
import React from "react";
import AuthButton from "./auth_button";

interface CaliberHeaderProps {
  className?: string;
  typedText?: string;
  showCursor?: boolean;
  compact?: boolean;
  noGradient?: boolean;
  hideAuth?: boolean;
}

export default function CaliberHeader({ className = "", typedText, showCursor, hideAuth }: CaliberHeaderProps) {
  const display = typedText !== undefined ? typedText : "Caliber";
  return (
    <div className={`flex items-center justify-between pt-4 ${className}`}>
      <div className="w-8" />
      <span
        className="font-semibold tracking-[0.22em] uppercase"
        style={{
          fontSize: "2.15rem",
          color: "rgba(161,161,170,0.75)",
          textShadow: "0 0 40px rgba(74,222,128,0.09), 0 0 80px rgba(74,222,128,0.04)",
          minWidth: "14ch",
          display: "inline-block",
          textAlign: "center",
        }}
      >
        {display}
        {showCursor && (
          <span className="cb-blink-cursor" style={{ color: "rgba(74,222,128,0.7)", marginLeft: "0.05em" }}>_</span>
        )}
      </span>
      <div className="w-8 flex justify-end">
        {!hideAuth && <AuthButton />}
      </div>
    </div>
  );
}
