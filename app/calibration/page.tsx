"use client";
// app/calibration/page.tsx

import React, { useMemo, useRef, useState, useEffect } from "react";
import { CALIBRATION_PROMPTS } from "@/lib/calibration_prompts";
import { EXTENSION_LANDING_PATH } from "@/lib/extension_config";

const TYPE_MS = 30;
const START_DELAY_MS = 200;
const TITLE_STAGGER_MS = 150; // stagger between title box reveals
const GLOW_DURATION_MS = 1200; // arrow glow pulse duration

function useTypewriter(text: string, msPerChar: number = TYPE_MS, delayMs: number = START_DELAY_MS): [string, boolean] {
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
    }, delayMs);
    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, [text, msPerChar, delayMs]);
  return [typed, typed === text];
}

/**
 * Reveal N items with a stagger delay. Starts when `start` becomes true.
 * Returns [visibleCount, allDone].
 */
function useStaggerReveal(total: number, start: boolean, intervalMs: number): [number, boolean] {
  const [visible, setVisible] = useState(0);
  useEffect(() => {
    if (!start || total <= 0) { setVisible(0); return; }
    setVisible(1); // first item immediately
    if (total <= 1) return;
    let current = 1;
    let cancelled = false;
    function tick() {
      if (cancelled || current >= total) return;
      setTimeout(() => {
        if (cancelled) return;
        current++;
        setVisible(current);
        tick();
      }, intervalMs);
    }
    tick();
    return () => { cancelled = true; };
  }, [total, start, intervalMs]);
  return [visible, start && visible >= total];
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
const LS_SESSION_KEY = "caliber_session_backup";
function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}
function setCookie(name: string, value: string, days = 7) {
  const d = new Date(); d.setTime(d.getTime() + days * 86400000);
  const secure = location.protocol === "https:" ? ";Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${d.toUTCString()};path=/;SameSite=Lax${secure}`;
}
function clearCookie(name: string) {
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? ";Secure" : "";
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;SameSite=Lax${secure}`;
}

function saveSessionToLS(s: AnySession | null) {
  try {
    if (s?.sessionId) localStorage.setItem(LS_SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(LS_SESSION_KEY);
  } catch { /* quota or private mode */ }
}

function loadSessionFromLS(): AnySession | null {
  try {
    const raw = localStorage.getItem(LS_SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (s?.sessionId && s?.state) return s;
    return null;
  } catch { return null; }
}

async function restoreSessionToServer(s: AnySession): Promise<boolean> {
  try {
    const res = await fetch("/api/calibration", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session: s }),
    });
    const json = await res.json().catch(() => null);
    return json?.ok === true;
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
                setStep("TITLES");
                return;
              }
            }
          } catch { /* result not ready — fall through to session fetch */ }
        }

        // Try fetching the full session to resume mid-flow
        const s = await fetchSession(targetId);
        if (!s) {
          // Server session gone (serverless cold start) — try restoring from localStorage
          const backup = loadSessionFromLS();
          if (backup && backup.sessionId === targetId) {
            // Try to push the backup back to the server (best-effort)
            const restored = await restoreSessionToServer(backup);
            if (restored) {
              // Re-fetch to get canonical server copy
              const fresh = await fetchSession(targetId);
              if (fresh) {
                setSession(fresh);
                setCookie(COOKIE_NAME, targetId);
                const resumeStep = getStepFromState(fresh.state, fresh);
                setStep(resumeStep);
                return;
              }
            }
            // Server round-trip failed, but we have a valid local backup — use it directly
            setSession(backup);
            setCookie(COOKIE_NAME, targetId);
            const resumeStep = getStepFromState(backup.state, backup);
            setStep(resumeStep);
            return;
          }
          // No backup at all — clear stale cookie, stay on LANDING
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

  // Persist session to localStorage on every update (survives serverless cold starts)
  useEffect(() => { saveSessionToLS(session); }, [session]);

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

  const canContinueResume = !!selectedFile && !busy;
  const [processingAttempts, setProcessingAttempts] = useState(0);
  const inFlightRef = useRef(false);
  const computeFiredRef = useRef(false);
  // Typewriter hooks
  const [tagline] = useTypewriter("The alignment tool for job calibration.");
  const [resumeSubtext, resumeDone] = useTypewriter(step === "RESUME" ? "Your experience holds the pattern." : "");

  // Staged reveal: Line1 typewriter → Line2 typewriter → titles stagger → CTA typewriter → button
  const isTitles = step === "TITLES";

  // 1. "Your signals have been calibrated."
  const [line1Typed, line1Done] = useTypewriter(isTitles ? "Your signals have been calibrated." : "", TYPE_MS, START_DELAY_MS);

  // 2. "These titles best match your pattern." — starts 400ms after line1 done
  const [line2Typed, line2Done] = useTypewriter(line1Done ? "These titles best match your pattern." : "", TYPE_MS, 400);

  // 3. Count of title boxes to render (from session)
  const _titleCount = useMemo(() => {
    const rec = session?.synthesis?.titleRecommendation as any;
    const enriched = Array.isArray(rec?.titles) ? rec.titles : [];
    let fallback: any[] = [];
    if (enriched.length === 0 && rec?.primary_title) {
      fallback.push(rec.primary_title);
      if (Array.isArray(rec.adjacent_titles)) fallback.push(...rec.adjacent_titles);
    }
    if (enriched.length === 0 && fallback.length === 0) {
      fallback = Array.isArray(session?.synthesis?.titleCandidates) ? session.synthesis.titleCandidates : [];
    }
    return Math.min(3, enriched.length || fallback.length);
  }, [session?.synthesis]);

  // Title boxes stagger in after line2 finishes
  const [titleRevealCount, titlesAllRevealed] = useStaggerReveal(_titleCount, line2Done, TITLE_STAGGER_MS);

  // Track glow state — true until any title is interacted with
  const [glowActive, setGlowActive] = useState(true);
  useEffect(() => {
    if (!titlesAllRevealed || !glowActive) return;
    const timer = setTimeout(() => setGlowActive(false), GLOW_DURATION_MS);
    return () => clearTimeout(timer);
  }, [titlesAllRevealed, glowActive]);

  // 4. "See your job fit score on real roles." — starts after titles all revealed
  const [ctaLine1Typed, ctaLine1Done] = useTypewriter(titlesAllRevealed ? "See your job fit score on real roles." : "", TYPE_MS, 400);

  // 5. "Use the Caliber LinkedIn extension." — starts immediately after ctaLine1
  const [ctaLine2Typed, ctaLine2Done] = useTypewriter(ctaLine1Done ? "Use the Caliber LinkedIn extension." : "", TYPE_MS, 200);

  // CTA button visible after ctaLine2 finishes
  const ctaButtonVisible = ctaLine2Done;

  const [promptText, promptDone] = useTypewriter(
    step === "PROMPT" && (promptIndex === 1 || promptIndex === 2 || promptIndex === 3 || promptIndex === 4 || promptIndex === 5)
      ? CALIBRATION_PROMPTS[promptIndex as 1 | 2 | 3 | 4 | 5]
      : ""
  );

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

  const isPreResults = ["LANDING", "RESUME", "PROMPT", "PROCESSING"].includes(step);

  return (
    <div className={`fixed inset-0 bg-[#0B0B0B] flex justify-center overflow-y-auto ${isPreResults ? "items-center" : "items-start pt-[8vh] sm:pt-[10vh]"}`}>
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
                    onClick={() => { clearCookie(COOKIE_NAME); saveSessionToLS(null); setSession(null); setSelectedFile(null); setAnswerText(""); setError(null); setStep("LANDING"); window.history.replaceState(null, "", "/calibration"); }}
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

                {/* STEP 1 — Typewriter intro lines */}
                {line1Typed.length > 0 ? (
                  <div className="mt-6 mb-2 text-center">
                    <p className="text-base sm:text-lg font-medium" style={{ color: "#E0E0E0" }}>
                      {line1Typed}<span className="animate-pulse" style={{ opacity: line1Done ? 0 : 1 }}>▍</span>
                    </p>
                  </div>
                ) : null}

                {line2Typed.length > 0 ? (
                  <div className="mb-4 text-center">
                    <p className="text-base sm:text-lg font-medium" style={{ color: "#E0E0E0" }}>
                      {line2Typed}<span className="animate-pulse" style={{ opacity: line2Done ? 0 : 1 }}>▍</span>
                    </p>
                  </div>
                ) : null}

                {/* Archetype label */}
                {archetypeLabel && line2Done ? (
                  <div className="mt-2 mb-3 text-xs font-semibold uppercase tracking-widest text-center" style={{ color: "#777" }}>{archetypeLabel}</div>
                ) : null}

                {/* STEP 2 — Title boxes, staggered reveal */}
                {titlesToRender.length === 0 && line2Done ? (
                  <div className="mt-6 mb-4 rounded-md px-4 py-3 text-center text-sm" style={{ backgroundColor: "#1A1A1A", color: "#AFAFAF", border: "1px solid rgba(242,242,242,0.10)" }}>
                    Your title recommendations are still being generated.
                  </div>
                ) : null}

                <div className="mt-2 space-y-1">
                  {titlesToRender.slice(0, titleRevealCount).map((t, idx) => {
                    const isExpanded = expandedTitleIdx === idx;
                    const rawBullets: string[] = Array.isArray((t as any).bullets_3) ? (t as any).bullets_3 : [];
                    const validBullets = rawBullets.filter((b: string) => b && b.trim());
                    const hasBullets = validBullets.length > 0;
                    const summaryText: string = typeof (t as any).summary_2s === "string" ? (t as any).summary_2s.trim() : "";
                    const hasSummary = summaryText.length > 0;
                    const canExpand = hasBullets || hasSummary;

                    return (
                      <div key={idx} style={{ animation: "cb-title-enter 0.25s ease-out" }}>
                        <div
                          className="flex flex-col rounded-md px-4 py-2.5 cursor-pointer select-none transition-colors"
                          style={{
                            backgroundColor: isExpanded ? "#1A1A1A" : "#141414",
                            border: isExpanded ? "1px solid rgba(242,242,242,0.18)" : "1px solid rgba(242,242,242,0.08)",
                          }}
                          onClick={() => {
                            if (!canExpand) return;
                            setExpandedTitleIdx(isExpanded ? null : idx);
                            setGlowActive(false);
                          }}
                          onMouseEnter={() => setGlowActive(false)}
                        >
                          {/* Title + score + copy row */}
                          <span className="flex items-center justify-between">
                            <span className="flex items-center gap-2 min-w-0">
                              {canExpand ? (
                                <span
                                  className="text-xs flex-shrink-0"
                                  style={{
                                    color: "#777",
                                    width: 14,
                                    animation: glowActive && titlesAllRevealed && !isExpanded ? "cb-arrow-glow 1.2s ease-in-out" : "none",
                                  }}
                                >{isExpanded ? "▼" : "▶"}</span>
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

                {/* STEP 3 — Extension CTA typewriter lines */}
                {ctaLine1Typed.length > 0 ? (
                  <div className="mt-8 mb-1 text-center">
                    <p className="text-base sm:text-lg font-medium" style={{ color: "#E0E0E0" }}>
                      {ctaLine1Typed}<span className="animate-pulse" style={{ opacity: ctaLine1Done ? 0 : 1 }}>▍</span>
                    </p>
                  </div>
                ) : null}

                {ctaLine2Typed.length > 0 ? (
                  <div className="mb-4 text-center">
                    <p className="text-base sm:text-lg font-medium" style={{ color: "#CFCFCF" }}>
                      {ctaLine2Typed}<span className="animate-pulse" style={{ opacity: ctaLine2Done ? 0 : 1 }}>▍</span>
                    </p>
                  </div>
                ) : null}

                {/* STEP 4 — CTA Button */}
                {ctaButtonVisible ? (
                  <div className="mt-4 flex flex-col items-center gap-2 py-3" style={{ animation: "cb-title-enter 0.3s ease-out" }}>
                    <a
                      href={EXTENSION_LANDING_PATH}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center rounded-md px-6 py-3 text-sm sm:text-base font-semibold transition-all ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2"
                      style={{ backgroundColor: "#4ADE80", color: "#0B0B0B", cursor: "pointer", minWidth: 220 }}
                    >
                      Find your fit on LinkedIn
                    </a>
                  </div>
                ) : null}

              </div>
              );
            })() : null}


          </div>
        </div>
      </div>
    </div>
  );
}