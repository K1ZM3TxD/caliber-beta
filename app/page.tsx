"use client";

import React, { useMemo, useState } from "react";
import PatternSynthesis from "./components/PatternSynthesis";

type PatternSynthesisOutput = {
  structural_summary: string;
  operate_best: string[];
  lose_energy: string[];
};

type UiError = {
  name: string;
  code: string;
  detail: string;
};

export default function IntakePage() {
  const [resumeText, setResumeText] = useState("");
  const [promptAnswers, setPromptAnswers] = useState<string[]>(["", "", "", "", ""]);
  const [jobDescription, setJobDescription] = useState(""); // ignored by request

  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<PatternSynthesisOutput | null>(null);
  const [error, setError] = useState<UiError | null>(null);

  const canSubmit = useMemo(() => !isLoading, [isLoading]);

  async function onCalibrate() {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/pattern-synthesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Job Description intentionally ignored
        body: JSON.stringify({ resumeText, promptAnswers }),
      });

      const data = await res.json();

      if (!res.ok) {
        const e = data?.error;
        if (e && typeof e.name === "string" && typeof e.code === "string" && typeof e.detail === "string") {
          setError({ name: e.name, code: e.code, detail: e.detail });
        } else {
          setError({ name: "Error", code: "REQUEST_FAILED", detail: "Request failed" });
        }
        return;
      }

      setResult(data as PatternSynthesisOutput);
    } catch (_err) {
      setError({ name: "Error", code: "NETWORK_ERROR", detail: "Network error calling pattern synthesis" });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <h1 className="text-3xl font-semibold">Caliber — Intake</h1>

        <div className="space-y-4">
          <label className="block">
            <span className="mb-2 block font-medium">Resume</span>
            <textarea
              className="min-h-[150px] w-full border p-3"
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
            />
          </label>

          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="block">
              <span className="mb-2 block font-medium">Prompt Answer {n}</span>
              <textarea
                className="min-h-[100px] w-full border p-3"
                value={promptAnswers[n - 1] ?? ""}
                onChange={(e) => {
                  const next = [...promptAnswers];
                  next[n - 1] = e.target.value;
                  setPromptAnswers(next);
                }}
              />
            </label>
          ))}

          <label className="block">
            <span className="mb-2 block font-medium">Job Description</span>
            <textarea
              className="min-h-[150px] w-full border p-3"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
            />
          </label>

          <div className="flex items-center gap-3">
            <button
              className="bg-black px-6 py-3 text-white disabled:opacity-50"
              type="button"
              onClick={onCalibrate}
              disabled={!canSubmit}
            >
              {isLoading ? "Calibrating…" : "Calibrate"}
            </button>

            {isLoading ? <span className="text-sm text-gray-600">Loading Pattern Synthesis…</span> : null}
          </div>
        </div>

        {error ? (
          <div className="border border-red-300 bg-red-50 p-4">
            <div className="font-semibold">Error</div>
            <div className="mt-2 space-y-1 text-sm">
              <div>
                <span className="font-medium">name:</span> {error.name}
              </div>
              <div>
                <span className="font-medium">code:</span> {error.code}
              </div>
              <div>
                <span className="font-medium">detail:</span> {error.detail}
              </div>
            </div>
          </div>
        ) : null}

        {result ? (
          <div className="border p-6">
            <PatternSynthesis
              structural_summary={result.structural_summary}
              operate_best={result.operate_best}
              lose_energy={result.lose_energy}
            />
          </div>
        ) : null}
      </div>
    </main>
  );
}