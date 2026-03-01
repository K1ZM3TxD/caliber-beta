"use client";
// app/calibration/page.tsx

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
    let started = false;
    let interval: any;
    const timeout = setTimeout(() => {
      started = true;
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

type UiStep = "LANDING" | "RESUME" | "PROMPT" | "PROCESSING" | "TITLES" | "JOB_TEXT" | "RESULTS";
// Helper: returns true if session has results available
function hasResults(session: any): boolean {
  return Boolean(session?.result) || (String(session?.state) === "PATTERN_SYNTHESIS" && Boolean(session?.patternSummary));
}
// Returns UI step based on backend state and session
function getStepFromState(state: unknown, session?: any): UiStep {
  const s = String(state ?? "");
  if (hasResults(session)) return "RESULTS";
  if (/^PROMPT_\d(_CLARIFIER)?$/.test(s)) return "PROMPT";
  if (s === "CONSOLIDATION_PENDING" || s === "CONSOLIDATION_RITUAL" || s === "PATTERN_SYNTHESIS") return "PROCESSING";
  if (s.startsWith("TITLE_HYPOTHESIS") || s.startsWith("TITLE_DIALOGUE")) return "TITLES";
  if (s.startsWith("JOB_INGEST")) return "JOB_TEXT";
  if (s === "ALIGNMENT_OUTPUT") return "PROCESSING";
  if (s === "TERMINAL_COMPLETE") return "RESULTS";
  return "PROCESSING";
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

async function fetchResult(calibrationId: string): Promise<AnySession> {
  const res = await fetch(`/api/calibration/result?calibrationId=${encodeURIComponent(calibrationId)}`);
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) {
    const code = json?.error?.code ?? "REQUEST_FAILED";
    const message = json?.error?.message ?? `Result fetch failed (${res.status})`;
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

function displayError(e: any): string {
  if (!e) return "Unknown error";
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message || "Error";
  if (typeof e?.message === "string") return e.message;
  try { return JSON.stringify(e); } catch { return "Unknown error"; }
}

export default function CalibrationPage() {
    // For TITLES step: track which title row was copied
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
    function handleCopyTitle(idx: number, title: string) {
      navigator.clipboard.writeText(title);
      setCopiedIndex(idx);
      setTimeout(() => setCopiedIndex(null), 1500);
    }
  const [session, setSession] = useState<AnySession | null>(null);
  const [step, setStep] = useState<UiStep>("LANDING");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumeUploading, setResumeUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const promptIndex = useMemo(() => getPromptIndexFromState(session?.state), [session?.state]);
  const hasAnswer = useMemo(() => answerText.trim().length > 0, [answerText]);
  function openFilePicker() { fileInputRef.current?.click(); }
  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) { setSelectedFile(e.target.files?.[0] ?? null); }
  async function begin() {
    setError(null); setBusy(true);
    try {
      const s = await postEvent({ type: "CREATE_SESSION" });
      setSession(s); setSelectedFile(null); setAnswerText(""); setStep("RESUME");
    } catch (e: any) { setError(displayError(e)); }
    finally { setBusy(false); }
  }
  async function submitResume() {
    if (!selectedFile) return;
    const sessionId = String(session?.sessionId ?? "");
    if (!sessionId) { setError("Missing sessionId (session not created). Click Begin Calibration again."); return; }
    setError(null); setBusy(true); setResumeUploading(true);
    try {
      const s = await uploadResume(sessionId, selectedFile);
      setSession(s); setAnswerText("");
      const n = getPromptIndexFromState(s?.state);
      if (n) setStep("PROMPT");
      else setStep("PROCESSING");
    } catch (e: any) {
      setError(displayError(e));
      // Do NOT clear selectedFile; user can retry or pick another file
    } finally {
      setBusy(false); setResumeUploading(false);
    }
  }
  async function submitAnswer() {
    const sessionId = String(session?.sessionId ?? "");
    if (!sessionId) { setError("Missing sessionId (session not created)."); return; }
    if (!hasAnswer) return;
    setError(null); setBusy(true);
    try {
      const s = await postEvent({ type: "SUBMIT_PROMPT_ANSWER", sessionId, answer: answerText.trim() });
      setSession(s); setAnswerText("");
      setStep(getStepFromState(s?.state, s));
    } catch (e: any) { setError(displayError(e)); }
    finally { setBusy(false); }
  }
  async function advance(): Promise<AnySession> {
    const sessionId = String(session?.sessionId ?? "");
    if (!sessionId) {
      setError("Missing sessionId (session not created).");
      throw new Error("Missing sessionId (session not created).");
    }
    setError(null); setBusy(true);
    try {
      const s = await postEvent({ type: "ADVANCE", sessionId });
      setSession(s);
      setStep(getStepFromState(s?.state, s));
      return s;
    } catch (e: any) {
      setError(displayError(e));
      throw e;
    } finally {
      setBusy(false);
    }
  }
    // Titles UI state
    const [titleFeedback, setTitleFeedback] = useState("");
    const [jobText, setJobText] = useState("");
    const [jobBusy, setJobBusy] = useState(false);
    const [titleTypewriter, titleTypewriterDone] = useTypewriter("These titles aren’t you—they’re the market’s shorthand for the kind of work your pattern fits (use them as search terms).");
    const [jobTypewriter, jobTypewriterDone] = useTypewriter("Paste the job description.");

    // Handle TITLE_FEEDBACK event and routing
    async function submitTitleFeedback() {
      const sessionId = String(session?.sessionId ?? "");
      if (!sessionId) { setError("Missing sessionId (session not created)." ); return; }
      setError(null); setBusy(true);
      try {
        const feedback = titleFeedback.trim();
        const s = await postEvent({ type: "TITLE_FEEDBACK", sessionId, feedback });
        setSession(s);
        setStep("JOB_TEXT"); // Always route to JOB_TEXT after TITLE_FEEDBACK
      } catch (e: any) {
        setError(displayError(e));
      } finally { setBusy(false); }
    }

    async function submitJobText() {
      const sessionId = String(session?.sessionId ?? "");
      if (!sessionId) { setError("Missing sessionId (session not created)." ); return; }
      if (!jobText.trim()) return;
      setError(null); setJobBusy(true);
      try {
        let s = await postEvent({ type: "SUBMIT_JOB_TEXT", sessionId, jobText: jobText.trim() });
        setSession(s); setJobText("");
        if (String(s?.state) !== "JOB_INGEST" || s?.job?.completed === true) {
          s = await postEvent({ type: "ADVANCE", sessionId });
          setSession(s);
        }
        setStep(getStepFromState(s?.state, s));
      } catch (e: any) {
        if (e?.message?.includes("JOB_REQUIRED") || e?.code === "JOB_REQUIRED") {
          setStep("JOB_TEXT");
        } else {
          setError(displayError(e));
        }
      } finally { setJobBusy(false); }
    }
  const canContinueResume = !!selectedFile && !busy;
  const [processingAttempts, setProcessingAttempts] = useState(0);
  const inFlightRef = useRef(false);
  const computeFiredRef = useRef(false);
  // Typewriter hooks
  const [tagline] = useTypewriter("The alignment tool for job calibration.");
  const [resumeSubtext, resumeDone] = useTypewriter(step === "RESUME" ? "Your experience holds the pattern." : "");
  const [promptText, promptDone] = useTypewriter(
    step === "PROMPT" && (promptIndex === 1 || promptIndex === 2 || promptIndex === 3 || promptIndex === 4 || promptIndex === 5)
      ? CALIBRATION_PROMPTS[promptIndex as 1 | 2 | 3 | 4 | 5]
      : ""
  );

  // Centering: use min-h-screen for main flex container
  // ...existing code...

  // Auto-advance for PROCESSING (use returned session, not stale state)
  useEffect(() => {
    if (step !== "PROCESSING") {
      setProcessingAttempts(0);
      computeFiredRef.current = false; // reset for next session / re-entry
      return;
    }
    let attempts = 0;
    let stopped = false;
    const interval = setInterval(async () => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      attempts++;
      setProcessingAttempts(attempts);
      // Debug: log state during PROCESSING polling
      const sState = String(session?.state);
      console.debug("PROCESSING poll: state=", sState);
      // Unified polling: always use getStepFromState for routing
      if (hasResults(session)) {
        stopped = true;
        clearInterval(interval);
        setStep("RESULTS");
        inFlightRef.current = false;
        return;
      }
      if (sState.startsWith("ALIGNMENT_OUTPUT")) {
        // Fire compute event ONCE when entering ALIGNMENT_OUTPUT
        if (!computeFiredRef.current) {
          computeFiredRef.current = true;
          const sessionId = String(session?.sessionId ?? "");
          if (sessionId) {
            try {
              const updated = await postEvent({ type: "COMPUTE_ALIGNMENT_OUTPUT", sessionId });
              setSession(updated);
              if (hasResults(updated)) {
                stopped = true;
                clearInterval(interval);
                setStep("RESULTS");
              } else {
                // Compute returned but no results yet — let next tick re-evaluate via ADVANCE
                setStep(getStepFromState(updated?.state, updated));
              }
            } catch (err: any) {
              setError(displayError(err));
            } finally {
              inFlightRef.current = false;
            }
            return;
          }
        }
        // Compute already fired — fall through to normal ADVANCE logic below
      }
      if (sState.startsWith("TITLE_HYPOTHESIS") || sState.startsWith("TITLE_DIALOGUE")) {
        stopped = true;
        clearInterval(interval);
        setStep("TITLES");
        inFlightRef.current = false;
        return;
      }
      if (sState.startsWith("JOB_INGEST")) {
        stopped = true;
        clearInterval(interval);
        setStep("JOB_TEXT");
        inFlightRef.current = false;
        return;
      }
      if (attempts > 90) {
        stopped = true;
        clearInterval(interval);
        setError("Processing appears stuck. Please retry.");
        setStep("PROCESSING");
        inFlightRef.current = false;
        return;
      }
      try {
        const sessionId = String(session?.sessionId ?? "");
        if (!sessionId) { inFlightRef.current = false; return; }
        const s = await postEvent({ type: "ADVANCE", sessionId });
        setSession(s);
        setStep(getStepFromState(s?.state, s));
      } catch (err: any) {
        // If error is JOB_REQUIRED, route to JOB_TEXT
        if (err?.message?.includes("JOB_REQUIRED") || err?.code === "JOB_REQUIRED") {
          setStep("JOB_TEXT");
        } else {
          setError("A terminal error occurred. Please retry.");
        }
      } finally {
        inFlightRef.current = false;
      }
    }, 700);
    return () => clearInterval(interval);
  }, [step, session]);

  // Spinner CSS
  const Spinner = () => (
    <span
      style={{
        display: "inline-block",
        width: 24,
        height: 24,
        border: "3px solid #444",
        borderTop: "3px solid #F2F2F2",
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
        marginLeft: 8,
      }}
    />
  );

  return (
    <div className="fixed inset-0 bg-[#0B0B0B] flex justify-center items-start pt-[18vh] sm:pt-[22vh] overflow-hidden">
      <div className="w-full max-w-[760px] px-6">
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        <div className="relative" style={{ color: "#F2F2F2" }}>
          <div className="w-full flex flex-col items-center text-center">
            {/* Static header area */}
            <div style={{ minHeight: "5.5em", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <div className="font-semibold tracking-tight text-5xl sm:text-6xl">Caliber</div>
              {/* Fixed-height error area */}
              <div style={{ minHeight: "2.2em" }}>
                {error ? (
                  <div className="mt-2 text-sm rounded-md px-3 py-2" style={{ background: "#2A0F0F", color: "#FFD1D1" }}>
                    {error}
                  </div>
                ) : null}
              </div>
            </div>
            {/* LANDING */}
            {step === "LANDING" ? (
              <div className="w-full max-w-[620px]" style={{ minHeight: "420px" }}>
                <div style={{ minHeight: "1.5em", lineHeight: 1.4 }}>
                  <p className="text-base sm:text-lg leading-relaxed" style={{ color: "#CFCFCF" }}>{tagline}</p>
                </div>
                <div className="mt-10">
                  <button
                    type="button"
                    onClick={begin}
                    disabled={busy}
                    className="inline-flex items-center justify-center rounded-md px-5 py-3 text-sm sm:text-base font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2"
                    style={{
                      backgroundColor: busy ? "rgba(242,242,242,0.35)" : "#F2F2F2",
                      color: "#0B0B0B",
                      cursor: busy ? "not-allowed" : "pointer",
                    }}
                  >
                    {busy ? "Processing…" : "Begin Calibration"}
                    {busy ? <Spinner /> : null}
                  </button>
                </div>
              </div>
            ) : null}

            {/* RESUME */}
            {step === "RESUME" ? (
              <div className="w-full max-w-[620px]" style={{ minHeight: "420px" }}>
                <div className="text-2xl sm:text-3xl font-semibold tracking-tight">Upload Resume</div>
                <div style={{ minHeight: "1.5em", lineHeight: 1.4 }}>
                  <div className="mt-3 text-base sm:text-lg leading-relaxed" style={{ color: "#CFCFCF" }}>{resumeSubtext}</div>
                </div>
                <div className="mt-8 flex justify-center">
                  <div className="w-full" style={{ maxWidth: 420 }}>
                    <div
                      className="rounded-md transition-opacity"
                      style={{
                        border: "1px dashed rgba(242,242,242,0.28)",
                        backgroundColor: selectedFile ? "#121212" : "#0F0F0F",
                        height: 110,
                        opacity: resumeDone ? 1 : 0,
                        pointerEvents: resumeDone ? "auto" : "none",
                        transition: "opacity 0.4s",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        position: "relative"
                      }}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                        className="hidden"
                        onChange={onFileChange}
                      />
                      {!selectedFile ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span className="text-sm sm:text-base" style={{ color: "#F2F2F2" }}>Drag & drop a resume</span>
                          <span className="text-xs mx-2" style={{ color: "#CFCFCF" }}>or</span>
                          <button
                            type="button"
                            onClick={openFilePicker}
                            disabled={busy}
                            className="inline-flex items-center justify-center rounded-md px-3 py-1 text-xs font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2"
                            style={{
                              backgroundColor: "rgba(242,242,242,0.14)",
                              color: "#F2F2F2",
                              border: "1px solid rgba(242,242,242,0.18)",
                              cursor: busy ? "not-allowed" : "pointer",
                            }}
                          >
                            Choose file
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                          <span className="text-sm sm:text-base font-medium">{selectedFile.name}</span>
                          <span className="mt-2 text-xs" style={{ color: "#CFCFCF" }}>File selected</span>
                          <button
                            type="button"
                            onClick={openFilePicker}
                            disabled={busy}
                            className="inline-flex items-center justify-center rounded-md px-3 py-1 text-xs font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 mt-2"
                            style={{
                              backgroundColor: "rgba(242,242,242,0.10)",
                              color: "#F2F2F2",
                              border: "1px solid rgba(242,242,242,0.16)",
                              cursor: busy ? "not-allowed" : "pointer",
                            }}
                          >
                            Choose different file
                          </button>
                        </div>
                      )}
                      <span className="absolute bottom-2 left-2 text-[10px]" style={{ color: "#CFCFCF" }}>PDF, DOCX, or TXT</span>
                    </div>
                  </div>
                </div>
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={submitResume}
                    disabled={!canContinueResume}
                    className="inline-flex items-center justify-center rounded-md px-5 py-3 text-sm sm:text-base font-medium transition-all ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2"
                    style={{
                      transitionDuration: "200ms",
                      backgroundColor: canContinueResume ? "#F2F2F2" : "rgba(242,242,242,0.35)",
                      color: "#0B0B0B",
                      cursor: canContinueResume ? "pointer" : "not-allowed",
                      boxShadow: canContinueResume ? "0 8px 20px rgba(0,0,0,0.25)" : "none",
                      transform: canContinueResume ? "translateY(-1px)" : "translateY(0px)",
                      minWidth: 140
                    }}
                  >
                    {resumeUploading ? (<><Spinner /><span className="ml-2">Uploading…</span></>) : "Continue"}
                  </button>
                </div>
              </div>
            ) : null}

            {/* PROMPT */}
            {step === "PROMPT" ? (
              <div className="w-full max-w-2xl" style={{ minHeight: "420px" }}>
                {/* Prompt question container, smaller font, more breathing room */}
                <div style={{ minHeight: "3.2em", lineHeight: 1.35 }} className="mt-8 text-lg sm:text-xl font-medium leading-snug tracking-tight flex items-center justify-center">
                  {promptIndex == null ? (
                    <span style={{ color: "#CFCFCF", fontSize: "1.1em" }}>
                      <Spinner />
                      <span className="ml-2">Loading…</span>
                    </span>
                  ) : (
                    <span style={{ opacity: promptDone ? 1 : 1, transition: "opacity 0.3s" }}>{promptText}</span>
                  )}
                </div>
                {/* Remove "Prompt X of 5" line */}
                <div className="mt-10">
                  {promptIndex == null ? (
                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 120 }}>
                      <Spinner />
                      <span className="ml-2">Loading…</span>
                    </div>
                  ) : (
                    <textarea
                      value={answerText}
                      onChange={(e) => setAnswerText(e.target.value)}
                      rows={6}
                      className="w-full rounded-md px-4 py-3 text-sm sm:text-base focus:outline-none transition-colors duration-200"
                      style={{
                        backgroundColor: "#141414",
                        color: "#F2F2F2",
                        border: "1px solid rgba(242,242,242,0.14)",
                        boxShadow: "none",
                        opacity: 1,
                        fontSize: "1em",
                        marginTop: "0.5em"
                      }}
                      placeholder="Type your response here…"
                      disabled={busy}
                    />
                  )}
                </div>
                <div className="mt-7">
                  <button
                    type="button"
                    onClick={submitAnswer}
                    disabled={promptIndex == null || !hasAnswer || busy}
                    className="inline-flex items-center justify-center rounded-md px-5 py-3 text-sm sm:text-base font-medium transition-all ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2"
                    style={{
                      transitionDuration: "200ms",
                      backgroundColor: promptIndex == null || !hasAnswer || busy ? "rgba(242,242,242,0.70)" : "#F2F2F2",
                      color: "#0B0B0B",
                      cursor: promptIndex == null || !hasAnswer || busy ? "not-allowed" : "pointer",
                      boxShadow: promptIndex == null || !hasAnswer || busy ? "0 0 0 rgba(0,0,0,0)" : "0 8px 20px rgba(0,0,0,0.35)",
                      transform: promptIndex == null || !hasAnswer || busy ? "translateY(0px)" : "translateY(-1px)",
                    }}
                  >
                    Submit
                  </button>
                </div>
              </div>
            ) : null}

            {/* PROCESSING */}
            {step === "PROCESSING" ? (
              <div className="w-full max-w-[620px]" style={{ minHeight: "420px" }}>
                <div className="text-base sm:text-lg leading-relaxed" style={{ color: "#CFCFCF" }}>
                  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", marginBottom: 8 }}>
                    <Spinner />
                    <span className="ml-2">Processing…</span>
                  </div>
                  <div style={{ color: "#AFAFAF", fontSize: "0.95em", marginTop: 4 }}>This can take up to ~1 minute.</div>
                  {processingAttempts > 90 ? (
                    <div className="mt-7">
                      <button
                        type="button"
                        onClick={advance}
                        disabled={busy}
                        className="inline-flex items-center justify-center rounded-md px-5 py-3 text-sm sm:text-base font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2"
                        style={{ backgroundColor: busy ? "rgba(242,242,242,0.35)" : "#F2F2F2", color: "#0B0B0B", cursor: busy ? "not-allowed" : "pointer" }}
                      >
                        Retry
                        {busy ? <Spinner /> : null}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
            {/* Fallback: never blank */}
            {!["LANDING","RESUME","PROMPT","PROCESSING","TITLES","JOB_TEXT","RESULTS"].includes(step) ? (
              <div className="w-full max-w-2xl" style={{ minHeight: "420px" }}>
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", marginTop: 32 }}>
                  <Spinner />
                  <span className="ml-2">Loading…</span>
                </div>
                <div className="mt-8 flex justify-center">
                  <button
                    type="button"
                    onClick={() => { setSession(null); setSelectedFile(null); setAnswerText(""); setError(null); setStep("LANDING"); }}
                    className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2"
                    style={{ backgroundColor: "rgba(242,242,242,0.10)", color: "#F2F2F2", border: "1px solid rgba(242,242,242,0.16)" }}
                  >
                    Restart
                  </button>
                </div>
              </div>
            ) : null}

            {/* TITLES UI */}
            {step === "TITLES" ? (
              <div className="w-full max-w-2xl" style={{ minHeight: "420px" }}>
                <div style={{ minHeight: "2.2em", lineHeight: 1.3 }} className="mt-8 text-lg sm:text-xl font-medium leading-snug tracking-tight flex items-center justify-center">
                  <span>{titleTypewriter}</span>
                </div>
                <div className="mt-10">
                  {Array.isArray(session?.synthesis?.titleCandidates) && session.synthesis.titleCandidates.length > 0 ? (
                    <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
                      {session.synthesis.titleCandidates.slice(0, 5).map((c: { title: string; score: number }, i: number) => (
                        <li
                          key={i}
                          className="flex items-center justify-between rounded-md px-5 py-3 mb-2"
                          style={{
                            backgroundColor: i === 0 ? "#1A1A1A" : "#121212",
                            border: i === 0 ? "1px solid rgba(242,242,242,0.18)" : "1px solid rgba(242,242,242,0.08)",
                          }}
                        >
                          <span className="flex items-center gap-3">
                            <span className="text-sm font-medium" style={{ color: "#999", minWidth: 20 }}>{i + 1}.</span>
                            <span className={i === 0 ? "text-base sm:text-lg font-semibold" : "text-base"} style={{ color: "#F2F2F2" }}>{c.title}</span>
                          </span>
                          <span className="flex items-center gap-2">
                            <span className="text-sm font-mono font-medium" style={{ color: i === 0 ? "#4ADE80" : "#AFAFAF" }}>{c.score}</span>
                            <button
                              type="button"
                              aria-label={copiedIndex === i ? "Copied" : "Copy title"}
                              onClick={() => handleCopyTitle(i, c.title)}
                              className="ml-2 px-2 py-1 rounded text-xs font-medium transition-colors"
                              style={{
                                background: copiedIndex === i ? "#4ADE80" : "#232323",
                                color: copiedIndex === i ? "#232323" : "#AFAFAF",
                                border: "none",
                                minWidth: 60,
                                cursor: "pointer"
                              }}
                            >
                              {copiedIndex === i ? "Copied" : "Copy"}
                              {copiedIndex === i ? <span style={{ color: '#4ADE80', fontSize: 18, marginLeft: 8 }} title="Copied">✓</span> : null}
                            </button>
                          </span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <div className="text-center">
                      {session?.synthesis?.marketTitle ? (
                        <div className="text-2xl font-semibold mb-2">{session.synthesis.marketTitle}</div>
                      ) : null}
                      {session?.synthesis?.titleExplanation ? (
                        <div className="text-base text-gray-300 mb-4">{session.synthesis.titleExplanation}</div>
                      ) : null}
                    </div>
                  )}
                </div>
                <div className="mt-7 flex justify-center">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-md px-5 py-3 text-sm sm:text-base font-medium transition-all ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2"
                    style={{ backgroundColor: busy ? "rgba(242,242,242,0.70)" : "#F2F2F2", color: "#0B0B0B", cursor: busy ? "not-allowed" : "pointer", minWidth: 140 }}
                    disabled={busy}
                    onClick={async () => {
                      const sessionId = String(session?.sessionId ?? "");
                      if (!sessionId) { setError("Missing sessionId (session not created)." ); return; }
                      setError(null); setBusy(true);
                      try {
                        const updated = await postEvent({ type: "TITLE_FEEDBACK", sessionId, feedback: "" });
                        setSession(updated);
                        setStep("JOB_TEXT");
                      } catch (e: any) {
                        setError(displayError(e));
                      } finally { setBusy(false); }
                    }}
                  >
                    {busy ? (<><Spinner /><span className="ml-2">Continue</span></>) : "Continue"}
                  </button>
                </div>
              </div>
            ) : null}

            {/* JOB TEXT UI */}
            {step === "JOB_TEXT" ? (
              <div className="w-full max-w-2xl" style={{ minHeight: "420px" }}>
                {/* Back button above textarea, left-aligned */}
                <div className="mt-6 mb-2 flex justify-start">
                  <button
                    type="button"
                    onClick={() => setStep("TITLES")}
                    className="inline-flex items-center rounded px-3 py-1 text-xs font-medium bg-[#232323] text-[#AFAFAF] border border-[#333] hover:bg-[#333] focus:outline-none focus:ring-2 focus:ring-offset-2"
                    style={{ minWidth: 60 }}
                  >
                    ← Back
                  </button>
                </div>
                <div style={{ minHeight: "2.2em", lineHeight: 1.3 }} className="mt-2 text-lg sm:text-xl font-medium leading-snug tracking-tight flex items-center justify-center">
                  <span>{jobTypewriter}</span>
                </div>
                <div className="mt-10">
                  <textarea
                    value={jobText}
                    onChange={e => setJobText(e.target.value)}
                    rows={8}
                    className="w-full rounded-md px-4 py-3 text-sm sm:text-base focus:outline-none transition-colors duration-200"
                    style={{ backgroundColor: "#141414", color: "#F2F2F2", border: "1px solid rgba(242,242,242,0.14)", boxShadow: "none", fontSize: "1em" }}
                    placeholder="Paste job description here…"
                    disabled={jobBusy}
                  />
                </div>
                <div className="mt-7 flex justify-center">
                  <button
                    type="button"
                    onClick={submitJobText}
                    disabled={jobBusy || !jobText.trim()}
                    className="inline-flex items-center justify-center rounded-md px-5 py-3 text-sm sm:text-base font-medium transition-all ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2"
                    style={{ backgroundColor: jobBusy || !jobText.trim() ? "rgba(242,242,242,0.70)" : "#F2F2F2", color: "#0B0B0B", cursor: jobBusy || !jobText.trim() ? "not-allowed" : "pointer", minWidth: 140 }}
                  >
                    {jobBusy ? (<><Spinner /><span className="ml-2">Continue</span></>) : "Continue"}
                  </button>
                </div>
              </div>
            ) : null}

            {/* RESULTS UI */}
            {step === "RESULTS" ? (
              <div className="w-full max-w-2xl" style={{ minHeight: "420px" }}>
                <div className="mt-8 text-lg sm:text-xl font-medium leading-snug tracking-tight flex items-center justify-center">
                  <span>Results</span>
                </div>
                {session?.result?.alignment?.score != null && (
                  <div className="mt-8 text-2xl font-bold text-green-400">Fit Score: {session.result.alignment.score}/10</div>
                )}
                <div className="mt-8 text-base text-gray-200 whitespace-pre-line border rounded p-4 bg-[#181818]">
                  {session?.result?.alignment?.summary
                    ?? session?.result?.summary
                    ?? session?.synthesis?.identitySummary
                    ?? "Summary pending."}
                </div>
                {Array.isArray(session?.synthesis?.operateBest) && session.synthesis.operateBest.length > 0 && (
                  <div className="mt-8">
                    <div className="font-semibold mb-2">Operate best when…</div>
                    <ul className="list-disc ml-6">
                      {session.synthesis.operateBest.map((b: string, i: number) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {Array.isArray(session?.synthesis?.loseEnergy) && session.synthesis.loseEnergy.length > 0 && (
                  <div className="mt-6">
                    <div className="font-semibold mb-2">Lose energy when…</div>
                    <ul className="list-disc ml-6">
                      {session.synthesis.loseEnergy.map((b: string, i: number) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="mt-10 flex justify-center">
                  <button
                    type="button"
                    onClick={() => { setSession(null); setSelectedFile(null); setAnswerText(""); setError(null); setStep("LANDING"); }}
                    className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2"
                    style={{ backgroundColor: "rgba(242,242,242,0.10)", color: "#F2F2F2", border: "1px solid rgba(242,242,242,0.16)" }}
                  >
                    Restart
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}