"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import CaliberHeader from "../components/caliber_header";

interface PipelineEntry {
  id: string;
  userId?: string;
  sessionId?: string;
  jobTitle: string;
  company: string;
  jobUrl: string;
  score: number;
  stage: string;
  createdAt: string;
  updatedAt: string;
  tailorId?: string;
}

type TailorPanelStatus =
  | "loading"
  | "ready"
  | "generating"
  | "done"
  | "error"
  | "unavailable";

const BOARD_COLUMNS = [
  { key: "resume_prep", label: "Resume Prep", color: "#4ADE80" },
  { key: "submitted", label: "Submitted", color: "#60A5FA" },
  { key: "interview_prep", label: "Interview Prep", color: "#FBBF24" },
  { key: "interview", label: "Interview", color: "#F472B6" },
] as const;

function getCookie(name: string): string {
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : "";
}

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
      return "interview";
    default:
      return "resume_prep";
  }
}

function scoreColor(score: number): string {
  if (score >= 7.5) return "#4ADE80";
  if (score >= 5) return "#FBBF24";
  return "#EF4444";
}

/* ────────────────────────────────────────────────────────────────────────
   Inline Tailor — Slide-over side panel
   ──────────────────────────────────────────────────────────────────────── */

function TailorPanel({
  entry,
  onClose,
}: {
  entry: PipelineEntry;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<TailorPanelStatus>("loading");
  const [tailoredText, setTailoredText] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [genStep, setGenStep] = useState(0);
  const genTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setStatus("loading");
    setTailoredText("");
    setError("");
    fetch(`/api/pipeline/tailor?pipelineId=${encodeURIComponent(entry.id)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) {
          setStatus("error");
          setError(data.error || "Failed to check tailor status");
          return;
        }
        if (data.status === "done") {
          setTailoredText(data.tailoredText);
          setStatus("done");
        } else if (data.status === "ready") {
          setStatus("ready");
        } else {
          setStatus("unavailable");
        }
      })
      .catch(() => {
        setStatus("error");
        setError("Failed to load tailor status");
      });
  }, [entry.id]);

  // Progressive step messaging while generating
  const genSteps = [
    "Analyzing job requirements…",
    "Aligning your experience…",
    "Generating tailored output…",
  ];
  useEffect(() => {
    if (status !== "generating") {
      if (genTimerRef.current) clearInterval(genTimerRef.current);
      genTimerRef.current = null;
      return;
    }
    setGenStep(0);
    genTimerRef.current = setInterval(() => {
      setGenStep((prev) =>
        prev < genSteps.length - 1 ? prev + 1 : prev
      );
    }, 4000);
    return () => {
      if (genTimerRef.current) clearInterval(genTimerRef.current);
    };
  }, [status, genSteps.length]);

  const generate = useCallback(async () => {
    setStatus("generating");
    setError("");
    try {
      const res = await fetch("/api/pipeline/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipelineId: entry.id }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Generation failed");
      setTailoredText(data.tailoredText);
      setStatus("done");
    } catch (err: unknown) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Generation failed");
    }
  }, [entry.id]);

  const copyToClipboard = useCallback(async () => {
    if (!tailoredText) return;
    try {
      await navigator.clipboard.writeText(tailoredText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard not available */
    }
  }, [tailoredText]);

  const download = useCallback(async () => {
    if (!tailoredText || downloading) return;
    setDownloading(true);
    try {
      const res = await fetch("/api/tailor/export-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tailoredText,
          jobTitle: entry.jobTitle,
          company: entry.company,
        }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const fnMatch = disposition.match(/filename="([^"]+)"/);
      const fn = fnMatch ? fnMatch[1] : `resume-${entry.company.toLowerCase().replace(/\s+/g, "-")}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fn;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      /* silent — user can retry */
    } finally {
      setDownloading(false);
    }
  }, [tailoredText, downloading, entry.jobTitle, entry.company]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div
        className="relative w-full max-w-[480px] h-full bg-zinc-950 border-l border-zinc-800 overflow-y-auto"
        style={{ animation: "cb-slide-in 0.2s ease-out" }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-800/60 px-6 py-4 flex items-start justify-between gap-3 z-10">
          <div className="min-w-0">
            <h2 className="text-white text-base font-semibold leading-snug truncate">
              {entry.jobTitle}
            </h2>
            <div className="text-zinc-400 text-sm mt-0.5">
              {entry.company}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Close"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Loading */}
          {status === "loading" && (
            <div className="text-center py-8">
              <div className="cb-spinner mx-auto mb-3" />
              <p className="text-zinc-500 text-sm">
                Checking tailor status…
              </p>
            </div>
          )}

          {/* Unavailable */}
          {status === "unavailable" && (
            <div className="text-center py-8 space-y-3">
              <p className="text-zinc-400 text-sm">
                No job context available for tailoring.
              </p>
              <p className="text-zinc-600 text-xs leading-relaxed">
                Use the Caliber extension on LinkedIn to score this job first —
                that captures the full job description needed for tailoring.
              </p>
            </div>
          )}

          {/* Ready */}
          {status === "ready" && (
            <div className="space-y-4">
              <p className="text-zinc-400 text-sm leading-relaxed">
                Caliber rewrites your resume to foreground experience most
                relevant to this role. Nothing is fabricated — only emphasis,
                ordering, and language are adjusted.
              </p>
              <button
                onClick={generate}
                className="w-full py-3 rounded-lg font-semibold text-sm transition-all"
                style={{
                  background: "rgba(74,222,128,0.10)",
                  color: "#4ADE80",
                  border: "1px solid rgba(74,222,128,0.45)",
                }}
              >
                Generate Tailored Resume
              </button>
            </div>
          )}

          {/* Generating */}
          {status === "generating" && (
            <div className="space-y-5">
              {/* Step indicator */}
              <div className="space-y-2">
                {genSteps.map((label, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2.5 text-sm transition-opacity duration-300"
                    style={{ opacity: i <= genStep ? 1 : 0.25 }}
                  >
                    {i < genStep ? (
                      <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : i === genStep ? (
                      <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-emerald-400" style={{ animation: "cb-gen-pulse 1.2s ease-in-out infinite" }} />
                      </div>
                    ) : (
                      <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
                      </div>
                    )}
                    <span className={i <= genStep ? "text-zinc-300" : "text-zinc-600"}>
                      {label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Skeleton preview */}
              <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/40 p-4 space-y-3">
                <div className="h-3 w-3/4 rounded bg-zinc-800" style={{ animation: "cb-gen-pulse 1.4s ease-in-out infinite" }} />
                <div className="h-3 w-full rounded bg-zinc-800" style={{ animation: "cb-gen-pulse 1.4s ease-in-out 0.2s infinite" }} />
                <div className="h-3 w-5/6 rounded bg-zinc-800" style={{ animation: "cb-gen-pulse 1.4s ease-in-out 0.4s infinite" }} />
                <div className="h-3 w-2/3 rounded bg-zinc-800" style={{ animation: "cb-gen-pulse 1.4s ease-in-out 0.6s infinite" }} />
              </div>

              <p className="text-zinc-600 text-xs text-center">
                This usually takes 10–20 seconds
              </p>
            </div>
          )}

          {/* Error */}
          {status === "error" && (
            <div className="text-center py-6 space-y-3">
              <p className="text-red-400 text-sm">{error}</p>
              <button
                onClick={generate}
                className="text-sm text-zinc-400 hover:text-white underline underline-offset-2 transition-colors"
              >
                Try again
              </button>
            </div>
          )}

          {/* Done — result + actions */}
          {status === "done" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                <svg
                  className="w-4 h-4 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Resume tailored
              </div>

              {/* Result preview */}
              <div className="border border-zinc-800 rounded-lg bg-zinc-900/50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800/60">
                  <span className="text-zinc-500 text-xs font-medium tracking-wide uppercase">
                    Tailored Resume
                  </span>
                  <button
                    onClick={copyToClipboard}
                    className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
                  >
                    {copied ? (
                      <>
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        Copied
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <div className="p-4 max-h-[360px] overflow-y-auto">
                  <pre className="text-zinc-300 text-sm whitespace-pre-wrap font-[family-name:var(--font-geist-sans)] leading-relaxed">
                    {tailoredText}
                  </pre>
                </div>
              </div>

              {/* Download */}
              <button
                onClick={download}
                disabled={downloading}
                className="w-full py-3 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: "rgba(74,222,128,0.10)",
                  color: "#4ADE80",
                  border: "1px solid rgba(74,222,128,0.45)",
                }}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                {downloading ? "Generating PDF…" : "Download PDF"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Saved Jobs Board
   ──────────────────────────────────────────────────────────────────────── */

export default function PipelinePage() {
  const { data: session, status: authStatus } = useSession();
  const [entries, setEntries] = useState<PipelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const dragIdRef = useRef<string | null>(null);
  const [tailorEntryId, setTailorEntryId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  // Read highlight param from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("highlight");
    if (id) {
      setHighlightId(id);
      // Clean URL without reload
      window.history.replaceState(null, "", "/pipeline");
    }
  }, []);

  const load = useCallback(() => {
    if (authStatus === "loading") return;
    // Pass calibration sessionId so server can migrate file-based entries
    const calSessionId = getCookie("caliber_sessionId") || "";
    const qs = calSessionId ? `?sessionId=${encodeURIComponent(calSessionId)}` : "";
    console.debug("[Caliber][pipeline] loading", { authStatus, calSessionId: calSessionId || "none" });
    fetch(`/api/pipeline${qs}`)
      .then((r) => {
        if (!r.ok) {
          console.warn("[Caliber][pipeline] load HTTP error", { status: r.status });
          return { ok: false };
        }
        return r.json();
      })
      .then((data) => {
        if (data.ok) {
          const filtered = (data.entries as PipelineEntry[]).filter(
            (e) => e.stage !== "archived"
          );
          console.debug("[Caliber][pipeline] loaded", { count: filtered.length });
          setEntries(filtered);
          // If server resolved a caliberSessionId we didn't have, restore the cookie
          // so the extension and future loads can use it
          if (data.caliberSessionId && !calSessionId) {
            document.cookie = `caliber_sessionId=${encodeURIComponent(data.caliberSessionId)};path=/;max-age=${7 * 86400};SameSite=Lax`;
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authStatus]);

  useEffect(() => {
    load();
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  // Scroll to highlighted entry after entries load
  useEffect(() => {
    if (!highlightId || loading || entries.length === 0) return;
    // Small delay so DOM has rendered the cards
    const timer = setTimeout(() => {
      const el = document.querySelector(`[data-entry-id="${CSS.escape(highlightId)}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      // Clear highlight after animation completes
      setTimeout(() => setHighlightId(null), 2500);
    }, 150);
    return () => clearTimeout(timer);
  }, [highlightId, loading, entries]);

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
      const entryId =
        e.dataTransfer.getData("text/plain") || dragIdRef.current;
      if (!entryId) return;
      const entry = entries.find((en) => en.id === entryId);
      if (!entry) return;
      if (mapStageToColumn(entry.stage) !== colKey) {
        moveToStage(entryId, colKey);
      }
    },
    [entries, moveToStage]
  );

  // Tailor panel entry
  const tailorEntry = tailorEntryId
    ? entries.find((e) => e.id === tailorEntryId) ?? null
    : null;

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

  return (
    <div className="w-full pb-16">
      {/* Ambient glow — matches current shell baseline */}
      <div
        className="pointer-events-none fixed inset-x-0 top-0"
        style={{
          height: "50vh",
          background: "radial-gradient(ellipse 100% 70% at 50% -20%, rgba(74,222,128,0.045) 0%, rgba(74,222,128,0.015) 40%, transparent 70%)",
          zIndex: 0,
        }}
      />
      <div className="relative z-10">
        <CaliberHeader className="mb-8" />

        {authStatus === "authenticated" && session?.user?.email && (
          <div className="text-center mb-6" style={{ marginTop: "-16px" }}>
            <span className="text-xs" style={{ color: "rgba(74,222,128,0.6)" }}>
              Signed in as {session.user.email}
            </span>
          </div>
        )}

      {/* Sign-in CTA for unauthenticated users — non-blocking */}
      {authStatus === "unauthenticated" && (
        <div
          className="mb-6 mx-auto rounded-lg px-5 py-4 flex items-center justify-between gap-4 flex-wrap"
          style={{
            maxWidth: "960px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.09)",
          }}
        >
          <p className="text-neutral-400 text-sm">
            Sign in to keep your saved jobs across sessions and devices.
          </p>
          <Link
            href="/signin?callbackUrl=/pipeline"
            className="inline-block px-5 py-2 rounded-lg font-semibold text-sm transition-all flex-shrink-0"
            style={{
              background: "rgba(74,222,128,0.10)",
              color: "#4ADE80",
              border: "1px solid rgba(74,222,128,0.55)",
            }}
          >
            Sign in
          </Link>
        </div>
      )}

      {loading && (
        <div className="text-center text-neutral-500">
          <div className="cb-spinner mx-auto mb-4" />
          Loading…
        </div>
      )}

      {!loading && (
        <div className="overflow-x-auto pb-2">
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: "repeat(4, minmax(220px, 1fr))",
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
                  const isResumePrepCol = col.key === "resume_prep";
                  const isHighlighted = entry.id === highlightId;
                  return (
                    <div
                      key={entry.id}
                      data-entry-id={entry.id}
                      draggable
                      onDragStart={(e) => onDragStart(e, entry.id)}
                      onDragEnd={onDragEnd}
                      className={`border rounded-lg p-4 bg-zinc-900/50 hover:border-zinc-700 transition-colors cursor-grab active:cursor-grabbing group ${isHighlighted ? "cb-highlight-card" : "border-zinc-800"}`}
                    >
                      {/* Top row: title + score + archive */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-white text-sm font-medium leading-snug min-w-0 truncate flex-1">
                          {entry.jobTitle}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span
                            className="text-xs font-bold tabular-nums px-1.5 py-0.5 rounded"
                            style={{
                              color: entry.score > 0 ? scoreColor(entry.score) : "#71717A",
                              backgroundColor: entry.score > 0
                                ? scoreColor(entry.score) + "18"
                                : "rgba(113,113,122,0.12)",
                            }}
                          >
                            {entry.score > 0 ? entry.score.toFixed(1) : "—"}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              archive(entry.id);
                            }}
                            className="w-6 h-6 flex items-center justify-center rounded-md text-zinc-600 hover:text-red-400 hover:bg-zinc-800/80 opacity-0 group-hover:opacity-100 transition-all"
                            title="Remove"
                          >
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2.5}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div className="text-zinc-500 text-xs mt-0.5 truncate">
                        {entry.company}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 mt-3">
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
                        {isResumePrepCol && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setTailorEntryId(entry.id);
                            }}
                            className="text-[11px] font-medium transition-colors ml-auto flex items-center gap-1"
                            style={{
                              color: entry.tailorId
                                ? "#4ADE80"
                                : "rgba(74,222,128,0.7)",
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLElement).style.color =
                                "#4ADE80";
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLElement).style.color =
                                entry.tailorId
                                  ? "#4ADE80"
                                  : "rgba(74,222,128,0.7)";
                            }}
                          >
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                            {entry.tailorId
                              ? "View tailored"
                              : "Tailor resume"}
                          </button>
                        )}
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
        </div>
      )}

      <div className="text-center mt-8 flex flex-col items-center gap-3">
        <Link
          href="/score"
          className="text-xs font-medium transition-colors"
          style={{ color: "rgba(74,222,128,0.65)", textDecoration: "none", borderBottom: "1px solid rgba(74,222,128,0.25)" }}
        >
          Score a New Job
        </Link>
        <a
          href="/"
          className="text-neutral-500 text-xs hover:text-neutral-300 underline underline-offset-2 transition-colors"
        >
          Back to Caliber
        </a>
      </div>

      {/* Inline tailor slide-over panel */}
      {tailorEntry && (
        <TailorPanel
          entry={tailorEntry}
          onClose={() => {
            setTailorEntryId(null);
            load();
          }}
        />
      )}
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
        @keyframes cb-slide-in {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        @keyframes cb-highlight-glow {
          0% {
            border-color: rgba(74, 222, 128, 0.5);
            box-shadow: 0 0 12px rgba(74, 222, 128, 0.15);
          }
          70% {
            border-color: rgba(74, 222, 128, 0.5);
            box-shadow: 0 0 12px rgba(74, 222, 128, 0.15);
          }
          100% {
            border-color: rgba(63, 63, 70, 1);
            box-shadow: none;
          }
        }
        .cb-highlight-card {
          animation: cb-highlight-glow 2.5s ease-out both;
        }
        @keyframes cb-gen-pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
