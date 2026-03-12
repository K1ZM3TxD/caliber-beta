"use client";

import React, { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import PipelineConfirmationBanner from "../components/pipeline_confirmation_banner";

type Status = "loading" | "ready" | "generating" | "done" | "error";

interface Prep {
  id: string;
  sessionId: string;
  jobTitle: string;
  company: string;
  jobUrl: string;
  jobText: string;
  score: number;
}

export default function TailorPage() {
  return (
    <Suspense
      fallback={
        <div className="text-center text-zinc-500 py-10">Loading…</div>
      }
    >
      <TailorInner />
    </Suspense>
  );
}

function TailorInner() {
  const searchParams = useSearchParams();
  const prepId = searchParams.get("id") ?? "";

  const [status, setStatus] = useState<Status>("loading");
  const [prep, setPrep] = useState<Prep | null>(null);
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [tailoredText, setTailoredText] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  // Load prepared context
  useEffect(() => {
    if (!prepId) {
      setStatus("error");
      setError(
        "No tailor context found. Use the extension to start tailoring."
      );
      return;
    }
    fetch(`/api/tailor/prepare?id=${encodeURIComponent(prepId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) throw new Error(data.error || "Failed to load context");
        setPrep(data.prep);
        setPipelineId(data.pipelineId ?? null);
        setStatus("ready");
      })
      .catch((err) => {
        setStatus("error");
        setError(err.message || "Failed to load tailor context");
      });
  }, [prepId]);

  const generate = useCallback(async () => {
    if (!prep) return;
    setStatus("generating");
    setError("");
    try {
      const res = await fetch("/api/tailor/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prepId: prep.id }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Generation failed");
      setTailoredText(data.tailoredText);
      setStatus("done");
    } catch (err: unknown) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Generation failed");
    }
  }, [prep]);

  const download = useCallback(() => {
    if (!tailoredText || !prep) return;
    const blob = new Blob([tailoredText], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `resume-${prep.company.toLowerCase().replace(/\s+/g, "-")}-${prep.jobTitle.toLowerCase().replace(/\s+/g, "-")}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [tailoredText, prep]);

  const copyToClipboard = useCallback(async () => {
    if (!tailoredText) return;
    try {
      await navigator.clipboard.writeText(tailoredText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard may not be available */
    }
  }, [tailoredText]);

  /* ── Job header (shared across ready / done states) ── */
  const jobHeader = prep ? (
    <div className="text-center">
      <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white leading-snug">
        {prep.jobTitle}
      </h1>
      <div className="text-zinc-400 text-sm mt-1">{prep.company}</div>
      {prep.score > 0 && (
        <div className="mt-1.5">
          <span className="inline-block bg-emerald-900/40 text-emerald-400 text-xs font-medium px-2 py-0.5 rounded">
            Fit score: {prep.score.toFixed(1)}
          </span>
        </div>
      )}
    </div>
  ) : null;

  return (
    <div
      className="w-full max-w-[600px] mx-auto pt-[8vh] pb-8 px-4"
    >
      {/* ─── Loading ─── */}
      {status === "loading" && (
        <div className="text-center text-zinc-500 pt-6">
          <div className="cb-spinner mx-auto mb-3" />
          Loading job context…
        </div>
      )}

      {/* ─── Error ─── */}
      {status === "error" && (
        <div className="text-center space-y-4 pt-6">
          <div className="inline-flex items-center gap-2 text-red-400 text-sm">
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
                d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z"
              />
            </svg>
            <span>{error}</span>
          </div>

          {/* Retry if we have prep context (generation error) */}
          {prep && (
            <button
              onClick={generate}
              className="text-sm text-zinc-400 hover:text-white underline underline-offset-2 transition-colors"
            >
              Try again
            </button>
          )}

          <div className="pt-1">
            <a
              href="/calibration"
              className="text-zinc-500 underline underline-offset-2 text-xs hover:text-zinc-300 transition-colors"
            >
              Back to Caliber
            </a>
          </div>
        </div>
      )}

      {/* ─── Ready — job context + generate ─── */}
      {status === "ready" && prep && (
        <div className="space-y-4">
          {jobHeader}

          <h2 className="text-lg font-semibold text-zinc-300 tracking-tight pt-1">
            Tailor Resume
          </h2>

          <p className="text-zinc-400 text-sm leading-relaxed">
            Caliber rewrites your resume to foreground experience most relevant
            to this role. Nothing is fabricated — only emphasis, ordering, and
            language are adjusted.
          </p>

          <PipelineConfirmationBanner
            jobTitle={prep.jobTitle}
            company={prep.company}
            visible={!!pipelineId}
          />

          <button
            onClick={generate}
            className="w-full py-3 rounded-lg font-semibold text-base transition-all"
            style={{
              background: "rgba(74,222,128,0.06)",
              color: "#4ADE80",
              border: "1px solid rgba(74,222,128,0.45)",
            }}
          >
            Generate Tailored Resume
          </button>

          <div className="text-center pt-1">
            <a
              href="/calibration"
              className="text-zinc-600 text-xs hover:text-zinc-400 underline underline-offset-2 transition-colors"
            >
              Back to Caliber
            </a>
          </div>
        </div>
      )}

      {/* ─── Generating ─── */}
      {status === "generating" && (
        <div className="text-center space-y-3 pt-6">
          <div className="cb-spinner mx-auto" />
          <p className="text-zinc-400 text-sm">
            Tailoring your resume for{" "}
            <span className="text-white">{prep?.jobTitle}</span> at{" "}
            <span className="text-white">{prep?.company}</span>…
          </p>
          <p className="text-zinc-600 text-xs">
            This usually takes 10–20 seconds
          </p>
        </div>
      )}

      {/* ─── Done — result + actions ─── */}
      {status === "done" && prep && (
        <div className="space-y-4">
          {/* Keep job context visible */}
          {jobHeader}

          {/* Success confirmation */}
          <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium pt-1">
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
            Resume tailored for {prep.jobTitle} at {prep.company}
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

          {/* Primary action: download */}
          <button
            onClick={download}
            className="w-full py-3 rounded-lg font-semibold text-base transition-all flex items-center justify-center gap-2"
            style={{
              background: "rgba(74,222,128,0.06)",
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
            Download Tailored Resume
          </button>

          {/* Secondary nav */}
          <div className="flex items-center justify-between text-xs pt-1">
            <a
              href="/pipeline"
              className="text-zinc-500 hover:text-zinc-300 underline underline-offset-2 transition-colors"
            >
              View pipeline →
            </a>
            <a
              href="/calibration"
              className="text-zinc-500 hover:text-zinc-300 underline underline-offset-2 transition-colors"
            >
              Back to Caliber
            </a>
          </div>
        </div>
      )}

      {/* Spinner CSS */}
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
