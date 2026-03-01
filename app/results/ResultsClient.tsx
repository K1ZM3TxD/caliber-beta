"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function fetchResult(calibrationId: string) {
  return fetch(`/api/calibration/result?calibrationId=${encodeURIComponent(calibrationId)}`)
    .then((r) => r.json());
}

export default function ResultsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const calibrationId = searchParams.get("calibrationId");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (!calibrationId) {
      setError("Missing calibration id. Please start over.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetchResult(calibrationId)
      .then((data) => {
        if (!data.ok) {
          setError(data.error?.message || "Unknown error");
          setResult(null);
        } else {
          setResult(data);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Network error. Please retry.");
        setLoading(false);
      });
  }, [calibrationId]);

  if (!calibrationId) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Fit score + summary</h1>
        <p style={{ color: "#B00" }}>Missing calibration id. <button onClick={() => router.push("/")}>Start over</button></p>
      </main>
    );
  }

  if (loading) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Fit score + summary</h1>
        <p>Loading…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Fit score + summary</h1>
        <p style={{ color: "#B00" }}>{error}</p>
        <button onClick={() => { setLoading(true); setError(null); fetchResult(calibrationId).then((data) => { if (!data.ok) { setError(data.error?.message || "Unknown error") } else { setResult(data) } setLoading(false) }).catch(() => { setError("Network error. Please retry."); setLoading(false) }) }}>Retry</button>
        <button style={{ marginLeft: 12 }} onClick={() => router.push("/")}>Start over</button>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, maxWidth: 600, margin: "0 auto" }}>
      <h1 style={{ fontSize: "2em", fontWeight: 700, marginBottom: 16 }}>Fit score + summary</h1>
      <div style={{ marginBottom: 24, textAlign: "center" }}>
        <div style={{ fontSize: "2.5em", fontWeight: 800, color: "#1A1A1A" }}>
          Fit score: {typeof result.score_0_to_10 === "number" ? result.score_0_to_10 : "-"} / 10
        </div>
        <div style={{ marginTop: 18, fontSize: "1.1em", color: "#444" }}>{result.summary}</div>
      </div>
      <div style={{ marginBottom: 24, background: "#F7F7F7", borderRadius: 8, padding: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Inputs:</div>
        {result.jobTitle && <div>Job title: <span style={{ fontWeight: 500 }}>{result.jobTitle}</span></div>}
        {result.jobText && <div>Job description: <span style={{ fontWeight: 500 }}>{result.jobText}</span></div>}
        {result.resumeFilename && <div>Resume: <span style={{ fontWeight: 500 }}>{result.resumeFilename}</span></div>}
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 32 }}>
        <button onClick={() => router.push("/")} style={{ padding: "10px 24px", fontWeight: 600, borderRadius: 6, background: "#EEE" }}>Start over / Re-run</button>
      </div>
    </main>
  );
}
