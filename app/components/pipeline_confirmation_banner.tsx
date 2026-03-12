"use client";

import React from "react";

interface PipelineConfirmationBannerProps {
  jobTitle: string;
  company: string;
  visible: boolean;
}

export default function PipelineConfirmationBanner({
  jobTitle,
  company,
  visible,
}: PipelineConfirmationBannerProps) {
  if (!visible) return null;

  return (
    <div
      className="rounded-lg px-4 py-3 text-sm text-zinc-300 leading-relaxed"
      style={{
        background: "rgba(74,222,128,0.06)",
        border: "1px solid rgba(74,222,128,0.15)",
      }}
    >
      <span className="text-[#4ADE80] font-medium">Added to pipeline</span>
      {" — "}
      {jobTitle} at {company}
    </div>
  );
}
