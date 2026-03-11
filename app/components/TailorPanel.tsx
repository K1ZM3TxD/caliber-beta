"use client";

import React, { useState, useCallback } from "react";

type TailorStatus = "idle" | "generating" | "done" | "error";

interface TailorPanelProps {
  entryId: string;
  jobTitle: string;
  company: string;
  onClose: () => void;
}

export default function TailorPanel({
  entryId,
  jobTitle,
  company,
  onClose,
}: TailorPanelProps) {
  const [status, setStatus] = useState<TailorStatus>("idle");
  const [tailoredText, setTailoredText] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const generate = useCallback(async () => {
    setStatus("generating");
    setError("");
    try {
      const res = await fetch("/api/tailor/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipelineId: entryId }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Generation failed");
      setTailoredText(data.tailoredText);
      setStatus("done");
    } catch (err: unknown) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Generation failed");
    }
  }, [entryId]);

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

  const download = useCallback(() => {
    if (!tailoredText) return;
    const blob = new Blob([tailoredText], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `resume-${company.toLowerCase().replace(/\s+/g, "-")}-${jobTitle.toLowerCase().replace(/\s+/g, "-")}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [tailoredText, company, jobTitle]);

  return (
    <div className="border border-zinc-700 rounded-lg bg-zinc-900 mt-2 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800">
        <div className="min-w-0">
          <div className="text-sm font-medium text-white truncate">
            Tailor for {jobTitle}
          </div>
          <div className="text-xs text-zinc-500">{company}</div>
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
          aria-label="Close tailor panel"
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

      {/* Body */}
      <div className="p-4">
        {/* Idle — show generate button */}
        {status === "idle" && (
          <div className="space-y-3">
            <p className="text-zinc-400 text-xs leading-relaxed">
              Caliber rewrites your resume to foreground experience most
              relevant to this role. Nothing is fabricated.
            </p>
            <button
              onClick={generate}
              className="w-full py-2.5 rounded-lg font-semibold text-sm transition-all"
              style={{
                background: "rgba(74,222,128,0.06)",
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
          <div className="text-center py-4 space-y-2">
            <div className="cb-spinner-sm mx-auto" />
            <p className="text-zinc-400 text-xs">
              Tailoring resume for{" "}
              <span className="text-white">{jobTitle}</span>…
            </p>
            <p className="text-zinc-600 text-[10px]">
              This usually takes 10–20 seconds
            </p>
          </div>
        )}

        {/* Error */}
        {status === "error" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-red-400 text-xs">
              <svg
                className="w-3.5 h-3.5 flex-shrink-0"
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
            <button
              onClick={generate}
              className="text-xs text-zinc-400 hover:text-white underline underline-offset-2 transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {/* Done — result */}
        {status === "done" && (
          <div className="space-y-3">
            {/* Success badge */}
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium">
              <svg
                className="w-3.5 h-3.5 flex-shrink-0"
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

            {/* Preview */}
            <div className="border border-zinc-800 rounded-lg bg-zinc-950/50 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800/60">
                <span className="text-zinc-500 text-[10px] font-medium tracking-wide uppercase">
                  Tailored Resume
                </span>
                <button
                  onClick={copyToClipboard}
                  className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
                >
                  {copied ? (
                    <>
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
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      Copied
                    </>
                  ) : (
                    <>
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
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                      Copy
                    </>
                  )}
                </button>
              </div>
              <div className="p-3 max-h-[240px] overflow-y-auto">
                <pre className="text-zinc-300 text-xs whitespace-pre-wrap font-[family-name:var(--font-geist-sans)] leading-relaxed">
                  {tailoredText}
                </pre>
              </div>
            </div>

            {/* Actions */}
            <button
              onClick={download}
              className="w-full py-2 rounded-lg font-semibold text-xs transition-all flex items-center justify-center gap-1.5"
              style={{
                background: "rgba(74,222,128,0.06)",
                color: "#4ADE80",
                border: "1px solid rgba(74,222,128,0.45)",
              }}
            >
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
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Download Tailored Resume
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        .cb-spinner-sm {
          width: 22px;
          height: 22px;
          border: 2px solid rgba(74, 222, 128, 0.15);
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
