// app/mock-calibration/page.tsx
"use client";

import React, { useMemo, useRef, useState } from "react";
import { CALIBRATION_PROMPTS } from "@/lib/calibration_prompts";

type Step = "LANDING" | "RESUME" | "PROMPT1";

export default function MockCalibrationPage() {
  const [step, setStep] = useState<Step>("LANDING");
  const [responseText, setResponseText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const hasText = useMemo(() => responseText.trim().length > 0, [responseText]);


  import React, { useRef, useState } from "react";

  // Automated runner for calibration pipeline
  export default function MockCalibrationPage() {
    const [running, setRunning] = useState(false);
    const [log, setLog] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<any>(null);
    const [sessionId, setSessionId] = useState<string>("");
    const [resumeFile, setResumeFile] = useState<File | null>(null);
    const logRef = useRef<HTMLDivElement>(null);

    // Scroll log to bottom on update
    React.useEffect(() => {
      if (logRef.current) {
        logRef.current.scrollTop = logRef.current.scrollHeight;
      }
    }, [log]);

    // Helper to append to log
    function appendLog(msg: string) {
      setLog((prev) => [...prev, msg]);
    }

    // Upload resume and get sessionId
    async function uploadResume(file: File): Promise<string> {
      appendLog("Uploading resume...");
      const formData = new FormData();
      formData.append("resume", file);
      const res = await fetch("/api/calibration/resume-upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Resume upload failed");
      const data = await res.json();
      if (!data.sessionId) throw new Error("No sessionId returned");
      appendLog(`Resume uploaded. sessionId: ${data.sessionId}`);
      return data.sessionId;
    }

    // Post calibration event
    async function postEvent(sessionId: string, event: any) {
      appendLog(`Posting event: ${event.type}`);
      const res = await fetch("/api/calibration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...event, sessionId }),
      });
      if (!res.ok) throw new Error(`Event ${event.type} failed`);
      const data = await res.json();
      appendLog(`Event ${event.type} response: "${data.state}"`);
      return data;
    }

    // Fetch result using sessionId
    async function fetchResult(sessionId: string) {
      appendLog("Fetching result...");
      const res = await fetch(`/api/calibration/result?calibrationId=${sessionId}`);
      if (!res.ok) throw new Error("Result fetch failed");
      const data = await res.json();
      appendLog("Result fetched.");
      return data;
    }

    // Poll for result in terminal states
    async function pollForResult(sessionId: string, maxTries = 10, delayMs = 1500) {
      appendLog("Polling for result...");
      for (let i = 0; i < maxTries; i++) {
        try {
          const res = await fetchResult(sessionId);
          if (res && res.result) {
            appendLog("Result found.");
            return res;
          }
        } catch (e) {
          appendLog(`Result poll error: ${(e as Error).message}`);
        }
        await new Promise((r) => setTimeout(r, delayMs));
      }
      throw new Error("Result not found after polling");
    }

    // Main runner logic
    async function runCalibration() {
      setRunning(true);
      setError(null);
      setLog([]);
      setResult(null);
      try {
        if (!resumeFile) throw new Error("No resume file selected");
        // Step 1: Upload resume
        const sid = await uploadResume(resumeFile);
        setSessionId(sid);

        // Step 2: Post initial event (START)
        let session = await postEvent(sid, { type: "START" });

        // Step 3: Post JOB_TEXT event
        session = await postEvent(sid, { type: "JOB_TEXT", jobText: "Senior Software Engineer" });

        // Step 4: Advance until terminal state or max steps
        let steps = 0;
        const maxSteps = 12;
        while (steps < maxSteps) {
          steps++;
          // If session.state is ALIGNMENT_OUTPUT, poll for result
          if (session.state === "ALIGNMENT_OUTPUT") {
            appendLog("Terminal state ALIGNMENT_OUTPUT reached. Polling for result...");
            const res = await pollForResult(sid);
            setResult(res.result);
            appendLog("Calibration complete.");
            return;
          }
          // If session.result exists, show result
          if (session.result) {
            setResult(session.result);
            appendLog("Calibration complete (result in session).");
            return;
          }
          // Otherwise, advance
          session = await postEvent(sid, { type: "ADVANCE" });
        }
        throw new Error("Max steps exceeded without terminal result");
      } catch (e: any) {
        setError(e.message || "Unknown error");
        appendLog(`ERROR: ${e.message || e}`);
      } finally {
        setRunning(false);
      }
    }

    // UI
    return (
      <div className="fixed inset-0 bg-[#0B0B0B] flex items-center justify-center overflow-hidden">
        <div className="w-full max-w-[720px] px-6">
          <div className="relative min-h-[560px]">
            <div className="h-full w-full flex flex-col items-center justify-center text-center">
              <div className="font-semibold tracking-tight text-4xl mb-2">Calibration Runner</div>
              <div className="mb-6 text-base" style={{ color: "#CFCFCF" }}>
                One-click automated pipeline for backend debugging.
              </div>
              <div className="mb-4">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  disabled={running}
                  onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
                  style={{ color: "#F2F2F2" }}
                />
              </div>
              <button
                type="button"
                disabled={running || !resumeFile}
                onClick={runCalibration}
                className="inline-flex items-center justify-center rounded-md px-5 py-3 text-base font-medium"
                style={{
                  backgroundColor: running || !resumeFile ? "rgba(242,242,242,0.35)" : "#F2F2F2",
                  color: "#0B0B0B",
                  cursor: running || !resumeFile ? "not-allowed" : "pointer",
                  boxShadow: running || !resumeFile ? "none" : "0 8px 20px rgba(0,0,0,0.25)",
                  marginBottom: 24,
                }}
              >
                {running ? "Running..." : "Run Calibration"}
              </button>
              {error && (
                <div className="mb-4 text-red-400 font-mono text-sm">Error: {error}</div>
              )}
              <div
                ref={logRef}
                className="w-full max-w-xl h-48 overflow-y-auto bg-[#181818] rounded-md p-4 text-left text-xs font-mono mb-4"
                style={{ color: "#F2F2F2" }}
              >
                {log.map((l, i) => (
                  <div key={i}>{l}</div>
                ))}
              </div>
              {result && (
                <div className="w-full max-w-xl bg-[#222] rounded-md p-4 text-left text-sm mb-4" style={{ color: "#F2F2F2" }}>
                  <div className="font-semibold mb-2">Calibration Result</div>
                  <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(result, null, 2)}</pre>
                </div>
              )}
              {log.length > 0 && (
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-md px-4 py-2 text-xs font-medium"
                  style={{ backgroundColor: "#F2F2F2", color: "#0B0B0B" }}
                  onClick={() => {
                    navigator.clipboard.writeText(log.join("\n"));
                  }}
                >
                  Copy Debug Log
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }