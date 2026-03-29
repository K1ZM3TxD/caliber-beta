"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import CaliberHeader from "../components/caliber_header";

interface KnownJob {
  jobId: string;
  canonicalKey: string;
  platform: "linkedin" | "indeed" | "web";
  title: string;
  company: string;
  location: string | null;
  sourceUrl: string;
  score: number;
  hrcBand: string | null;
  hrcReason: string | null;
  workModeCompat: string | null;
  supportsFit: string[];
  calibrationTitle: string;
  textSource: string;
  scoredAt: string;
}

type SortMode = "date" | "score";
type PlatformFilter = "all" | "linkedin" | "indeed";
type TierFilter = "all" | "strong";

function getCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : "";
}

function scoreColor(score: number): string {
  if (score >= 7.0) return "#4ADE80";
  if (score >= 5.0) return "#FBBF24";
  return "#EF4444";
}

function scoreLabel(score: number): string {
  if (score >= 9.0) return "Excellent";
  if (score >= 8.0) return "Very Strong";
  if (score >= 7.0) return "Strong";
  if (score >= 6.0) return "Viable";
  if (score >= 5.0) return "Adjacent";
  return "Poor Fit";
}

function hrcColor(band: string | null): string {
  if (band === "High") return "#4ADE80";
  if (band === "Possible") return "#FBBF24";
  return "#9CA3AF";
}

function compatLabel(compat: string | null): string {
  if (compat === "compatible") return "Aligned";
  if (compat === "adjacent") return "Adjacent";
  if (compat === "conflicting") return "Divergent";
  return "";
}

function compatColor(compat: string | null): string {
  if (compat === "compatible") return "#4ADE80";
  if (compat === "adjacent") return "#FBBF24";
  if (compat === "conflicting") return "#EF4444";
  return "#9CA3AF";
}

function platformLabel(platform: string): string {
  if (platform === "linkedin") return "LinkedIn";
  if (platform === "indeed") return "Indeed";
  return "Web";
}

function platformColor(platform: string): string {
  if (platform === "linkedin") return "#60A5FA";
  if (platform === "indeed") return "#FBBF24";
  return "#9CA3AF";
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

function applySort(jobs: KnownJob[], sort: SortMode): KnownJob[] {
  const copy = [...jobs];
  if (sort === "score") {
    copy.sort((a, b) => b.score - a.score);
  }
  // "date" is already sorted newest-first from the API
  return copy;
}

function applyFilters(
  jobs: KnownJob[],
  platform: PlatformFilter,
  tier: TierFilter,
): KnownJob[] {
  return jobs.filter(
    (j) =>
      (platform === "all" || j.platform === platform) &&
      (tier === "all" || j.score >= 7.0),
  );
}

// ─── Filter pill component ─────────────────────────────────────

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
        active
          ? "bg-neutral-700 border-neutral-500 text-white"
          : "bg-transparent border-neutral-700 text-neutral-500 hover:text-neutral-300 hover:border-neutral-600"
      }`}
    >
      {children}
    </button>
  );
}

// ─── Add-job form state ────────────────────────────────────────

type IngestStatus = "idle" | "submitting" | "success" | "error";

interface IngestResult {
  score: number;
  hrcBand: string | null;
  workModeCompat: string | null;
  supportsFit: string[];
  platform: string;
}

export default function KnownJobsPage() {
  const [jobs, setJobs] = useState<KnownJob[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [sort, setSort] = useState<SortMode>("date");
  const [platform, setPlatform] = useState<PlatformFilter>("all");
  const [tier, setTier] = useState<TierFilter>("all");

  // Add-job form
  const [addOpen, setAddOpen] = useState(false);
  const [ingestUrl, setIngestUrl] = useState("");
  const [ingestText, setIngestText] = useState("");
  const [ingestStatus, setIngestStatus] = useState<IngestStatus>("idle");
  const [ingestResult, setIngestResult] = useState<IngestResult | null>(null);
  const [ingestError, setIngestError] = useState<string | null>(null);

  function load() {
    setStatus("loading");
    const sessionId = getCookie("caliber_sessionId");
    const url = sessionId
      ? `/api/jobs/known?sessionId=${encodeURIComponent(sessionId)}&limit=50`
      : `/api/jobs/known?limit=50`;

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) {
          setStatus("error");
          return;
        }
        setJobs(data.entries ?? []);
        setStatus(data.entries?.length > 0 ? "ready" : "empty");
      })
      .catch(() => setStatus("error"));
  }

  function submitAddJob(e: React.FormEvent) {
    e.preventDefault();
    if (ingestStatus === "submitting") return;
    setIngestStatus("submitting");
    setIngestError(null);
    setIngestResult(null);

    const sessionId = getCookie("caliber_sessionId");
    fetch("/api/jobs/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: ingestUrl.trim(),
        jobText: ingestText.trim(),
        ...(sessionId ? { sessionId } : {}),
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) {
          setIngestStatus("error");
          setIngestError(data.error ?? "Something went wrong. Try again.");
          return;
        }
        setIngestStatus("success");
        setIngestResult({
          score: data.score,
          hrcBand: data.hrcBand,
          workModeCompat: data.workModeCompat,
          supportsFit: data.supportsFit ?? [],
          platform: data.platform ?? "web",
        });
        // Reload the list so the new job appears
        load();
      })
      .catch(() => {
        setIngestStatus("error");
        setIngestError("Network error — check your connection and try again.");
      });
  }

  function resetAddForm() {
    setIngestUrl("");
    setIngestText("");
    setIngestStatus("idle");
    setIngestResult(null);
    setIngestError(null);
  }

  useEffect(() => {
    load();
  }, []);

  const displayJobs = useMemo(() => {
    const filtered = applyFilters(jobs, platform, tier);
    return applySort(filtered, sort);
  }, [jobs, sort, platform, tier]);

  const strongCount = useMemo(() => jobs.filter((j) => j.score >= 7.0).length, [jobs]);

  const hasFiltersActive = platform !== "all" || tier !== "all";
  const linkedInCount = jobs.filter((j) => j.platform === "linkedin").length;
  const indeedCount = jobs.filter((j) => j.platform === "indeed").length;

  return (
    <div className="flex flex-col gap-6 pt-6 pb-16">
      <CaliberHeader />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Scored Jobs</h1>
          {status === "ready" && (
            <p className="text-sm text-neutral-400 mt-0.5">
              {jobs.length} scored ·{" "}
              <span style={{ color: "#4ADE80" }}>{strongCount} strong</span>
              {hasFiltersActive && ` · showing ${displayJobs.length}`}
            </p>
          )}
          {status !== "ready" && (
            <p className="text-sm text-neutral-500 mt-0.5">
              Jobs evaluated from your sidecard sessions
            </p>
          )}
        </div>
        <Link
          href="/pipeline"
          className="text-sm text-neutral-400 hover:text-white transition-colors"
        >
          ← Saved Jobs
        </Link>
      </div>

      {/* ─── Add Job form ── */}
      {(status === "ready" || status === "empty") && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-950 overflow-hidden">
          <button
            onClick={() => { setAddOpen((v) => !v); if (addOpen) resetAddForm(); }}
            className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-neutral-400 hover:text-white transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <span className="text-base leading-none text-neutral-600">+</span>
              Score a job manually
            </span>
            <span className="text-neutral-600 text-xs">{addOpen ? "▲" : "▼"}</span>
          </button>

          {addOpen && (
            <div className="border-t border-neutral-800 px-4 pb-4 pt-3">
              {ingestStatus === "success" && ingestResult ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex items-center gap-1.5 rounded-lg px-3 py-2"
                      style={{ background: scoreColor(ingestResult.score) + "18" }}
                    >
                      <span
                        className="text-lg font-bold tabular-nums"
                        style={{ color: scoreColor(ingestResult.score) }}
                      >
                        {ingestResult.score.toFixed(1)}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm text-white font-medium">{scoreLabel(ingestResult.score)}</span>
                      {ingestResult.hrcBand && (
                        <span className="text-xs" style={{ color: hrcColor(ingestResult.hrcBand) }}>
                          {ingestResult.hrcBand} screen likelihood
                        </span>
                      )}
                      {ingestResult.workModeCompat && compatLabel(ingestResult.workModeCompat) && (
                        <span className="text-xs" style={{ color: compatColor(ingestResult.workModeCompat) }}>
                          {compatLabel(ingestResult.workModeCompat)} work mode
                        </span>
                      )}
                    </div>
                  </div>
                  {ingestResult.supportsFit[0] && (
                    <p className="text-[12px] text-green-500/80 italic">{ingestResult.supportsFit[0]}</p>
                  )}
                  <p className="text-xs text-neutral-500">
                    Job scored and added to your list{ingestResult.platform !== "web" ? ` (${platformLabel(ingestResult.platform)})` : ""}.
                  </p>
                  <button
                    onClick={resetAddForm}
                    className="self-start text-xs text-neutral-500 hover:text-white transition-colors"
                  >
                    Score another job
                  </button>
                </div>
              ) : (
                <form onSubmit={submitAddJob} className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] text-neutral-500 uppercase tracking-wide">Job URL</label>
                    <input
                      type="url"
                      value={ingestUrl}
                      onChange={(e) => setIngestUrl(e.target.value)}
                      placeholder="https://www.linkedin.com/jobs/view/..."
                      required
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-500 transition-colors"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] text-neutral-500 uppercase tracking-wide">
                      Job Description
                    </label>
                    <textarea
                      value={ingestText}
                      onChange={(e) => setIngestText(e.target.value)}
                      placeholder="Paste the full job description text here (copy from the job posting page)…"
                      rows={6}
                      required
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-500 transition-colors resize-y"
                    />
                    <p className="text-[10px] text-neutral-600">
                      {ingestText.trim().length < 200
                        ? `${200 - ingestText.trim().length} more characters needed`
                        : `${ingestText.trim().length} characters — ready`}
                    </p>
                  </div>
                  {ingestError && (
                    <p className="text-xs text-red-400">{ingestError}</p>
                  )}
                  <button
                    type="submit"
                    disabled={ingestStatus === "submitting"}
                    className="self-start text-sm font-medium px-4 py-1.5 rounded-lg bg-green-700 hover:bg-green-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {ingestStatus === "submitting" ? "Scoring…" : "Score Job"}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── Controls ── */}
      {status === "ready" && jobs.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Sort */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-neutral-600 uppercase tracking-wide">Sort</span>
              <div className="flex gap-1">
                <Pill active={sort === "date"} onClick={() => setSort("date")}>Recent</Pill>
                <Pill active={sort === "score"} onClick={() => setSort("score")}>Best Score</Pill>
              </div>
            </div>

            {/* Platform */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-neutral-600 uppercase tracking-wide">Platform</span>
              <div className="flex gap-1">
                <Pill active={platform === "all"} onClick={() => setPlatform("all")}>All</Pill>
                {linkedInCount > 0 && (
                  <Pill active={platform === "linkedin"} onClick={() => setPlatform("linkedin")}>
                    LinkedIn
                  </Pill>
                )}
                {indeedCount > 0 && (
                  <Pill active={platform === "indeed"} onClick={() => setPlatform("indeed")}>
                    Indeed
                  </Pill>
                )}
              </div>
            </div>

            {/* Tier */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-neutral-600 uppercase tracking-wide">Show</span>
              <div className="flex gap-1">
                <Pill active={tier === "all"} onClick={() => setTier("all")}>All</Pill>
                <Pill active={tier === "strong"} onClick={() => setTier("strong")}>
                  Strong only
                </Pill>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Loading skeleton ── */}
      {status === "loading" && (
        <div className="flex flex-col gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="rounded-xl bg-neutral-900 border border-neutral-800 p-4 animate-pulse">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 flex flex-col gap-2">
                  <div className="h-4 bg-neutral-700 rounded w-2/3" />
                  <div className="h-3 bg-neutral-800 rounded w-1/3" />
                  <div className="h-3 bg-neutral-800 rounded w-1/2" />
                </div>
                <div className="h-8 w-8 bg-neutral-800 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Empty — no cache ── */}
      {status === "empty" && (
        <div className="rounded-xl bg-neutral-900 border border-neutral-800 px-6 py-10 flex flex-col items-center gap-3 text-center">
          <p className="text-neutral-300 font-medium">No scored jobs yet</p>
          <p className="text-sm text-neutral-500 max-w-sm">
            Install the Caliber extension, open a job on LinkedIn or Indeed, and click the sidecard
            to score it. Scored jobs appear here automatically.
          </p>
          <div className="flex gap-3 mt-2">
            <Link
              href="/calibration"
              className="text-sm text-green-400 hover:text-green-300 transition-colors"
            >
              Start calibration →
            </Link>
            <Link
              href="/extension"
              className="text-sm text-neutral-400 hover:text-white transition-colors"
            >
              Get extension →
            </Link>
          </div>
        </div>
      )}

      {/* ─── Error ── */}
      {status === "error" && (
        <div className="rounded-xl bg-neutral-900 border border-neutral-800 px-6 py-8 flex flex-col items-center gap-2 text-center">
          <p className="text-neutral-400 text-sm">Could not load scored jobs.</p>
          <button
            className="text-sm text-green-400 hover:text-green-300 transition-colors"
            onClick={load}
          >
            Try again
          </button>
        </div>
      )}

      {/* ─── No-results-for-filter message ── */}
      {status === "ready" && displayJobs.length === 0 && jobs.length > 0 && (
        <div className="rounded-xl bg-neutral-900 border border-neutral-800 px-6 py-8 flex flex-col items-center gap-2 text-center">
          <p className="text-neutral-400 text-sm">No jobs match this filter.</p>
          <button
            className="text-sm text-green-400 hover:text-green-300 transition-colors"
            onClick={() => { setPlatform("all"); setTier("all"); }}
          >
            Clear filters
          </button>
        </div>
      )}

      {/* ─── Job list ── */}
      {status === "ready" && displayJobs.length > 0 && (
        <div className="flex flex-col gap-2">
          {displayJobs.map((job) => (
            <a
              key={job.jobId}
              href={job.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-xl bg-neutral-900 border border-neutral-800 px-4 py-3 hover:border-neutral-600 transition-colors group"
            >
              <div className="flex items-start justify-between gap-4">
                {/* Left: job info */}
                <div className="flex-1 min-w-0">
                  {/* Title + platform */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-white group-hover:text-green-300 transition-colors truncate">
                      {job.title}
                    </span>
                    <span
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                      style={{
                        background: platformColor(job.platform) + "22",
                        color: platformColor(job.platform),
                      }}
                    >
                      {platformLabel(job.platform)}
                    </span>
                    {job.workModeCompat && compatLabel(job.workModeCompat) && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{
                          background: compatColor(job.workModeCompat) + "18",
                          color: compatColor(job.workModeCompat),
                        }}
                      >
                        {compatLabel(job.workModeCompat)}
                      </span>
                    )}
                  </div>

                  {/* Company · location · time */}
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-neutral-400">{job.company}</span>
                    {job.location && (
                      <>
                        <span className="text-neutral-600 text-xs">·</span>
                        <span className="text-xs text-neutral-500">{job.location}</span>
                      </>
                    )}
                    <span className="text-neutral-600 text-xs">·</span>
                    <span className="text-xs text-neutral-500">{timeAgo(job.scoredAt)}</span>
                  </div>

                  {/* Top fit reason — only if strong match and bullet available */}
                  {job.score >= 7.0 && job.supportsFit[0] && (
                    <div className="mt-1.5 text-[11px] text-green-500/80 italic leading-snug">
                      {job.supportsFit[0]}
                    </div>
                  )}

                  {/* Calibration title */}
                  {job.calibrationTitle && (
                    <div className="mt-1 text-[11px] text-neutral-600">
                      calibrated as{" "}
                      <span className="text-neutral-500">{job.calibrationTitle}</span>
                    </div>
                  )}
                </div>

                {/* Right: score */}
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <div
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5"
                    style={{ background: scoreColor(job.score) + "18" }}
                  >
                    <span
                      className="text-base font-bold tabular-nums"
                      style={{ color: scoreColor(job.score) }}
                    >
                      {job.score.toFixed(1)}
                    </span>
                  </div>
                  <span className="text-[10px] text-neutral-600">{scoreLabel(job.score)}</span>
                  {job.hrcBand && (
                    <span
                      className="text-[10px]"
                      style={{ color: hrcColor(job.hrcBand) }}
                    >
                      {job.hrcBand} screen
                    </span>
                  )}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}

      {/* ─── Footer count ── */}
      {status === "ready" && jobs.length > 0 && (
        <p className="text-xs text-neutral-600 text-center">
          {displayJobs.length}{displayJobs.length !== jobs.length ? ` of ${jobs.length}` : ""}{" "}
          scored job{displayJobs.length !== 1 ? "s" : ""} · trusted sidecard sessions only
        </p>
      )}
    </div>
  );
}
