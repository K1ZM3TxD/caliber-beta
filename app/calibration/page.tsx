"use client";
// app/calibration/page.tsx

import React, { useMemo, useRef, useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { CALIBRATION_PROMPTS } from "@/lib/calibration_prompts";
import CaliberHeader from "../components/caliber_header";
import ExtensionInstallBlock from "../components/ExtensionInstallBlock";

const TYPE_MS = 57;
const START_DELAY_MS = 350;
function useTypewriter(text: string, msPerChar: number = TYPE_MS, startWhen: boolean = true): [string, boolean] {
  const [typed, setTyped] = useState("");
  useEffect(() => {
    let i = 0;
    let cancelled = false;
    setTyped("");
    if (!text || !startWhen) return () => { cancelled = true; };
    const timeout = setTimeout(() => {
      const step = () => {
        if (cancelled) return;
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
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [text, msPerChar, startWhen]);
  return [typed, typed.length > 0 && typed === text];
}

function useWordReveal(text: string, msPerChar: number = TYPE_MS, startWhen: boolean = true): [string[], number, boolean] {
  const words = useMemo(() => (text ? text.split(/\s+/) : []), [text]);
  const [count, setCount] = useState(0);
  useEffect(() => {
    setCount(0);
    if (!text || !startWhen || words.length === 0) return;
    let idx = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const reveal = () => {
      idx++;
      setCount(idx);
      if (idx < words.length) {
        const delay = words[idx].length * msPerChar;
        timers.push(setTimeout(reveal, delay));
      }
    };
    const firstDelay = words[0].length * msPerChar;
    timers.push(setTimeout(reveal, firstDelay));
    return () => timers.forEach(clearTimeout);
  }, [text, msPerChar, startWhen, words]);
  return [words, count, count >= words.length];
}

/** Staged progress for processing screen — presentation-only timing. */
function useStagedProgress(active: boolean, done: boolean): { percent: number; label: string; complete: boolean } {
  const stages = [20, 40, 60, 80];
  const NORMAL_MS = 1200;
  const FAST_MS = 400;
  const [idx, setIdx] = useState(0);
  const [complete, setComplete] = useState(false);
  const doneRef = useRef(false);
  useEffect(() => { doneRef.current = done; }, [done]);
  useEffect(() => {
    if (!active) { setIdx(0); setComplete(false); return; }
    let i = 0;
    setIdx(0);
    setComplete(false);
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (i < stages.length - 1) {
        i++;
        setIdx(i);
        timer = setTimeout(tick, doneRef.current ? FAST_MS : NORMAL_MS);
      } else {
        // At 80 — wait for backend done, then show complete
        const waitDone = () => {
          if (doneRef.current) { setComplete(true); }
          else { timer = setTimeout(waitDone, 150); }
        };
        timer = setTimeout(waitDone, doneRef.current ? FAST_MS : 150);
      }
    };
    timer = setTimeout(tick, NORMAL_MS);
    return () => clearTimeout(timer);
  }, [active]);
  const pct = complete ? 100 : stages[idx];
  return { percent: pct, label: complete ? "Complete" : `${pct}%`, complete };
}

type AnySession = any;

type UiStep = "LANDING" | "RESUME" | "WORK_PREFERENCES" | "PROMPT" | "PROCESSING" | "TITLES";
// Helper: returns true if session has results available
function hasResults(session: any): boolean {
  return Boolean(session?.result) || (String(session?.state) === "PATTERN_SYNTHESIS" && Boolean(session?.patternSummary));
}
// Returns UI step based on backend state and session
function getStepFromState(state: unknown, session?: any): UiStep {
  const s = String(state ?? "");
  if (hasResults(session)) return "TITLES";
  if (s === "WORK_PREFERENCES") return "WORK_PREFERENCES";
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
    // Signed-in users go straight to saved jobs — no re-calibration needed
    const { data: authSession, status: authStatus } = useSession();
    const router = useRouter();
    useEffect(() => {
      if (authStatus === "authenticated" && authSession?.user) {
        router.replace("/pipeline");
      }
    }, [authStatus, authSession, router]);

    // For TITLES step: track which title row was copied
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
    const [whyFitsOpen, setWhyFitsOpen] = useState(false);
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
  const [signalPrefBusy, setSignalPrefBusy] = useState(false);
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
  const [promptTransitioning, setPromptTransitioning] = useState(false);
  const submitLockRef = useRef(false);
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
      // After resume upload, backend advances to WORK_PREFERENCES state
      if (String(s?.state) === "WORK_PREFERENCES") {
        setStep("WORK_PREFERENCES");
      } else {
        const n = getPromptIndexFromState(s?.state);
        if (n) setStep("PROMPT");
        else setStep("PROCESSING");
      }
    } catch (e: any) {
      setError(displayError(e));
      // Do NOT clear selectedFile; user can retry or pick another file
    } finally {
      setBusy(false); setResumeUploading(false);
    }
  }
  async function submitAnswer() {
    if (submitLockRef.current) return;
    const sessionId = String(session?.sessionId ?? "");
    if (!sessionId) { setError("Missing sessionId (session not created)."); return; }
    if (!hasAnswer) return;
    submitLockRef.current = true;
    setError(null); setBusy(true); setPromptTransitioning(true);
    try {
      const inClarifier = String(session?.state ?? "").endsWith("_CLARIFIER");
      const eventType = inClarifier ? "SUBMIT_PROMPT_CLARIFIER_ANSWER" : "SUBMIT_PROMPT_ANSWER";
      const s = await postEvent({ type: eventType, sessionId, answer: answerText.trim() });
      setAnswerText("");
      setSession(s);
      setStep(getStepFromState(s?.state, s));
      // Brief hold so new typewriter starts before we un-freeze
      await new Promise(r => setTimeout(r, 80));
    } catch (e: any) { setError(displayError(e)); }
    finally { setBusy(false); setPromptTransitioning(false); submitLockRef.current = false; }
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
  async function setSignalPreference(include: boolean) {
    const sessionId = String(session?.sessionId ?? "");
    if (!sessionId) return;
    setSignalPrefBusy(true);
    try {
      const s = await postEvent({ type: "SET_SIGNAL_PREFERENCE", sessionId, includeDetectedSignals: include } as any);
      setSession(s);
    } catch (_) { /* non-blocking — preference is best-effort */ }
    finally { setSignalPrefBusy(false); }
  }
  // Work preference chips state
  const WORK_MODE_OPTIONS: Array<{ id: string; label: string; desc: string }> = [
    { id: "builder_systems", label: "Building & Systems", desc: "Creating products, tools, infrastructure" },
    { id: "sales_execution", label: "Sales & Partnerships", desc: "Revenue, deals, client relationships" },
    { id: "operational_execution", label: "Operations & Execution", desc: "Process, logistics, getting things done" },
    { id: "analytical_investigative", label: "Analysis & Research", desc: "Data, investigation, strategy" },
    { id: "creative_ideation", label: "Creative & Ideation", desc: "Design, content, innovation" },
  ];
  const [selectedPreferred, setSelectedPreferred] = useState<string[]>([]);
  const [selectedAvoided, setSelectedAvoided] = useState<string[]>([]);
  const [chipIndex, setChipIndex] = useState(0);
  const chipsDone = chipIndex >= WORK_MODE_OPTIONS.length;

  function advanceChip() {
    setChipIndex(prev => prev + 1);
  }

  function togglePreferred(id: string) {
    setSelectedPreferred(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    setSelectedAvoided(prev => prev.filter(x => x !== id));
    advanceChip();
  }
  function toggleAvoided(id: string) {
    setSelectedAvoided(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    setSelectedPreferred(prev => prev.filter(x => x !== id));
    advanceChip();
  }
  function skipChip() {
    advanceChip();
  }

  // Auto-submit preferences when all chips have been reviewed
  const chipsAutoSubmitted = useRef(false);
  useEffect(() => {
    if (chipsDone && !chipsAutoSubmitted.current && !busy) {
      chipsAutoSubmitted.current = true;
      submitWorkPreferences();
    }
  }, [chipsDone]);

  async function submitWorkPreferences() {
    const sessionId = String(session?.sessionId ?? "");
    if (!sessionId) { setError("Missing sessionId."); return; }
    setError(null); setBusy(true);
    try {
      const prefs: any = {};
      if (selectedPreferred.length > 0) prefs.preferredModes = selectedPreferred;
      if (selectedAvoided.length > 0) prefs.avoidedModes = selectedAvoided;
      const s = await postEvent({ type: "SET_WORK_PREFERENCES", sessionId, workPreferences: prefs } as any);
      setSession(s);
      setStep(getStepFromState(s?.state, s));
    } catch (e: any) { setError(displayError(e)); }
    finally { setBusy(false); }
  }

  async function skipWorkPreferences() {
    const sessionId = String(session?.sessionId ?? "");
    if (!sessionId) { setError("Missing sessionId."); return; }
    setError(null); setBusy(true);
    try {
      const s = await postEvent({ type: "ADVANCE", sessionId });
      setSession(s);
      setStep(getStepFromState(s?.state, s));
    } catch (e: any) { setError(displayError(e)); }
    finally { setBusy(false); }
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
          setError(`Analysis did not reach results (state: ${String(s?.state)}).`);
        }
      } catch (e: any) {
        setError(displayError(e));
      } finally { setJobBusy(false); }
    }
  const canContinueResume = !!selectedFile && !busy;
  const [processingAttempts, setProcessingAttempts] = useState(0);
  const inFlightRef = useRef(false);
  const computeFiredRef = useRef(false);
  // Staged progress: deferred transition support
  const [backendDone, setBackendDone] = useState(false);
  const deferredStepRef = useRef<UiStep | null>(null);
  const staged = useStagedProgress(step === "PROCESSING", backendDone);
  // Typewriter hooks — CALIBER at half speed, tagline chains after CALIBER finishes
  const tagline = "Career Decision Engine";
  const [caliberTyped, caliberDone] = useTypewriter(step === "LANDING" ? "Caliber" : "", 285);
  const [taglineAllWords, taglineRevealCount, taglineDone] = useWordReveal(step === "LANDING" ? tagline : "", TYPE_MS, caliberDone);
  const [resumeSubtext, resumeDone] = useTypewriter(step === "RESUME" ? "Your experience holds the pattern." : "");
  const [chipHeading, chipHeadingDone] = useTypewriter(step === "WORK_PREFERENCES" ? "What kind of work do you want more of?" : "");
  const inClarifierState = String(session?.state ?? "").endsWith("_CLARIFIER");
  const clarifierQuestion = promptIndex ? (session as any)?.prompts?.[promptIndex]?.clarifier?.question : null;
  const [promptText, promptDone] = useTypewriter(
    step === "PROMPT" && (promptIndex === 1 || promptIndex === 2 || promptIndex === 3 || promptIndex === 4 || promptIndex === 5)
      ? (inClarifierState && clarifierQuestion ? clarifierQuestion : CALIBRATION_PROMPTS[promptIndex as 1 | 2 | 3 | 4 | 5])
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

  // Helper: defer step transition through staged progress when leaving PROCESSING
  const deferOrSetStep = (newStep: UiStep) => {
    if (newStep !== "PROCESSING") {
      setBackendDone(true);
      deferredStepRef.current = newStep;
    }
  };

  // Auto-advance for PROCESSING (use returned session, not stale state)
  useEffect(() => {
    if (step !== "PROCESSING") {
      setProcessingAttempts(0);
      computeFiredRef.current = false; // reset for next session / re-entry
      setBackendDone(false);
      deferredStepRef.current = null;
      return;
    }
    if (backendDone) return; // stop polling once backend is done — staged progress takes over
    let attempts = 0;
    let stopped = false;
    const interval = setInterval(async () => {
      if (inFlightRef.current) return;
      // SGD gate: pause polling when detected signals await user choice
      const _ds = (session as any)?.detectedSignals;
      const _idc = (session as any)?.includeDetectedSignals;
      if (Array.isArray(_ds) && _ds.length > 0 && _idc == null) {
        console.debug("[SGD-GATE] Detected signals awaiting user choice — polling paused");
        return;
      }
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
        deferOrSetStep("TITLES");
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
                deferOrSetStep("TITLES");
              } else {
                // Compute returned but no results yet — let next tick re-evaluate via ADVANCE
                const next = getStepFromState(updated?.state, updated);
                if (next !== "PROCESSING") deferOrSetStep(next);
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
        deferOrSetStep("TITLES");
        inFlightRef.current = false;
        return;
      }
      if (sState.startsWith("JOB_INGEST")) {
        stopped = true;
        clearInterval(interval);
        deferOrSetStep("TITLES");
        inFlightRef.current = false;
        return;
      }
      if (attempts > 90) {
        stopped = true;
        clearInterval(interval);
        setError("Processing appears stuck. Please retry.");
        inFlightRef.current = false;
        return;
      }
      try {
        const sessionId = String(session?.sessionId ?? "");
        if (!sessionId) { inFlightRef.current = false; return; }
        const s = await postEvent({ type: "ADVANCE", sessionId });
        setSession(s);
        const next = getStepFromState(s?.state, s);
        if (next !== "PROCESSING") deferOrSetStep(next);
      } catch (err: any) {
        // If error is JOB_REQUIRED, route to JOB_TEXT
        if (err?.message?.includes("JOB_REQUIRED") || err?.code === "JOB_REQUIRED") {
          deferOrSetStep("TITLES");
        } else {
          setError(displayError(err));
        }
      } finally {
        inFlightRef.current = false;
      }
    }, 700);
    return () => clearInterval(interval);
  }, [step, session, backendDone]);

  // Transition out of PROCESSING after staged progress completes
  useEffect(() => {
    if (!staged.complete || !deferredStepRef.current) return;
    const t = setTimeout(() => {
      const target = deferredStepRef.current;
      deferredStepRef.current = null;
      setBackendDone(false);
      if (target) setStep(target);
    }, 600); // brief pause on "Complete" before transition
    return () => clearTimeout(t);
  }, [staged.complete]);

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
    <div className="fixed inset-0 flex flex-col items-center overflow-y-auto" style={{ background: '#050805', scrollbarGutter: 'stable' }}>
      {/* Subtle ambient glow */}
      <div
        className="pointer-events-none fixed inset-x-0 top-0"
        style={{
          height: "50vh",
          background: "radial-gradient(ellipse 100% 70% at 50% -20%, rgba(74,222,128,0.045) 0%, rgba(74,222,128,0.015) 40%, transparent 70%)",
          zIndex: 0,
        }}
      />
      {/* Layout rule: flex-col + items-center on outer = horizontal centering.
         LANDING and RESUME use my-auto to vertically center within the viewport.
         Content-heavy steps use fixed top padding.
         No-header pages (TITLES) use pt-[10vh] — enough for ambient glow, no dead space. */}
      <div className={`relative z-10 w-full max-w-[760px] px-4 sm:px-6 pb-16 ${step === "TITLES" ? "pt-[3vh] sm:pt-[5vh]" : "my-auto"}`}>
        <style>{`
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          @keyframes cb-title-enter { 0% { opacity: 0; transform: translateY(8px); } 100% { opacity: 1; transform: translateY(0); } }
          @keyframes cb-fade-up { 0% { opacity: 0; transform: translateY(12px); } 100% { opacity: 1; transform: translateY(0); } }
          .cb-title-card:hover { border-color: rgba(255,255,255,0.14) !important; background-color: rgba(255,255,255,0.06) !important; }
          .cb-dropzone { transition: border-color 0.2s, background-color 0.2s, box-shadow 0.2s; }
          .cb-dropzone:hover { border-color: rgba(74,222,128,0.50) !important; background-color: rgba(255,255,255,0.02) !important; box-shadow: 0 0 0 1px rgba(74,222,128,0.18), 0 0 20px rgba(74,222,128,0.06) !important; }
          .cb-textarea:focus { border-color: rgba(74,222,128,0.55) !important; box-shadow: 0 0 0 1.5px rgba(74,222,128,0.22), 0 0 24px rgba(74,222,128,0.08) !important; }
          .cb-textarea::placeholder { color: rgba(161,161,170,0.65); }
        `}</style>
        {/* Hero content */}
        <div className="relative" style={{ color: "#F2F2F2" }}>
          <div className="w-full flex flex-col items-center text-center">
            {/* Zone 1 — Brand / Status field */}
            <div style={{ minHeight: step === "TITLES" ? "auto" : "5.5em", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              {step !== "TITLES" && step !== "WORK_PREFERENCES" ? (
                <CaliberHeader typedText={step === "LANDING" ? caliberTyped : undefined} showCursor={step === "LANDING"} />
              ) : null}
              {/* Fixed-height error area */}
              <div style={{ minHeight: step === "TITLES" ? "0.5em" : "2.2em" }}>
                {error ? (
                  <div className="mt-2 text-sm rounded-md px-3 py-2" style={{ background: "#2A0F0F", color: "#FFD1D1" }}>
                    {error}
                  </div>
                ) : null}
              </div>
            </div>


            {/* Shared hero content zone for LANDING and RESUME. */}
            {(step === "LANDING" || step === "RESUME") ? (
              <div className="w-full flex flex-col items-center" style={{ minHeight: "400px" }}>

            {/* LANDING */}
            {step === "LANDING" ? (
              <div className="w-full" style={{ maxWidth: 640 }}>
                <div style={{ minHeight: "3em" }} className="mt-8">
                  <p className="cb-headline">{step === "LANDING" ? taglineAllWords.map((w, i) => <span key={i} className={i < taglineRevealCount ? 'cb-word-reveal' : ''} style={{ opacity: i < taglineRevealCount ? undefined : 0 }}>{w}{i < taglineAllWords.length - 1 ? ' ' : ''}</span>) : tagline}</p>
                </div>
                <div className="mt-8" style={{ opacity: taglineDone ? 1 : 0, pointerEvents: taglineDone ? "auto" : "none", transition: "opacity 0.5s ease 400ms" }}>
                  <button
                    type="button"
                    onClick={begin}
                    disabled={busy}
                    className="inline-flex items-center justify-center rounded-md transition-all duration-200 focus:outline-none"
                    style={{
                      fontSize: '15px',
                      fontWeight: 600,
                      padding: '14px 28px',
                      backgroundColor: busy ? "rgba(58,180,100,0.10)" : "rgba(74,222,128,0.10)",
                      color: busy ? "rgba(74,222,128,0.45)" : "#4ADE80",
                      border: busy ? "1px solid rgba(74,222,128,0.28)" : "1px solid rgba(74,222,128,0.55)",
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
              <div className="w-full max-w-[620px]">
                <div style={{ minHeight: "3em" }} className="mt-8">
                  <div className="cb-headline">{resumeSubtext}</div>
                </div>
                <div className="mt-6 flex justify-center">
                  <div className="w-full" style={{ maxWidth: 420 }}>
                    <div
                      className="rounded-md transition-opacity cb-dropzone"
                      style={{
                        border: "1px dashed rgba(255,255,255,0.14)",
                        backgroundColor: selectedFile ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.025)",
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
                              backgroundColor: "rgba(255,255,255,0.10)",
                              color: "#F2F2F2",
                              border: "1px solid rgba(255,255,255,0.18)",
                              cursor: busy ? "not-allowed" : "pointer",
                            }}
                          >
                            Choose file
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                          <span className="text-sm sm:text-base font-medium">{selectedFile.name}</span>
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
                      {!selectedFile && <span className="absolute bottom-2 left-0 right-0 text-center text-[10px]" style={{ color: "#CFCFCF" }}>PDF, DOCX, or TXT</span>}
                    </div>
                  </div>
                </div>
                <div className="mt-5 flex justify-center" style={{ opacity: selectedFile ? 1 : 0, pointerEvents: selectedFile ? "auto" : "none", transition: "opacity 0.4s ease" }}>
                  <button
                    type="button"
                    onClick={submitResume}
                    disabled={!canContinueResume}
                    className="inline-flex items-center justify-center rounded-md px-6 py-3 text-sm sm:text-base font-semibold transition-all ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2"
                    style={{
                      transitionDuration: "200ms",
                      backgroundColor: canContinueResume ? "rgba(74,222,128,0.10)" : "rgba(74,222,128,0.05)",
                      color: canContinueResume ? "#4ADE80" : "rgba(74,222,128,0.45)",
                      border: canContinueResume ? "1px solid rgba(74,222,128,0.55)" : "1px solid rgba(74,222,128,0.28)",
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

              </div>
            ) : null}

            {/* WORK_PREFERENCES */}
            {step === "WORK_PREFERENCES" ? (
              <div className="w-full max-w-[620px]" style={{ minHeight: "420px" }}>
                <div className="mt-8 cb-headline text-center">
                  {chipHeading}<span className="cb-blink" style={{ opacity: chipHeadingDone ? 0 : 1 }}>|</span>
                </div>

                <div className="mt-8 overflow-hidden" style={{ opacity: chipHeadingDone ? 1 : 0, pointerEvents: chipHeadingDone ? "auto" : "none", transition: "opacity 0.5s ease", minHeight: "150px" }}>
                  {!chipsDone && (() => {
                    const mode = WORK_MODE_OPTIONS[chipIndex];
                    if (!mode) return null;
                    const isPreferred = selectedPreferred.includes(mode.id);
                    const isAvoided = selectedAvoided.includes(mode.id);
                    return (
                      <div
                        key={mode.id}
                        className="rounded-xl px-6 py-6 select-none cb-chip-enter"
                        style={{
                          backgroundColor: isPreferred ? "rgba(74,222,128,0.09)" : isAvoided ? "rgba(239,68,68,0.07)" : "rgba(255,255,255,0.05)",
                          border: isPreferred ? "1.5px solid rgba(74,222,128,0.45)" : isAvoided ? "1.5px solid rgba(239,68,68,0.38)" : "1.5px solid rgba(255,255,255,0.16)",
                          boxShadow: "0 2px 16px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.04) inset",
                        }}
                      >
                        <div className="text-center mb-4">
                          <span className="text-base font-semibold" style={{ color: "rgba(237,237,237,0.9)" }}>{mode.label}</span>
                          <p className="text-sm mt-1" style={{ color: "rgba(161,161,170,0.60)" }}>{mode.desc}</p>
                        </div>
                        <div className="flex items-center justify-center gap-4">
                          <button
                            type="button"
                            onClick={() => togglePreferred(mode.id)}
                            title="Want more"
                            className="rounded-lg w-14 h-14 text-2xl font-bold transition-colors flex items-center justify-center"
                            style={{
                              backgroundColor: isPreferred ? "rgba(74,222,128,0.18)" : "rgba(255,255,255,0.10)",
                              color: isPreferred ? "#4ADE80" : "rgba(200,200,210,0.7)",
                              border: isPreferred ? "2px solid rgba(74,222,128,0.5)" : "2px solid rgba(255,255,255,0.22)",
                            }}
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() => skipChip()}
                            title="Neutral"
                            className="rounded-lg px-4 h-10 text-xs transition-colors flex items-center justify-center"
                            style={{
                              backgroundColor: "transparent",
                              color: "rgba(161,161,170,0.65)",
                              border: "1px solid rgba(255,255,255,0.14)",
                            }}
                          >
                            Skip
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleAvoided(mode.id)}
                            title="Want less"
                            className="rounded-lg w-14 h-14 text-2xl font-bold transition-colors flex items-center justify-center"
                            style={{
                              backgroundColor: isAvoided ? "rgba(239,68,68,0.18)" : "rgba(255,255,255,0.10)",
                              color: isAvoided ? "#EF4444" : "rgba(200,200,210,0.7)",
                              border: isAvoided ? "2px solid rgba(239,68,68,0.45)" : "2px solid rgba(255,255,255,0.22)",
                            }}
                          >
                            &minus;
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Progress dots */}
                  {!chipsDone && (
                    <div className="flex items-center justify-center gap-2 mt-4">
                      {WORK_MODE_OPTIONS.map((_, i) => (
                        <div
                          key={i}
                          className="rounded-full"
                          style={{
                            width: 7, height: 7,
                            backgroundColor: i < chipIndex ? "rgba(74,222,128,0.5)"
                              : i === chipIndex ? "rgba(237,237,237,0.6)"
                              : "rgba(255,255,255,0.12)",
                            transition: "background-color 0.3s",
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {chipsDone && (
                  <div className="mt-8 flex items-center justify-center" style={{ animation: "fadeIn 0.4s ease" }}>
                    <Spinner /><span className="ml-2" style={{ color: "rgba(161,161,170,0.6)" }}>Saving…</span>
                  </div>
                )}
              </div>
            ) : null}

            {/* PROMPT */}
            {step === "PROMPT" ? (
              <div className="w-full max-w-2xl" style={{ minHeight: "420px" }}>
                {/* Prompt question container — anchored top so second lines extend downward */}
                <div style={{ minHeight: "3.2em" }} className="mt-8 cb-headline text-center">
                  {promptIndex == null ? (
                    <span style={{ color: "#CFCFCF", fontSize: "1.1em" }}>
                      <Spinner />
                      <span className="ml-2">Loading…</span>
                    </span>
                  ) : (
                    <span style={{ transition: "opacity 0.3s", opacity: promptTransitioning ? 0 : 1 }}>{promptText}</span>
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
                        backgroundColor: answerText.trim().length > 0 ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.08)",
                        color: "#F2F2F2",
                        border: answerText.trim().length > 0 ? "1px solid rgba(255,255,255,0.28)" : "1px solid rgba(255,255,255,0.22)",
                        boxShadow: "none",
                        fontSize: "1em",
                        marginTop: "0.5em",
                        outline: "none",
                        opacity: promptTransitioning ? 0 : 1,
                        transition: "opacity 0.15s ease, border-color 0.2s ease, background-color 0.2s ease",
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
                      backgroundColor: promptIndex == null || !hasAnswer || busy ? "rgba(74,222,128,0.05)" : "rgba(74,222,128,0.10)",
                      color: promptIndex == null || !hasAnswer || busy ? "rgba(74,222,128,0.45)" : "#4ADE80",
                      border: promptIndex == null || !hasAnswer || busy ? "1px solid rgba(74,222,128,0.28)" : "1px solid rgba(74,222,128,0.55)",
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
                  {/* Staged progress bar */}
                  <div style={{ width: "100%", maxWidth: 260, margin: "20px auto 0" }}>
                    <div style={{
                      height: 3,
                      borderRadius: 2,
                      backgroundColor: "rgba(255,255,255,0.06)",
                      overflow: "hidden",
                    }}>
                      <div style={{
                        height: "100%",
                        width: `${staged.percent}%`,
                        backgroundColor: staged.complete ? "#4ADE80" : "rgba(74,222,128,0.45)",
                        borderRadius: 2,
                        transition: "width 0.6s ease",
                      }} />
                    </div>
                    <div style={{
                      marginTop: 10,
                      fontSize: "0.85rem",
                      color: staged.complete ? "#4ADE80" : "#737373",
                      letterSpacing: "0.06em",
                      transition: "color 0.3s ease",
                    }}>
                      {staged.label}
                    </div>
                  </div>

                  {/* Detected signals choice */}
                  {(session as any)?.detectedSignals?.length > 0 ? (
                    <div style={{
                      marginTop: 28,
                      padding: "16px 20px",
                      borderRadius: 8,
                      backgroundColor: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      opacity: 1,
                      transition: "opacity 0.4s ease",
                    }}>
                      {(session as any)?.includeDetectedSignals == null ? (
                        <>
                          <div style={{ fontSize: "0.85rem", color: "#CFCFCF", marginBottom: 8, fontWeight: 500 }}>
                            Additional signals detected
                          </div>
                          <div style={{ fontSize: "0.8rem", color: "#737373", marginBottom: 12, lineHeight: 1.5 }}>
                            Your answers suggest experience not clearly expressed in your resume:
                          </div>
                          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 14px 0" }}>
                            {((session as any).detectedSignals as string[]).map((s: string) => (
                              <li key={s} style={{ fontSize: "0.8rem", color: "#A3A3A3", padding: "2px 0" }}>
                                <span style={{ color: "#4ADE80", marginRight: 6 }}>·</span>{s}
                              </li>
                            ))}
                          </ul>
                          <div style={{ fontSize: "0.78rem", color: "#737373", marginBottom: 14 }}>
                            Include these in your evaluation?
                          </div>
                          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                            <button
                              type="button"
                              disabled={signalPrefBusy}
                              onClick={() => setSignalPreference(true)}
                              style={{
                                fontSize: "0.8rem",
                                padding: "6px 14px",
                                borderRadius: 6,
                                border: "1px solid rgba(74,222,128,0.4)",
                                backgroundColor: "transparent",
                                color: "#4ADE80",
                                cursor: signalPrefBusy ? "not-allowed" : "pointer",
                                opacity: signalPrefBusy ? 0.5 : 1,
                              }}
                            >
                              Yes, include them
                            </button>
                            <button
                              type="button"
                              disabled={signalPrefBusy}
                              onClick={() => setSignalPreference(false)}
                              style={{
                                fontSize: "0.8rem",
                                padding: "6px 14px",
                                borderRadius: 6,
                                border: "1px solid rgba(255,255,255,0.10)",
                                backgroundColor: "transparent",
                                color: "#737373",
                                cursor: signalPrefBusy ? "not-allowed" : "pointer",
                                opacity: signalPrefBusy ? 0.5 : 1,
                              }}
                            >
                              No, use resume only
                            </button>
                          </div>
                        </>
                      ) : (
                        <div style={{ fontSize: "0.82rem", color: (session as any).includeDetectedSignals ? "#4ADE80" : "#737373" }}>
                          {(session as any).includeDetectedSignals
                            ? "✓ Additional signals included in evaluation"
                            : "Evaluation will use resume signals only"}
                        </div>
                      )}
                    </div>
                  ) : null}

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
            {!["LANDING","RESUME","WORK_PREFERENCES","PROMPT","PROCESSING","TITLES"].includes(step) ? (
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

              // All titles sorted by score for hero + adjacent extraction
              const allTitlesSorted = (enrichedTitles.length > 0
                ? enrichedTitles
                : recTitles.length > 0
                  ? recTitles
                  : fallbackCandidates.map(c => ({ title: c.title, fit_0_to_10: c.score }))
              ).sort((a, b) => (b.fit_0_to_10 ?? 0) - (a.fit_0_to_10 ?? 0));

              const heroTitle = allTitlesSorted[0] ?? null;
              const adjacentTitles = allTitlesSorted.slice(1, 3).filter(t => t.title);
              const heroBullets: string[] = heroTitle && Array.isArray((heroTitle as any).bullets_3) ? (heroTitle as any).bullets_3.filter((b: string) => b && b.trim()) : [];
              const heroSummary: string = heroTitle && typeof (heroTitle as any).summary_2s === "string" ? (heroTitle as any).summary_2s.trim() : "";
              const heroHasWhyContent = heroBullets.length > 0 || heroSummary.length > 0;
              // Visible justification: use bullets if available, otherwise split summary into lines
              const visibleReasons: string[] = heroBullets.length > 0
                ? heroBullets.slice(0, 3)
                : heroSummary
                  ? heroSummary.split(/\.\s+/).filter(s => s.trim()).slice(0, 2).map(s => s.replace(/\.$/, '').trim())
                  : [];

              return (
              <div className="w-full max-w-3xl pb-8">
                {/* Conclusive framing */}
                <div className="mt-2 flex flex-col items-center text-center mx-auto" style={{ maxWidth: 560 }}>
                  <div className="flex items-center gap-2 mb-3">
                    <span style={{ color: "#3AB464", fontSize: "0.85rem" }}>{"\u2713"}</span>
                    <span className="text-xs font-medium uppercase tracking-widest" style={{ color: "#666" }}>Calibration complete</span>
                  </div>
                  <p className="text-sm sm:text-base leading-relaxed" style={{ color: "rgba(237,237,237,0.78)", fontWeight: 400 }}>Based on your experience, you align most strongly with:</p>
                  {archetypeLabel ? (
                    <span className="text-[11px] font-medium uppercase tracking-widest mt-2" style={{ color: "#555" }}>{archetypeLabel}</span>
                  ) : null}
                </div>

                {/* Fallback: no title available */}
                {!heroTitle ? (
                  <div className="mt-10 mb-4 rounded-lg px-5 py-4 text-center text-sm" style={{ backgroundColor: "rgba(255,255,255,0.025)", color: "#AFAFAF", border: "1px solid rgba(255,255,255,0.05)" }}>
                    Your title recommendation is still being generated.
                  </div>
                ) : null}

                {/* Hero title card — the payoff moment */}
                {heroTitle ? (
                  <div
                    className="cb-title-card rounded-2xl"
                    style={{
                      marginTop: 32,
                      animation: "cb-title-enter 0.35s ease-out 0.15s both",
                      backgroundColor: "rgba(255,255,255,0.025)",
                      border: "1px solid rgba(74,222,128,0.25)",
                    }}
                  >
                    <div className="px-6 py-8 sm:px-8 sm:py-10 flex flex-col items-center text-center">
                      {/* Title — primary payoff */}
                      <div className="text-[1.5rem] sm:text-[2rem] font-semibold" style={{ color: "#F2F2F2", lineHeight: 1.1, letterSpacing: "-0.01em" }}>{heroTitle.title}</div>

                      {/* Adjacent roles — subtle secondary context */}
                      {adjacentTitles.length > 0 ? (
                        <p className="mt-3 text-[13px]" style={{ color: "#666" }}>
                          Also nearby: {adjacentTitles.map(t => t.title).join(", ")}
                        </p>
                      ) : null}

                      {/* Visible justification — why this fits, surfaced above the fold */}
                      {visibleReasons.length > 0 ? (
                        <div className="mt-6 w-full" style={{ maxWidth: 440 }}>
                          <ul className="space-y-2 text-left">
                            {visibleReasons.map((reason, i) => (
                              <li key={i} className="flex items-start gap-2.5 text-[13px] leading-relaxed" style={{ color: "#a3a3a3" }}>
                                <span className="mt-[6px] shrink-0 h-[5px] w-[5px] rounded-full" style={{ background: "rgba(74,222,128,0.5)" }} />
                                <span>{reason}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {/* Bridge to next step */}
                      <p className="mt-6 text-sm" style={{ color: "#888" }}>We&rsquo;ll use this to score real jobs as you browse LinkedIn.</p>

                      {/* Primary CTA — Extension download */}
                      <div className="mt-5 w-full">
                        <ExtensionInstallBlock calibratedTitle={heroTitle?.title ?? null} hideLinkedIn />
                      </div>

                      {/* Supporting CTA copy */}
                      <p className="mt-2 text-[12px] leading-relaxed" style={{ color: "#666", maxWidth: 360 }}>See which jobs actually match this profile — Caliber scores every listing you open.</p>

                      {/* Secondary CTA — LinkedIn search */}
                      <div className="mt-5">
                        <a
                          href={`https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(heroTitle.title)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg px-6 py-2.5 text-sm font-medium transition-all duration-150 hover:brightness-110"
                          style={{ background: "rgba(250,204,21,0.06)", color: "#FBBF24", border: "1px solid rgba(250,204,21,0.35)", textDecoration: "none" }}
                        >Search on LinkedIn</a>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Expanded detail — de-emphasized, secondary */}
                {heroTitle && heroHasWhyContent ? (
                  <div
                    className="mt-6 w-full max-w-[480px] mx-auto rounded-lg transition-all duration-200"
                    style={{
                      backgroundColor: whyFitsOpen ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.015)",
                      border: whyFitsOpen ? "1px solid rgba(255,255,255,0.10)" : "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setWhyFitsOpen(!whyFitsOpen)}
                      className="w-full flex items-center justify-center gap-2 px-5 py-3 cursor-pointer select-none"
                      style={{ background: "none", border: "none" }}
                    >
                      <span className="text-[13px] font-medium" style={{ color: "#666" }}>How we scored this</span>
                      <span className="text-[11px]" style={{ color: "#555" }}>{whyFitsOpen ? "\u25B4" : "\u25BE"}</span>
                    </button>
                    {whyFitsOpen ? (
                      <div className="px-5 pb-4">
                        <div className="border-t pt-3" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                          <p className="text-[13px] leading-relaxed mb-3" style={{ color: "#737373", textAlign: "left" }}>
                            Caliber scores pattern fit, not keyword overlap. We look at the shape of your experience — how your skills, context, and trajectory align with what a role actually demands.
                          </p>
                          {heroBullets.length > 0 ? (
                            <ul className="text-[13px] leading-relaxed pl-4 space-y-1.5" style={{ color: "#a3a3a3", listStyleType: "none", textAlign: "left" }}>
                              {heroBullets.map((b: string, i: number) => (
                                <li key={i} className="flex items-start gap-2">
                                  <span className="mt-[5px] shrink-0 h-[5px] w-[5px] rounded-full" style={{ background: "rgba(74,222,128,0.45)" }} />
                                  <span>{b}</span>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                          {heroSummary && heroBullets.length === 0 ? (
                            <p className="text-[13px] leading-relaxed" style={{ color: "#888", textAlign: "left" }}>{heroSummary}</p>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {/* Signals influencing this calibration */}
                {(session as any)?.includeDetectedSignals === true && Array.isArray((session as any)?.detectedSignals) && (session as any).detectedSignals.length > 0 ? (
                  <div className="mt-3 flex justify-center">
                    <p className="text-[11px] leading-relaxed" style={{ color: "rgba(74,222,128,0.5)" }}>
                      <span style={{ fontWeight: 500 }}>Signals influencing this calibration:</span>{" "}
                      {(session as any).detectedSignals.join(" · ")}
                    </p>
                  </div>
                ) : null}

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