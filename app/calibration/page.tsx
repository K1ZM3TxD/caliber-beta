// app/calibration/page.tsx
"use client";

import React, { useMemo, useRef, useState } from "react";
import { CALIBRATION_PROMPTS } from "@/lib/calibration_prompts";

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

  const canContinueResume = !!selectedFile && !busy;

  return (
    <div className="fixed inset-0 bg-[#0B0B0B] flex items-center justify-center overflow-hidden">
      <div className="w-full max-w-[760px] px-6">
        <div className="relative min-h-[600px]" style={{ color: "#F2F2F2" }}>
          <div className="h-full w-full flex flex-col items-center justify-center text-center">
            <div className="flex flex-col items-center">
              <div className="mt-2 font-semibold tracking-tight text-5xl sm:text-6xl">Caliber</div>
              <div className="mt-3 text-sm" style={{ color: "#CFCFCF" }}>
                {session?.state ? `state: ${session.state}` : "state: (none)"}
              </div>
              {error ? (
                <div className="mt-4 text-sm rounded-md px-3 py-2" style={{ background: "#2A0F0F", color: "#FFD1D1" }}>
                  {error}
                </div>
              ) : null}
            </div>

            {/* LANDING */}
            {step === "LANDING" ? (
              <div className="mt-10 w-full max-w-[620px]">
                <p className="text-base sm:text-lg leading-relaxed" style={{ color: "#CFCFCF" }}>
                  The alignment tool for job calibration.
                </p>

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
                    Begin Calibration
                  </button>
                </div>
              </div>
            ) : null}

            {/* RESUME */}
            {step === "RESUME" ? (
              <div className="mt-10 w-full max-w-[620px]">
                <div className="text-2xl sm:text-3xl font-semibold tracking-tight">Upload Resume</div>
                <div className="mt-3 text-base sm:text-lg leading-relaxed" style={{ color: "#CFCFCF" }}>
                  Your experience holds the pattern.
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                  className="hidden"
                  onChange={onFileChange}
                />

                <div className="mt-8 flex justify-center">
                  <div className="w-full" style={{ maxWidth: 560 }}>
                    <div
                      className="rounded-md"
                      style={{
                        border: "1px dashed rgba(242,242,242,0.28)",
                        backgroundColor: selectedFile ? "#121212" : "#0F0F0F",
                        height: 140,
                      }}
                    >
                      <div className="h-full w-full flex flex-col items-center justify-center px-6 text-center">
                        {!selectedFile ? (
                          <>
                            <div className="text-sm sm:text-base" style={{ color: "#F2F2F2" }}>
                              Drag & drop your resume here
                            </div>
                            <div className="mt-2 text-sm" style={{ color: "#CFCFCF" }}>
                              or
                            </div>
                            <div className="mt-3">
                              <button
                                type="button"
                                onClick={openFilePicker}
                                disabled={busy}
                                className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2"
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
                          </>
                        ) : (
                          <>
                            <div className="text-sm sm:text-base font-medium">{selectedFile.name}</div>
                            <div className="mt-2 text-sm" style={{ color: "#CFCFCF" }}>
                              File selected
                            </div>
                            <div className="mt-3">
                              <button
                                type="button"
                                onClick={openFilePicker}
                                disabled={busy}
                                className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2"
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
                          </>
                        )}
                      </div>
                    </div>

                    <div className="mt-2 text-xs" style={{ color: "#CFCFCF" }}>
                      PDF, DOCX, or TXT
                    </div>
                  </div>
                </div>

                <div className="mt-8">
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
                    }}
                  >
                    Continue
                  </button>
                </div>
              </div>
            ) : null}

            {/* PROMPT */}
            {step === "PROMPT" ? (
              <div className="mt-10 w-full max-w-2xl">
                <div className="text-xs sm:text-sm font-medium" style={{ color: "#CFCFCF" }}>
                  Prompt {promptIndex ?? "?"} of 5
                </div>

                <div className="mt-3 text-2xl sm:text-3xl font-semibold leading-snug tracking-tight">
                  {promptIndex ? CALIBRATION_PROMPTS[promptIndex] : "Loading prompt…"}
                </div>

                <div className="mt-7">
                  <textarea
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    rows={7}
                    className="w-full rounded-md px-4 py-3 text-sm sm:text-base focus:outline-none transition-colors duration-200"
                    style={{
                      backgroundColor: "#141414",
                      color: "#F2F2F2",
                      border: "1px solid rgba(242,242,242,0.14)",
                      boxShadow: "none",
                    }}
                    placeholder="Type your response here…"
                  />
                </div>

                <div className="mt-7">
                  <button
                    type="button"
                    onClick={submitAnswer}
                    disabled={!hasAnswer || busy}
                    className="inline-flex items-center justify-center rounded-md px-5 py-3 text-sm sm:text-base font-medium transition-all ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2"
                    style={{
                      transitionDuration: "200ms",
                      backgroundColor: !hasAnswer || busy ? "rgba(242,242,242,0.70)" : "#F2F2F2",
                      color: "#0B0B0B",
                      cursor: !hasAnswer || busy ? "not-allowed" : "pointer",
                      boxShadow: !hasAnswer || busy ? "0 0 0 rgba(0,0,0,0)" : "0 8px 20px rgba(0,0,0,0.35)",
                      transform: !hasAnswer || busy ? "translateY(0px)" : "translateY(-1px)",
                    }}
                  >
                    Submit
                  </button>
                </div>
              </div>
            ) : null}

            {/* PROCESSING */}
            {step === "PROCESSING" ? (
              <div className="mt-10 w-full max-w-[620px]">
                <div className="text-base sm:text-lg leading-relaxed" style={{ color: "#CFCFCF" }}>
                  Processing. Click advance until synthesis is ready.
                </div>

                <div className="mt-7">
                  <button
                    type="button"
                    onClick={advance}
                    disabled={busy}
                    className="inline-flex items-center justify-center rounded-md px-5 py-3 text-sm sm:text-base font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2"
                    style={{
                      backgroundColor: busy ? "rgba(242,242,242,0.35)" : "#F2F2F2",
                      color: "#0B0B0B",
                      cursor: busy ? "not-allowed" : "pointer",
                    }}
                  >
                    Advance
                  </button>
                </div>
              </div>
            ) : null}

            {/* RESULTS */}
            {step === "RESULTS" ? (
              <div className="mt-10 w-full max-w-3xl text-left">
                <div className="text-xl sm:text-2xl font-semibold tracking-tight">Pattern Summary</div>

                <div
                  className="mt-4 rounded-md px-4 py-4 whitespace-pre-wrap text-sm sm:text-base"
                  style={{ backgroundColor: "#121212", border: "1px solid rgba(242,242,242,0.14)" }}
                >
                  {String(session?.synthesis?.patternSummary ?? "—")}
                </div>

                {/* Anchor metrics block */}
                <div className="mt-8 text-left text-[14px] leading-relaxed opacity-80 space-y-2">
                  <div>
                    <span className="font-semibold">Anchor overlap: </span>
                    {typeof (session?.synthesis?.anchor_overlap_score ??
                      session?.synthesis?.anchorOverlapScore ??
                      session?.anchor_overlap_score) === "number"
                      ? (
                          session?.synthesis?.anchor_overlap_score ??
                          session?.synthesis?.anchorOverlapScore ??
                          session?.anchor_overlap_score
                        ).toFixed(2)
                      : "—"}
                  </div>

                  <div>
                    <span className="font-semibold">Missing anchors: </span>
                    {typeof (session?.synthesis?.missing_anchor_count ??
                      session?.synthesis?.missingAnchorCount ??
                      session?.missing_anchor_count) === "number"
                      ? (session?.synthesis?.missing_anchor_count ??
                          session?.synthesis?.missingAnchorCount ??
                          session?.missing_anchor_count)
                      : "—"}
                  </div>

                  {(session?.synthesis?.missing_anchor_terms ??
                    session?.synthesis?.missingAnchorTerms ??
                    session?.missing_anchor_terms)?.length ? (
                    <div>
                      <span className="font-semibold">Missing terms: </span>
                      {(session?.synthesis?.missing_anchor_terms ??
                        session?.synthesis?.missingAnchorTerms ??
                        session?.missing_anchor_terms
                      ).join(", ")}
                    </div>
                  ) : null}
                </div>

                <div className="mt-7">
                  <button
                    type="button"
                    onClick={() => {
                      setSession(null);
                      setSelectedFile(null);
                      setAnswerText("");
                      setError(null);
                      setStep("LANDING");
                    }}
                    className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2"
                    style={{
                      backgroundColor: "rgba(242,242,242,0.10)",
                      color: "#F2F2F2",
                      border: "1px solid rgba(242,242,242,0.16)",
                    }}
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