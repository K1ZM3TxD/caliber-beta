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
    <div className="mb-6 border border-emerald-900/50 rounded-lg bg-emerald-950/30 px-4 py-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-emerald-400 text-base flex-shrink-0">✓</span>
        <div className="min-w-0">
          <div className="text-emerald-300 text-sm font-medium">
            Job saved
          </div>
          <div className="text-zinc-400 text-xs truncate">
            {jobTitle} — {company}
          </div>
        </div>
      </div>
      <a
        href="/pipeline"
        className="flex-shrink-0 text-xs font-medium text-zinc-400 border border-zinc-700 rounded px-3 py-1.5 hover:text-white hover:border-zinc-500 transition-colors"
      >
        View saved jobs
      </a>
    </div>
  );
}
