// app/calibration/page.tsx
"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";
import { CALIBRATION_PROMPTS } from "@/lib/calibration_prompts";

const TYPE_MS = 55;
const START_DELAY_MS = 200;
function useTypewriter(text: string, msPerChar: number = TYPE_MS): [string, boolean] {
  const [typed, setTyped] = useState("");
  useEffect(() => {
    let i = 0;
    setTyped("");
    if (!text) return;
    let interval: any;
    const timeout = setTimeout(() => {
      interval = setInterval(() => {
        setTyped(text.slice(0, ++i));
        if (i >= text.length) clearInterval(interval);
      }, msPerChar);
    }, START_DELAY_MS);
    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, [text, msPerChar]);
  return [typed, typed === text];
}

type AnySession = any;

type UiStep = "LANDING" | "RESUME" | "PROMPT" | "TITLE_AND_JOB" | "PROCESSING" | "RESULTS";
// Step router for session.state
function getStepFromState(state: unknown, session?: AnySession): UiStep {
  const s = String(state ?? "");
  if (/^PROMPT_\d/.test(s)) return "PROMPT";
  if (s.startsWith("TITLE_") || s === "JOB_INGEST") return "TITLE_AND_JOB";
  if (s === "PATTERN_SYNTHESIS" && session?.patternSummary) return "RESULTS";
  return "PROCESSING";
}
// TITLES step: derive title and explanation
function getTitleFromSession(session: AnySession): string {
  return session?.marketTitle ?? "(title pending)";
}
  // TITLES step: feedback handler (must be inside component for state access)
  async function submitTitleFeedback(feedback: string) {
    const sessionId = String(session?.sessionId ?? "");
    if (!sessionId) {
      setError("Missing sessionId (session not created).");
      return;
    }
    setTitleBusy(true);
    setError(null);
    try {
      // Use the contract event type for title feedback
      const s = await postEvent({
        type: "TITLE_FEEDBACK",
        sessionId,
        payload: feedback,
      });
      setSession(s);
      setTitleFeedback("");
      setStep(getStepFromState(s?.state, s));
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setTitleBusy(false);
    }
  }

function getPromptIndexFromState(state: unknown): number | null {
  const s = String(state ?? "");
  const m = /^PROMPT_(\d)(?:_CLARIFIER)?$/.exec(s);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

async function postEvent(event: any): Promise<AnySession> {
  const res = await fetch("/api/calibration", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event }),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) {
    const code = json?.error?.code ?? "REQUEST_FAILED";
    const message = json?.error?.message ?? `Request failed (${res.status})`;
    throw new Error(`${code}: ${message}`);
  }

  return json.session;
}

async function uploadResume(sessionId: string, file: File): Promise<AnySession> {
  const form = new FormData();
  form.append("sessionId", sessionId);
  form.append("file", file);

  const res = await fetch("/api/calibration/resume-upload", { method: "POST", body: form });
  const json = await res.json().catch(() => null);

  if (!res.ok || !json?.ok) {
    const code = json?.error?.code ?? "REQUEST_FAILED";
    const message = json?.error?.message ?? `Upload failed (${res.status})`;
    throw new Error(`${code}: ${message}`);
  }

  return json.session;
}

export default function CalibrationPage() {
  const [session, setSession] = useState<AnySession | null>(null);
  const [step, setStep] = useState<UiStep>("LANDING");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const promptIndex = useMemo(() => getPromptIndexFromState(session?.state), [session?.state]);
  const hasAnswer = useMemo(() => answerText.trim().length > 0, [answerText]);
  const title = getTitleFromSession(session);

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
  }

  async function begin() {
    setError(null);
    setBusy(true);
    try {
      const s = await postEvent({ type: "CREATE_SESSION" });
      setSession(s);
      setSelectedFile(null);
      setAnswerText("");
      setStep("RESUME");
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function submitResume() {
    if (!selectedFile) return;
    const sessionId = String(session?.sessionId ?? "");
    if (!sessionId) {
      setError("Missing sessionId (session not created). Click Begin Calibration again.");
      return;
    }

    setError(null);
    setBusy(true);
    try {
      const s = await uploadResume(sessionId, selectedFile);
      setSession(s);
      setAnswerText("");
      // After resume-upload route, server deterministically advances away from RESUME_INGEST.
      // We’ll route UI based on the returned state.
      const n = getPromptIndexFromState(s?.state);
      if (n !== null) setStep("PROMPT");
      else setStep("PROCESSING");
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function submitAnswer() {
    const sessionId = String(session?.sessionId ?? "");
    if (!sessionId) {
      setError("Missing sessionId (session not created).");
      return;
    }
    if (!hasAnswer) return;

    setError(null);
    setBusy(true);
    try {
      const s = await postEvent({
        type: "SUBMIT_PROMPT_ANSWER",
        sessionId,
        answer: answerText.trim(),
      });
      setSession(s);
      setAnswerText("");

      const n = getPromptIndexFromState(s?.state);
      if (n !== null) {
        setStep("PROMPT");
      } else if (String(s?.state) === "PATTERN_SYNTHESIS" && s?.synthesis?.patternSummary) {
        setStep("RESULTS");
      } else {
        setStep("PROCESSING");
      }
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function advance() {
    const sessionId = String(session?.sessionId ?? "");
    if (!sessionId) {
      setError("Missing sessionId (session not created).");
      return;
    }

    setError(null);
    setBusy(true);
    try {
      const s = await postEvent({ type: "ADVANCE", sessionId });
      setSession(s);

      // Route based on returned state
      const n = getPromptIndexFromState(s?.state);
      if (n !== null) {
        setStep("PROMPT");
      } else if (String(s?.state) === "PATTERN_SYNTHESIS" && s?.synthesis?.patternSummary) {
        setStep("RESULTS");
      } else if (String(s?.state) === "JOB_INGEST") {
        setError(null);
        setStep("JOB_TEXT");
      } else if (String(s?.state).startsWith("TITLE_")) {
        setStep("TITLES");
      } else {
        setStep("PROCESSING");
      }
    } catch (e: any) {
      // JOB_REQUIRED: route to JOB_TEXT, clear error
      const errMsg = String(e?.message ?? "");
      const errCode = e?.error?.code ?? "";
      if (errMsg.includes("JOB_REQUIRED") || errCode === "JOB_REQUIRED") {
        setError(null);
        setStep("JOB_TEXT");
        // Do not set error
      } else {
        setError(errMsg);
      }
    } finally {
      setBusy(false);
    }
  }

  const canContinueResume = !!selectedFile && !busy;

  // Typewriter hooks
  const [tagline] = useTypewriter("The alignment tool for job calibration.");
  const [resumeSubtext, resumeDone] = useTypewriter(step === "RESUME" ? "Your experience holds the pattern." : "");
  const [promptText] = useTypewriter(step === "PROMPT" && promptIndex !== null ? (CALIBRATION_PROMPTS[promptIndex] ?? "") : "");

  // Auto-advance for PROCESSING
  useEffect(() => {
    // Prevent polling if session.state is JOB_INGEST (job required)
    if (step !== "PROCESSING" || String(session?.state) === "JOB_INGEST") {
      setProcessingAttempts(0);
      return;
    }
    let attempts = 0;
    const interval = setInterval(async () => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      attempts++;
      setProcessingAttempts(attempts);
      if (attempts > 90) {
        inFlightRef.current = false;
        return;
      }
      try {
        const sessionId = String(session?.sessionId ?? "");
        if (!sessionId) {
          inFlightRef.current = false;
          return;
        }
        const s = await postEvent({ type: "ADVANCE", sessionId });
        setSession(s);
        // Route to next step if interactive
        const n = getPromptIndexFromState(s?.state);
        if (n !== null) {
          setStep("PROMPT");
        } else if (String(s?.state).startsWith("TITLE_")) {
          setStep("TITLES");
        } else if (String(s?.state) === "JOB_INGEST") {
          setError(null);
          setStep("JOB_TEXT");
          clearInterval(interval);
          return;
        } else if (String(s?.state) === "PATTERN_SYNTHESIS" && session?.synthesis?.patternSummary) {
          setStep("RESULTS");
        } else {
          setStep("PROCESSING");
        }
      } catch (err: any) {
        // JOB_REQUIRED: route to JOB_TEXT, stop polling
        const errMsg = String(err?.message ?? "");
        const errCode = err?.error?.code ?? "";
        if (errMsg.includes("JOB_REQUIRED") || errCode === "JOB_REQUIRED") {
          setError(null);
          setStep("JOB_TEXT");
          clearInterval(interval);
          // Do not set error
          return;
        } else {
          setError("A terminal error occurred. Please retry.");
        }
      } finally {
        inFlightRef.current = false;
      }
    }, 700);
    return () => clearInterval(interval);
  }, [step, session?.sessionId]);

  const [jobText, setJobText] = useState("");
  const [titleFeedback, setTitleFeedback] = useState("");
  const [titleBusy, setTitleBusy] = useState(false);
  const [jobBusy, setJobBusy] = useState(false);
  const [processingAttempts, setProcessingAttempts] = useState(0);
  const inFlightRef = useRef(false);

  // Handler for combined TITLE_AND_JOB screen CTA
  async function handleScoreJob() {
    if (busy || !jobText.trim()) return;
    setBusy(true);
    setError(null);
    try {
      let s = session;
      // If feedback is non-empty, send TITLE_FEEDBACK first
      if (titleFeedback.trim()) {
        s = await postEvent({
          type: "TITLE_FEEDBACK",
          sessionId: String(session?.sessionId ?? ""),
          payload: titleFeedback.trim(),
        });
        setSession(s);
        setTitleFeedback("");
      }
      // Then send JOB_PARSED event
      s = await postEvent({
        type: "JOB_PARSED",
        sessionId: String(s?.sessionId ?? ""),
        payload: jobText.trim(),
      });
      setSession(s);
      setJobText("");
      setStep(getStepFromState(s?.state, s));
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  const ritualProgress = session?.consolidationRitual?.progressPct;
  const ritualMessage = session?.consolidationRitual?.message ?? session?.encodingRitual?.message ?? "";
  const encodingCompleted = Boolean(session?.encodingRitual?.completed);

  return (
    <div className="fixed inset-0 bg-[#0B0B0B] flex justify-center items-center overflow-auto">
      <div
        className="w-full max-w-[760px] px-6 flex flex-col"
        style={{ minHeight: 520, height: "auto" }}
      >
        {/* Row A: Header */}
        <div style={{ height: 88, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div className="font-semibold tracking-tight text-5xl sm:text-6xl">Caliber</div>
          <div style={{ minHeight: "2.2em" }}>
            {/* Only show error banner if error is non-null and not JOB_REQUIRED */}
            {error && !(step === "JOB_TEXT" && (!error || error.includes("JOB_REQUIRED"))) ? (
              <div className="mt-2 text-sm rounded-md px-3 py-2" style={{ background: "#2A0F0F", color: "#FFD1D1" }}>
                {error}
              </div>
            ) : null}
          </div>
        </div>
        {/* Row B: Prompt/step text */}
        <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {step === "LANDING" && <p className="text-base sm:text-lg leading-relaxed" style={{ color: "#CFCFCF" }}>{tagline}</p>}
          {step === "RESUME" && <div className="text-base sm:text-lg leading-relaxed" style={{ color: "#CFCFCF" }}>{resumeSubtext}</div>}
          {step === "PROMPT" && <div className="mt-3 text-2xl sm:text-3xl font-semibold leading-snug tracking-tight">{promptIndex !== null ? promptText : "Loading prompt…"}</div>}
          {step === "TITLE_AND_JOB" && (
            <div className="w-full max-w-[560px] mx-auto flex flex-col items-center justify-center">
              <div className="mb-2 text-lg font-semibold" style={{ color: "#F2F2F2" }}>Title suggestion</div>
              <div className="mb-4 text-xl font-bold" style={{ color: "#CFCFCF" }}>{getTitleFromSession(session)}</div>
              {session?.titleExplanation && (
                <div className="mb-2 text-sm" style={{ color: "#AFAFAF" }}>{session.titleExplanation}</div>
              )}
              <input
                type="text"
                value={titleFeedback}
                onChange={(e) => setTitleFeedback(e.target.value)}
                className="w-full rounded-md px-4 py-3 text-sm sm:text-base focus:outline-none transition-colors duration-200"
                style={{ backgroundColor: "#141414", color: "#F2F2F2", border: "1px solid rgba(242,242,242,0.14)", boxShadow: "none", marginBottom: 18 }}
                placeholder="Optional: tweak the title…"
                disabled={titleBusy}
              />
              <div className="mb-2 text-lg font-semibold" style={{ color: "#F2F2F2" }}>Job description</div>
              <textarea
                value={jobText}
                onChange={(e) => setJobText(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                    e.preventDefault();
                    if (!busy && jobText.trim()) handleScoreJob();
                  }
                }}
                rows={8}
                className="w-full rounded-md px-4 py-3 text-sm sm:text-base focus:outline-none transition-colors duration-200"
                style={{ backgroundColor: "#141414", color: "#F2F2F2", border: "1px solid rgba(242,242,242,0.14)", boxShadow: "none", fontSize: "1em" }}
                placeholder="Paste job description here…"
                disabled={busy}
              />
            </div>
          )}
          {step === "PROCESSING" && (
            <div className="text-base sm:text-lg leading-relaxed" style={{ color: "#CFCFCF" }}>
              {typeof ritualProgress === "number" ? (
                <>
                  <div style={{ fontWeight: 500, fontSize: "1.1em" }}>
                    Ritual progress: {Math.round(ritualProgress)}%
                  </div>
                  <div style={{ marginTop: 6 }}>{ritualMessage}</div>
                </>
              ) : encodingCompleted ? (
                <div style={{ fontWeight: 500, fontSize: "1.1em" }}>Encoding complete</div>
              ) : (
                <div style={{ fontWeight: 500, fontSize: "1.1em" }}>Processing…</div>
              )}
            </div>
          )}
        </div>
        {/* Row C: Input + buttons */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}>
          <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {step === "LANDING" && (
              <></>
            )}
            {step === "RESUME" && (
              <div className="w-full max-w-[560px]">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                  className="hidden"
                  onChange={onFileChange}
                />
                <div className="rounded-md" style={{ border: "1px dashed rgba(242,242,242,0.28)", backgroundColor: selectedFile ? "#121212" : "#0F0F0F", minHeight: 110 }}>
                  <div className="h-full w-full flex flex-col items-center justify-center px-6 text-center">
                    {!selectedFile ? (
                      <>
                        <div className="text-sm sm:text-base" style={{ color: "#F2F2F2" }}>Drag & drop your resume here</div>
                        <div className="mt-2 text-sm" style={{ color: "#CFCFCF" }}>or</div>
                        <div className="mt-3">
                          <button type="button" onClick={openFilePicker} disabled={busy} className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2" style={{ backgroundColor: "rgba(242,242,242,0.14)", color: "#F2F2F2", border: "1px solid rgba(242,242,242,0.18)", cursor: busy ? "not-allowed" : "pointer" }}>Choose file</button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-sm sm:text-base font-medium">{selectedFile.name}</div>
                        <div className="mt-2 text-sm" style={{ color: "#CFCFCF" }}>File selected</div>
                        <div className="mt-3">
                          <button type="button" onClick={openFilePicker} disabled={busy} className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2" style={{ backgroundColor: "rgba(242,242,242,0.10)", color: "#F2F2F2", border: "1px solid rgba(242,242,242,0.16)", cursor: busy ? "not-allowed" : "pointer" }}>Choose different file</button>
                        </div>
                        {/* Continue button removed from inside upload box */}
                      </>
                    )}
                  </div>
                </div>
                <div className="mt-2 text-xs" style={{ color: "#CFCFCF" }}>PDF, DOCX, or TXT</div>
              </div>
            )}
            {step === "PROMPT" && (
              <textarea
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (!busy && hasAnswer) submitAnswer();
                  }
                }}
                rows={7}
                className="w-full rounded-md px-4 py-3 text-sm sm:text-base focus:outline-none transition-colors duration-200"
                style={{ backgroundColor: "#141414", color: "#F2F2F2", border: "1px solid rgba(242,242,242,0.14)", boxShadow: "none" }}
                placeholder="Type your response here…"
              />
            )}
            {step === "TITLE_AND_JOB" && (
              <button
                type="button"
                onClick={handleScoreJob}
                disabled={busy || !jobText.trim()}
                className="inline-flex items-center justify-center rounded-md px-5 py-3 text-sm sm:text-base font-medium transition-all ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2"
                style={{ backgroundColor: busy || !jobText.trim() ? "rgba(242,242,242,0.70)" : "#F2F2F2", color: "#0B0B0B", cursor: busy || !jobText.trim() ? "not-allowed" : "pointer", minWidth: 140 }}
              >
                Score this job
              </button>
            )}
            {step === "JOB_TEXT" && (
              <textarea value={jobText} onChange={(e) => setJobText(e.target.value)} rows={8} className="w-full rounded-md px-4 py-3 text-sm sm:text-base focus:outline-none transition-colors duration-200" style={{ backgroundColor: "#141414", color: "#F2F2F2", border: "1px solid rgba(242,242,242,0.14)", boxShadow: "none", fontSize: "1em" }} placeholder="Paste job description here…" disabled={jobBusy} />
            )}
          </div>
          <div className="sticky bottom-0 z-10" style={{ height: 64, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(11,11,11,0.97)", backdropFilter: "blur(2px)" }}>
            {step === "LANDING" && (
              <button type="button" onClick={begin} disabled={busy} className="inline-flex items-center justify-center rounded-md px-5 py-3 text-sm sm:text-base font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2" style={{ backgroundColor: busy ? "rgba(242,242,242,0.35)" : "#F2F2F2", color: "#0B0B0B", cursor: busy ? "not-allowed" : "pointer" }}>Begin Calibration</button>
            )}
            {step === "RESUME" && (
              <button type="button" onClick={submitResume} disabled={!canContinueResume} className="inline-flex items-center justify-center rounded-md px-5 py-3 text-sm sm:text-base font-medium transition-all ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2" style={{ transitionDuration: "200ms", backgroundColor: canContinueResume ? "#F2F2F2" : "rgba(242,242,242,0.35)", color: "#0B0B0B", cursor: canContinueResume ? "pointer" : "not-allowed", boxShadow: canContinueResume ? "0 8px 20px rgba(0,0,0,0.25)" : "none", transform: canContinueResume ? "translateY(-1px)" : "translateY(0px)", minWidth: 140 }}>Continue</button>
            )}
            {step === "PROMPT" && (
              <button type="button" onClick={submitAnswer} disabled={busy || !hasAnswer} className="inline-flex items-center justify-center rounded-md px-5 py-3 text-sm sm:text-base font-medium transition-all ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2" style={{ backgroundColor: busy || !hasAnswer ? "rgba(242,242,242,0.70)" : "#F2F2F2", color: "#0B0B0B", cursor: busy || !hasAnswer ? "not-allowed" : "pointer", minWidth: 140 }}>Continue</button>
            )}
            {step === "TITLE_AND_JOB" && (
              <button
                type="button"
                onClick={handleScoreJob}
                disabled={busy || !jobText.trim()}
                className="inline-flex items-center justify-center rounded-md px-5 py-3 text-sm sm:text-base font-medium transition-all ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2"
                style={{ backgroundColor: busy || !jobText.trim() ? "rgba(242,242,242,0.70)" : "#F2F2F2", color: "#0B0B0B", cursor: busy || !jobText.trim() ? "not-allowed" : "pointer", minWidth: 140 }}
              >
                Score this job
              </button>
            )}
            {step === "RESULTS" && (
              <div className="w-full max-w-[560px] mx-auto flex flex-col items-center justify-center">
                <button type="button" disabled className="inline-flex items-center justify-center rounded-md px-5 py-3 text-base font-medium bg-gray-400 text-gray-700 cursor-not-allowed" style={{ minWidth: 180, marginTop: 16 }}>
                  Open dialogue (next step)
                </button>
                <div className="mt-2 text-xs text-gray-400">Coming next: LLM dialogue</div>
              </div>
            )}
            {step === "PROCESSING" && processingAttempts > 90 && (
              <button type="button" onClick={advance} disabled={busy} className="inline-flex items-center justify-center rounded-md px-5 py-3 text-sm sm:text-base font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2" style={{ backgroundColor: busy ? "rgba(242,242,242,0.35)" : "#F2F2F2", color: "#0B0B0B", cursor: busy ? "not-allowed" : "pointer" }}>Retry</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}