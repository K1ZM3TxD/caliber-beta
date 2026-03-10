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
    <Suspense fallback={<div className="text-center text-zinc-500 py-12">Loading…</div>}>
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

  // Load prepared context
  useEffect(() => {
    if (!prepId) {
      setStatus("error");
      setError("No tailor context found. Use the extension to start tailoring.");
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
    const blob = new Blob([tailoredText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `resume-${prep.company.toLowerCase().replace(/\s+/g, "-")}-${prep.jobTitle.toLowerCase().replace(/\s+/g, "-")}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [tailoredText, prep]);

  return (
    <div
      className="w-full py-12"
      style={{
        background:
          "radial-gradient(ellipse 60% 35% at 50% 0%, rgba(74,222,128,0.045), transparent)",
      }}
    >
      {/* Pipeline confirmation banner — only if entry actually exists */}
      <PipelineConfirmationBanner
        jobTitle={prep?.jobTitle ?? ""}
        company={prep?.company ?? ""}
        visible={!!pipelineId && status !== "done"}
      />

      {/* Wordmark */}
      <div className="text-center mb-10">
        <span
          className="text-sm font-medium tracking-[0.22em] uppercase text-zinc-400"
          style={{ textShadow: "0 0 40px rgba(74,222,128,0.08)" }}
        >
          Caliber
        </span>
      </div>

      {/* Status: Loading */}
      {status === "loading" && (
        <div className="text-center text-zinc-500">
          <div className="cb-spinner mx-auto mb-4" />
          Loading job context…
        </div>
      )}

      {/* Status: Error */}
      {status === "error" && (
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <a
            href="/"
            className="text-zinc-400 underline underline-offset-2 text-sm hover:text-white"
          >
            Back to Caliber
          </a>
        </div>
      )}

      {/* Status: Ready — show job context + generate button */}
      {status === "ready" && prep && (
        <div className="space-y-6">
          <div className="border border-zinc-800 rounded-lg p-5 bg-zinc-900/50">
            <div className="text-zinc-400 text-xs uppercase tracking-wider mb-2">
              Tailoring For
            </div>
            <div className="text-white font-medium text-lg leading-snug">
              {prep.jobTitle}
            </div>
            <div className="text-zinc-400 text-sm mt-1">{prep.company}</div>
            {prep.score > 0 && (
              <div className="mt-3">
                <span className="inline-block bg-emerald-900/40 text-emerald-400 text-xs font-medium px-2 py-0.5 rounded">
                  Fit score: {prep.score.toFixed(1)}
                </span>
              </div>
            )}
          </div>

          <p className="text-zinc-400 text-sm leading-relaxed">
            Caliber will rewrite your resume to foreground experience most
            relevant to this role. Nothing is fabricated — only emphasis,
            ordering, and language are adjusted.
          </p>

          <button
            onClick={generate}
            className="w-full py-3 rounded-lg font-semibold text-black text-base transition-all"
            style={{
              background: "#4ADE80",
              boxShadow: "0 0 24px rgba(74,222,128,0.18)",
            }}
          >
            Generate Tailored Resume
          </button>
        </div>
      )}

      {/* Status: Generating */}
      {status === "generating" && (
        <div className="text-center space-y-4">
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

      {/* Status: Done — show tailored text + download */}
      {status === "done" && prep && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
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
                d="M5 13l4 4L19 7"
              />
            </svg>
            Resume tailored for {prep.jobTitle} at {prep.company}
          </div>

          <div className="border border-zinc-800 rounded-lg p-5 bg-zinc-900/50 max-h-[400px] overflow-y-auto">
            <pre className="text-zinc-300 text-sm whitespace-pre-wrap font-[family-name:var(--font-geist-sans)] leading-relaxed">
              {tailoredText}
            </pre>
          </div>

          <button
            onClick={download}
            className="w-full py-3 rounded-lg font-semibold text-black text-base transition-all"
            style={{
              background: "#4ADE80",
              boxShadow: "0 0 24px rgba(74,222,128,0.18)",
            }}
          >
            Download Tailored Resume
          </button>

          <div className="flex items-center justify-between text-xs pt-2">
            <a
              href="/pipeline"
              className="text-zinc-500 hover:text-zinc-300 underline underline-offset-2 transition-colors"
            >
              View pipeline →
            </a>
            <a
              href="/"
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
