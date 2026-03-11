"use client";

import React, { useEffect, useState, useCallback } from "react";

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

const BOARD_COLUMNS = [
  { key: "resume_prep", label: "Resume Prep", color: "#4ADE80" },
  { key: "submitted", label: "Submitted", color: "#60A5FA" },
  { key: "interview_prep", label: "Interview Prep", color: "#FBBF24" },
  { key: "interview", label: "Interview", color: "#F472B6" },
] as const;

// Map legacy stages to board columns
function mapStageToColumn(stage: string): string {
  switch (stage) {
    case "strong_match":
    case "tailored":
    case "resume_prep":
      return "resume_prep";
    case "applied":
    case "submitted":
      return "submitted";
    case "interview_prep":
      return "interview_prep";
    case "interviewing":
    case "interview":
      return "interview";
    case "offer":
      return "interview"; // show offers in interview column
    default:
      return "resume_prep";
  }
}

export default function PipelinePage() {
  const [entries, setEntries] = useState<PipelineEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    fetch("/api/pipeline")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          const filtered = (data.entries as PipelineEntry[]).filter(
            (e) => e.stage !== "archived"
          );
          setEntries(filtered);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const moveToStage = useCallback(
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

  // Group entries by board column
  const columns = BOARD_COLUMNS.map((col) => ({
    ...col,
    entries: entries
      .filter((e) => mapStageToColumn(e.stage) === col.key)
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ),
  }));

  const nextColumn = (currentColKey: string): string | null => {
    const idx = BOARD_COLUMNS.findIndex((c) => c.key === currentColKey);
    if (idx === -1 || idx >= BOARD_COLUMNS.length - 1) return null;
    return BOARD_COLUMNS[idx + 1].key;
  };

  const prevColumn = (currentColKey: string): string | null => {
    const idx = BOARD_COLUMNS.findIndex((c) => c.key === currentColKey);
    if (idx <= 0) return null;
    return BOARD_COLUMNS[idx - 1].key;
  };

  return (
    <div
      className="w-full py-10"
      style={{
        background:
          "radial-gradient(ellipse 80% 40% at 50% 0%, rgba(74,222,128,0.045), transparent)",
      }}
    >
      <h1 className="text-xl font-semibold text-white text-center mb-8 tracking-tight">
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
          <p className="mb-4">No jobs in your pipeline yet.</p>
          <p className="text-zinc-600">
            Score jobs on LinkedIn — strong matches (8.0+) will appear here
            when you tailor your resume.
          </p>
        </div>
      )}

      {!loading && entries.length > 0 && (
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: "repeat(4, 1fr)",
            minWidth: 0,
          }}
        >
          {columns.map((col) => (
            <div key={col.key} className="flex flex-col min-w-0">
              {/* Column header */}
              <div
                className="flex items-center gap-2 mb-3 px-1"
              >
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: col.color }}
                />
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  {col.label}
                </span>
                <span className="text-[10px] text-zinc-600 ml-auto">
                  {col.entries.length}
                </span>
              </div>

              {/* Cards */}
              <div className="space-y-2 flex-1">
                {col.entries.map((entry) => {
                  const colKey = mapStageToColumn(entry.stage);
                  const next = nextColumn(colKey);
                  const prev = prevColumn(colKey);
                  const nextLabel = next
                    ? BOARD_COLUMNS.find((c) => c.key === next)?.label
                    : null;
                  const prevLabel = prev
                    ? BOARD_COLUMNS.find((c) => c.key === prev)?.label
                    : null;

                  return (
                    <div
                      key={entry.id}
                      className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/50 hover:border-zinc-700 transition-colors"
                    >
                      <div className="text-white text-sm font-medium leading-snug truncate">
                        {entry.jobTitle}
                      </div>
                      <div className="text-zinc-500 text-[11px] mt-0.5 truncate">
                        {entry.company}
                      </div>
                      {entry.score > 0 && (
                        <div className="mt-1.5">
                          <span className="text-emerald-400 text-[11px] font-medium tabular-nums">
                            {entry.score.toFixed(1)}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {entry.jobUrl && (
                          <a
                            href={entry.jobUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-zinc-500 hover:text-zinc-300 underline underline-offset-2 transition-colors"
                          >
                            View
                          </a>
                        )}
                        {prev && (
                          <button
                            onClick={() => moveToStage(entry.id, prev)}
                            className="text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors"
                            title={`Move to ${prevLabel}`}
                          >
                            ← {prevLabel}
                          </button>
                        )}
                        {next && (
                          <button
                            onClick={() => moveToStage(entry.id, next)}
                            className="text-[10px] text-zinc-500 hover:text-white transition-colors ml-auto"
                            title={`Move to ${nextLabel}`}
                          >
                            {nextLabel} →
                          </button>
                        )}
                        <button
                          onClick={() => archive(entry.id)}
                          className="text-[10px] text-zinc-600 hover:text-red-400 transition-colors"
                          title="Archive"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
                {col.entries.length === 0 && (
                  <div className="text-[11px] text-zinc-700 text-center py-6 border border-dashed border-zinc-800/50 rounded-lg">
                    No jobs
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="text-center mt-8">
        <a
          href="/calibration"
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
