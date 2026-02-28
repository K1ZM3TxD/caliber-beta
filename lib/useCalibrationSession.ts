import { useState } from "react";

export type CalibrationPhase = "LANDING" | "RESUME_INGEST" | "CONFIRMATION";

export interface CalibrationSession {
  sessionId?: string;
  phase: CalibrationPhase;
  error?: string;
}

export function useCalibrationSession() {
  const [session, setSession] = useState<CalibrationSession>({ phase: "LANDING" });
  const [isLoading, setIsLoading] = useState(false);

  const beginSession = async () => {
    setIsLoading(true);
    setSession((prev) => ({ ...prev, error: undefined }));
    try {
      const res = await fetch("/api/calibration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: { type: "CREATE_SESSION" } }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        const code = json?.error?.code ?? "REQUEST_FAILED";
        const message = json?.error?.message ?? `Request failed (${res.status})`;
        throw new Error(`${code}: ${message}`);
      }
      const sessionId = String(json?.session?.sessionId ?? "");
      setSession({ sessionId, phase: "RESUME_INGEST" });
    } catch (err: any) {
      setSession((prev) => ({ ...prev, error: err.message }));
    } finally {
      setIsLoading(false);
    }
  };

  const uploadResume = async (file: File) => {
    if (!session.sessionId) {
      setSession((prev) => ({ ...prev, error: "Missing sessionId (session not created)." }));
      return;
    }
    setIsLoading(true);
    setSession((prev) => ({ ...prev, error: undefined }));
    try {
      const formData = new FormData();
      formData.append("sessionId", session.sessionId);
      formData.append("file", file);
      const res = await fetch("/api/calibration/resume-upload", {
        method: "POST",
        body: formData,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        const code = json?.error?.code ?? "UPLOAD_FAILED";
        const message = json?.error?.message ?? `Upload failed (${res.status})`;
        throw new Error(`${code}: ${message}`);
      }
      setSession((prev) => ({ ...prev, phase: "CONFIRMATION" }));
    } catch (err: any) {
      setSession((prev) => ({ ...prev, error: err.message }));
    } finally {
      setIsLoading(false);
    }
  };

  const resetError = () => {
    setSession((prev) => ({ ...prev, error: undefined }));
  };

  return {
    session,
    isLoading,
    beginSession,
    uploadResume,
    resetError,
  };
}
