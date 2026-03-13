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
        className="font-semibold tracking-[0.22em] uppercase cb-wordmark-glow"
        style={{
          fontSize: "2.15rem",
          color: "rgba(161,161,170,0.75)",
          minWidth: "14ch",
          display: "inline-block",
          textAlign: "center",
        }}
      >
        {display}
        {showCursor && (
          <span className="cb-blink-cursor" style={{ color: "#22c55e", marginLeft: "0.05em" }}>_</span>
        )}
      </span>
      <div className="w-8 flex justify-end">
        {!hideAuth && <AuthButton />}
      </div>
    </div>
  );
}
