"use client";

import React, { useEffect, useState, useCallback } from "react";
import CaliberHeader from "../components/caliber_header";

interface PipelineEntry {
  id: string;
  sessionId: string;
  jobTitle: string;
  company: string;
  jobUrl: string;
  score: number;
  stage: string;
  createdAt: string;
  updatedAt: string;
  tailorId?: string;
}

const STAGES = [
  { key: "strong_match", label: "Strong Match", color: "#4ADE80" },
  { key: "tailored", label: "Tailored", color: "#60A5FA" },
  { key: "applied", label: "Applied", color: "#A78BFA" },
  { key: "interviewing", label: "Interviewing", color: "#FBBF24" },
  { key: "offer", label: "Offer", color: "#F472B6" },
] as const;

const STAGE_MAP: Record<string, (typeof STAGES)[number]> = Object.fromEntries(
  STAGES.map((s) => [s.key, s])
);

export default function PipelinePage() {
  const [entries, setEntries] = useState<PipelineEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    fetch("/api/pipeline")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          // Sort: most recent first, filter out archived
          const sorted = (data.entries as PipelineEntry[])
            .filter((e) => e.stage !== "archived")
            .sort(
              (a, b) =>
                new Date(b.updatedAt).getTime() -
                new Date(a.updatedAt).getTime()
            );
          setEntries(sorted);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const advance = useCallback(
    async (id: string, nextStage: string) => {
      await fetch("/api/pipeline", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, stage: nextStage }),
      });
      load();
    },
    [load]
  );

  const archive = useCallback(
    async (id: string) => {
      await fetch("/api/pipeline", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, stage: "archived" }),
      });
      load();
    },
    [load]
  );

  const nextStage = (current: string): string | null => {
    const idx = STAGES.findIndex((s) => s.key === current);
    if (idx === -1 || idx >= STAGES.length - 1) return null;
    return STAGES[idx + 1].key;
  };

  return (
    <div
      className="w-full py-12"
      style={{
        background:
          "radial-gradient(ellipse 60% 35% at 50% 0%, rgba(74,222,128,0.045), transparent)",
      }}
    >
      {/* Wordmark */}
      <CaliberHeader className="mb-8" />

      <h1 className="text-lg font-semibold text-white text-center mb-6">
        Your Pipeline
      </h1>

      {loading && (
        <div className="text-center text-zinc-500">
          <div className="cb-spinner mx-auto mb-4" />
          Loading…
        </div>
      )}

      {!loading && entries.length === 0 && (
        <div className="text-center text-zinc-500 text-sm">
          <p className="mb-4">
            No jobs in your pipeline yet.
          </p>
          <p className="text-zinc-600">
            Score jobs on LinkedIn — strong matches (8.0+) will appear here
            when you tailor your resume.
          </p>
        </div>
      )}

      {!loading && entries.length > 0 && (
        <div className="space-y-3">
          {entries.map((entry) => {
            const stageInfo = STAGE_MAP[entry.stage] ?? {
              label: entry.stage,
              color: "#71717a",
            };
            const next = nextStage(entry.stage);

            return (
              <div
                key={entry.id}
                className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/50 hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-medium text-sm leading-snug truncate">
                      {entry.jobTitle}
                    </div>
                    <div className="text-zinc-500 text-xs mt-0.5">
                      {entry.company}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {entry.score > 0 && (
                      <span className="text-emerald-400 text-xs font-medium tabular-nums">
                        {entry.score.toFixed(1)}
                      </span>
                    )}
                    <span
                      className="inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
                      style={{
                        color: stageInfo.color,
                        background: stageInfo.color + "18",
                      }}
                    >
                      {stageInfo.label}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3">
                  {entry.jobUrl && (
                    <a
                      href={entry.jobUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-zinc-500 hover:text-zinc-300 underline underline-offset-2 transition-colors"
                    >
                      View job
                    </a>
                  )}

                  {next && (
                    <button
                      onClick={() => advance(entry.id, next)}
                      className="text-[11px] text-zinc-500 hover:text-white transition-colors ml-auto"
                    >
                      Move to{" "}
                      <span style={{ color: STAGE_MAP[next]?.color }}>
                        {STAGE_MAP[next]?.label}
                      </span>{" "}
                      →
                    </button>
                  )}

                  <button
                    onClick={() => archive(entry.id)}
                    className="text-[11px] text-zinc-600 hover:text-red-400 transition-colors"
                    title="Archive"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="text-center mt-8">
        <a
          href="/"
          className="text-zinc-600 text-xs hover:text-zinc-400 underline underline-offset-2 transition-colors"
        >
          Back to Caliber
        </a>
      </div>

      <style jsx>{`
        .cb-spinner {
          width: 28px;
          height: 28px;
          border: 3px solid rgba(74, 222, 128, 0.15);
          border-top-color: #4ade80;
          border-radius: 50%;
          animation: cb-spin 0.7s linear infinite;
        }
        @keyframes cb-spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
