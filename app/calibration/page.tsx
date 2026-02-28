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

type UiStep = "LANDING" | "RESUME" | "PROMPT" | "PROCESSING" | "RESULTS";

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
      if (n) setStep("PROMPT");
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
      if (n) {
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
      if (n) {
        setStep("PROMPT");
      } else if (String(s?.state) === "PATTERN_SYNTHESIS" && s?.synthesis?.patternSummary) {
        setStep("RESULTS");
      } else if (String(s?.state) === "JOB_INGEST") {
        setError(null);
        setStep("JOB_TEXT");
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
        if (n !== null || String(s?.state).startsWith("TITLE_")) {
          if (getStepFromState(s?.state) === "JOB_TEXT") {
            setError(null);
          }
          setStep(getStepFromState(s?.state));
        } else if (String(s?.state) === "JOB_INGEST") {
          setError(null);
          setStep("JOB_TEXT");
          clearInterval(interval);
          return;
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

  // Submit job text using correct contract
  async function submitJobText() {
    setError(null);
    const sessionId = String(session?.sessionId ?? "");
    if (!sessionId) {
      setError("Missing sessionId (session not created).");
      return;
    }
    if (!jobText.trim()) return;

    setJobBusy(true);
    try {
      const s = await postEvent({
        type: "JOB_PARSED",
        sessionId,
        payload: jobText.trim(), // must be a string
      });
      setSession(s);
      setJobText("");
      // Route based on returned state
      const n = getPromptIndexFromState(s?.state);
      if (n !== null) {
        setError(null);
        setStep("PROMPT");
      } else if (String(s?.state) === "PATTERN_SYNTHESIS" && s?.synthesis?.patternSummary) {
        setError(null);
        setStep("RESULTS");
      } else if (String(s?.state) === "PROCESSING") {
        setError(null);
        setStep("PROCESSING");
        // Auto-advance will re-enable
      } else {
        setError(null);
        setStep("PROCESSING");
      }
    } catch (e: any) {
      // JOB_REQUIRED: stay on JOB_TEXT, do not show error
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
      setJobBusy(false);
    }
  }

  // Ritual progress helpers
  const ritualProgress = session?.consolidationRitual?.progressPct;
  const ritualMessage = session?.consolidationRitual?.message ?? session?.encodingRitual?.message ?? "";
  const encodingCompleted = session?.encodingRitual?.completed;

  return (
    <div className="fixed inset-0 bg-[#0B0B0B] flex justify-center items-center overflow-hidden">
      <div
        className="w-full max-w-[760px] px-6"
        style={{ height: 520, display: "grid", gridTemplateRows: `${88}px ${120}px ${220 + 64}px` }}
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
          {step === "TITLES" && <div className="mt-2 text-lg sm:text-xl font-medium leading-snug tracking-tight flex items-center justify-center"><span style={{ color: "#CFCFCF" }}>{title}</span></div>}
          {step === "JOB_TEXT" && <div className="text-lg sm:text-xl font-medium leading-snug tracking-tight flex items-center justify-center"><span>Paste the job description.</span></div>}
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
        <div style={{ height: 284, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}>
          <div style={{ height: 220, width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
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
                <div className="rounded-md" style={{ border: "1px dashed rgba(242,242,242,0.28)", backgroundColor: selectedFile ? "#121212" : "#0F0F0F", height: 110 }}>
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
                      </>
                    )}
                  </div>
                </div>
                <div className="mt-2 text-xs" style={{ color: "#CFCFCF" }}>PDF, DOCX, or TXT</div>
              </div>
            )}
            {step === "PROMPT" && (
              <textarea value={answerText} onChange={(e) => setAnswerText(e.target.value)} rows={7} className="w-full rounded-md px-4 py-3 text-sm sm:text-base focus:outline-none transition-colors duration-200" style={{ backgroundColor: "#141414", color: "#F2F2F2", border: "1px solid rgba(242,242,242,0.14)", boxShadow: "none" }} placeholder="Type your response here…" />
            )}
            {step === "TITLES" && (
              <input type="text" value={titleFeedback} onChange={(e) => setTitleFeedback(e.target.value)} className="w-full rounded-md px-4 py-3 text-sm sm:text-base focus:outline-none transition-colors duration-200" style={{ backgroundColor: "#141414", color: "#F2F2F2", border: "1px solid rgba(242,242,242,0.14)", boxShadow: "none" }} placeholder="Type your feedback…" disabled={titleBusy} />
            )}
            {step === "JOB_TEXT" && (
              <textarea value={jobText} onChange={(e) => setJobText(e.target.value)} rows={8} className="w-full rounded-md px-4 py-3 text-sm sm:text-base focus:outline-none transition-colors duration-200" style={{ backgroundColor: "#141414", color: "#F2F2F2", border: "1px solid rgba(242,242,242,0.14)", boxShadow: "none", fontSize: "1em" }} placeholder="Paste job description here…" disabled={jobBusy} />
            )}
          </div>
          <div style={{ height: 64, width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {step === "LANDING" && (
              <button type="button" onClick={begin} disabled={busy} className="inline-flex items-center justify-center rounded-md px-5 py-3 text-sm sm:text-base font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2" style={{ backgroundColor: busy ? "rgba(242,242,242,0.35)" : "#F2F2F2", color: "#0B0B0B", cursor: busy ? "not-allowed" : "pointer" }}>Begin Calibration</button>
            )}
            {step === "RESUME" && (
              <button type="button" onClick={submitResume} disabled={!canContinueResume} className="inline-flex items-center justify-center rounded-md px-5 py-3 text-sm sm:text-base font-medium transition-all ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2" style={{ transitionDuration: "200ms", backgroundColor: canContinueResume ? "#F2F2F2" : "rgba(242,242,242,0.35)", color: "#0B0B0B", cursor: canContinueResume ? "pointer" : "not-allowed", boxShadow: canContinueResume ? "0 8px 20px rgba(0,0,0,0.25)" : "none", transform: canContinueResume ? "translateY(-1px)" : "translateY(0px)", minWidth: 140 }}>Continue</button>
            )}
            {step === "PROMPT" && (
              <button type="button" onClick={submitAnswer} disabled={!hasAnswer || busy} className="inline-flex items-center justify-center rounded-md px-5 py-3 text-sm sm:text-base font-medium transition-all ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2" style={{ transitionDuration: "200ms", backgroundColor: !hasAnswer || busy ? "rgba(242,242,242,0.70)" : "#F2F2F2", color: "#0B0B0B", cursor: !hasAnswer || busy ? "not-allowed" : "pointer", boxShadow: !hasAnswer || busy ? "0 0 0 rgba(0,0,0,0)" : "0 8px 20px rgba(0,0,0,0.35)", transform: !hasAnswer || busy ? "translateY(0px)" : "translateY(-1px)", minWidth: 120 }}>Submit</button>
            )}
            {step === "TITLES" && (
              <div style={{ display: "flex", gap: 16 }}>
                <button type="button" onClick={() => submitTitleFeedback(titleFeedback.trim())} disabled={titleBusy || !titleFeedback.trim()} className="inline-flex items-center justify-center rounded-md px-5 py-3 text-sm sm:text-base font-medium transition-all ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2" style={{ backgroundColor: titleBusy || !titleFeedback.trim() ? "rgba(242,242,242,0.70)" : "#F2F2F2", color: "#0B0B0B", cursor: titleBusy || !titleFeedback.trim() ? "not-allowed" : "pointer", minWidth: 120 }}>Continue</button>
                <button type="button" onClick={() => submitTitleFeedback("")} disabled={titleBusy} className="inline-flex items-center justify-center rounded-md px-5 py-3 text-sm sm:text-base font-medium transition-all ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2" style={{ backgroundColor: titleBusy ? "rgba(242,242,242,0.70)" : "#F2F2F2", color: "#0B0B0B", cursor: titleBusy ? "not-allowed" : "pointer", minWidth: 120 }}>Looks right</button>
              </div>
            )}
            {step === "JOB_TEXT" && (
              <button type="button" onClick={submitJobText} disabled={jobBusy || !jobText.trim()} className="inline-flex items-center justify-center rounded-md px-5 py-3 text-sm sm:text-base font-medium transition-all ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2" style={{ backgroundColor: jobBusy || !jobText.trim() ? "rgba(242,242,242,0.70)" : "#F2F2F2", color: "#0B0B0B", cursor: jobBusy || !jobText.trim() ? "not-allowed" : "pointer", minWidth: 140 }}>Continue</button>
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