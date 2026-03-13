"use client";

import React, { useState, useCallback, useRef } from "react";
import CaliberHeader from "../../components/caliber_header";
import IngestLayout from "../../components/IngestLayout";

/* ─── Flow steps ─── */
type Step = "INTRO" | "PROMPT_1" | "PROMPT_2" | "PROMPT_3" | "GENERATING" | "RESULT";

/* ─── Prompt config ─── */
const PROMPTS: Record<
  "PROMPT_1" | "PROMPT_2" | "PROMPT_3",
  { heading: string; supporting: string; examples: string[]; placeholder: string; multiline: boolean }
> = {
  PROMPT_1: {
    heading: "Tell us what you\u2019ve done.",
    supporting: "List roles, projects, or work you\u2019ve done and what you were responsible for.",
    examples: [
      "Product manager at a fintech startup",
      "Built internal analytics dashboards",
      "Led customer onboarding redesign",
      "Managed partnerships with major vendors",
    ],
    placeholder: "Describe your experience\u2026",
    multiline: true,
  },
  PROMPT_2: {
    heading: "What kinds of work do you do unusually well?",
    supporting: "Think about the things people rely on you for.",
    examples: [
      "Translating technical work into clear plans",
      "Fixing broken processes",
      "Building systems from scratch",
      "Managing complex stakeholders",
    ],
    placeholder: "What are you known for\u2026",
    multiline: true,
  },
  PROMPT_3: {
    heading: "What kind of role are you targeting next?",
    supporting: "",
    examples: [
      "Product Operations",
      "Technical Program Manager",
      "Security Analyst",
      "Growth Marketing",
    ],
    placeholder: "Target role\u2026",
    multiline: false,
  },
};

/* ─── Reusable button style ─── */
const greenBtnStyle: React.CSSProperties = {
  backgroundColor: "rgba(74,222,128,0.06)",
  color: "#4ADE80",
  border: "1px solid rgba(74,222,128,0.45)",
};
const greenBtnClass =
  "inline-flex items-center justify-center rounded-md px-6 py-3 text-sm font-semibold transition-all hover:brightness-125 disabled:opacity-40 disabled:cursor-not-allowed";

const mutedBtnStyle: React.CSSProperties = {
  backgroundColor: "rgba(255,255,255,0.03)",
  color: "#a3a3a3",
  border: "1px solid rgba(255,255,255,0.08)",
};

export default function BuildResumePage() {
  const [step, setStep] = useState<Step>("INTRO");
  const [experience, setExperience] = useState("");
  const [strengths, setStrengths] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [editableText, setEditableText] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const editRef = useRef<HTMLTextAreaElement>(null);

  /* ─── Navigation ─── */
  const advance = useCallback(() => {
    setStep((s) => {
      if (s === "INTRO") return "PROMPT_1";
      if (s === "PROMPT_1") return "PROMPT_2";
      if (s === "PROMPT_2") return "PROMPT_3";
      return s;
    });
  }, []);

  const currentAnswer = step === "PROMPT_1" ? experience : step === "PROMPT_2" ? strengths : targetRole;
  const setCurrentAnswer =
    step === "PROMPT_1" ? setExperience : step === "PROMPT_2" ? setStrengths : setTargetRole;

  /* ─── Generate ─── */
  const generate = useCallback(async () => {
    setStep("GENERATING");
    setError("");
    try {
      const res = await fetch("/api/resume-skeleton", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          experience: experience.trim(),
          strengths: strengths.trim(),
          targetRole: targetRole.trim(),
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Generation failed");
      setResumeText(data.resume);
      setEditableText(data.resume);
      setStep("RESULT");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Generation failed");
      setStep("PROMPT_3"); // go back to last prompt so user can retry
    }
  }, [experience, strengths, targetRole]);

  /* ─── Download ─── */
  const download = useCallback(() => {
    const text = editableText || resumeText;
    if (!text) return;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "base-resume.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [editableText, resumeText]);

  /* ─── Copy ─── */
  const copyToClipboard = useCallback(async () => {
    const text = editableText || resumeText;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard may not be available */ }
  }, [editableText, resumeText]);

  /* ─── Render ─── */
  return (
    <IngestLayout maxWidth="600px" centered>
      <CaliberHeader className="mb-8" />

      {/* ── INTRO ── */}
      {step === "INTRO" && (
        <div className="text-center flex flex-col items-center cb-reveal">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-neutral-200 mb-3">
            Build your base resume
          </h1>
          <p className="text-sm text-neutral-400 leading-relaxed max-w-md mx-auto mb-8">
            Answer three quick prompts and Caliber will create a resume we can
            tailor automatically when strong matches appear.
          </p>
          <button className={greenBtnClass} style={greenBtnStyle} onClick={advance}>
            Start
          </button>
        </div>
      )}

      {/* ── PROMPTS 1-3 ── */}
      {(step === "PROMPT_1" || step === "PROMPT_2" || step === "PROMPT_3") && (
        <div className="flex flex-col items-center cb-reveal" key={step}>
          {/* Progress dots */}
          <div className="flex gap-2 mb-6">
            {(["PROMPT_1", "PROMPT_2", "PROMPT_3"] as const).map((p, i) => (
              <div
                key={p}
                className="w-2 h-2 rounded-full transition-colors"
                style={{
                  backgroundColor:
                    step === p
                      ? "rgba(74,222,128,0.7)"
                      : i < (step === "PROMPT_1" ? 0 : step === "PROMPT_2" ? 1 : 2)
                        ? "rgba(74,222,128,0.35)"
                        : "rgba(255,255,255,0.12)",
                }}
              />
            ))}
          </div>

          <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-neutral-200 text-center mb-2">
            {PROMPTS[step].heading}
          </h2>
          {PROMPTS[step].supporting && (
            <p className="text-sm text-neutral-400 text-center mb-4 max-w-md">
              {PROMPTS[step].supporting}
            </p>
          )}

          {/* Input */}
          {PROMPTS[step].multiline ? (
            <textarea
              className="w-full rounded-md px-4 py-3 text-sm text-neutral-200 leading-relaxed resize-none focus:outline-none focus:ring-1 transition-all"
              style={{
                backgroundColor: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                minHeight: "140px",
              }}
              placeholder={PROMPTS[step].placeholder}
              value={currentAnswer}
              onChange={(e) => setCurrentAnswer(e.target.value)}
              onFocus={(e) => { e.target.style.borderColor = "rgba(74,222,128,0.4)"; }}
              onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; }}
              autoFocus
            />
          ) : (
            <input
              type="text"
              className="w-full rounded-md px-4 py-3 text-sm text-neutral-200 focus:outline-none focus:ring-1 transition-all"
              style={{
                backgroundColor: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
              placeholder={PROMPTS[step].placeholder}
              value={currentAnswer}
              onChange={(e) => setCurrentAnswer(e.target.value)}
              onFocus={(e) => { e.target.style.borderColor = "rgba(74,222,128,0.4)"; }}
              onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && currentAnswer.trim()) {
                  e.preventDefault();
                  if (step === "PROMPT_3") generate();
                  else advance();
                }
              }}
              autoFocus
            />
          )}

          {/* Example answers */}
          <div className="w-full mt-3 mb-6">
            <span className="text-xs text-neutral-500 block mb-1.5">Examples:</span>
            <div className="flex flex-wrap gap-1.5">
              {PROMPTS[step].examples.map((ex) => (
                <span
                  key={ex}
                  className="text-xs px-2.5 py-1 rounded-full cursor-pointer transition-colors hover:bg-white/[0.06]"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    color: "#a3a3a3",
                  }}
                  onClick={() => {
                    const current = currentAnswer.trim();
                    setCurrentAnswer(current ? current + "\n" + ex : ex);
                  }}
                >
                  {ex}
                </span>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-red-400 text-sm mb-4">{error}</p>
          )}

          {/* Navigation */}
          <div className="flex gap-3 w-full justify-center">
            {step !== "PROMPT_1" && (
              <button
                className="inline-flex items-center justify-center rounded-md px-5 py-2.5 text-sm transition-all hover:brightness-125"
                style={mutedBtnStyle}
                onClick={() =>
                  setStep(step === "PROMPT_2" ? "PROMPT_1" : step === "PROMPT_3" ? "PROMPT_2" : step)
                }
              >
                Back
              </button>
            )}
            {step === "PROMPT_3" ? (
              <button
                className={greenBtnClass}
                style={greenBtnStyle}
                disabled={!currentAnswer.trim()}
                onClick={generate}
              >
                Generate Resume
              </button>
            ) : (
              <button
                className={greenBtnClass}
                style={greenBtnStyle}
                disabled={!currentAnswer.trim()}
                onClick={advance}
              >
                Continue
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── GENERATING ── */}
      {step === "GENERATING" && (
        <div className="text-center flex flex-col items-center pt-6 cb-reveal">
          <div
            className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin mb-4"
            style={{ borderColor: "rgba(74,222,128,0.4)", borderTopColor: "transparent" }}
          />
          <p className="text-sm text-neutral-400">Building your base resume&hellip;</p>
        </div>
      )}

      {/* ── RESULT ── */}
      {step === "RESULT" && (
        <div className="flex flex-col items-center cb-reveal">
          <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-neutral-200 text-center mb-1">
            Your base resume
          </h2>
          <p className="text-xs text-neutral-500 text-center mb-6">
            Review, edit, then download. This base can be tailored automatically for strong-match jobs.
          </p>

          {/* Editable resume output */}
          <textarea
            ref={editRef}
            className="w-full rounded-md px-4 py-4 text-sm text-neutral-300 leading-relaxed resize-vertical focus:outline-none focus:ring-1 transition-all font-mono"
            style={{
              backgroundColor: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              minHeight: "400px",
            }}
            value={editableText}
            onChange={(e) => setEditableText(e.target.value)}
            onFocus={(e) => { e.target.style.borderColor = "rgba(74,222,128,0.3)"; }}
            onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; }}
          />

          {/* Actions */}
          <div className="flex flex-wrap gap-3 mt-6 justify-center">
            <button className={greenBtnClass} style={greenBtnStyle} onClick={download}>
              Download (.txt)
            </button>
            <button
              className="inline-flex items-center justify-center rounded-md px-5 py-2.5 text-sm font-semibold transition-all hover:brightness-125"
              style={mutedBtnStyle}
              onClick={copyToClipboard}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>

          {/* Tailoring message */}
          <p className="text-xs text-neutral-500 text-center mt-8 max-w-sm leading-relaxed">
            This base resume can be tailored automatically when strong matches appear through Caliber.
          </p>

          {/* Start over */}
          <button
            className="text-xs text-neutral-500 hover:text-neutral-300 underline underline-offset-2 mt-4 transition-colors"
            onClick={() => {
              setStep("INTRO");
              setExperience("");
              setStrengths("");
              setTargetRole("");
              setResumeText("");
              setEditableText("");
              setError("");
            }}
          >
            Start over
          </button>
        </div>
      )}
    </IngestLayout>
  );
}
