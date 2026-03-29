"use client";

import React, { useEffect, useState } from "react";
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
  calibrationTitle: string;
  textSource: string;
  scoredAt: string;
}

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

export default function KnownJobsPage() {
  const [jobs, setJobs] = useState<KnownJob[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");

  useEffect(() => {
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
  }, []);

  return (
    <div className="flex flex-col gap-6 pt-6 pb-16">
      <CaliberHeader />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Recently Scored Jobs</h1>
          <p className="text-sm text-neutral-400 mt-0.5">
            Jobs Caliber has evaluated from your sidecard sessions
          </p>
        </div>
        <Link
          href="/pipeline"
          className="text-sm text-neutral-400 hover:text-white transition-colors"
        >
          ← Saved Jobs
        </Link>
      </div>

      {status === "loading" && (
        <div className="flex flex-col gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="rounded-xl bg-neutral-900 border border-neutral-800 p-4 animate-pulse">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 flex flex-col gap-2">
                  <div className="h-4 bg-neutral-700 rounded w-2/3" />
                  <div className="h-3 bg-neutral-800 rounded w-1/3" />
                </div>
                <div className="h-8 w-8 bg-neutral-800 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      )}

      {status === "empty" && (
        <div className="rounded-xl bg-neutral-900 border border-neutral-800 px-6 py-10 flex flex-col items-center gap-3 text-center">
          <p className="text-neutral-300 font-medium">No scored jobs yet</p>
          <p className="text-sm text-neutral-500 max-w-sm">
            Jobs appear here after you score them through the Caliber extension sidecard on LinkedIn or Indeed.
          </p>
          <Link
            href="/calibration"
            className="mt-2 text-sm text-green-400 hover:text-green-300 transition-colors"
          >
            Start calibration →
          </Link>
        </div>
      )}

      {status === "error" && (
        <div className="rounded-xl bg-neutral-900 border border-neutral-800 px-6 py-8 flex flex-col items-center gap-2 text-center">
          <p className="text-neutral-400 text-sm">Could not load scored jobs.</p>
          <button
            className="text-sm text-green-400 hover:text-green-300 transition-colors"
            onClick={() => {
              setStatus("loading");
              const sessionId = getCookie("caliber_sessionId");
              const url = sessionId
                ? `/api/jobs/known?sessionId=${encodeURIComponent(sessionId)}&limit=50`
                : `/api/jobs/known?limit=50`;
              fetch(url).then(r => r.json()).then(data => {
                if (!data.ok) { setStatus("error"); return; }
                setJobs(data.entries ?? []);
                setStatus(data.entries?.length > 0 ? "ready" : "empty");
              }).catch(() => setStatus("error"));
            }}
          >
            Try again
          </button>
        </div>
      )}

      {status === "ready" && (
        <div className="flex flex-col gap-2">
          {jobs.map((job) => (
            <a
              key={job.jobId}
              href={job.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-xl bg-neutral-900 border border-neutral-800 px-4 py-3 hover:border-neutral-600 transition-colors group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
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
                  </div>
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
                  {job.calibrationTitle && (
                    <div className="mt-1 text-[11px] text-neutral-600">
                      calibrated as <span className="text-neutral-500">{job.calibrationTitle}</span>
                    </div>
                  )}
                </div>

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

      {status === "ready" && jobs.length > 0 && (
        <p className="text-xs text-neutral-600 text-center">
          {jobs.length} scored job{jobs.length !== 1 ? "s" : ""} · from trusted sidecard sessions only
        </p>
      )}
    </div>
  );
}
