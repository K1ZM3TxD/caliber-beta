"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";

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

function scoreColor(score: number): string {
  if (score >= 7.5) return "#4ADE80";
  if (score >= 5) return "#FBBF24";
  return "#EF4444";
}

export default function PipelinePage() {
  const [entries, setEntries] = useState<PipelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const dragIdRef = useRef<string | null>(null);

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
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
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

  // Drag handlers
  const onDragStart = useCallback((e: React.DragEvent, entryId: string) => {
    dragIdRef.current = entryId;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", entryId);
    (e.currentTarget as HTMLElement).style.opacity = "0.5";
  }, []);

  const onDragEnd = useCallback((e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).style.opacity = "1";
    dragIdRef.current = null;
    setDragOverCol(null);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent, colKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCol(colKey);
  }, []);

  const onDragLeave = useCallback(() => {
    setDragOverCol(null);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent, colKey: string) => {
      e.preventDefault();
      setDragOverCol(null);
      const entryId = e.dataTransfer.getData("text/plain") || dragIdRef.current;
      if (!entryId) return;
      const entry = entries.find((en) => en.id === entryId);
      if (!entry) return;
      if (mapStageToColumn(entry.stage) !== colKey) {
        moveToStage(entryId, colKey);
      }
    },
    [entries, moveToStage]
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
      <h1 className="text-xl font-semibold text-zinc-300 text-center mb-8 tracking-tight">
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
            <div
              key={col.key}
              className="flex flex-col min-w-0"
              onDragOver={(e) => onDragOver(e, col.key)}
              onDragLeave={onDragLeave}
              onDrop={(e) => onDrop(e, col.key)}
            >
              {/* Column header */}
              <div className="flex items-center gap-2 mb-3 px-1">
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

              {/* Drop zone */}
              <div
                className="space-y-2.5 flex-1 rounded-lg p-1 transition-colors"
                style={{
                  backgroundColor:
                    dragOverCol === col.key
                      ? "rgba(74,222,128,0.06)"
                      : "transparent",
                  border:
                    dragOverCol === col.key
                      ? "1px dashed rgba(74,222,128,0.25)"
                      : "1px dashed transparent",
                }}
              >
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
                      draggable
                      onDragStart={(e) => onDragStart(e, entry.id)}
                      onDragEnd={onDragEnd}
                      className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/50 hover:border-zinc-700 transition-colors cursor-grab active:cursor-grabbing"
                    >
                      {/* Top row: title + fit score */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-white text-sm font-medium leading-snug min-w-0 truncate">
                          {entry.jobTitle}
                        </div>
                        {entry.score > 0 && (
                          <span
                            className="text-sm font-semibold tabular-nums flex-shrink-0"
                            style={{ color: scoreColor(entry.score) }}
                          >
                            {entry.score.toFixed(1)}
                          </span>
                        )}
                      </div>
                      <div className="text-zinc-500 text-xs mt-0.5 truncate">
                        {entry.company}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        {entry.jobUrl && (
                          <a
                            href={entry.jobUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-zinc-500 hover:text-zinc-300 underline underline-offset-2 transition-colors"
                          >
                            Open job
                          </a>
                        )}
                        {prev && (
                          <button
                            onClick={() => moveToStage(entry.id, prev)}
                            className="text-[11px] text-zinc-600 hover:text-zinc-300 transition-colors"
                            title={`Move to ${prevLabel}`}
                          >
                            ← {prevLabel}
                          </button>
                        )}
                        {next && (
                          <button
                            onClick={() => moveToStage(entry.id, next)}
                            className="text-[11px] text-zinc-500 hover:text-white transition-colors ml-auto"
                            title={`Move to ${nextLabel}`}
                          >
                            {nextLabel} →
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
                {col.entries.length === 0 && (
                  <div className="text-xs text-zinc-700 text-center py-8 border border-dashed border-zinc-800/50 rounded-lg">
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
