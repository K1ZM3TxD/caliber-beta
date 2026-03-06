"use client";
// app/calibration/page.tsx

import React, { useMemo, useRef, useState, useEffect } from "react";
import { CALIBRATION_PROMPTS } from "@/lib/calibration_prompts";
import { CHROME_STORE_URL, EXTENSION_LANDING_PATH } from "@/lib/extension_config";

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

type UiStep = "LANDING" | "RESUME" | "PROMPT" | "PROCESSING" | "TITLES";
// Helper: returns true if session has results available
function hasResults(session: any): boolean {
  return Boolean(session?.result) || (String(session?.state) === "PATTERN_SYNTHESIS" && Boolean(session?.patternSummary));
}
// Returns UI step based on backend state and session
function getStepFromState(state: unknown, session?: any): UiStep {
  const s = String(state ?? "");
  if (hasResults(session)) return "TITLES";
  if (/^PROMPT_\d(_CLARIFIER)?$/.test(s)) return "PROMPT";
  if (s === "CONSOLIDATION_PENDING" || s === "CONSOLIDATION_RITUAL" || s === "PATTERN_SYNTHESIS") return "PROCESSING";
  if (s.startsWith("TITLE_HYPOTHESIS") || s.startsWith("TITLE_DIALOGUE")) return "TITLES";
  if (s.startsWith("JOB_INGEST")) return "TITLES";
  if (s === "ALIGNMENT_OUTPUT") return "PROCESSING";
  if (s === "TERMINAL_COMPLETE") return "TITLES";
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

async function fetchResult(calibrationId: string): Promise<any> {
  if (!calibrationId || calibrationId.trim().length === 0) {
    // Guard: do nothing if calibrationId is empty
    return null;
  }
  const res = await fetch(`/api/calibration/result?calibrationId=${encodeURIComponent(calibrationId)}`);
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) {
    const code = json?.error?.code ?? "REQUEST_FAILED";
    const message = json?.error?.message ?? `Result fetch failed (${res.status})`;
    throw new Error(`${code}: ${message}`);
  }
  return json; // returns { ok, calibrationId, score_0_to_10, summary, ... }
}

async function fetchSession(sessionId: string): Promise<AnySession | null> {
  const res = await fetch(`/api/calibration?sessionId=${encodeURIComponent(sessionId)}`);
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) return null;
  return json.session;
}

const COOKIE_NAME = "caliber_sessionId";
function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}
function setCookie(name: string, value: string, days = 7) {
  const d = new Date(); d.setTime(d.getTime() + days * 86400000);
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${d.toUTCString()};path=/;SameSite=Lax`;
}
function clearCookie(name: string) {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;SameSite=Lax`;
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

/** Truncate text to at most N sentences. */
function truncateToSentences(text: string, n: number): string {
  if (!text) return "";
  // Split on sentence-ending punctuation followed by whitespace or end of string
  const sentences = text.match(/[^.!?]*[.!?]+/g);
  if (!sentences || sentences.length === 0) return text;
  return sentences.slice(0, n).join("").trim();
}

export default function CalibrationPage() {
    // For TITLES step: track which title row was copied
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
    const [expandedTitleIdx, setExpandedTitleIdx] = useState<number | null>(null);
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
  const resumeAttemptedRef = useRef(false);

  // On mount: resume from URL param or cookie
  useEffect(() => {
    if (resumeAttemptedRef.current) return;
    resumeAttemptedRef.current = true;

    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const urlId = params.get("calibrationId")?.trim() || null;
        const cookieId = getCookie(COOKIE_NAME);
        const targetId = urlId || cookieId;
        if (!targetId) return; // no session to resume — stay on LANDING

        // If URL has calibrationId, try result endpoint first (durable results link)
        if (urlId) {
          try {
            const result = await fetchResult(urlId);
            if (result?.ok) {
              // Populate session + inline result panel, stay on JOB_TEXT
              const resultSession = await fetchSession(urlId);
              if (resultSession) {
                setSession(resultSession);
                setCookie(COOKIE_NAME, urlId);
                setJobResult(buildJobResult(resultSession, result));
                setStep("TITLES");
                return;
              }
            }
          } catch { /* result not ready — fall through to session fetch */ }
        }

        // Try fetching the full session to resume mid-flow
        const s = await fetchSession(targetId);
        if (!s) {
          // Session expired or not found — clear stale cookie, stay on LANDING
          clearCookie(COOKIE_NAME);
          return;
        }

        setSession(s);
        setCookie(COOKIE_NAME, targetId);
        const resumeStep = getStepFromState(s.state, s);
        // Map PROCESSING back to the right UI step based on what's missing
        if (s.state === "RESUME_INGEST" && (!s.resume?.rawText || s.resume.rawText.trim().length === 0)) {
          setStep("RESUME");
        } else if (s.state === "RESUME_INGEST") {
          setStep("RESUME"); // resume uploaded but not advanced yet
        } else {
          setStep(resumeStep);
        }
      } catch {
        // Silent fail — land on LANDING
      }
    })();
  }, []);
  const promptIndex = useMemo(() => getPromptIndexFromState(session?.state), [session?.state]);
  const hasAnswer = useMemo(() => answerText.trim().length > 0, [answerText]);
  function openFilePicker() { fileInputRef.current?.click(); }
  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) { setSelectedFile(e.target.files?.[0] ?? null); }
  async function begin() {
    setError(null); setBusy(true);
    try {
      const s = await postEvent({ type: "CREATE_SESSION" });
      if (s?.sessionId) setCookie(COOKIE_NAME, s.sessionId);
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
    const [jobResult, setJobResult] = useState<{ score: number; summary: string; title: string; supports_fit: string[]; stretch_factors: string[]; bottom_line_2s: string } | null>(null);
    /** Build jobResult from session + optional fetchResult response */
    function buildJobResult(s: any, result?: any): { score: number; summary: string; title: string; supports_fit: string[]; stretch_factors: string[]; bottom_line_2s: string } {
      const score = result?.score_0_to_10 ?? s?.result?.alignment?.score ?? 0;
      const rawSummary = result?.summary ?? s?.result?.alignment?.summary ?? s?.result?.summary ?? "";
      const title = s?.synthesis?.titleRecommendation?.primary_title?.title
        ?? s?.synthesis?.marketTitle
        ?? s?.synthesis?.titleCandidates?.[0]?.title ?? "";
      const supports_fit: string[] = Array.isArray(s?.result?.alignment?.supports_fit) ? s.result.alignment.supports_fit : [];
      const stretch_factors: string[] = Array.isArray(s?.result?.alignment?.stretch_factors) ? s.result.alignment.stretch_factors : [];
      const bottom_line_2s: string = typeof s?.result?.alignment?.bottom_line_2s === "string" ? s.result.alignment.bottom_line_2s : "";
      return { score: Number(score), summary: truncateToSentences(rawSummary, 3), title, supports_fit, stretch_factors, bottom_line_2s };
    }
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
        setStep("TITLES"); // Stay on TITLES after TITLE_FEEDBACK
      } catch (e: any) {
        setError(displayError(e));
      } finally { setBusy(false); }
    }

    /** Run the full job → score pipeline inline, staying on JOB_TEXT. */
    async function submitJobText() {
      const sessionId = String(session?.sessionId ?? "");
      if (!sessionId) { setError("Missing sessionId (session not created)." ); return; }
      if (!jobText.trim()) return;
      setError(null); setJobBusy(true); setJobResult(null);
      try {
        // 1. Submit job text
        let s = await postEvent({ type: "SUBMIT_JOB_TEXT", sessionId, jobText: jobText.trim() });
        setSession(s);

        // 2. Advance through intermediate states until ALIGNMENT_OUTPUT or TERMINAL_COMPLETE
        let ticks = 0;
        while (ticks < 12) {
          const st = String(s?.state ?? "");
          if (st === "ALIGNMENT_OUTPUT" || st === "TERMINAL_COMPLETE" || hasResults(s)) break;
          s = await postEvent({ type: "ADVANCE", sessionId });
          setSession(s);
          ticks++;
        }

        // 3. Fire COMPUTE_ALIGNMENT_OUTPUT if we reached that state
        if (String(s?.state) === "ALIGNMENT_OUTPUT") {
          s = await postEvent({ type: "COMPUTE_ALIGNMENT_OUTPUT", sessionId });
          setSession(s);
        }

        // 4. One more ADVANCE if needed to reach TERMINAL_COMPLETE
        if (String(s?.state) !== "TERMINAL_COMPLETE" && !hasResults(s)) {
          s = await postEvent({ type: "ADVANCE", sessionId });
          setSession(s);
        }

        // 5. Fetch result and display inline
        if (hasResults(s) || String(s?.state) === "TERMINAL_COMPLETE") {
          try {
            const result = await fetchResult(sessionId);
            setJobResult(buildJobResult(s, result));
          } catch {
            // Result fetch failed but session has results — extract from session
            setJobResult(buildJobResult(s));
          }
        } else {
          setError(`Pipeline did not reach results (state: ${String(s?.state)}).`);
        }
      } catch (e: any) {
        setError(displayError(e));
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
// FitAccordion for inline fit score analysis
function FitAccordion({ jobResult }: { jobResult: { score: number; summary: string; title: string; supports_fit: string[]; stretch_factors: string[]; bottom_line_2s: string } }) {
  const [expanded, setExpanded] = useState(true);
  useEffect(() => { setExpanded(true); }, [jobResult]); // expand by default on new result
  return (
    <div className="flex flex-col rounded-md px-4 py-2.5 cursor-pointer select-none transition-colors" style={{ backgroundColor: expanded ? "#1A1A1A" : "#141414", border: expanded ? "1px solid rgba(242,242,242,0.18)" : "1px solid rgba(242,242,242,0.08)" }}>
      <span className="flex items-center justify-between" onClick={() => setExpanded(!expanded)}>
        <span className="flex items-center gap-2 min-w-0">
          <span className="text-xs flex-shrink-0" style={{ color: "#777", width: 14 }}>{expanded ? "▼" : "▶"}</span>
          <span className="text-sm font-semibold truncate" style={{ color: "#4ADE80" }}>Fit Score</span>
        </span>
        <span className="flex items-center gap-2 flex-shrink-0 ml-2">
          <span className="text-sm font-mono font-bold" style={{ color: "#4ADE80" }}>{jobResult.score}/10</span>
        </span>
      </span>
      {expanded ? (
        <div className="px-2 py-3">
          <div className="text-center mb-4">
            <span className="text-3xl font-bold font-mono" style={{ color: "#4ADE80" }}>{jobResult.score}/10</span>
          </div>
          {jobResult.supports_fit.length > 0 ? (
            <div className="mb-2">
              <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "#4ADE80" }}>Supports the fit</div>
              <ul className="text-sm leading-relaxed pl-4" style={{ color: "#CFCFCF", listStyleType: "disc", textAlign: "left" }}>
                {jobResult.supports_fit.map((d, i) => <li key={i}><strong>{d}</strong></li>)}
              </ul>
            </div>
          ) : null}
          {jobResult.stretch_factors.length > 0 ? (
            <div className="mb-2">
              <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "#F59E0B" }}>Stretch factors</div>
              <ul className="text-sm leading-relaxed pl-4" style={{ color: "#CFCFCF", listStyleType: "disc", textAlign: "left" }}>
                {jobResult.stretch_factors.map((c, i) => <li key={i}><strong>{c}</strong></li>)}
              </ul>
            </div>
          ) : null}
          {jobResult.bottom_line_2s ? (
            <div className="mt-2 text-sm leading-relaxed" style={{ color: "#CFCFCF", textAlign: "left" }}>{jobResult.bottom_line_2s}</div>
          ) : jobResult.summary ? (
            <div className="mt-2 text-sm leading-relaxed" style={{ color: "#CFCFCF", textAlign: "left" }}>{jobResult.summary}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

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
        setStep("TITLES");
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
                setStep("TITLES");
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
        setStep("TITLES");
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
          setStep("TITLES");
        } else {
          setError(displayError(err));
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
    <div className="fixed inset-0 bg-[#0B0B0B] flex justify-center items-start pt-[8vh] sm:pt-[10vh] overflow-y-auto">
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
            {!["LANDING","RESUME","PROMPT","PROCESSING","TITLES"].includes(step) ? (
              <div className="w-full max-w-2xl" style={{ minHeight: "420px" }}>
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", marginTop: 32 }}>
                  <Spinner />
                  <span className="ml-2">Loading…</span>
                </div>
                <div className="mt-8 flex justify-center">
                  <button
                    type="button"
                    onClick={() => { clearCookie(COOKIE_NAME); setSession(null); setSelectedFile(null); setAnswerText(""); setError(null); setStep("LANDING"); window.history.replaceState(null, "", "/calibration"); }}
                    className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2"
                    style={{ backgroundColor: "rgba(242,242,242,0.10)", color: "#F2F2F2", border: "1px solid rgba(242,242,242,0.16)" }}
                  >
                    Restart
                  </button>
                </div>
              </div>
            ) : null}

            {/* TITLES UI */}
            {step === "TITLES" ? (() => {
              const rec = session?.synthesis?.titleRecommendation as any;
              // New enriched titles array (from enriched .titles sub-property)
              const enrichedTitles: Array<{ title: string; fit_0_to_10: number; bullets_3?: [string, string, string]; summary_2s?: string }> =
                Array.isArray(rec?.titles) ? rec.titles : [];
              const archetypeLabel: string = rec?.archetype_label ?? "";

              // Fallback 1: build from titleRecommendation.primary_title + adjacent_titles
              let recTitles: Array<{ title: string; fit_0_to_10: number }> = [];
              if (enrichedTitles.length === 0 && rec?.primary_title) {
                recTitles.push({ title: rec.primary_title.title, fit_0_to_10: rec.primary_title.score });
                if (Array.isArray(rec.adjacent_titles)) {
                  for (const adj of rec.adjacent_titles) {
                    recTitles.push({ title: adj.title, fit_0_to_10: adj.score });
                  }
                }
              }

              // Fallback 2: build from legacy candidates
              const fallbackCandidates: Array<{ title: string; score: number }> =
                Array.isArray(session?.synthesis?.titleCandidates) ? session.synthesis.titleCandidates : [];

              let titlesToRender = enrichedTitles.length > 0
                ? enrichedTitles
                : recTitles.length > 0
                  ? recTitles
                  : fallbackCandidates.map(c => ({ title: c.title, fit_0_to_10: c.score }));

              // Sort by score descending and take top 3
              titlesToRender = [...titlesToRender]
                .sort((a, b) => (b.fit_0_to_10 ?? 0) - (a.fit_0_to_10 ?? 0))
                .slice(0, 3);

              return (
              <div className="w-full max-w-2xl pb-12">
                {/* Archetype label */}
                {archetypeLabel ? (
                  <div className="mt-4 mb-3 text-xs font-semibold uppercase tracking-widest text-center" style={{ color: "#777" }}>{archetypeLabel}</div>
                ) : null}

                {/* Fallback: no title rows available */}
                {titlesToRender.length === 0 ? (
                  <div className="mt-6 mb-4 rounded-md px-4 py-3 text-center text-sm" style={{ backgroundColor: "#1A1A1A", color: "#AFAFAF", border: "1px solid rgba(242,242,242,0.10)" }}>
                    Your title recommendations are still being generated. Try pasting a job description below to get your fit score.
                  </div>
                ) : null}

                {/* Title rows with expand/collapse */}
                <div className="mt-2 space-y-1">
                  {titlesToRender.map((t, idx) => {
                    const isExpanded = expandedTitleIdx === idx;
                    const rawBullets: string[] = Array.isArray((t as any).bullets_3) ? (t as any).bullets_3 : [];
                    const validBullets = rawBullets.filter((b: string) => b && b.trim());
                    const hasBullets = validBullets.length > 0;
                    const summaryText: string = typeof (t as any).summary_2s === "string" ? (t as any).summary_2s.trim() : "";
                    const hasSummary = summaryText.length > 0;
                    const canExpand = hasBullets || hasSummary;

                    return (
                      <div key={idx}>
                        <div
                          className="flex flex-col rounded-md px-4 py-2.5 cursor-pointer select-none transition-colors"
                          style={{
                            backgroundColor: isExpanded ? "#1A1A1A" : "#141414",
                            border: isExpanded ? "1px solid rgba(242,242,242,0.18)" : "1px solid rgba(242,242,242,0.08)",
                          }}
                          onClick={() => {
                            if (!canExpand) return;
                            setExpandedTitleIdx(isExpanded ? null : idx);
                          }}
                        >
                          {/* Title + score + copy row */}
                          <span className="flex items-center justify-between">
                            <span className="flex items-center gap-2 min-w-0">
                              {canExpand ? (
                                <span className="text-xs flex-shrink-0" style={{ color: "#777", width: 14 }}>{isExpanded ? "▼" : "▶"}</span>
                              ) : (
                                <span className="text-xs flex-shrink-0" style={{ color: "#333", width: 14 }}>·</span>
                              )}
                              <span className={`text-sm ${idx === 0 ? "font-semibold" : ""} truncate`} style={{ color: "#F2F2F2" }}>{t.title}</span>
                            </span>
                            <span className="flex items-center gap-2 flex-shrink-0 ml-2">
                              <span className="text-sm font-mono font-medium" style={{ color: idx === 0 ? "#4ADE80" : "#AFAFAF" }}>{t.fit_0_to_10}/10</span>
                              <button
                                type="button"
                                aria-label={copiedIndex === idx ? "Copied" : "Copy title"}
                                onClick={(e) => { e.stopPropagation(); handleCopyTitle(idx, t.title); }}
                                className="px-2 py-0.5 rounded text-xs font-medium transition-colors"
                                style={{
                                  background: copiedIndex === idx ? "#4ADE80" : "#232323",
                                  color: copiedIndex === idx ? "#232323" : "#AFAFAF",
                                  border: "none",
                                  minWidth: 52,
                                  cursor: "pointer",
                                }}
                              >
                                {copiedIndex === idx ? "Copied ✓" : "Copy"}
                              </button>
                            </span>
                          </span>
                        </div>
                        {/* Expanded details — summary first, then bullets */}
                        {isExpanded && canExpand ? (
                          <div className="px-6 py-4 sm:px-7 sm:py-5 rounded-b-md mb-1 text-left" style={{ backgroundColor: "#1A1A1A", borderLeft: "1px solid rgba(242,242,242,0.18)", borderRight: "1px solid rgba(242,242,242,0.18)", borderBottom: "1px solid rgba(242,242,242,0.18)" }}>
                            {hasSummary ? (
                              <p className="text-sm sm:text-base leading-relaxed sm:leading-7 mb-3" style={{ color: "#E0E0E0", textAlign: "left" }}>{summaryText}</p>
                            ) : null}
                            {hasBullets ? (
                              <ul className="text-sm sm:text-base leading-relaxed sm:leading-7 pl-5 space-y-1 text-left" style={{ color: "#B0B0B0", listStyleType: "disc" }}>
                                {validBullets.map((b: string, bi: number) => <li key={bi} className="font-bold text-left">{b}</li>)}
                              </ul>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                {/* Job area — Fit accordion replaces textarea when results exist */}
                {jobResult ? (
                  <div className="mt-8">
                    <FitAccordion jobResult={jobResult} />
                    <div className="mt-5 flex justify-center">
                      <button
                        type="button"
                        onClick={() => { setJobResult(null); setJobText(""); setError(null); }}
                        className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2"
                        style={{ backgroundColor: "rgba(242,242,242,0.10)", color: "#F2F2F2", border: "1px solid rgba(242,242,242,0.16)" }}
                      >
                        ← Try another job
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mt-8">
                      <div className="flex flex-col items-center mb-2 gap-3 py-2">
                        <a
                          href={CHROME_STORE_URL ?? EXTENSION_LANDING_PATH}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center rounded-md px-5 py-3 text-sm sm:text-base font-medium transition-all ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2"
                          style={{ backgroundColor: "rgba(74,222,128,0.12)", color: "#4ADE80", cursor: "pointer", minWidth: 180, border: "1px solid rgba(74,222,128,0.3)" }}
                        >
                          Try our browser extension for LinkedIn or Indeed
                        </a>
                        <span className="text-lg font-medium" style={{ color: "#888" }}>or</span>
                        <span className="text-base font-medium" style={{ color: "#bbb" }}>Paste job description below</span>
                      </div>
                      <textarea
                        value={jobText}
                        onChange={e => setJobText(e.target.value)}
                        rows={6}
                        className="w-full rounded-md px-4 py-3 text-base sm:text-lg font-medium placeholder:text-[#9A9A9A] focus:outline-none transition-colors duration-200"
                        style={{ backgroundColor: "#141414", color: "#F2F2F2", border: "1px solid rgba(242,242,242,0.22)", boxShadow: "none" }}
                        placeholder="Paste job description here…"
                        disabled={busy || jobBusy}
                      />
                    </div>
                    {jobBusy ? (
                      <div className="mt-4 flex items-center justify-center gap-2">
                        <Spinner />
                        <span className="text-sm" style={{ color: "#AFAFAF" }}>Scoring… this can take up to ~1 minute.</span>
                      </div>
                    ) : null}
                    <div className="mt-7 flex flex-col items-center gap-2">
                      {jobText.trim().length < 20 && !(busy || jobBusy) ? (
                        <p className="text-xs" style={{ color: "#666" }}>Paste a job description to run calibration.</p>
                      ) : null}
                      <button
                        type="button"
                        className="inline-flex items-center justify-center rounded-md px-5 py-3 text-sm sm:text-base font-medium transition-all ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2"
                        style={{ backgroundColor: (busy || jobBusy || jobText.trim().length < 20) ? "rgba(242,242,242,0.70)" : "#F2F2F2", color: "#0B0B0B", cursor: (busy || jobBusy || jobText.trim().length < 20) ? "not-allowed" : "pointer", minWidth: 180 }}
                        disabled={busy || jobBusy || jobText.trim().length < 20}
                        onClick={async () => {
                          const sessionId = String(session?.sessionId ?? "");
                          if (!sessionId) { setError("Missing sessionId (session not created)." ); return; }
                          setError(null); setBusy(true); setJobBusy(true);
                          try {
                            const curState = String(session?.state ?? "");
                            if (curState.startsWith("TITLE_HYPOTHESIS") || curState.startsWith("TITLE_DIALOGUE")) {
                              await postEvent({ type: "TITLE_FEEDBACK", sessionId, feedback: "" });
                            }
                            let s = await postEvent({ type: "SUBMIT_JOB_TEXT", sessionId, jobText: jobText.trim() });
                            setSession(s);
                            let ticks = 0;
                            while (ticks < 12) {
                              const st = String(s?.state ?? "");
                              if (st === "ALIGNMENT_OUTPUT" || st === "TERMINAL_COMPLETE" || hasResults(s)) break;
                              s = await postEvent({ type: "ADVANCE", sessionId });
                              setSession(s);
                              ticks++;
                            }
                            if (String(s?.state) === "ALIGNMENT_OUTPUT") {
                              s = await postEvent({ type: "COMPUTE_ALIGNMENT_OUTPUT", sessionId });
                              setSession(s);
                            }
                            if (String(s?.state) !== "TERMINAL_COMPLETE" && !hasResults(s)) {
                              s = await postEvent({ type: "ADVANCE", sessionId });
                              setSession(s);
                            }
                            if (hasResults(s) || String(s?.state) === "TERMINAL_COMPLETE") {
                              try {
                                const result = await fetchResult(sessionId);
                                setJobResult(buildJobResult(s, result));
                              } catch {
                                setJobResult(buildJobResult(s));
                              }
                            }
                          } catch (e: any) {
                            if (e?.message?.includes("JOB_REQUIRED") || e?.code === "JOB_REQUIRED") {
                              setError("A job description is required.");
                            } else {
                              setError(displayError(e));
                            }
                          } finally { setBusy(false); setJobBusy(false); }
                        }}
                      >
                        {(busy || jobBusy) ? (<><Spinner /><span className="ml-2">Running…</span></>) : "Run calibration"}
                      </button>
                    </div>
                  </>
                )}
              </div>
              );
            })() : null}


          </div>
        </div>
      </div>
    </div>
  );
}