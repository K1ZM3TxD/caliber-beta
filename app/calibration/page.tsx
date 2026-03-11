"use client";
// app/calibration/page.tsx

import React, { useMemo, useRef, useState, useEffect } from "react";
import Link from "next/link";
import { CALIBRATION_PROMPTS } from "@/lib/calibration_prompts";
import CaliberHeader from "../components/caliber_header";

const TYPE_MS = 38;
const START_DELAY_MS = 350;
function useTypewriter(text: string, msPerChar: number = TYPE_MS): [string, boolean] {
  const [typed, setTyped] = useState("");
  useEffect(() => {
    let i = 0;
    setTyped("");
    if (!text) return;
    const timeout = setTimeout(() => {
      const step = () => {
        i++;
        setTyped(text.slice(0, i));
        if (i < text.length) {
          // Slightly eased pacing: brief pause after punctuation
          const ch = text[i - 1];
          const next = (ch === "." || ch === "," || ch === "\u2014") ? msPerChar * 3 : msPerChar + Math.random() * 12;
          setTimeout(step, next);
        }
      };
      step();
    }, START_DELAY_MS);
    return () => { clearTimeout(timeout); };
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

// --- Client-side session backup for rehydration after server-side loss ---
const SESSION_BACKUP_KEY = "caliber_session_backup";
function persistSessionBackup(session: AnySession) {
  try {
    if (session?.sessionId) localStorage.setItem(SESSION_BACKUP_KEY, JSON.stringify(session));
  } catch { /* quota exceeded or private browsing */ }
}
function loadSessionBackup(): AnySession | null {
  try {
    const raw = localStorage.getItem(SESSION_BACKUP_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}
function clearSessionBackup() {
  try { localStorage.removeItem(SESSION_BACKUP_KEY); } catch {}
}
async function tryRestoreSession(backup: AnySession): Promise<boolean> {
  try {
    const res = await fetch("/api/calibration", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session: backup }),
    });
    const json = await res.json().catch(() => null);
    return Boolean(res.ok && json?.ok);
  } catch { return false; }
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

  // Persist session to localStorage on every change for rehydration
  useEffect(() => {
    if (session) persistSessionBackup(session);
  }, [session]);

  // Notify extension content script when calibration reaches TITLES (session ready)
  useEffect(() => {
    if (step === "TITLES" && session?.sessionId) {
      window.dispatchEvent(new CustomEvent("caliber:session-ready", {
        detail: { sessionId: session.sessionId },
      }));
    }
  }, [step, session?.sessionId]);

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
        let s = await fetchSession(targetId);

        // Server lost the session — try restoring from localStorage backup
        if (!s) {
          const backup = loadSessionBackup();
          if (backup && backup.sessionId === targetId) {
            const restored = await tryRestoreSession(backup);
            if (restored) {
              s = await fetchSession(targetId);
            }
          }
        }

        if (!s) {
          // Session truly gone — clear stale cookie + backup, stay on LANDING
          clearCookie(COOKIE_NAME);
          clearSessionBackup();
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
    const [titleTypewriter, titleTypewriterDone] = useTypewriter("Market titles that match your pattern. Use them as search terms.");
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
    <div className="flex flex-col rounded-md px-4 py-2.5 cursor-pointer select-none transition-colors" style={{ backgroundColor: expanded ? "rgba(255,255,255,0.045)" : "rgba(255,255,255,0.025)", border: expanded ? "1px solid rgba(255,255,255,0.10)" : "1px solid rgba(255,255,255,0.05)" }}>
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
        border: "3px solid rgba(58,180,100,0.15)",
        borderTop: "3px solid #3AB464",
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
        marginLeft: 8,
      }}
    />
  );

  return (
    <div className="fixed inset-0 flex justify-center items-start overflow-y-auto" style={{ background: 'radial-gradient(ellipse 65% 40% at 50% 12%, rgba(74,222,128,0.07) 0%, transparent 100%), #050505' }}>
      <div className="w-full max-w-[760px] px-6 pt-[10vh] pb-16">
        <style>{`
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          @keyframes cb-title-enter { 0% { opacity: 0; transform: translateY(8px); } 100% { opacity: 1; transform: translateY(0); } }
          @keyframes cb-fade-up { 0% { opacity: 0; transform: translateY(12px); } 100% { opacity: 1; transform: translateY(0); } }
          .cb-title-card:hover { border-color: rgba(255,255,255,0.10) !important; background-color: rgba(255,255,255,0.04) !important; }
          .cb-dropzone { transition: border-color 0.2s, background-color 0.2s; }
          .cb-dropzone:hover { border-color: rgba(255,255,255,0.14) !important; background-color: rgba(255,255,255,0.02) !important; }
          .cb-textarea:focus { border-color: rgba(74,222,128,0.50) !important; box-shadow: 0 0 0 1px rgba(74,222,128,0.18), 0 0 20px rgba(74,222,128,0.06) !important; }
          .cb-textarea::placeholder { color: rgba(161,161,170,0.50); }
        `}</style>
        <div className="relative" style={{ color: "#F2F2F2" }}>
          <div className="w-full flex flex-col items-center text-center">
            {/* Static header area */}
            <div style={{ minHeight: step === "TITLES" ? "auto" : "5.5em", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              {step === "TITLES" ? (
                <div className="flex items-center gap-2 mb-1">
                  <span style={{ color: "#3AB464", fontSize: "0.85rem" }}>{"\u2713"}</span>
                  <span className="text-xs font-medium uppercase tracking-widest" style={{ color: "#666" }}>Calibration complete</span>
                </div>
              ) : (
                <CaliberHeader />
              )}
              {/* Fixed-height error area */}
              <div style={{ minHeight: step === "TITLES" ? "0.5em" : "2.2em" }}>
                {error ? (
                  <div className="mt-2 text-sm rounded-md px-3 py-2" style={{ background: "#2A0F0F", color: "#FFD1D1" }}>
                    {error}
                  </div>
                ) : null}
              </div>
            </div>


            {/* LANDING */}
            {step === "LANDING" ? (
              <div className="w-full" style={{ maxWidth: 640 }}>
                <div style={{ minHeight: "1.5em" }} className="mt-8">
                  <p style={{ fontSize: '26px', fontWeight: 400, lineHeight: 1.5, letterSpacing: '0.005em', color: 'rgba(237,237,237,0.78)' }}>{tagline}</p>
                </div>
                <div className="mt-8">
                  <button
                    type="button"
                    onClick={begin}
                    disabled={busy}
                    className="inline-flex items-center justify-center rounded-md transition-all duration-200 focus:outline-none"
                    style={{
                      fontSize: '15px',
                      fontWeight: 600,
                      padding: '14px 28px',
                      backgroundColor: busy ? "rgba(58,180,100,0.08)" : "rgba(74,222,128,0.06)",
                      color: busy ? "rgba(74,222,128,0.45)" : "#4ADE80",
                      border: busy ? "1px solid rgba(74,222,128,0.20)" : "1px solid rgba(74,222,128,0.45)",
                      cursor: busy ? "not-allowed" : "pointer",
                      boxShadow: "none",
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
                <div style={{ minHeight: "1.5em", lineHeight: 1.4 }}>
                  <div className="text-base sm:text-lg leading-relaxed tracking-wide" style={{ color: 'rgba(207,207,207,0.72)', fontWeight: 300, letterSpacing: '0.02em' }}>{resumeSubtext}</div>
                </div>
                <div className="mt-6 flex justify-center">
                  <div className="w-full" style={{ maxWidth: 420 }}>
                    <div
                      className="rounded-md transition-opacity cb-dropzone"
                      style={{
                        border: "1px dashed rgba(255,255,255,0.08)",
                        backgroundColor: selectedFile ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.015)",
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
                              backgroundColor: "rgba(255,255,255,0.08)",
                              color: "#F2F2F2",
                              border: "1px solid rgba(255,255,255,0.12)",
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
                            className="inline-flex items-center justify-center rounded-md px-3 py-1 text-xs font-medium transition-colors duration-200 focus:outline-none mt-2"
                            style={{
                              backgroundColor: "rgba(255,255,255,0.06)",
                              color: "#F2F2F2",
                              border: "1.5px solid rgba(255,255,255,0.18)",
                              cursor: busy ? "not-allowed" : "pointer",
                            }}
                          >
                            Choose different file
                          </button>
                        </div>
                      )}
                      <span className="absolute bottom-2 left-0 right-0 text-center text-[10px]" style={{ color: "#CFCFCF" }}>PDF, DOCX, or TXT</span>
                    </div>
                  </div>
                </div>
                <div className="mt-5">
                  <button
                    type="button"
                    onClick={submitResume}
                    disabled={!canContinueResume}
                    className="inline-flex items-center justify-center rounded-md px-6 py-3 text-sm sm:text-base font-semibold transition-all ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2"
                    style={{
                      transitionDuration: "200ms",
                      backgroundColor: canContinueResume ? "rgba(74,222,128,0.06)" : "rgba(74,222,128,0.03)",
                      color: canContinueResume ? "#4ADE80" : "rgba(74,222,128,0.45)",
                      border: canContinueResume ? "1px solid rgba(74,222,128,0.45)" : "1px solid rgba(74,222,128,0.20)",
                      cursor: canContinueResume ? "pointer" : "not-allowed",
                      boxShadow: "none",
                      minWidth: 140
                    }}
                  >
                    {resumeUploading ? (<><Spinner /><span className="ml-2">Uploading…</span></>) : "Continue"}
                  </button>
                </div>
                <div className="mt-6 text-center" style={{ opacity: resumeDone ? 1 : 0, transition: "opacity 0.6s 0.3s" }}>
                  <Link
                    href="/calibration/build-resume"
                    className="text-xs transition-colors duration-200"
                    style={{ color: "rgba(207,207,207,0.5)", textDecoration: "none", borderBottom: "1px solid rgba(207,207,207,0.18)" }}
                    onMouseEnter={e => { e.currentTarget.style.color = "rgba(207,207,207,0.8)"; e.currentTarget.style.borderBottomColor = "rgba(207,207,207,0.35)"; }}
                    onMouseLeave={e => { e.currentTarget.style.color = "rgba(207,207,207,0.5)"; e.currentTarget.style.borderBottomColor = "rgba(207,207,207,0.18)"; }}
                  >
                    Don&apos;t have a resume? Build a great one.
                  </Link>
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
                      className="w-full rounded-md px-4 py-3 text-sm sm:text-base focus:outline-none transition-colors duration-200 cb-textarea"
                      style={{
                        backgroundColor: "rgba(255,255,255,0.06)",
                        color: "#F2F2F2",
                        border: "1px solid rgba(255,255,255,0.13)",
                        boxShadow: "none",
                        opacity: 1,
                        fontSize: "1em",
                        marginTop: "0.5em",
                        outline: "none",
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
                    className="inline-flex items-center justify-center rounded-md px-6 py-3 text-sm sm:text-base font-semibold transition-all ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2"
                    style={{
                      transitionDuration: "200ms",
                      backgroundColor: promptIndex == null || !hasAnswer || busy ? "rgba(74,222,128,0.03)" : "rgba(74,222,128,0.06)",
                      color: promptIndex == null || !hasAnswer || busy ? "rgba(74,222,128,0.45)" : "#4ADE80",
                      border: promptIndex == null || !hasAnswer || busy ? "1px solid rgba(74,222,128,0.20)" : "1px solid rgba(74,222,128,0.45)",
                      cursor: promptIndex == null || !hasAnswer || busy ? "not-allowed" : "pointer",
                      boxShadow: "none",
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
                    onClick={() => { clearCookie(COOKIE_NAME); clearSessionBackup(); setSession(null); setSelectedFile(null); setAnswerText(""); setError(null); setStep("LANDING"); window.history.replaceState(null, "", "/calibration"); }}
                    className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2"
                    style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "#F2F2F2", border: "1px solid rgba(255,255,255,0.10)" }}
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

              // Sort by score descending and take top 1
              titlesToRender = [...titlesToRender]
                .sort((a, b) => (b.fit_0_to_10 ?? 0) - (a.fit_0_to_10 ?? 0))
                .slice(0, 1);

              const heroTitle = titlesToRender[0] ?? null;
              const heroExpanded = expandedTitleIdx === 0;
              const heroRawBullets: string[] = heroTitle && Array.isArray((heroTitle as any).bullets_3) ? (heroTitle as any).bullets_3 : [];
              const heroValidBullets = heroRawBullets.filter((b: string) => b && b.trim());
              const heroHasBullets = heroValidBullets.length > 0;
              const heroSummaryText: string = heroTitle && typeof (heroTitle as any).summary_2s === "string" ? (heroTitle as any).summary_2s.trim() : "";
              const heroHasSummary = heroSummaryText.length > 0;
              const heroCanExpand = heroHasBullets || heroHasSummary;

              return (
              <div className="w-full max-w-3xl pb-8">

                {/* Fallback: no title available */}
                {!heroTitle ? (
                  <div className="mt-4 mb-4 rounded-lg px-5 py-4 text-center text-sm" style={{ backgroundColor: "rgba(255,255,255,0.025)", color: "#AFAFAF", border: "1px solid rgba(255,255,255,0.05)" }}>
                    Your title recommendation is still being generated.
                  </div>
                ) : null}

                {/* Hero title card */}
                {heroTitle ? (
                  <div
                    className="cb-title-card rounded-2xl transition-all duration-150 cursor-pointer"
                    style={{
                      animation: "cb-title-enter 0.35s ease-out 0.15s both",
                      backgroundColor: heroExpanded ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.015)",
                      border: heroExpanded ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(255,255,255,0.04)",
                    }}
                    onClick={() => {
                      if (!heroCanExpand) return;
                      setExpandedTitleIdx(heroExpanded ? null : 0);
                    }}
                  >
                    <div className="px-6 py-8 sm:px-8 sm:py-10 text-center">
                      <div className="text-[1.3rem] sm:text-[1.7rem] font-medium" style={{ color: "#F2F2F2", lineHeight: 1.15, letterSpacing: "0.01em" }}>{heroTitle.title}</div>
                      <div className="flex items-center justify-center gap-4 mt-5">
                        <a
                          href={`https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(heroTitle.title)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="px-6 py-2.5 rounded-lg text-[15px] font-medium transition-all duration-150 hover:brightness-110"
                          style={{ background: "rgba(74,222,128,0.12)", color: "#4ADE80", border: "1px solid rgba(74,222,128,0.22)", textDecoration: "none", whiteSpace: "nowrap" }}
                        >Search on LinkedIn</a>
                        {heroCanExpand ? (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setExpandedTitleIdx(heroExpanded ? null : 0); }}
                            className="px-6 py-2.5 rounded-lg text-[15px] font-medium transition-colors duration-150"
                            style={{ background: "rgba(251,191,36,0.08)", color: heroExpanded ? "#999" : "#FBBF24", border: "1px solid rgba(251,191,36,0.18)", whiteSpace: "nowrap", cursor: "pointer" }}
                          >
                            {heroExpanded ? "Hide details \u25B4" : "See why it fits \u25BE"}
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {/* Expanded content */}
                    {heroExpanded && heroCanExpand ? (
                      <div className="px-6 pb-5 sm:px-8 text-left" onClick={(e) => e.stopPropagation()}>
                        <div className="border-t pt-4 mb-2" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                          <p className="text-sm leading-relaxed mb-2" style={{ color: "#CFCFCF" }}>Your pattern matches on 4 core signals.</p>
                          {heroHasBullets ? (
                            <ul className="text-sm leading-relaxed pl-4 space-y-0.5 mb-2" style={{ color: "#A0A0A0", listStyleType: "disc" }}>
                              {heroValidBullets.map((b: string, bi: number) => <li key={bi}>{b}</li>)}
                            </ul>
                          ) : null}
                          {heroHasSummary ? (
                            <p className="text-[13px] leading-relaxed" style={{ color: "#999" }}>{heroSummaryText}</p>
                          ) : null}
                        </div>
                        {/* Search actions */}
                        <div className="flex items-center gap-2 mt-3">
                          <a
                            href={`https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(heroTitle.title)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1 rounded-md text-[11px] font-medium transition-all duration-150 hover:bg-[rgba(242,242,242,0.10)]"
                            style={{ background: "rgba(255,255,255,0.04)", color: "#AAA", border: "1px solid rgba(255,255,255,0.06)", textDecoration: "none" }}
                          >Search on LinkedIn</a>
                          <a
                            href={`https://www.indeed.com/jobs?q=${encodeURIComponent(heroTitle.title)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1 rounded-md text-[11px] font-medium transition-all duration-150 hover:bg-[rgba(242,242,242,0.10)]"
                            style={{ background: "rgba(255,255,255,0.04)", color: "#AAA", border: "1px solid rgba(255,255,255,0.06)", textDecoration: "none" }}
                          >Search on Indeed</a>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {/* Extension CTA — supporting section */}
                <div className="mt-4" style={{ animation: "cb-fade-up 0.35s ease-out both" }}>
                  <div
                    className="rounded-xl px-6 py-5 sm:px-8 sm:py-7 flex flex-col items-center text-center"
                    style={{
                      background: "linear-gradient(180deg, rgba(74,222,128,0.035) 0%, transparent 100%)",
                      border: "1px solid rgba(74,222,128,0.08)",
                    }}
                  >
                    <h3 className="text-base sm:text-lg font-semibold tracking-tight mb-3" style={{ color: "#F2F2F2" }}>Analyze real jobs as you browse</h3>
                    <a
                      href="/extension"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group inline-flex items-center justify-center gap-2.5 rounded-lg px-8 py-3 text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2"
                      style={{
                        background: "rgba(74,222,128,0.06)",
                        color: "#4ADE80",
                        cursor: "pointer",
                        minWidth: 240,
                        border: "1px solid rgba(74,222,128,0.45)",
                        boxShadow: "none",
                      }}
                    >
                      <span>Get the Extension</span>
                      <span style={{ fontSize: "1.1em", display: "inline-block", transition: "transform 0.2s" }} className="group-hover:translate-x-0.5">{"\u2192"}</span>
                    </a>
                    <p className="mt-2 text-xs" style={{ color: "#555" }}>Chrome {"\u00b7"} LinkedIn {"\u00b7"} Indeed</p>
                  </div>
                </div>

                {/* How we score this — integrated philosophy */}
                <div className="mt-3">
                  <div
                    className="rounded-xl transition-all duration-150 cursor-pointer"
                    style={{
                      backgroundColor: expandedTitleIdx === -1 ? "rgba(255,255,255,0.045)" : "rgba(255,255,255,0.02)",
                      border: expandedTitleIdx === -1 ? "1px solid rgba(255,255,255,0.09)" : "1px solid rgba(255,255,255,0.04)",
                    }}
                    onClick={() => setExpandedTitleIdx(expandedTitleIdx === -1 ? null : -1)}
                  >
                    <div className="px-4 py-3 flex items-center justify-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: expandedTitleIdx === -1 ? "#999" : "#666" }}>How we score this</span>
                      <span className="text-xs" style={{ color: "#666" }}>{expandedTitleIdx === -1 ? "\u25B4" : "\u25BE"}</span>
                    </div>
                    {expandedTitleIdx === -1 ? (
                      <div className="px-4 pb-3 text-left text-sm leading-relaxed" style={{ color: "#777" }} onClick={(e) => e.stopPropagation()}>
                        <p className="mb-1.5">Caliber scores pattern fit, not keyword overlap. We look at the shape of your experience — how your skills, context, and trajectory align with what a role actually demands.</p>
                        <p className="mb-1.5">This title reflects the kind of work your background most closely matches. It may not be your last job title, but it represents where your pattern has the strongest signal.</p>
                        <p>The goal is to help you search more effectively and assess real roles faster — not to limit what you can do.</p>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Recalibrate */}
                <div className="mt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={() => { clearCookie(COOKIE_NAME); clearSessionBackup(); setSession(null); setSelectedFile(null); setAnswerText(""); setError(null); setStep("LANDING"); window.history.replaceState(null, "", "/calibration"); }}
                    className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-[11px] font-normal transition-colors duration-200 focus:outline-none"
                    style={{ backgroundColor: "transparent", color: "#555", border: "none", cursor: "pointer" }}
                  >
                    <span style={{ fontSize: "0.85em" }}>{"\u21BB"}</span>
                    Recalibrate
                  </button>
                </div>
              </div>
              );
            })() : null}

          </div>
        </div>
      </div>
    </div>
  );
}